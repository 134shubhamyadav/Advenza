import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  createMemorySchema,
  updateMemorySchema,
  migrateMemoriesSchema,
  curateCollageSchema,
  listMemoriesQuerySchema,
} from "../schemas/memory.schemas.js";
import * as memoryController from "../controllers/memory.controller.js";
import { uploadLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

// Enforce authentication across all memory routes
router.use(verifyToken);

// POST /api/memories/curate — AI-powered memory selection for collages
router.post("/curate", validate({ body: curateCollageSchema }), memoryController.curateCollage);

// GET /api/memories — List user's memories with cursor pagination, category & search filter
router.get("/", validate({ query: listMemoriesQuerySchema }), memoryController.listMemories);

// GET /api/memories/:id — Get specific memory
router.get("/:id", memoryController.getMemoryById);

// POST /api/memories/upload-binary — Stream binary memory media directly to backend storage
router.post(
  "/upload-binary",
  uploadLimiter,
  express.raw({
    type: ["image/jpeg", "image/png", "image/webp", "image/*", "video/mp4", "video/quicktime", "video/*", "application/octet-stream"],
    limit: "50mb",
  }),
  memoryController.uploadMemoryBinary
);

// POST /api/memories — Create new memory metadata (triggers non-blocking AI enrichment)
router.post("/", validate({ body: createMemorySchema }), memoryController.createMemory);

// PATCH /api/memories/:id — Update memory metadata
router.patch("/:id", validate({ body: updateMemorySchema }), memoryController.updateMemory);

// DELETE /api/memories/:id — Delete memory (soft-delete default, permanent if ?permanent=true)
router.delete("/:id", memoryController.deleteMemory);

// POST /api/memories/:id/reprocess — Re-trigger AI enrichment for a memory
router.post("/:id/reprocess", memoryController.reprocessMemory);

// POST /api/memories/migrate — Migrate legacy client memories
router.post("/migrate", validate({ body: migrateMemoriesSchema }), memoryController.migrateMemories);

// POST /api/memories/cleanup-assets — Clean up orphaned/cancelled media assets
router.post("/cleanup-assets", memoryController.cleanupAssets);

export default router;
