import express from "express";
import { verifyToken } from "../middleware/auth.js";
import {
  getInvitationByToken,
  acceptInvitation,
  createTripInvitation,
} from "../controllers/invitation.controller.js";

const router = express.Router();

/**
 * @route   GET /api/invitations/:token
 * @desc    Validate an invitation token and fetch trip preview data (public)
 * @access  Public
 */
router.get("/:token", getInvitationByToken);

/**
 * @route   POST /api/invitations/:token/accept
 * @desc    Accept group invitation and join the trip
 * @access  Authenticated
 */
router.post("/:token/accept", verifyToken, acceptInvitation);

/**
 * @route   POST /api/invitations/trips/:id
 * @desc    Send a group / consensus invitation
 * @access  Authenticated
 */
router.post("/trips/:id", verifyToken, createTripInvitation);

export default router;
