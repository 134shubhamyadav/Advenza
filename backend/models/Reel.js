import mongoose from "mongoose";
import crypto from "crypto";

export const REEL_TEMPLATES = [
  "cinematic",
  "travel_diary",
  "fast-paced",
  "polaroid-memories",
  "wanderlust",
  "minimal",
  "adventure",
  "photo_story",
];

export const REEL_ASPECT_RATIOS = ["9:16", "1:1", "4:5", "16:9"];
export const REEL_AUDIO_SOURCES = ["music", "original", "mixed", "none"];
export const REEL_STATUSES = [
  "queued",
  "processing",
  "completed",
  "failed",
  "cancelled",
  "deleted",
];

const ReelSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: [true, "userId is required"],
      index: true,
    },
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Trip",
      required: [true, "tripId is required"],
      index: true,
    },
    memoryIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Memory",
      },
    ],
    memories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Memory",
      },
    ],
    template: {
      type: String,
      enum: REEL_TEMPLATES,
      default: "cinematic",
      index: true,
    },
    aspectRatio: {
      type: String,
      enum: REEL_ASPECT_RATIOS,
      default: "9:16",
      index: true,
    },
    resolution: {
      type: String,
      default: "1080p",
    },
    duration: {
      type: Number,
      min: 3,
      max: 180,
      default: 15,
    },
    audio: {
      source: {
        type: String,
        default: "music",
      },
      trackId: {
        type: String,
        default: "lofi-chill",
      },
      preset: {
        type: String,
        default: "lofi-chill",
      },
      customAudioUrl: {
        type: String,
        default: "",
      },
      storageKey: {
        type: String,
        default: "",
      },
      duration: {
        type: Number,
        default: 0,
      },
    },
    text: {
      title: {
        type: String,
        trim: true,
        default: "",
        maxlength: [100, "Title cannot exceed 100 characters"],
      },
      subtitle: {
        type: String,
        trim: true,
        default: "",
        maxlength: [120, "Subtitle cannot exceed 120 characters"],
      },
      position: {
        type: String,
        enum: ["top", "center", "bottom"],
        default: "bottom",
      },
      style: {
        type: String,
        enum: ["cinematic", "bold", "minimal", "vintage"],
        default: "cinematic",
      },
      showCaptions: {
        type: Boolean,
        default: true,
      },
    },
    output: {
      storageKey: { type: String, default: "" },
      url: { type: String, default: "" },
      videoUrl: { type: String, default: "" },
      format: { type: String, default: "mp4" },
      width: { type: Number, default: 1080 },
      height: { type: Number, default: 1920 },
      duration: { type: Number, default: 0 },
      fileSize: { type: Number, default: 0 },
      fileSizeBytes: { type: Number, default: 0 },
      renderTimeMs: { type: Number, default: 0 },
    },

    status: {
      type: String,
      enum: REEL_STATUSES,
      default: "queued",
      index: true,
    },
    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    stage: {
      type: String,
      default: "Queued",
    },
    jobId: {
      type: String,
      default: null,
    },
    error: {
      type: String,
      default: null,
    },
    shareToken: {
      type: String,
      default: () => crypto.randomBytes(16).toString("hex"),
      unique: true,
      sparse: true,
      index: true,
    },
    shareAccess: {
      type: String,
      enum: ["private", "shared"],
      default: "private",
      index: true,
    },
    processingTimeMs: {
      type: Number,
      default: 0,
    },
    retryCount: {
      type: Number,
      default: 0,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for user gallery and trip reel queries
ReelSchema.index({ userId: 1, isDeleted: 1, createdAt: -1 });
ReelSchema.index({ tripId: 1, isDeleted: 1, createdAt: -1 });
ReelSchema.index({ status: 1, createdAt: 1 });

export const Reel = mongoose.model("Reel", ReelSchema);
export default Reel;
