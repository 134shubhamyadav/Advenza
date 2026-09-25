import mongoose from "mongoose";
import crypto from "crypto";

export const COLLAGE_LAYOUTS = ["grid", "hero", "editorial", "masonry", "polaroid"];
export const COLLAGE_ASPECT_RATIOS = ["1:1", "4:5", "3:4", "16:9", "9:16"];
export const COLLAGE_THEMES = ["dark", "light", "warm", "ocean", "sand", "sunset", "blur"];
export const COLLAGE_FORMATS = ["webp", "jpeg", "png"];
export const COLLAGE_STATUSES = ["queued", "processing", "completed", "failed", "deleted"];

const CollageSchema = new mongoose.Schema(
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
        required: true,
      },
    ],
    layout: {
      type: String,
      enum: COLLAGE_LAYOUTS,
      default: "grid",
      index: true,
    },
    aspectRatio: {
      type: String,
      enum: COLLAGE_ASPECT_RATIOS,
      default: "1:1",
      index: true,
    },
    theme: {
      type: String,
      enum: COLLAGE_THEMES,
      default: "dark",
    },
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
    output: {
      storageKey: { type: String, default: "" },
      url: { type: String, default: "" },
      width: { type: Number, default: 0 },
      height: { type: Number, default: 0 },
      format: { type: String, enum: COLLAGE_FORMATS, default: "webp" },
      fileSize: { type: Number, default: 0 },
    },
    status: {
      type: String,
      enum: COLLAGE_STATUSES,
      default: "queued",
      index: true,
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

// Compound indexes for performant timeline and gallery querying
CollageSchema.index({ userId: 1, isDeleted: 1, createdAt: -1 });
CollageSchema.index({ tripId: 1, isDeleted: 1, createdAt: -1 });
CollageSchema.index({ status: 1, createdAt: 1 });

export const Collage = mongoose.model("Collage", CollageSchema);
export default Collage;
