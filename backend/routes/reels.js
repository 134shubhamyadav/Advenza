import express from 'express';
import {
  createReel,
  getReelById,
  listReels,
  deleteReel,
  shareReel,
  getSharedReel,
  downloadReel,
  getAudioPresetsList
} from '../controllers/reel.controller.js';
import { verifyToken } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { reelLimiter } from '../middleware/rateLimiter.js';
import {
  createReelSchema,
  listReelsQuerySchema
} from '../schemas/reel.schemas.js';

const router = express.Router();

// Public Read-Only Endpoint for Shared Reels (no auth required)
router.get('/share/:shareToken', getSharedReel);

// All subsequent routes require authenticated user
router.use(verifyToken);

// GET /api/reels/presets/audio - Royalty-free music list
router.get('/presets/audio', getAudioPresetsList);

// POST /api/reels - Enqueue a new reel generation job
router.post(
  '/',
  reelLimiter,
  validate({ body: createReelSchema }),
  createReel
);

// GET /api/reels - List user's reels (with optional tripId filter)
router.get(
  '/',
  validate({ query: listReelsQuerySchema }),
  listReels
);

// GET /api/reels/:id - Get status, progress, or video details
router.get('/:id', getReelById);

// DELETE /api/reels/:id - Delete reel and clean up video asset
router.delete('/:id', deleteReel);

// GET /api/reels/:id/download - Direct MP4 download
router.get('/:id/download', downloadReel);

// POST /api/reels/:id/share - Generate public share link
router.post('/:id/share', shareReel);

export default router;
