import mongoose from "mongoose";
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { generateReel, probeMedia } from "../services/reels/reel-engine.js";
import Reel from "../models/Reel.js";
import { config } from "../config/env.js";
import { logger } from "../utils/logger.js";

async function runReelsSystemTest() {
  console.log("=== ADVENZA REELS SYSTEM INTEGRATION TEST ===");

  await mongoose.connect(config.MONGODB_URI);
  console.log("Connected to MongoDB Atlas");

  const scratchDir = path.resolve("scratch/test_reel_assets");
  if (!fs.existsSync(scratchDir)) fs.mkdirSync(scratchDir, { recursive: true });

  const photo1 = path.join(scratchDir, "paris_eiffel.jpg");
  const photo2 = path.join(scratchDir, "paris_louvre.jpg");

  await sharp({
    create: { width: 1080, height: 1920, channels: 3, background: { r: 24, g: 119, b: 242 } },
  }).jpeg().toFile(photo1);

  await sharp({
    create: { width: 1080, height: 1920, channels: 3, background: { r: 244, g: 63, b: 94 } },
  }).jpeg().toFile(photo2);

  const testUserId = new mongoose.Types.ObjectId();
  const testTripId = new mongoose.Types.ObjectId();

  const reel = await Reel.create({
    userId: testUserId,
    tripId: testTripId,
    memories: [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()],
    template: "cinematic",
    aspectRatio: "9:16",
    resolution: "1080p",
    duration: 6,
    audio: { preset: "summer-acoustic" },
    text: {
      title: "PARIS ADVENTURE 2026",
      subtitle: "Summer Memories in the City of Light",
      position: "bottom",
      style: "cinematic",
    },
    status: "queued",
    stage: "queued",
    progress: 0,
  });

  console.log(`Created test Reel record: ${reel._id}`);

  const result = await generateReel({
    reelId: reel._id.toString(),
    userId: testUserId.toString(),
    tripId: testTripId.toString(),
    memories: [
      { _id: "m1", mediaUrl: photo1, type: "photo" },
      { _id: "m2", mediaUrl: photo2, type: "photo" },
    ],
    template: "cinematic",
    aspectRatio: "9:16",
    resolution: "1080p",
    targetDuration: 6,
    musicPreset: "summer-acoustic",
    textConfig: {
      title: "PARIS ADVENTURE 2026",
      subtitle: "Summer Memories in the City of Light",
      position: "bottom",
      style: "cinematic",
    },
  });

  console.log("Rendered MP4 output:", result);

  const parsedUrl = new URL(result.videoUrl, "http://localhost:5000");
  const localRelative = parsedUrl.pathname.replace(/^\//, "");
  const absolutePath = path.resolve(process.cwd(), localRelative);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Output video file missing from disk: ${absolutePath}`);
  }

  const probe = await probeMedia(absolutePath);
  const videoStream = probe.streams.find((s) => s.codec_type === "video");
  const audioStream = probe.streams.find((s) => s.codec_type === "audio");

  console.log("Video Stream:", {
    codec: videoStream?.codec_name,
    dimensions: `${videoStream?.width}x${videoStream?.height}`,
    pixFmt: videoStream?.pix_fmt,
  });
  console.log("Audio Stream:", {
    codec: audioStream?.codec_name,
    channels: audioStream?.channels,
    sampleRate: audioStream?.sample_rate,
  });

  if (videoStream?.codec_name !== "h264") throw new Error("Expected h264 video codec");
  if (videoStream?.width !== 1080 || videoStream?.height !== 1920) throw new Error("Expected 1080x1920 resolution");
  if (videoStream?.pix_fmt !== "yuv420p") throw new Error("Expected yuv420p pixel format");
  if (audioStream?.codec_name !== "aac") throw new Error("Expected aac audio codec");

  // Cleanup
  await Reel.findByIdAndDelete(reel._id);
  if (fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);
  fs.rmSync(scratchDir, { recursive: true, force: true });
  await mongoose.connection.close();

  console.log("SUCCESS: Real AI Travel Reels System verified end-to-end!");
}

runReelsSystemTest().catch((err) => {
  console.error("Test failed:", err);
  mongoose.connection.close();
  process.exit(1);
});
