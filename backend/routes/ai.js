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
  destinationOverviewInputSchema,
} from "../schemas/ai.schemas.js";
import * as aiController from "../controllers/ai.controller.js";

const router = express.Router();

// Enforce auth token verification on all AI endpoints
router.use(verifyToken);

// GET /api/ai/destination-overview
router.get(
  "/destination-overview",
  validate({ query: destinationOverviewInputSchema }),
  aiController.getDestinationOverview
);

// GET /api/ai/destination-disambiguation
router.get(
  "/destination-disambiguation",
  aiController.disambiguateDestination
);

// POST /api/ai/budget-feasibility
router.post(
  "/budget-feasibility",
  aiController.calculateBudgetFeasibility
);

// POST /api/ai/orchestrated-research
router.post(
  "/orchestrated-research",
  aiController.orchestratedResearch
);

// GET /api/ai/trains (Live RailCore Indian Railways train search, fares & availability)
router.get(
  "/trains",
  aiController.searchTrains
);

// GET /api/ai/stations (High-speed station & railhead autocomplete across 8,990+ Indian Railways stations)
router.get(
  "/stations",
  aiController.searchStations
);

// GET /api/ai/trains/live/:trainNumber (Direct CRIS NTES Live Train Tracking - Free & Unlimited)
router.get(
  "/trains/live/:trainNumber",
  aiController.trackLiveTrain
);

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
