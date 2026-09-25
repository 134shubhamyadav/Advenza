import express from "express";
import { fetchDestinationImage, normalizeDestination } from "../services/media/destination-image.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = express.Router();

/**
 * GET /api/media/destination-image?destination=...
 * Resolves a verified, high-resolution hero image for any destination.
 */
router.get(
  "/destination-image",
  asyncHandler(async (req, res) => {
    const rawDestination = req.query.destination;
    if (!rawDestination) {
      return res.status(400).json({ error: "destination query parameter is required" });
    }

    const image = await fetchDestinationImage(rawDestination);
    res.json(image);
  })
);

export default router;
