import express from "express";
import { collageController } from "../controllers/collage.controller.js";
import { verifyToken } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { collageLimiter } from "../middleware/rateLimiter.js";
import {
  createCollageSchema,
  listCollagesQuerySchema,
  updateCollageSchema,
} from "../schemas/collage.schemas.js";

const router = express.Router();

// Public Read-Only Endpoint for Shared Collages (no auth required)
router.get("/share/:shareToken", collageController.getSharedCollage);

// All subsequent routes require authenticated user
router.use(verifyToken);

// POST /api/collages — Enqueue a new collage generation job
router.post(
  "/",
  collageLimiter,
  validate({ body: createCollageSchema }),
  collageController.createCollage
);

// GET /api/collages — List user's collages
router.get(
  "/",
  validate({ query: listCollagesQuerySchema }),
  collageController.listCollages
);

// GET /api/collages/:id — Get status and preview metadata
router.get("/:id", collageController.getCollage);

// DELETE /api/collages/:id — Soft-delete collage and cleanup storage
router.delete("/:id", collageController.deleteCollage);

// GET /api/collages/:id/download — Download the final generated image
router.get("/:id/download", collageController.downloadCollage);

// POST /api/collages/:id/share — Generate public sharing token
router.post("/:id/share", collageController.shareCollage);

export default router;
