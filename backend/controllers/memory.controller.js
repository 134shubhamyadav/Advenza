import mongoose from "mongoose";
import Memory from "../models/Memory.js";
import Trip from "../models/Trip.js";
import { memoryAiService } from "../services/ai/memory-ai.service.js";
import { cloudinaryService } from "../services/storage/cloudinary.service.js";
import { memoryStorageService } from "../services/storage/memory-storage.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { NotFoundError, ForbiddenError, ValidationError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

async function verifyTripAccess(tripId, uid) {
  if (!tripId || tripId === "NONE") return { allowed: true };
  const trip = await Trip.findById(tripId).lean();
  if (!trip) {
    return { allowed: false, status: 404, error: "Referenced trip not found" };
  }
  const isOwner = String(trip.createdBy) === String(uid);
  const isMember = Array.isArray(trip.members) && trip.members.some((m) => m.userId === uid || m.email === uid);
  if (!isOwner && !isMember) {
    return { allowed: false, status: 403, error: "Access denied to referenced trip" };
  }
  return { allowed: true, trip };
}

export const listMemories = asyncHandler(async (req, res) => {
  const { tripId, category, search, limit, cursor, status, paginate } = req.query;

  const filter = {
    userId: req.uid,
    isDeleted: false,
  };

  if (status) {
    filter.status = status;
  } else {
    filter.status = { $ne: "deleted" };
  }

  if (category) {
    filter.category = category;
  }

  if (search && typeof search === "string" && search.trim()) {
    const term = search.trim();
    const searchRegex = new RegExp(term, "i");
    filter.$or = [
      { caption: searchRegex },
      { highlight: searchRegex },
      { place: searchRegex },
      { tags: searchRegex },
      { "aiMetadata.tags": searchRegex },
      { "aiMetadata.description": searchRegex },
    ];
  }

  if (tripId && tripId !== "ALL") {
    const access = await verifyTripAccess(tripId, req.uid);
    if (!access.allowed) {
      if (access.status === 404) throw new NotFoundError(access.error);
      throw new ForbiddenError(access.error);
    }
    filter.tripId = tripId;
  }

  // Check if cursor-based pagination is explicitly requested
  const isPaginated = Boolean(cursor || limit || paginate === "true");
  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 30, 1), 100);

  if (cursor) {
    const cursorDate = new Date(cursor);
    if (!isNaN(cursorDate.getTime())) {
      filter.createdAt = { $lt: cursorDate };
    }
  }

  const sortOrder = tripId && tripId !== "ALL" ? { n: 1, createdAt: -1 } : { createdAt: -1 };

  if (isPaginated) {
    const items = await Memory.find(filter)
      .sort(sortOrder)
      .limit(parsedLimit + 1)
      .lean();

    const hasMore = items.length > parsedLimit;
    const paginatedItems = hasMore ? items.slice(0, parsedLimit) : items;
    const nextCursor =
      hasMore && paginatedItems.length > 0
        ? paginatedItems[paginatedItems.length - 1].createdAt?.toISOString()
        : null;

    return res.json({
      memories: paginatedItems,
      nextCursor,
      hasMore,
      count: paginatedItems.length,
    });
  }

  // Legacy direct array response for full backwards compatibility
  const memories = await Memory.find(filter).sort(sortOrder).lean();
  res.json(memories);
});

export const getMemoryById = asyncHandler(async (req, res) => {
  const memory = await Memory.findOne({ _id: req.params.id, userId: req.uid, isDeleted: false }).lean();
  if (!memory) {
    throw new NotFoundError("Memory not found or access denied");
  }
  res.json(memory);
});

export const getSharedMemory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    throw new NotFoundError("Memory not found");
  }

  const memory = await Memory.findOne({
    _id: id,
    isDeleted: false,
    status: { $ne: "deleted" },
  }).lean();

  if (!memory) {
    throw new NotFoundError("Memory not found or no longer available");
  }

  // Return a safe, sanitized public payload without exposing userId or private user account metadata
  const publicData = {
    _id: memory._id,
    place: memory.place || "Travel Memory",
    date: memory.date || "",
    weather: memory.weather || "",
    highlight: memory.highlight || "",
    caption: memory.caption || "",
    description: memory.description || "",
    category: memory.category || "OTHER",
    media: Array.isArray(memory.media) && memory.media.length > 0
      ? memory.media
      : (memory.mediaUrl ? [{ url: memory.mediaUrl, resourceType: memory.mediaType || "image" }] : []),
    location: memory.location || null,
    moments: memory.moments || [],
    createdAt: memory.createdAt,
  };

  res.json(publicData);
});

