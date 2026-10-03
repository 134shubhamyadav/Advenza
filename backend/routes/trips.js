import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  createTripSchema,
  addExpenseSchema,
  inviteMemberSchema,
  voteSchema,
  addOptionSchema,
  updateItinerarySchema,
} from "../schemas/trip.schemas.js";
import * as tripController from "../controllers/trip.controller.js";
import { createTripInvitation } from "../controllers/invitation.controller.js";

const router = express.Router();

// Apply auth to all routes
router.use(verifyToken);

// GET /api/trips — all trips for the authenticated user
router.get("/", tripController.listTrips);

// GET /api/trips/:id — specific trip
router.get("/:id", tripController.getTripById);

// POST /api/trips — create trip
router.post("/", validate({ body: createTripSchema }), tripController.createTrip);

// PUT /api/trips/:id — update trip details
router.put("/:id", tripController.updateTrip);

// DELETE /api/trips/:id — delete trip
router.delete("/:id", tripController.deleteTrip);

// ─── BUDGET ROUTES ─────────────────────────────────────────────────────────────
// POST /api/trips/:id/expenses — add an expense
router.post("/:id/expenses", validate({ body: addExpenseSchema }), tripController.addExpense);

// DELETE /api/trips/:id/expenses/:expenseId — remove an expense
router.delete("/:id/expenses/:expenseId", tripController.deleteExpense);

// ─── GROUP ROUTES ───────────────────────────────────────────────────────────────
// POST /api/trips/:id/members — invite a member (sends Brevo group invite email)
router.post("/:id/members", validate({ body: inviteMemberSchema }), createTripInvitation);
router.post("/:id/invitations", validate({ body: inviteMemberSchema }), createTripInvitation);

// POST /api/trips/:id/vote — cast a vote
router.post("/:id/vote", validate({ body: voteSchema }), tripController.castVote);

// POST /api/trips/:id/options — add a custom vote option / proposal
router.post("/:id/options", validate({ body: addOptionSchema }), tripController.addVoteOption);

// PUT /api/trips/:id/itinerary — smart-patch: replace only the supplied days, preserve the rest
router.put("/:id/itinerary", validate({ body: updateItinerarySchema }), tripController.patchItinerary);

export default router;
