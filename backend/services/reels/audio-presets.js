import path from "path";
import fs from "fs";

export const AUDIO_TRACKS = {
  acoustic_journey: {
    id: "acoustic_journey",
    title: "Acoustic Journey",
    artist: "Advenza Soundscapes",
    genre: "Acoustic Folk",
    bpm: 96,
    mood: "Warm & Sunlit",
    license: "Royalty-Free Creative Commons (Advenza Authorized)",
    // Musical frequencies for synthetic fallback (A-major chord drone with soft pulse)
    synthFormula: "sin(220*2*PI*t)*0.12+sin(277.18*2*PI*t)*0.10+sin(329.63*2*PI*t)*0.09+sin(440*2*PI*t)*0.05",
  },
  lofi_beats: {
    id: "lofi_beats",
    title: "Lo-Fi Travel Beats",
    artist: "Advenza Soundscapes",
    genre: "Chillhop",
    bpm: 82,
    mood: "Relaxed Wanderlust",
    license: "Royalty-Free Creative Commons (Advenza Authorized)",
    synthFormula: "sin(174.61*2*PI*t)*0.14+sin(220*2*PI*t)*0.11+sin(261.63*2*PI*t)*0.09+sin(329.63*2*PI*t)*0.06",
  },
  cinematic_horizons: {
    id: "cinematic_horizons",
    title: "Cinematic Horizons",
    artist: "Advenza Soundscapes",
    genre: "Orchestral Ambient",
    bpm: 74,
    mood: "Epic & Panoramic",
    license: "Royalty-Free Creative Commons (Advenza Authorized)",
    synthFormula: "sin(130.81*2*PI*t)*0.15+sin(196*2*PI*t)*0.12+sin(261.63*2*PI*t)*0.10+sin(392*2*PI*t)*0.07",
  },
  upbeat_adventure: {
    id: "upbeat_adventure",
    title: "Upbeat Adventure",
    artist: "Advenza Soundscapes",
    genre: "Indie Groove",
    bpm: 120,
    mood: "Energetic & Joyful",
    license: "Royalty-Free Creative Commons (Advenza Authorized)",
    synthFormula: "sin(261.63*2*PI*t)*0.13+sin(329.63*2*PI*t)*0.11+sin(392*2*PI*t)*0.10+sin(523.25*2*PI*t)*0.06",
  },
};

/**
 * Returns FFmpeg audio input options for the requested track and duration.
 * If a physical file exists, uses it with trimming and volume fading.
 * Otherwise, generates a clean harmonic ambient musical bed via FFmpeg lavfi.
 */
export function getAudioInputForTrack(trackId, durationSec = 15) {
  const track = AUDIO_TRACKS[trackId] || AUDIO_TRACKS.acoustic_journey;
  const audioDir = path.resolve(process.cwd(), "assets", "audio");
  const localFile = path.join(audioDir, `${track.id}.mp3`);

  if (fs.existsSync(localFile)) {
    return {
      type: "file",
      path: localFile,
      filter: `afade=t=in:st=0:d=1.5,afade=t=out:st=${Math.max(0, durationSec - 2)}:d=2`,
      track,
    };
  }

  // Pure synthetic musical audio bed using FFmpeg lavfi aevalsrc
  const formula = track.synthFormula || AUDIO_TRACKS.acoustic_journey.synthFormula;
  const filterString = `aevalsrc=${formula}:s=44100:d=${durationSec},afade=t=in:st=0:d=1.5,afade=t=out:st=${Math.max(0, durationSec - 2)}:d=2,volume=1.2`;

  return {
    type: "lavfi",
    inputString: filterString,
    track,
  };
}

export const AUDIO_PRESETS = Object.values(AUDIO_TRACKS).map((t) => ({
  id: t.id,
  title: t.title,
  artist: t.artist,
  genre: t.genre,
  bpm: t.bpm,
  mood: t.mood,
}));

export function getAudioTrackConfig(presetId, duration = 15) {
  const normId = (presetId || "").replace(/-/g, "_");
  const track = AUDIO_TRACKS[normId] || AUDIO_TRACKS.lofi_beats || AUDIO_TRACKS.acoustic_journey;
  const audioDir = path.resolve(process.cwd(), "assets", "audio");
  const localFile = path.join(audioDir, `${track.id}.mp3`);

  return {
    localFile: fs.existsSync(localFile) ? localFile : null,
    syntheticLavfi: `aevalsrc=${track.synthFormula || "sin(220*2*PI*t)*0.1"}:s=44100:d=${duration}`,
    track
  };
}

export default AUDIO_TRACKS;

