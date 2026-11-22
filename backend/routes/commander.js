import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { commanderLimiter } from "../middleware/rateLimiter.js";
import {
  getCommanderEventsSchema,
  acceptCommanderPlanSchema,
  updateTransitSchema,
  commanderCommandSchema,
} from "../schemas/commander.schemas.js";
import * as commanderController from "../controllers/commander.controller.js";

const router = express.Router();

router.use(verifyToken);

// GET /api/commander/events
router.get(
  "/events",
  commanderLimiter,
  validate({ query: getCommanderEventsSchema }),
  commanderController.getEvents
);

// POST /api/commander/events/:id/accept
router.post(
  "/events/:id/accept",
  validate({ params: acceptCommanderPlanSchema }),
  commanderController.acceptEvent
);

// POST /api/commander/events/:id/revert
router.post(
  "/events/:id/revert",
  validate({ params: acceptCommanderPlanSchema }),
  commanderController.revertEvent
);

// POST /api/commander/transit
router.post(
  "/transit",
  validate({ body: updateTransitSchema }),
  commanderController.updateTransit
);

// POST /api/commander/command
router.post(
  "/command",
  validate({ body: commanderCommandSchema }),
  commanderController.executeCommand
);

export default router;