export const createMemory = asyncHandler(async (req, res) => {
  const {
    tripId,
    media = [],
    mediaUrl,
    thumbnailUrl,
    storageKey,
    thumbnailKey = "",
    mediaType = "image",
    category = "OTHER",
    place = "",
    date = "",
    weather = "",
    spend = 0,
    highlight = "",
    caption = "",
    description = "",
    moments = [],
    tags = [],
    location,
    capturedAt,
    aiMetadata = {},
    status = "ready",
    n = 1,
  } = req.body;

  // Validate media count (max 10 media files per Memory)
  if (Array.isArray(media) && media.length > 10) {
    throw new ValidationError("Maximum 10 media files are allowed per Memory.");
  }

  // Normalize media items array
  let finalMedia = [];
  if (Array.isArray(media) && media.length > 0) {
    finalMedia = media.map((item) => ({
      url: String(item.url || "").trim(),
      publicId: String(item.publicId || "").trim(),
      resourceType: item.resourceType === "video" ? "video" : "image",
      format: String(item.format || "").trim(),
      width: Number(item.width) || 0,
      height: Number(item.height) || 0,
      duration: Number(item.duration) || 0,
      originalName: String(item.originalName || "").trim(),
    }));
  } else if (mediaUrl && typeof mediaUrl === "string" && mediaUrl.trim()) {
    finalMedia = [
      {
        url: mediaUrl.trim(),
        publicId: storageKey || "",
        resourceType: mediaType === "video" ? "video" : "image",
        format: "",
        width: 0,
        height: 0,
        duration: 0,
        originalName: "",
      },
    ];
  }

  if (finalMedia.length === 0) {
    throw new ValidationError("At least one media file is required to create a memory.");
  }

  // Reject base64 data URIs in any media item
  for (const item of finalMedia) {
    if (item.url.startsWith("data:")) {
      throw new ValidationError("Base64 data URIs are not allowed. Media must be uploaded to Cloudinary storage first.");
    }
  }

  if (tripId && tripId !== "NONE") {
    const access = await verifyTripAccess(tripId, req.uid);
    if (!access.allowed) {
      if (access.status === 404) throw new NotFoundError(access.error);
      throw new ForbiddenError(access.error);
    }
  }

  const primaryItem = finalMedia[0];
  const finalMediaUrl = primaryItem.url;
  const finalStorageKey = primaryItem.publicId || storageKey || `users/${req.uid}/memories/${Date.now()}`;
  const finalMediaType = primaryItem.resourceType || mediaType;

  const memory = new Memory({
    userId: req.uid,
    tripId: (tripId && tripId !== "NONE") ? tripId : null,
    n: Number(n) || 1,
    place: String(place).trim(),
    date: String(date).trim(),
    weather: String(weather).trim(),
    spend: Math.max(0, Number(spend) || 0),
    media: finalMedia,
    mediaUrl: finalMediaUrl,
    thumbnailUrl: thumbnailUrl ? String(thumbnailUrl).trim() : finalMediaUrl,
    storageKey: finalStorageKey,
    thumbnailKey: String(thumbnailKey).trim(),
    mediaType: finalMediaType,
    category,
    highlight: String(highlight).trim(),
    caption: String(caption).trim() || String(highlight).trim(),
    description: String(description).trim(),
    moments: Array.isArray(moments) ? moments.map(String) : [],
    tags: Array.isArray(tags) ? tags.map(String) : [],
    location: location || undefined,
    capturedAt: capturedAt ? new Date(capturedAt) : null,
    aiMetadata,
    status,
  });

  try {
    const saved = await memory.save();

    // Trigger non-blocking asynchronous AI enrichment
    memoryAiService.enrichMemoryAsync(saved._id).catch(() => {});

    res.status(201).json(saved);
  } catch (saveErr) {
    logger.error(`[MemoryController] Failed to save memory document to MongoDB: ${saveErr.message}`);
    // Rollback uploaded Cloudinary assets to prevent orphaned media
    if (finalMedia.length > 0) {
      const cleanupAssets = finalMedia
        .filter((m) => m.publicId)
        .map((m) => ({ publicId: m.publicId, resourceType: m.resourceType }));
      if (cleanupAssets.length > 0) {
        logger.info(`[MemoryController] Rolling back ${cleanupAssets.length} Cloudinary assets after DB error.`);
        cloudinaryService.deleteMediaBatch(cleanupAssets).catch((cleanupErr) => {
          logger.warn(`[MemoryController] Rollback failed for some assets: ${cleanupErr.message}`);
        });
      }
    }
    throw saveErr;
  }
});

