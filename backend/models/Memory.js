import mongoose from "mongoose";

export const MEMORY_CATEGORIES = [
  "LANDMARK",
  "FOOD",
  "PEOPLE",
  "NATURE",
  "TRANSPORT",
  "HOTEL",
  "EVENT",
  "CITY",
  "NIGHTLIFE",
  "ADVENTURE",
  "CULTURE",
  "OTHER",
];

const MemorySchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: [true, "userId is required"],
      index: true,
    },
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Trip",
      index: true,
      default: null,
    },
    n: {
      type: Number,
      default: 1,
    },
    place: {
      type: String,
      trim: true,
      default: "",
    },
    date: {
      type: String,
      trim: true,
      default: "",
    },
    weather: {
      type: String,
      trim: true,
      default: "",
    },
    spend: {
      type: Number,
      default: 0,
      min: [0, "Spend cannot be negative"],
    },
    // Media URLs and Storage References — Strictly external URLs (no base64 or raw binaries)
    mediaUrl: {
      type: String,
      required: [true, "mediaUrl is required"],
      trim: true,
      validate: {
        validator: function (v) {
          return !v.startsWith("data:");
        },
        message: "mediaUrl must be a valid external/storage URL, not a base64 data URI.",
      },
    },
    thumbnailUrl: {
      type: String,
      trim: true,
      default: "",
      validate: {
        validator: function (v) {
          return !v || !v.startsWith("data:");
        },
        message: "thumbnailUrl must be a valid external/storage URL, not a base64 data URI.",
      },
    },
    storageKey: {
      type: String,
      required: [true, "storageKey is required"],
      trim: true,
    },
    thumbnailKey: {
      type: String,
      trim: true,
      default: "",
    },
    mediaType: {
      type: String,
      enum: ["image", "video"],
      default: "image",
    },
    // Controlled Category Classification
    category: {
      type: String,
      enum: MEMORY_CATEGORIES,
      default: "OTHER",
      index: true,
    },
    highlight: {
      type: String,
      trim: true,
      default: "",
    },
    caption: {
      type: String,
      trim: true,
      default: "",
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    moments: [
      {
        type: String,
        trim: true,
      },
    ],
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    location: {
      name: { type: String, trim: true, default: "" },
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
    },
    capturedAt: {
      type: Date,
      default: null,
    },
    // AI Curation & Enrichment Metadata
    aiMetadata: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({ status: "PENDING" }),
    },
    // Processing Status Lifecycle
    status: {
      type: String,
      enum: ["uploaded", "processing", "ready", "failed", "deleted"],
      default: "ready",
      index: true,
    },
    // Soft-Delete Support
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

// Compound Indexes tailored for real query patterns
MemorySchema.index({ tripId: 1, isDeleted: 1, createdAt: -1 });
MemorySchema.index({ userId: 1, isDeleted: 1, createdAt: -1 });
MemorySchema.index({ tripId: 1, status: 1 });
MemorySchema.index({ tripId: 1, category: 1 });
MemorySchema.index({ userId: 1, tripId: 1, n: 1 });

// Full-text search index for keyword lookups
MemorySchema.index({ caption: "text", highlight: "text", place: "text", tags: "text" });

export const Memory = mongoose.model("Memory", MemorySchema);
export default Memory;

