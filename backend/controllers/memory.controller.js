import Memory from "../models/Memory.js";
import Trip from "../models/Trip.js";
import { memoryAiService } from "../services/ai/memory-ai.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { NotFoundError, ForbiddenError, ValidationError } from "../utils/errors.js";

async function verifyTripAccess(tripId, uid) {
  if (!tripId) return { allowed: true };
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

  if (tripId) {
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

  const sortOrder = tripId ? { n: 1, createdAt: -1 } : { createdAt: -1 };

  if (isPaginated) {
    // Fetch one extra item to test whether a next page exists
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

export const createMemory = asyncHandler(async (req, res) => {
  const {
    tripId,
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

  if (mediaUrl.startsWith("data:")) {
    throw new ValidationError("Base64 data URIs are not allowed. Media must be uploaded to object storage first.");
  }

  const expectedPrefix = `users/${req.uid}/`;
  if (!storageKey.startsWith(expectedPrefix)) {
    throw new ForbiddenError("Forbidden: Storage path does not belong to the authenticated user.");
  }

  if (tripId) {
    const access = await verifyTripAccess(tripId, req.uid);
    if (!access.allowed) {
      if (access.status === 404) throw new NotFoundError(access.error);
      throw new ForbiddenError(access.error);
    }
  }

  const memory = new Memory({
    userId: req.uid,
    tripId: tripId || null,
    n: Number(n) || 1,
    place: String(place).trim(),
    date: String(date).trim(),
    weather: String(weather).trim(),
    spend: Math.max(0, Number(spend) || 0),
    mediaUrl: String(mediaUrl).trim(),
    thumbnailUrl: thumbnailUrl ? String(thumbnailUrl).trim() : "",
    storageKey: String(storageKey).trim(),
    thumbnailKey: String(thumbnailKey).trim(),
    mediaType: mediaType === "video" ? "video" : "image",
    category,
    highlight: String(highlight).trim(),
    caption: String(caption).trim(),
    description: String(description).trim(),
    moments: Array.isArray(moments) ? moments.map(String) : [],
    tags: Array.isArray(tags) ? tags.map(String) : [],
    location: location || undefined,
    capturedAt: capturedAt ? new Date(capturedAt) : null,
    aiMetadata,
    status,
  });

  const saved = await memory.save();

  // Trigger non-blocking asynchronous AI enrichment (description, tags, category)
  memoryAiService.enrichMemoryAsync(saved._id).catch(() => {});

  res.status(201).json(saved);
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
    "location",
    "capturedAt",
    "aiMetadata",
    "status",
    "thumbnailKey",
    "thumbnailUrl",
    "n",
  ];

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

  if (isPermanent) {
    const memory = await Memory.findOneAndDelete({ _id: req.params.id, userId: req.uid });
    if (!memory) {
      throw new NotFoundError("Memory not found or access denied");
    }
    return res.json({ message: "Memory permanently deleted", id: req.params.id });
  }

  // Default: Soft-delete for recoverable safety
  const memory = await Memory.findOneAndUpdate(
    { _id: req.params.id, userId: req.uid, isDeleted: false },
    { $set: { isDeleted: true, status: "deleted", deletedAt: new Date() } },
    { new: true }
  );

  if (!memory) {
    throw new NotFoundError("Memory not found or access denied");
  }

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
    if (!item.photo && !item.mediaUrl) continue;
    const mediaUrl = item.mediaUrl || item.photo;
    if (mediaUrl.startsWith("data:")) continue;

    // Check if already migrated by storageKey to ensure idempotence
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

  const { memoryStorageService } = await import("../services/storage/memory-storage.service.js");
  const fileName = req.headers["x-file-name"] || "memory_upload.jpg";
  const mimeType = req.headers["content-type"] || "image/jpeg";
  const tripId = req.headers["x-trip-id"] || null;

  const result = await memoryStorageService.uploadMemoryMedia({
    fileBuffer: req.body,
    fileName,
    mimeType,
    userId: req.uid,
    tripId,
  });

  res.status(201).json({
    success: true,
    ...result,
  });
});