export const updateMemory = asyncHandler(async (req, res) => {
  const memory = await Memory.findOne({ _id: req.params.id, userId: req.uid, isDeleted: false });
  if (!memory) {
    throw new NotFoundError("Memory not found or access denied");
  }

  const updatableFields = [
    "place",
    "date",
    "weather",
    "spend",
    "highlight",
    "caption",
    "description",
    "category",
    "moments",
    "tags",
    "media",
    "location",
    "capturedAt",
    "aiMetadata",
    "status",
    "thumbnailKey",
    "thumbnailUrl",
    "n",
  ];

  if (Array.isArray(req.body.media)) {
    if (req.body.media.length > 10) {
      throw new ValidationError("Maximum 10 media files are allowed per Memory.");
    }
  }

  for (const field of updatableFields) {
    if (req.body[field] !== undefined) {
      memory[field] = req.body[field];
    }
  }

  const saved = await memory.save();
  res.json(saved);
});

export const deleteMemory = asyncHandler(async (req, res) => {
  const isPermanent = req.query.permanent === "true";

  const memory = await Memory.findOne({ _id: req.params.id, userId: req.uid });
  if (!memory) {
    throw new NotFoundError("Memory not found or access denied");
  }

  // Cleanup Cloudinary and storage assets
  const cleanupItems = [];
  if (Array.isArray(memory.media) && memory.media.length > 0) {
    for (const item of memory.media) {
      if (item.publicId) {
        cleanupItems.push({ publicId: item.publicId, resourceType: item.resourceType || "image" });
      }
    }
  }
  if (memory.storageKey && !cleanupItems.some((c) => c.publicId === memory.storageKey)) {
    cleanupItems.push({ publicId: memory.storageKey, resourceType: memory.mediaType || "image" });
  }

  if (cleanupItems.length > 0) {
    cloudinaryService.deleteMediaBatch(cleanupItems).catch((err) => {
      logger.warn(`[MemoryController] Cloudinary asset deletion notice: ${err.message}`);
    });
  }

  // Also clean up local or Firebase storage if legacy
  if (memory.storageKey) {
    memoryStorageService.deleteMemoryMedia(memory.storageKey, memory.thumbnailKey).catch(() => {});
  }

  if (isPermanent) {
    await Memory.deleteOne({ _id: req.params.id, userId: req.uid });
    return res.json({ message: "Memory permanently deleted", id: req.params.id });
  }

  // Soft-delete for safety
  memory.isDeleted = true;
  memory.status = "deleted";
  memory.deletedAt = new Date();
  await memory.save();

  res.json({ message: "Memory deleted successfully", id: req.params.id });
});

export const curateCollage = asyncHandler(async (req, res) => {
  const { tripId, targetCount, style } = req.body;
  const result = await memoryAiService.curateCollageMemories({
    tripId,
    targetCount: targetCount ? Number(targetCount) : 6,
    style: style || "Balanced",
    userId: req.uid,
  });
  res.json(result);
});

export const reprocessMemory = asyncHandler(async (req, res) => {
  const memory = await Memory.findOne({ _id: req.params.id, userId: req.uid, isDeleted: false });
  if (!memory) throw new NotFoundError("Memory not found or access denied");

  memoryAiService.enrichMemoryAsync(memory._id).catch(() => {});
  res.json({ success: true, message: "AI enrichment job queued." });
});

