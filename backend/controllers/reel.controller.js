import crypto from 'crypto';
import path from 'path';
import Reel from '../models/Reel.js';

import Memory from '../models/Memory.js';
import Trip from '../models/Trip.js';
import { addReelJob } from '../services/queue/reel-queue.js';
import { deleteStoredFile } from '../services/reels/storage.service.js';
import { AUDIO_PRESETS } from '../services/reels/audio-presets.js';
import { logger } from '../utils/logger.js';

/**
 * POST /api/reels
 * Create and enqueue a new reel generation job.
 */
export async function createReel(req, res, next) {
  try {
    const userId = req.uid || req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized: User identity missing.' });
    }
    const {
      tripId,
      memoryIds,
      template = 'cinematic',
      aspectRatio = '9:16',
      resolution = '1080p',
      targetDuration = 15,
      musicPreset = 'lofi-chill',
      customAudioUrl,
      text
    } = req.body;

    // 1. Verify Trip access (owner via createdBy or userId, or collaborator via members)
    const trip = await Trip.findOne({
      _id: tripId,
      $or: [{ createdBy: userId }, { userId }, { 'members.userId': userId }]
    });

    if (!trip) {
      return res.status(404).json({ success: false, message: 'Trip not found or unauthorized' });
    }

    // 2. Fetch Memories
    let memories = [];
    if (Array.isArray(memoryIds) && memoryIds.length > 0) {
      memories = await Memory.find({
        _id: { $in: memoryIds },
        tripId,
        userId
      }).lean();

      if (memories.length === 0) {
        return res.status(400).json({ success: false, message: 'None of the selected memories belong to this trip' });
      }
    } else {
      // Pick up to 8 of the best memories from this trip
      memories = await Memory.find({
        tripId,
        userId
      })
        .sort({ isFavorite: -1, date: -1, createdAt: -1 })
        .limit(8)
        .lean();

      if (memories.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No memories available for this trip. Upload photos or videos first!'
        });
      }
    }

    // 3. Prepare Text Overlay defaults if omitted
    const textConfig = {
      title: text?.title || trip.destination || trip.title || 'Travel Memories',
      subtitle: text?.subtitle || (trip.startDate ? new Date(trip.startDate).getFullYear().toString() : 'Advenza Moments'),
      position: text?.position || 'bottom',
      style: text?.style || 'cinematic'
    };

    // 4. Create Reel document in DB
    const reel = await Reel.create({
      userId,
      tripId,
      memories: memories.map((m) => m._id),
      template,
      aspectRatio,
      resolution,
      duration: targetDuration,
      audio: {
        preset: musicPreset,
        customAudioUrl
      },
      text: textConfig,
      status: 'queued',
      stage: 'queued',
      progress: 0
    });

    // 5. Enqueue background rendering job
    try {
      await addReelJob({
        reelId: reel._id.toString(),
        userId: userId.toString(),
        tripId: tripId.toString(),
        memories: memories.map((m) => ({
          _id: m._id.toString(),
          mediaUrl: m.mediaUrl || m.imageUrl || m.url,
          type: m.type || 'photo'
        })),
        template,
        aspectRatio,
        resolution,
        targetDuration,
        musicPreset,
        customAudioUrl,
        textConfig
      });
    } catch (queueErr) {
      await Reel.findByIdAndUpdate(reel._id, {
        status: 'failed',
        stage: 'failed',
        error: queueErr.message
      });
      return res.status(503).json({
        success: false,
        status: 'NOT_CONFIGURED',
        message: queueErr.message
      });
    }

    logger.info(`Reel creation requested: ${reel._id} by user ${userId}`);

    return res.status(202).json({
      success: true,
      message: 'Reel generation queued',
      reel: {
        id: reel._id,
        status: reel.status,
        stage: reel.stage,
        progress: reel.progress,
        template: reel.template,
        aspectRatio: reel.aspectRatio
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/reels/:id
 * Retrieve reel status, progress, or completed video details.
 */
export async function getReelById(req, res, next) {
  try {
    const userId = req.uid || req.user?._id || req.user?.id;
    const { id } = req.params;

    const reel = await Reel.findOne({
      _id: id,
      userId
    })
      .populate('tripId', 'title destination startDate endDate')
      .populate('memories', 'mediaUrl type date location');

    if (!reel) {
      return res.status(404).json({ success: false, message: 'Reel not found' });
    }

    return res.status(200).json({
      success: true,
      reel
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/reels
 * List reels with optional tripId filter and pagination.
 */
export async function listReels(req, res, next) {
  try {
    const userId = req.uid || req.user?._id || req.user?.id;
    const { tripId, page = 1, limit = 10 } = req.query;

    const query = { userId };
    if (tripId) query.tripId = tripId;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [reels, total] = await Promise.all([
      Reel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('tripId', 'title destination')
        .lean(),
      Reel.countDocuments(query)
    ]);

    return res.status(200).json({
      success: true,
      reels,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/reels/:id
 * Delete a reel and remove its video from storage.
 */
export async function deleteReel(req, res, next) {
  try {
    const userId = req.uid || req.user?._id || req.user?.id;
    const { id } = req.params;

    const reel = await Reel.findOne({ _id: id, userId });
    if (!reel) {
      return res.status(404).json({ success: false, message: 'Reel not found' });
    }

    if (reel.output?.storageKey) {
      await deleteStoredFile(reel.output.storageKey);
    }

    await Reel.deleteOne({ _id: id });

    return res.status(200).json({
      success: true,
      message: 'Reel deleted successfully'
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/reels/:id/share
 * Generate or retrieve share token for public link.
 */
export async function shareReel(req, res, next) {
  try {
    const userId = req.uid || req.user?._id || req.user?.id;
    const { id } = req.params;

    const reel = await Reel.findOne({ _id: id, userId });
    if (!reel) {
      return res.status(404).json({ success: false, message: 'Reel not found' });
    }

    if (!reel.shareToken) {
      reel.shareToken = crypto.randomBytes(16).toString('hex');
    }
    reel.isPublic = true;
    await reel.save();

    return res.status(200).json({
      success: true,
      shareToken: reel.shareToken,
      shareUrl: `/shared/reel/${reel.shareToken}`
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/reels/share/:shareToken
 * Public endpoint to view a shared reel.
 */
export async function getSharedReel(req, res, next) {
  try {
    const { shareToken } = req.params;

    const reel = await Reel.findOne({
      shareToken,
      isPublic: true,
      status: 'completed'
    })
      .populate('tripId', 'title destination')
      .lean();

    if (!reel) {
      return res.status(404).json({ success: false, message: 'Shared reel not found or unavailable' });
    }

    return res.status(200).json({
      success: true,
      reel: {
        id: reel._id,
        videoUrl: reel.output?.videoUrl,
        duration: reel.duration,
        aspectRatio: reel.aspectRatio,
        text: reel.text,
        trip: reel.tripId,
        createdAt: reel.createdAt
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/reels/:id/download
 * Download the completed video file.
 */
export async function downloadReel(req, res, next) {
  try {
    const userId = req.uid || req.user?._id || req.user?.id;
    const { id } = req.params;

    const reel = await Reel.findOne({ _id: id, userId });
    if (!reel) {
      return res.status(404).json({ success: false, message: 'Reel not found' });
    }

    if (reel.status !== 'completed' || !reel.output?.videoUrl) {
      return res.status(400).json({ success: false, message: 'Reel is not ready for download' });
    }

    // If local file, stream directly with attachment header
    if (reel.output.videoUrl.startsWith('/uploads/')) {
      const relativePath = reel.output.videoUrl.replace(/^\//, '');
      const absolutePath = path.resolve(process.cwd(), relativePath);
      return res.download(absolutePath, `advenza_reel_${id}.mp4`);
    }

    // If remote URL, redirect
    return res.redirect(reel.output.videoUrl);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/reels/presets/audio
 * Return royalty-free audio tracks.
 */
export async function getAudioPresetsList(req, res) {
  return res.status(200).json({
    success: true,
    presets: AUDIO_PRESETS
  });
}

