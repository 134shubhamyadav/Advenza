import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { logger } from '../../utils/logger.js';
import { downloadMediaFile, createReelWorkDir, cleanupWorkDir, uploadReelVideo } from './storage.service.js';
import { getAudioTrackConfig } from './audio-presets.js';

ffmpeg.setFfmpegPath(ffmpegStatic);
ffmpeg.setFfprobePath(ffprobeStatic.path);

const RESOLUTION_MAP = {
  '9:16': {
    '1080p': { width: 1080, height: 1920 },
    '720p': { width: 720, height: 1280 }
  },
  '16:9': {
    '1080p': { width: 1920, height: 1080 },
    '720p': { width: 1280, height: 720 }
  },
  '1:1': {
    '1080p': { width: 1080, height: 1080 },
    '720p': { width: 720, height: 720 }
  }
};

/**
 * Probe a media file to inspect streams and duration.
 */
export const probeMedia = (filePath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata);
    });
  });
};

/**
 * Generate an SVG title card overlay and render it to a transparent PNG.
 */
async function generateTitleOverlayPng({
  title,
  subtitle,
  position = 'bottom',
  style = 'cinematic',
  width,
  height,
  outputPath
}) {
  const safeTitle = (title || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').toUpperCase();
  const safeSub = (subtitle || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const cardWidth = Math.min(width * 0.82, 860);
  const cardHeight = safeSub ? 160 : 110;
  const cardX = (width - cardWidth) / 2;

  let cardY = height - cardHeight - (height * 0.12);
  if (position === 'top') {
    cardY = height * 0.08;
  } else if (position === 'center') {
    cardY = (height - cardHeight) / 2;
  }

  const titleY = cardY + 54;
  const subY = cardY + 115;
  const titleFontSize = width > 1000 ? 38 : 30;
  const subFontSize = width > 1000 ? 22 : 18;

  let bgFill = 'rgba(15, 23, 42, 0.72)';
  let strokeColor = 'rgba(255, 255, 255, 0.22)';
  let accentBar = '<rect x="' + (cardX + 24) + '" y="' + (cardY + 28) + '" width="4" height="' + (cardHeight - 56) + '" rx="2" fill="#38bdf8"/>';

  if (style === 'minimal') {
    bgFill = 'rgba(0, 0, 0, 0.55)';
    strokeColor = 'rgba(255, 255, 255, 0.12)';
    accentBar = '';
  } else if (style === 'vintage') {
    bgFill = 'rgba(38, 28, 20, 0.78)';
    strokeColor = 'rgba(245, 158, 11, 0.35)';
    accentBar = '<rect x="' + (cardX + 24) + '" y="' + (cardY + 28) + '" width="4" height="' + (cardHeight - 56) + '" rx="2" fill="#f59e0b"/>';
  } else if (style === 'bold') {
    bgFill = 'rgba(17, 24, 39, 0.85)';
    strokeColor = 'rgba(168, 85, 247, 0.4)';
    accentBar = '<rect x="' + (cardX + 24) + '" y="' + (cardY + 28) + '" width="5" height="' + (cardHeight - 56) + '" rx="2" fill="#a855f7"/>';
  }

  const textStartX = accentBar ? cardX + 46 : cardX + 32;

  const svg = `
  <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="shadow" x="-5%" y="-10%" width="110%" height="130%">
        <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="rgba(0,0,0,0.6)"/>
      </filter>
    </defs>
    <rect x="${cardX}" y="${cardY}" width="${cardWidth}" height="${cardHeight}" rx="24" fill="${bgFill}" stroke="${strokeColor}" stroke-width="1.5" filter="url(#shadow)"/>
    ${accentBar}
    <text x="${textStartX}" y="${titleY}" font-family="Arial, -apple-system, Roboto, sans-serif" font-size="${titleFontSize}" font-weight="800" fill="#ffffff" letter-spacing="1.5">
      ${safeTitle}
    </text>
    ${safeSub ? `
    <text x="${textStartX}" y="${subY}" font-family="Arial, -apple-system, Roboto, sans-serif" font-size="${subFontSize}" font-weight="500" fill="#cbd5e1" letter-spacing="0.5">
      ${safeSub}
    </text>
    ` : ''}
  </svg>
  `;

  await sharp(Buffer.from(svg)).png().toFile(outputPath);
  return outputPath;
}

/**
 * Standardize an image or video clip into a target MP4 segment.
 */
async function processClipToSegment({
  inputPath,
  outputPath,
  duration,
  width,
  height,
  fps = 30,
  template = 'cinematic',
  hasAudio = false
}) {
  return new Promise((resolve, reject) => {
    const isVideo = hasAudio || /\.(mp4|mov|webm|mkv|avi)$/i.test(inputPath);

    const fadeDuration = template === 'fast-paced' ? 0.2 : 0.4;
    const fadeOutStart = Math.max(0, duration - fadeDuration);

    const videoFilters = [
      `scale=${width}:${height}:force_original_aspect_ratio=increase`,
      `crop=${width}:${height}`,
      `fade=t=in:st=0:d=${fadeDuration}`,
      `fade=t=out:st=${fadeOutStart}:d=${fadeDuration}`
    ];

    const cmd = ffmpeg();

    if (isVideo) {
      cmd.input(inputPath);
      cmd.duration(duration);
    } else {
      cmd.input(inputPath).loop(duration);
    }

    cmd
      .outputOptions([
        '-c:v libx264',
        `-t ${duration}`,
        '-pix_fmt yuv420p',
        `-r ${fps}`,
        `-vf ${videoFilters.join(',')}`,
        '-preset fast'
      ])
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', (err) => {
        logger.error(`Error processing clip ${inputPath}:`, err);
        reject(err);
      });

    cmd.run();
  });
}

