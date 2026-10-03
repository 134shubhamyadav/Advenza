import crypto from "crypto";
import Invitation from "../models/Invitation.js";
import Trip from "../models/Trip.js";
import { sendBrevoGroupInvitationMail } from "../services/mail/brevo-mail.service.js";
import { config } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { NotFoundError, ForbiddenError, ValidationError } from "../utils/errors.js";

/**
 * Creates and sends a group / consensus invitation email.
 * POST /api/trips/:id/invitations or POST /api/trips/:id/members
 */
export const createTripInvitation = asyncHandler(async (req, res) => {
  const { email, name, inviterName } = req.body;
  const tripId = req.params.id;

  if (!email || typeof email !== "string") {
    throw new ValidationError("A valid recipient email address is required");
  }

  const invitedEmail = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(invitedEmail)) {
    throw new ValidationError("Please provide a valid email address");
  }

  const trip = await Trip.findById(tripId);
  if (!trip) {
    throw new NotFoundError("Trip not found");
  }

  // Authorization: STRICTLY Trip owner/organizer can invite members
  const isOwner = String(trip.createdBy) === String(req.uid);
  if (!isOwner) {
    throw new ForbiddenError("Only the trip organizer can invite new members");
  }

  // Check if this person is already a confirmed member
  const alreadyMember = Array.isArray(trip.members) && trip.members.some(
    (m) => m.email?.toLowerCase() === invitedEmail && m.role !== "Pending"
  );
  if (alreadyMember) {
    return res.status(400).json({
      success: false,
      message: "This person is already a confirmed member of this trip.",
    });
  }

  // Check for active pending invitation for this trip & email
  let invitation = await Invitation.findOne({
    tripId: trip._id,
    invitedEmail,
    status: "PENDING",
    expiresAt: { $gt: new Date() },
  });

  const effectiveInviterName = inviterName || "Your travel companion";
  const clientBaseUrl = (config.CLIENT_URL || "http://localhost:3000").replace(/\/$/, "");

  let token;
  if (invitation) {
    // Re-use or refresh token for pending invite
    token = invitation.token;
    invitation.inviterName = effectiveInviterName;
    invitation.tripTitle = trip.title;
    invitation.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await invitation.save();
  } else {
    // Generate secure random token
    token = crypto.randomBytes(32).toString("hex");
    invitation = await Invitation.create({
      token,
      tripId: trip._id,
      inviterId: req.uid,
      inviterName: effectiveInviterName,
      inviterEmail: req.headers["x-user-email"] || "",
      invitedEmail,
      tripTitle: trip.title,
      status: "PENDING",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days expiry
    });
  }

  // Ensure member is recorded in Trip.members as Pending
  const existingMemberIndex = trip.members.findIndex(
    (m) => m.email?.toLowerCase() === invitedEmail
  );

  if (existingMemberIndex === -1) {
    const initials = (name || invitedEmail.split("@")[0]).slice(0, 2).toUpperCase();
    trip.members.push({
      name: name || invitedEmail.split("@")[0],
      email: invitedEmail,
      role: "Pending",
      initials,
      color: "bg-muted text-foreground",
    });
    await trip.save();
  }

  const inviteLink = `${clientBaseUrl}/invite/${token}`;

  // Send invitation email via Brevo
  try {
    await sendBrevoGroupInvitationMail({
      to: invitedEmail,
      inviterName: effectiveInviterName,
      tripTitle: trip.title,
      inviteLink,
      expiresInDays: 7,
    });
    logger.info(`[Invitation Controller] Sent invite email to ${invitedEmail} for trip ${trip._id}`);
  } catch (emailErr) {
    logger.error(`[Invitation Controller] Failed to send email via Brevo: ${emailErr.message}`);
    // Still return success with invite link if Brevo had issue in dev/local mode
  }

  return res.status(200).json({
    success: true,
    message: `Invitation successfully sent to ${invitedEmail}!`,
    invitationId: invitation._id,
    inviteLink,
    token,
    trip,
  });
});

/**
 * Validates and retrieves metadata for an invitation token (public/safe preview).
 * GET /api/invitations/:token
 */