export const migrateMemories = asyncHandler(async (req, res) => {
  const { memories } = req.body;
  const results = [];

  for (const item of memories) {
    if (!item.photo && !item.mediaUrl && (!item.media || item.media.length === 0)) continue;
    const mediaUrl = item.mediaUrl || item.photo || (item.media?.[0]?.url);
    if (!mediaUrl || mediaUrl.startsWith("data:")) continue;

    const storageKey = item.storageKey || `users/${req.uid}/migrated_${item.date || ""}_${item.n || Date.now()}`;
    const existing = await Memory.findOne({ userId: req.uid, storageKey });
    if (existing) {
      results.push(existing);
      continue;
    }

    const doc = new Memory({
      userId: req.uid,
      tripId: item.tripId || null,
      n: Number(item.n) || 1,
      place: String(item.place || "").trim(),
      date: String(item.date || "").trim(),
      weather: String(item.weather || "").trim(),
      spend: Number(item.spend) || 0,
      media: item.media || [{ url: mediaUrl, publicId: storageKey, resourceType: item.mediaType || "image" }],
      mediaUrl,
      storageKey,
      mediaType: item.mediaType || "image",
      highlight: String(item.highlight || "").trim(),
      moments: Array.isArray(item.moments) ? item.moments : [],
      status: "ready",
    });
    const saved = await doc.save();
    results.push(saved);
  }

  res.json({ migratedCount: results.length, memories: results });
});

export const uploadMemoryBinary = asyncHandler(async (req, res) => {
  if (!req.body || !Buffer.isBuffer(req.body) || req.body.length === 0) {
    throw new ValidationError("Binary body is missing or empty.");
  }

  const rawFileName = req.headers["x-file-name"];
  let fileName = "memory_upload.jpg";
  if (rawFileName) {
    try {
      fileName = decodeURIComponent(rawFileName);
    } catch {
      fileName = rawFileName;
    }
  }

  const mimeType = req.headers["content-type"] || "image/jpeg";
  const tripId = req.headers["x-trip-id"] || null;

  // 1. Primary storage: Cloudinary
  if (cloudinaryService.isConfigured) {
    try {
      const cloudinaryResult = await cloudinaryService.uploadMedia({
        fileBuffer: req.body,
        fileName,
        mimeType,
        userId: req.uid,
        tripId,
      });

      return res.status(201).json({
        success: true,
        url: cloudinaryResult.url,
        mediaUrl: cloudinaryResult.url,
        publicId: cloudinaryResult.publicId,
        storageKey: cloudinaryResult.publicId,
        resourceType: cloudinaryResult.resourceType,
        mediaType: cloudinaryResult.resourceType,
        format: cloudinaryResult.format,
        width: cloudinaryResult.width,
        height: cloudinaryResult.height,
        duration: cloudinaryResult.duration,
        originalName: cloudinaryResult.originalName,
        thumbnailUrl: cloudinaryResult.url,
      });
    } catch (cloudErr) {
      logger.warn(`[MemoryController] Cloudinary upload notice, attempting fallback: ${cloudErr.message}`);
    }
  }

  // 2. Fallback storage: Local / Firebase storage
  const result = await memoryStorageService.uploadMemoryMedia({
    fileBuffer: req.body,
    fileName,
    mimeType,
    userId: req.uid,
    tripId,
  });

  res.status(201).json({
    success: true,
    url: result.mediaUrl,
    mediaUrl: result.mediaUrl,
    publicId: result.storageKey,
    storageKey: result.storageKey,
    resourceType: result.mediaType || (mimeType.startsWith("video/") ? "video" : "image"),
    mediaType: result.mediaType || (mimeType.startsWith("video/") ? "video" : "image"),
    thumbnailUrl: result.thumbnailUrl || result.mediaUrl,
    thumbnailKey: result.thumbnailKey || "",
    width: result.width || 0,
    height: result.height || 0,
    duration: 0,
    originalName: fileName,
  });
});

export const cleanupAssets = asyncHandler(async (req, res) => {
  const { items = [] } = req.body;
  if (Array.isArray(items) && items.length > 0) {
    const safeItems = items
      .map((item) => (typeof item === "string" ? { publicId: item, resourceType: "image" } : item))
      .filter((item) => item && item.publicId);

    if (safeItems.length > 0) {
      await cloudinaryService.deleteMediaBatch(safeItems);
    }
  }
  res.json({ success: true, message: "Assets cleaned up successfully." });
});

/**
 * POST /api/memories/generate-captions
 * Visually analyzes memory photos using multimodal AI and generates 8 distinct captions.
 */
export const generateCaptions = asyncHandler(async (req, res) => {
  const { memoryId, imageUrls, place, highlight, caption, date, category, tonePreference } = req.body;

  const result = await memoryAiService.generatePhotoAwareCaptions({
    memoryId,
    imageUrls,
    place,
    highlight,
    caption,
    date,
    category,
    tonePreference,
    userId: req.uid,
  });

  res.json({
    success: true,
    visualSummary: result.visualSummary,
    captions: result.captions,
    provider: result.provider,
    model: result.model,
  });
});

