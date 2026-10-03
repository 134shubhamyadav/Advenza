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

export const MediaItemSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: [true, "Media URL is required"],
      trim: true,
      validate: {
        validator: function (v) {
          return !v || !v.startsWith("data:");
        },
        message: "media url must be a valid external/storage URL, not a base64 data URI.",
      },
    },
    publicId: {
      type: String,
      trim: true,
      default: "",
    },
    resourceType: {
      type: String,
      enum: ["image", "video"],
      default: "image",
    },
    format: {
      type: String,
      trim: true,
      default: "",
    },
    width: {
      type: Number,
      default: 0,
    },
    height: {
      type: Number,
      default: 0,
    },
    duration: {
      type: Number,
      default: 0,
    },
    originalName: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { _id: true }
);

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
    // Multi-Media Support: Up to 10 photos/videos per Memory
    media: {
      type: [MediaItemSchema],
      validate: [
        {
          validator: function (arr) {
            return !arr || arr.length <= 10;
          },
          message: "A single memory can contain at most 10 media items.",
        },
      ],
      default: [],
    },
    // Legacy single media fields for full backwards compatibility
    mediaUrl: {
      type: String,
      trim: true,
      default: "",
      validate: {
        validator: function (v) {
          return !v || !v.startsWith("data:");
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
      trim: true,
      default: "",
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

// Automatic sync between media array and legacy single media fields
MemorySchema.pre("validate", function () {
  if (this.media && this.media.length > 0) {
    if (!this.mediaUrl && this.media[0]?.url) {
      this.mediaUrl = this.media[0].url;
    }
    if (!this.storageKey && this.media[0]?.publicId) {
      this.storageKey = this.media[0].publicId;
    }
    if (!this.mediaType && this.media[0]?.resourceType) {
      this.mediaType = this.media[0].resourceType;
    }
  } else if (this.mediaUrl && (!this.media || this.media.length === 0)) {
    this.media = [
      {
        url: this.mediaUrl,
        publicId: this.storageKey || "",
        resourceType: this.mediaType || "image",
      },
    ];
  }
});

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