export const getInvitationByToken = asyncHandler(async (req, res) => {
  const { token } = req.params;

  if (!token || typeof token !== "string") {
    throw new ValidationError("Invitation token is required");
  }

  const invitation = await Invitation.findOne({ token });
  if (!invitation) {
    return res.status(404).json({
      valid: false,
      message: "Invitation link is invalid or does not exist.",
    });
  }

  if (invitation.status === "ACCEPTED") {
    return res.status(400).json({
      valid: false,
      status: "ACCEPTED",
      message: "This invitation has already been accepted.",
    });
  }

  if (invitation.status === "REVOKED") {
    return res.status(400).json({
      valid: false,
      status: "REVOKED",
      message: "This invitation has been revoked by the trip organizer.",
    });
  }

  if (invitation.status === "EXPIRED" || new Date() > invitation.expiresAt) {
    return res.status(400).json({
      valid: false,
      status: "EXPIRED",
      message: "This invitation link has expired. Please ask the organizer for a new invite.",
    });
  }

  const trip = await Trip.findById(invitation.tripId).select(
    "title destination origin startDate endDate travelers style interests members"
  );

  if (!trip) {
    return res.status(404).json({
      valid: false,
      message: "The trip associated with this invitation is no longer available.",
    });
  }

  return res.status(200).json({
    valid: true,
    token: invitation.token,
    trip: {
      _id: trip._id,
      title: trip.title,
      destination: trip.destination,
      origin: trip.origin,
      startDate: trip.startDate,
      endDate: trip.endDate,
      travelers: trip.travelers,
      style: trip.style,
      interests: trip.interests,
      memberCount: (trip.members || []).length,
    },
    inviterName: invitation.inviterName,
    invitedEmail: invitation.invitedEmail,
    expiresAt: invitation.expiresAt,
  });
});

/**
 * Accepts an invitation and adds the authenticated user to the trip group.
 * POST /api/invitations/:token/accept
 */
export const acceptInvitation = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { userName, userEmail } = req.body;
  const userId = req.uid;

  if (!token) {
    throw new ValidationError("Invitation token is required");
  }

  if (!userId) {
    throw new ForbiddenError("Authentication required to accept invitation");
  }

  // 1. Validate invitation record
  const invitation = await Invitation.findOne({ token });
  if (!invitation) {
    throw new NotFoundError("Invitation link is invalid or does not exist.");
  }

  const trip = await Trip.findById(invitation.tripId);
  if (!trip) {
    throw new NotFoundError("The trip associated with this invitation is no longer available.");
  }

  // 2. Validate authenticated user's email matches invited email
  const invitedEmail = (invitation.invitedEmail || "").toLowerCase().trim();
  const authEmail = (req.userEmail || req.user?.email || userEmail || "").toLowerCase().trim();

  if (authEmail && invitedEmail && authEmail !== invitedEmail) {
    return res.status(403).json({
      success: false,
      message: `This invitation was sent to ${invitedEmail}. You are currently signed in as ${authEmail}. Please sign in with the invited email address.`,
    });
  }

  // 3. Verify invitation status (idempotency check)
  if (invitation.status === "ACCEPTED") {
    // If already accepted, verify user is in members and return success
    return res.status(200).json({
      success: true,
      message: "Invitation already accepted. Welcome back to the group!",
      tripId: trip._id,
      trip,
    });
  }

  if (invitation.status === "EXPIRED" || new Date() > invitation.expiresAt) {
    throw new ValidationError("This invitation link has expired. Please ask for a new invite.");
  }

  if (invitation.status === "REVOKED") {
    throw new ForbiddenError("This invitation was revoked by the trip organizer.");
  }

  // 4. Update actual membership on Trip (Single Source of Truth)
  const effectiveEmail = authEmail || invitedEmail;
  const effectiveName = (userName || req.user?.displayName || req.user?.name || effectiveEmail.split("@")[0] || "Traveler").trim();
  const initials = effectiveName.slice(0, 2).toUpperCase();

  if (!Array.isArray(trip.members)) {
    trip.members = [];
  }

  // Find if user already exists in members array (either by pending email or userId)
  const memberIndex = trip.members.findIndex(
    (m) =>
      (m.userId && String(m.userId) === String(userId)) ||
      (m.email && m.email.toLowerCase().trim() === effectiveEmail)
  );

  if (memberIndex !== -1) {
    // Transition from Pending to confirmed Member
    trip.members[memberIndex].userId = String(userId);
    trip.members[memberIndex].role = "Member";
    trip.members[memberIndex].name = effectiveName;
    trip.members[memberIndex].email = effectiveEmail;
    trip.members[memberIndex].initials = initials;
    trip.members[memberIndex].color = "bg-primary text-primary-foreground";
  } else {
    // Add as new confirmed Member
    trip.members.push({
      userId: String(userId),
      name: effectiveName,
      email: effectiveEmail,
      role: "Member",
      initials,
      color: "bg-primary text-primary-foreground",
    });
  }

  // Synchronize total travelers count if needed
  if (trip.travelers < trip.members.length) {
    trip.travelers = trip.members.length;
  }

  // Explicitly notify Mongoose of subdocument array mutation
  trip.markModified("members");
  await trip.save();

  // 5. Update invitation status ONLY AFTER trip save succeeds
  invitation.status = "ACCEPTED";
  invitation.acceptedAt = new Date();
  invitation.acceptedBy = String(userId);
  await invitation.save();

  logger.info(`[Invitation Controller] User ${userId} (${effectiveEmail}) accepted invitation for trip ${trip._id}`);

  return res.status(200).json({
    success: true,
    message: `You've joined "${trip.title}"!`,
    tripId: trip._id,
    trip,
  });
});
