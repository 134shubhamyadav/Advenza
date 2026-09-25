import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { aiGenerateLimiter, aiChatLimiter } from "../middleware/rateLimiter.js";
import {
  generateTripInputSchema,
  regenerateTripInputSchema,
  planBInputSchema,
  chatInputSchema,
  packingInputSchema,
  riskInputSchema,
  estimateBudgetInputSchema,
} from "../schemas/ai.schemas.js";
import * as aiController from "../controllers/ai.controller.js";

const router = express.Router();

// Enforce auth token verification on all AI endpoints
router.use(verifyToken);

// GET /api/ai/estimate-budget
router.get(
  "/estimate-budget",
  validate({ query: estimateBudgetInputSchema }),
  aiController.estimateBudget
);

// POST /api/ai/generate
router.post(
  "/generate",
  aiGenerateLimiter,
  validate({ body: generateTripInputSchema }),
  aiController.generate
);

// POST /api/ai/regenerate/:tripId
router.post(
  "/regenerate/:tripId",
  aiGenerateLimiter,
  validate({ body: regenerateTripInputSchema }),
  aiController.regenerate
);

// POST /api/ai/planb & /api/ai/plan-b (Both paths supported for frontend compatibility)
router.post(
  "/planb",
  validate({ body: planBInputSchema }),
  aiController.planB
);

router.post(
  "/plan-b",
  validate({ body: planBInputSchema }),
  aiController.planB
);

// POST /api/ai/chat
router.post(
  "/chat",
  aiChatLimiter,
  validate({ body: chatInputSchema }),
  aiController.chat
);

// POST /api/ai/packing
router.post(
  "/packing",
  validate({ body: packingInputSchema }),
  aiController.packing
);

// POST /api/ai/risk
router.post(
  "/risk",
  validate({ body: riskInputSchema }),
  aiController.risk
);

export default router;