/**
 * Main Reel Generation Engine
 */
export async function generateReel({
  reelId,
  userId,
  tripId,
  memories = [],
  template = 'cinematic',
  aspectRatio = '9:16',
  resolution = '1080p',
  targetDuration = 15,
  musicPreset = 'lofi-chill',
  customAudioUrl = null,
  textConfig = {},
  onProgress = () => {}
}) {
  const startTime = Date.now();
  const workDir = createReelWorkDir(reelId);
  const clipsDir = path.join(workDir, 'clips');
  fs.mkdirSync(clipsDir, { recursive: true });

  try {
    onProgress({ percent: 5, stage: 'initializing', message: 'Setting up media pipeline' });

    const targetDimensions = RESOLUTION_MAP[aspectRatio]?.[resolution] || { width: 1080, height: 1920 };
    const { width, height } = targetDimensions;

    if (!memories || memories.length === 0) {
      throw new Error('No memories provided for reel generation');
    }

    // 1. Download media files
    onProgress({ percent: 12, stage: 'downloading', message: `Downloading ${memories.length} memories` });
    const localMediaFiles = [];

    for (let i = 0; i < memories.length; i++) {
      const mem = memories[i];
      const mediaUrl = mem.mediaUrl || mem.imageUrl || mem.url;
      if (!mediaUrl) continue;

      const ext = path.extname(new URL(mediaUrl, 'http://localhost').pathname) || '.jpg';
      const destPath = path.join(workDir, `input_${i}${ext}`);

      try {
        await downloadMediaFile(mediaUrl, destPath);
        localMediaFiles.push({
          path: destPath,
          type: mem.type || (ext.match(/\.(mp4|mov|webm)$/i) ? 'video' : 'photo'),
          memoryId: mem._id || mem.id
        });
      } catch (err) {
        logger.warn(`Failed to download memory ${mem._id || i}:`, err.message);
      }
    }

    if (localMediaFiles.length === 0) {
      throw new Error('Could not download any valid media assets for reel');
    }

    // 2. Calculate clip durations
    const numClips = localMediaFiles.length;
    let clipDuration = targetDuration / numClips;
    if (template === 'fast-paced') {
      clipDuration = Math.min(2.5, Math.max(1.5, clipDuration));
    } else {
      clipDuration = Math.min(6.0, Math.max(2.5, clipDuration));
    }
    const totalDuration = clipDuration * numClips;

    // 3. Process each clip to standardized segment
    const segmentPaths = [];
    for (let i = 0; i < localMediaFiles.length; i++) {
      const percent = 20 + Math.floor(((i + 1) / numClips) * 35);
      onProgress({
        percent,
        stage: 'processing_clips',
        message: `Rendering clip ${i + 1} of ${numClips}`
      });

      const segmentPath = path.join(clipsDir, `seg_${String(i).padStart(3, '0')}.mp4`);
      await processClipToSegment({
        inputPath: localMediaFiles[i].path,
        outputPath: segmentPath,
        duration: clipDuration,
        width,
        height,
        fps: 30,
        template,
        hasAudio: localMediaFiles[i].type === 'video'
      });
      segmentPaths.push(segmentPath);
    }

    // 4. Concatenate segments
    onProgress({ percent: 60, stage: 'assembling', message: 'Concatenating video sequence' });
    const concatListFile = path.join(workDir, 'concat_list.txt');
    const concatContent = segmentPaths.map((p) => `file '${p.replace(/\\/g, '/')}'`).join('\n') + '\n';
    fs.writeFileSync(concatListFile, concatContent);

    const mergedVideoPath = path.join(workDir, 'merged_raw.mp4');
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(concatListFile)
        .inputOptions(['-f concat', '-safe 0'])
        .outputOptions(['-c copy'])
        .output(mergedVideoPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    // 5. Title Card Overlay (if requested)
    let overlayPngPath = null;
    if (textConfig?.title) {
      onProgress({ percent: 70, stage: 'overlays', message: 'Designing title overlays' });
      overlayPngPath = path.join(workDir, 'overlay.png');
      await generateTitleOverlayPng({
        title: textConfig.title,
        subtitle: textConfig.subtitle,
        position: textConfig.position || 'bottom',
        style: textConfig.style || 'cinematic',
        width,
        height,
        outputPath: overlayPngPath
      });
    }

    // 6. Audio Track Setup
    onProgress({ percent: 78, stage: 'audio', message: 'Scoring background music and audio' });
    const audioConfig = getAudioTrackConfig(musicPreset);
    let audioInput = audioConfig.syntheticLavfi;
    let isLavfiAudio = true;

    if (customAudioUrl) {
      const customAudioPath = path.join(workDir, 'custom_audio.mp3');
      try {
        await downloadMediaFile(customAudioUrl, customAudioPath);
        audioInput = customAudioPath;
        isLavfiAudio = false;
      } catch (e) {
        logger.warn('Failed to download custom audio, using fallback preset');
      }
    } else if (audioConfig.localFile && fs.existsSync(audioConfig.localFile)) {
      audioInput = audioConfig.localFile;
      isLavfiAudio = false;
    }

    // 7. Final Composite & Encoding
    onProgress({ percent: 84, stage: 'encoding', message: 'Final video composition and encoding' });
    const finalMp4Path = path.join(workDir, `reel_${reelId}.mp4`);

    await new Promise((resolve, reject) => {
      const cmd = ffmpeg().input(mergedVideoPath);

      const complexFilters = [];
      let videoMap = '0:v';

      if (overlayPngPath && fs.existsSync(overlayPngPath)) {
        cmd.input(overlayPngPath);
        const titleDur = Math.min(4.0, totalDuration - 0.5);
        complexFilters.push(`[1:v]format=rgba,fade=t=in:st=0.3:d=0.4:alpha=1,fade=t=out:st=${titleDur - 0.4}:d=0.4:alpha=1[ovl]`);
        complexFilters.push(`[0:v][ovl]overlay=0:0:enable='between(t,0,${titleDur})'[vout]`);
        videoMap = '[vout]';
      }

      // Audio input
      const audioInputIndex = overlayPngPath ? 2 : 1;
      cmd.input(audioInput);
      if (isLavfiAudio) {
        cmd.inputFormat('lavfi');
      }

      const audioFadeOutStart = Math.max(0, totalDuration - 1.5);
      complexFilters.push(`[${audioInputIndex}:a]volume=0.75,afade=t=in:ss=0:d=0.8,afade=t=out:st=${audioFadeOutStart}:d=1.5[aout]`);

      cmd
        .complexFilter(complexFilters)
        .outputOptions([
          `-map ${videoMap}`,
          '-map [aout]',
          '-c:v libx264',
          '-preset fast',
          '-crf 23',
          '-pix_fmt yuv420p',
          '-c:a aac',
          '-b:a 192k',
          `-t ${totalDuration}`,
          '-movflags +faststart'
        ])
        .output(finalMp4Path)
        .on('progress', (prog) => {
          if (prog?.percent) {
            const scaled = 84 + Math.floor(prog.percent * 0.1);
            onProgress({ percent: Math.min(94, scaled), stage: 'encoding', message: 'Encoding H.264 MP4' });
          }
        })
        .on('end', resolve)
        .on('error', (err) => {
          logger.error('Final encoding error:', err);
          reject(err);
        });

      cmd.run();
    });

    // 8. Upload to storage
    onProgress({ percent: 95, stage: 'uploading', message: 'Saving video to storage' });
    const stats = fs.statSync(finalMp4Path);
    const uploadResult = await uploadReelVideo({
      filePath: finalMp4Path,
      userId,
      reelId,
      filename: `reel_${reelId}.mp4`
    });

    const elapsedMs = Date.now() - startTime;
    onProgress({ percent: 100, stage: 'completed', message: 'Reel ready!' });

    return {
      success: true,
      videoUrl: uploadResult.url,
      storageKey: uploadResult.key,
      duration: totalDuration,
      aspectRatio,
      resolution,
      fileSizeBytes: stats.size,
      renderTimeMs: elapsedMs,
      clipCount: localMediaFiles.length
    };
  } finally {
    // Clean up temporary workspace directory
    try {
      cleanupWorkDir(workDir);
    } catch (cleanupErr) {
      logger.warn('Failed to cleanup reel work directory:', cleanupErr.message);
    }
  }
}
