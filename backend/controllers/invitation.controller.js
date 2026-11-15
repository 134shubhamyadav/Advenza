import crypto from "crypto";
import mongoose from "mongoose";
import Invitation from "../models/Invitation.js";
import Trip from "../models/Trip.js";
import User from "../models/User.js";
import { sendBrevoGroupInvitationMail } from "../services/mail/brevo-mail.service.js";
import { config, getClientBaseUrl } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { NotFoundError, ForbiddenError, ValidationError } from "../utils/errors.js";

/**
 * Resolves the authorized group membership for the invitation email and invitation landing page.
 * - Extracts organizer exactly once (labeled Organizer)
 * - Extracts confirmed members who have joined (labeled Member)
 * - Strictly excludes Pending, Rejected, Revoked, or Removed invitations
 * - Strictly prevents duplicate members or the organizer appearing in joined members
 * - Sanitizes names so email addresses are never exposed
 *
 * @param {Object} trip - MongoDB Trip document or plain object
 * @param {string} [inviterName] - Optional name of organizer from request
 * @returns {Promise<{ organizer: { name: string, role: string, userId?: string, email?: string }, joinedMembers: Array<{ name: string, role: string, userId?: string }>, confirmedCount: number }>}
 */
export async function resolveGroupMembers(trip, inviterName) {
  const rawMembers = Array.isArray(trip?.members) ? trip.members : [];
  const tripCreatorUid = trip?.createdBy ? String(trip.createdBy) : null;

  // 1. Resolve Organizer Identity
  let organizerUser = null;
  let organizerMember = null;
  let organizerName = "";
  let organizerEmail = "";

  // Check if organizer is in trip.members
  organizerMember = rawMembers.find(
    (m) =>
      m &&
      (m.role === "Organizer" ||
        (tripCreatorUid && m.userId && String(m.userId) === tripCreatorUid))
  ) || null;

  // If trip creator UID exists, look up User collection
  if (tripCreatorUid && mongoose.connection?.readyState === 1) {
    try {
      organizerUser = await User.findOne({ firebaseUid: tripCreatorUid }).lean();
      if (organizerUser?.displayName) {
        organizerName = organizerUser.displayName.trim();
      }
      if (organizerUser?.email) {
        organizerEmail = organizerUser.email.trim().toLowerCase();
      }
    } catch (_) {}
  }

  // If organizerMember has name and no organizerName resolved yet
  if (!organizerName && organizerMember?.name && !organizerMember.name.includes("@")) {
    organizerName = organizerMember.name.trim();
  }
  if (!organizerEmail && organizerMember?.email) {
    organizerEmail = organizerMember.email.trim().toLowerCase();
  }

  // If inviterName was provided and is a human name (not placeholder)
  const cleanInviter = (inviterName || "").trim();
  const isGenericInviter =
    !cleanInviter ||
    cleanInviter.toLowerCase() === "your travel companion" ||
    cleanInviter.toLowerCase() === "a fellow traveler" ||
    cleanInviter.toLowerCase() === "trip organizer";

  if (!organizerName && !isGenericInviter) {
    organizerName = cleanInviter;
  }

  // If inviterName is provided, also check if any member matches it
  if (!organizerMember && !isGenericInviter) {
    organizerMember = rawMembers.find(
      (m) => m?.name && m.name.toLowerCase().trim() === cleanInviter.toLowerCase()
    ) || null;
  }

  // Format organizer name if missing or raw email
  if (!organizerName || organizerName.includes("@")) {
    if (organizerName && organizerName.includes("@")) {
      const handle = organizerName.split("@")[0].replace(/[._-]/g, " ");
      organizerName = handle.charAt(0).toUpperCase() + handle.slice(1);
    } else if (organizerEmail) {
      const handle = organizerEmail.split("@")[0].replace(/[._-]/g, " ");
      organizerName = handle.charAt(0).toUpperCase() + handle.slice(1);
    } else {
      organizerName = "Trip Organizer";
    }
  }

  // 2. Resolve Joined Members
  // Only include users who have successfully joined (role === "Member" or confirmed userId)
  // Strictly EXCLUDE:
  // - "Pending", "Rejected", "Removed", "Revoked"
  // - The organizer (by role, userId, object reference, email, or exact name)
  // - Duplicate entries
  const seenUserIds = new Set();
  const seenEmails = new Set();
  const seenNames = new Set();

  if (tripCreatorUid) seenUserIds.add(tripCreatorUid);
  if (organizerMember?.userId) seenUserIds.add(String(organizerMember.userId));
  if (organizerEmail) seenEmails.add(organizerEmail);
  if (organizerMember?.email) seenEmails.add(organizerMember.email.toLowerCase().trim());
  if (organizerName && organizerName !== "Trip Organizer") seenNames.add(organizerName.toLowerCase().trim());

  const joinedCandidates = rawMembers.filter((m) => {
    if (!m) return false;
    const role = (m.role || "").trim();
    if (role === "Pending" || role === "Rejected" || role === "Removed" || role === "Revoked") return false;
    if (role === "Organizer") return false;
    if (organizerMember && m === organizerMember) return false;

    const mUid = m.userId ? String(m.userId) : null;
    const mEmail = m.email ? m.email.toLowerCase().trim() : null;
    const mName = m.name ? m.name.toLowerCase().trim() : null;

    if (mUid && seenUserIds.has(mUid)) return false;
    if (mEmail && seenEmails.has(mEmail)) return false;
    if (mName && seenNames.has(mName)) return false;

    // Must be confirmed member (explicit "Member" role or confirmed userId)
    return role === "Member" || Boolean(mUid);
  });

  const joinedMembers = [];
  for (const m of joinedCandidates) {
    let memberName = (m.name || "").trim();
    const mUid = m.userId ? String(m.userId) : null;
    const mEmail = m.email ? m.email.toLowerCase().trim() : null;

    // If missing name or raw email, look up displayName from User collection
    if ((!memberName || memberName.includes("@")) && mUid && mongoose.connection?.readyState === 1) {
      try {
        const u = await User.findOne({ firebaseUid: mUid }).lean();
        if (u?.displayName) {
          memberName = u.displayName.trim();
        }
      } catch (_) {}
    }

    // Ensure email is never exposed
    if (!memberName || memberName.includes("@")) {
      if (memberName.includes("@")) {
        const handle = memberName.split("@")[0].replace(/[._-]/g, " ");
        memberName = handle.charAt(0).toUpperCase() + handle.slice(1);
      } else if (mEmail) {
        const handle = mEmail.split("@")[0].replace(/[._-]/g, " ");
        memberName = handle.charAt(0).toUpperCase() + handle.slice(1);
      } else {
        memberName = "Traveler";
      }
    }

    // Deduplicate in final list
    const lowerName = memberName.toLowerCase().trim();
    if (seenNames.has(lowerName)) continue;
    seenNames.add(lowerName);
    if (mUid) seenUserIds.add(mUid);
    if (mEmail) seenEmails.add(mEmail);

    joinedMembers.push({
      name: memberName,
      role: "Member",
      userId: mUid || undefined,
    });
  }

  const confirmedCount = 1 + joinedMembers.length;

  return {
    organizer: {
      name: organizerName,
      role: "Organizer",
      userId: tripCreatorUid || organizerMember?.userId || undefined,
      email: organizerEmail || undefined,
    },
    joinedMembers,
    confirmedCount,
  };
}

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
  const clientBaseUrl = getClientBaseUrl(req);

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

  let emailDelivery = { sent: false, error: null, messageId: null, isIpUnauthorized: false, detectedIp: null };

  // Format trip dates if present
  let tripDates = "";
  if (trip.startDate && trip.endDate) {
    tripDates = `${trip.startDate} – ${trip.endDate}`;
  } else if (trip.duration) {
    tripDates = `${trip.duration} Day${trip.duration > 1 ? "s" : ""}`;
  }

  // Resolve actual group members for email (Organizer + joined members, strictly excluding pending)
  // Fetch fresh trip from MongoDB to guarantee zero stale cache
  const freshTrip = await Trip.findById(trip._id).lean();
  const groupMembers = await resolveGroupMembers(freshTrip || trip, effectiveInviterName);

  // Send invitation email via Brevo
  try {
    const sendResult = await sendBrevoGroupInvitationMail({
      to: invitedEmail,
      inviterName: groupMembers.organizer.name,
      tripTitle: trip.title,
      tripDestination: trip.destination || "",
      tripDates,
      tripStyle: trip.style || "",
      groupMembers,
      inviteLink,
      expiresInDays: 7,
    });
    emailDelivery = { sent: true, error: null, messageId: sendResult.messageId, isIpUnauthorized: false, detectedIp: null };
    logger.info(`[Invitation Controller] Sent invite email to ${invitedEmail} for trip ${trip._id} (MessageId: ${sendResult.messageId})`);
  } catch (emailErr) {
    const isIpUnauthorized = Boolean(emailErr.isIpUnauthorized);
    const detectedIp = emailErr.detectedIp || null;
    emailDelivery = {
      sent: false,
      error: emailErr.cleanMessage || emailErr.message,
      messageId: null,
      isIpUnauthorized,
      detectedIp,
    };
    logger.error(`[Invitation Controller] Failed to send email via Brevo: ${emailErr.message}`);
  }

  // Update invitation record with delivery status (Invitation remains 100% created and valid)
  invitation.emailDeliveryStatus = emailDelivery.sent ? "SENT" : "FAILED";
  invitation.emailDeliveryError = emailDelivery.isIpUnauthorized ? "BREVO_IP_UNAUTHORIZED" : emailDelivery.error;
  invitation.brevoMessageId = emailDelivery.messageId;
  await invitation.save();

  const userFacingMessage = emailDelivery.sent
    ? `Invitation email successfully sent to ${invitedEmail} via Brevo!`
    : emailDelivery.isIpUnauthorized
    ? `Invitation created! However, Brevo rejected email delivery because server IP (${emailDelivery.detectedIp || "unknown"}) is not authorized in Brevo Security settings. You can share the invitation link directly.`
    : `Invitation created! However, email delivery could not be completed (${emailDelivery.error}). You can share the invitation link directly.`;

  return res.status(200).json({
    success: true,
    emailSent: emailDelivery.sent,
    emailError: emailDelivery.error,
    isIpUnauthorized: emailDelivery.isIpUnauthorized,
    detectedIp: emailDelivery.detectedIp,
    message: userFacingMessage,
    invitationId: invitation._id,
    inviteLink,
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

  const trip = await Trip.findById(invitation.tripId).lean();

  if (!trip) {
    return res.status(404).json({
      valid: false,
      message: "The trip associated with this invitation is no longer available.",
    });
  }

  // Resolve actual group members directly from live MongoDB trip document
  const groupMembers = await resolveGroupMembers(trip, invitation.inviterName);

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
      memberCount: groupMembers.confirmedCount,
      confirmedCount: groupMembers.confirmedCount,
      organizer: groupMembers.organizer,
      confirmedMembers: groupMembers.joinedMembers,
    },
    inviterName: groupMembers.organizer.name || invitation.inviterName,
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

  // Synchronize total travelers count to match confirmed members count
  const confirmedCount = 1 + trip.members.filter((m) => m.role === "Member").length;
  if (trip.travelers < confirmedCount) {
    trip.travelers = confirmedCount;
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
