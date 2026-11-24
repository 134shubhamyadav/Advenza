import { z } from "zod";

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

export const mediaItemSchema = z.object({
  url: z.string().trim().min(1, "Media url is required").refine(
    (url) => !url.startsWith("data:"),
    { message: "Media url must be an external/Cloudinary URL, not base64 data" }
  ),
  publicId: z.string().trim().optional().default(""),
  resourceType: z.enum(["image", "video"]).default("image"),
  format: z.string().trim().optional().default(""),
  width: z.coerce.number().optional().default(0),
  height: z.coerce.number().optional().default(0),
  duration: z.coerce.number().optional().default(0),
  originalName: z.string().trim().optional().default(""),
});

export const createMemorySchema = z.object({
  tripId: z.string().trim().optional(),
  // Multi-media array (max 10 files)
  media: z.array(mediaItemSchema).max(10, "A memory can contain at most 10 media files").optional(),
  // Legacy single-media fields (supported for backward compatibility)
  mediaUrl: z.string().trim().refine(
    (url) => !url || !url.startsWith("data:"),
    { message: "mediaUrl must be a stored object URL, not base64 data" }
  ).optional(),
  thumbnailUrl: z.string().trim().optional(),
  storageKey: z.string().trim().optional(),
  thumbnailKey: z.string().trim().optional(),
  mediaType: z.enum(["image", "video"]).default("image"),
  category: z.enum(MEMORY_CATEGORIES).default("OTHER"),
  place: z.string().trim().default(""),
  date: z.string().trim().default(""),
  weather: z.string().trim().default(""),
  spend: z.coerce.number().min(0).default(0),
  highlight: z.string().trim().default(""),
  caption: z.string().trim().default(""),
  description: z.string().trim().default(""),
  moments: z.array(z.string().trim()).default([]),
  tags: z.array(z.string().trim()).default([]),
  n: z.coerce.number().default(1),
  location: z.object({
    name: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
  }).optional(),
  capturedAt: z.string().optional(),
  aiMetadata: z.record(z.any()).optional(),
  status: z.enum(["uploaded", "processing", "ready", "failed", "deleted"]).default("ready"),
}).refine(
  (data) => {
    if (data.media && data.media.length > 0) return true;
    if (data.mediaUrl && data.storageKey) return true;
    return false;
  },
  { message: "Either a media array or both mediaUrl and storageKey are required to create a memory." }
);

export const updateMemorySchema = z.object({
  place: z.string().trim().optional(),
  date: z.string().trim().optional(),
  weather: z.string().trim().optional(),
  spend: z.coerce.number().min(0).optional(),
  highlight: z.string().trim().optional(),
  caption: z.string().trim().optional(),
  description: z.string().trim().optional(),
  category: z.enum(MEMORY_CATEGORIES).optional(),
  moments: z.array(z.string().trim()).optional(),
  tags: z.array(z.string().trim()).optional(),
  media: z.array(mediaItemSchema).max(10, "A memory can contain at most 10 media files").optional(),
  location: z.object({
    name: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
  }).optional(),
  capturedAt: z.string().optional(),
  thumbnailKey: z.string().trim().optional(),
  thumbnailUrl: z.string().trim().optional(),
  aiMetadata: z.record(z.any()).optional(),
  status: z.enum(["uploaded", "processing", "ready", "failed", "deleted"]).optional(),
  n: z.coerce.number().optional(),
});

export const curateCollageSchema = z.object({
  tripId: z.string().trim().optional(),
  targetCount: z.coerce.number().min(3).max(20).default(6),
  style: z.string().trim().default("HIGHLIGHTS"),
});

export const listMemoriesQuerySchema = z.object({
  tripId: z.string().trim().optional(),
  category: z.enum(MEMORY_CATEGORIES).optional(),
  search: z.string().trim().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  cursor: z.string().trim().optional(),
  paginate: z.string().optional(),
  status: z.string().optional(),
});

export const migrateMemoriesSchema = z.object({
  memories: z.array(
    z.object({
      tripId: z.string().optional(),
      place: z.string().optional(),
      date: z.string().optional(),
      weather: z.string().optional(),
      spend: z.coerce.number().optional(),
      photo: z.string().optional(),
      mediaUrl: z.string().optional(),
      media: z.array(mediaItemSchema).optional(),
      highlight: z.string().optional(),
      moments: z.array(z.string()).optional(),
      category: z.string().optional(),
      n: z.coerce.number().optional(),
    })
  ).min(1, "At least one memory required for migration"),
});

// AI Structured Output Schema for Collage Curation
export const CurateCollageOutputSchema = z.object({
  themeTitle: z.string().default("Highlights of the Journey"),
  collageLayoutTip: z.string().default("Grid layout with balanced landmarks and scenery"),
  selectedMemories: z.array(
    z.object({
      memoryId: z.string(),
      reason: z.string(),
    })
  ).min(1, "Must select at least one memory"),
  excludedMemories: z.array(
    z.object({
      memoryId: z.string(),
      reason: z.string(),
    })
  ).default([]),
});

// Photo-Aware AI Caption Generation Schema
export const generateCaptionsSchema = z
  .object({
    memoryId: z.string().trim().optional(),
    imageUrls: z.array(z.string().trim().min(1)).optional().default([]),
    place: z.string().trim().optional().default(""),
    highlight: z.string().trim().optional().default(""),
    caption: z.string().trim().optional().default(""),
    date: z.string().trim().optional().default(""),
    category: z.string().trim().optional().default(""),
    tonePreference: z.string().trim().optional().default(""),
  })
  .refine(
    (data) => Boolean(data.memoryId || (data.imageUrls && data.imageUrls.length > 0)),
    { message: "Either memoryId or at least one imageUrl is required for photo-aware caption generation" }
  );

export const PhotoAwareCaptionsOutputSchema = z.object({
  visualSummary: z.string().default("Visual highlights from the travel memory"),
  captions: z
    .array(
      z.object({
        id: z.string(),
        style: z.string(),
        tag: z.string(),
        caption: z.string(),
        focus: z.string().optional().default(""),
      })
    )
    .min(8, "At least 8 diverse captions are required"),
});

