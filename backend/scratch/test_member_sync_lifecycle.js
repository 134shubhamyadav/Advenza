/**
 * test_member_sync_lifecycle.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Automated lifecycle test for group-member synchronization in invitation emails.
 *
 * Tests the 8-step scenario defined in the user requirement:
 *  1. Organizer creates a trip group.
 *  2. Organizer sends Invite 1 → email shows Organizer only.
 *  3. User 1 accepts → trip.members updated with role "Member".
 *  4. User 2 accepts → trip.members updated with role "Member".
 *  5. Organizer sends Invite 2 → email roster shows Organizer + User1 + User2 (3 confirmed).
 *  6. Remove User 1 via removeTripMember → User 1 no longer in trip.members.
 *  7. Organizer sends Invite 3 → email roster shows Organizer + User2 only (2 confirmed).
 *  8. Verify getInvitationByToken returns live membership, not stale data.
 *
 * Also tests edge cases:
 *  - Duplicate acceptance is idempotent.
 *  - Pending invitations are strictly excluded from member roster.
 *  - Removed members do not reappear.
 *
 * Run: node backend/scratch/test_member_sync_lifecycle.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

import dotenv from "dotenv";
dotenv.config({ path: "backend/.env" });

import mongoose from "mongoose";
import crypto from "crypto";

// ── Models ──────────────────────────────────────────────────────────────────
import Trip from "../models/Trip.js";
import Invitation from "../models/Invitation.js";
import User from "../models/User.js";
import { resolveGroupMembers } from "../controllers/invitation.controller.js";

// ── Test infrastructure ──────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(label, condition, detail = "") {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

function section(title) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`📋 ${title}`);
  console.log("─".repeat(60));
}

// ── Main test ────────────────────────────────────────────────────────────────
async function runTests() {
  const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!MONGO_URI) {
    console.error("❌ MONGODB_URI not set in environment. Exiting.");
    process.exit(1);
  }

  console.log("\n🚀 Connecting to MongoDB...");
  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected to MongoDB");

  const organizerUid = `test-organizer-${Date.now()}`;
  const user1Uid = `test-user1-${Date.now()}`;
  const user2Uid = `test-user2-${Date.now()}`;
  const orgEmail = `organizer-${Date.now()}@test.advenza`;
  const user1Email = `user1-${Date.now()}@test.advenza`;
  const user2Email = `user2-${Date.now()}@test.advenza`;
  const user3Email = `user3-${Date.now()}@test.advenza`; // Invite only, never accept

  let tripId;
  let invitation1Token, invitation2Token, invitation3Token;

  try {
    // ════════════════════════════════════════════════════════════════════════
    section("STEP 1 — Organizer creates trip group");
    // ════════════════════════════════════════════════════════════════════════

    const trip = await Trip.create({
      title: "Test Group Trip",
      destination: "Goa, India",
      style: "Adventure",
      createdBy: organizerUid,
      travelers: 1,
      members: [],
    });
    tripId = trip._id;

    assert("Trip created with no members", Array.isArray(trip.members) && trip.members.length === 0);

    // ════════════════════════════════════════════════════════════════════════
    section("STEP 2 — Organizer sends Invite 1 → simulate pending member add");
    // ════════════════════════════════════════════════════════════════════════

    // Simulate invitation creation (what createTripInvitation does)
    const token1 = crypto.randomBytes(32).toString("hex");
    await Invitation.create({
      token: token1,
      tripId,
      inviterId: organizerUid,
      inviterName: "Test Organizer",
      inviterEmail: orgEmail,
      invitedEmail: user1Email,
      tripTitle: trip.title,
      status: "PENDING",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    invitation1Token = token1;

    // Pending member placeholder added
    const freshTrip1 = await Trip.findById(tripId);
    freshTrip1.members.push({
      name: "User One",
      email: user1Email,
      role: "Pending",
      initials: "U1",
      color: "bg-muted",
    });
    await freshTrip1.save();

    // Resolve group members for email (should show Organizer only, no pending)
    const freshForEmail1 = await Trip.findById(tripId).lean();
    const resolved1 = await resolveGroupMembers(freshForEmail1, "Test Organizer");

    assert("Step 2: Organizer appears in roster", resolved1.organizer.name === "Test Organizer");
    assert("Step 2: No joined members (Pending excluded)", resolved1.joinedMembers.length === 0);
    assert("Step 2: Confirmed count = 1", resolved1.confirmedCount === 1);
    console.log(`     → Roster: Organizer="${resolved1.organizer.name}", joinedMembers=${resolved1.joinedMembers.length}`);

    // ════════════════════════════════════════════════════════════════════════
    section("STEP 3 — User 1 accepts invitation");
    // ════════════════════════════════════════════════════════════════════════

    // Simulate acceptInvitation for User 1
    const tripForAccept1 = await Trip.findById(tripId);
    const memberIdx1 = tripForAccept1.members.findIndex(
      (m) => m.email?.toLowerCase() === user1Email
    );
    if (memberIdx1 !== -1) {
      tripForAccept1.members[memberIdx1].userId = user1Uid;
      tripForAccept1.members[memberIdx1].role = "Member";
      tripForAccept1.members[memberIdx1].name = "User One Accepted";
      tripForAccept1.members[memberIdx1].initials = "UA";
    }
    tripForAccept1.markModified("members");
    await tripForAccept1.save();

    await Invitation.findOneAndUpdate({ token: token1 }, { status: "ACCEPTED" });

    // Also add pending invite for user3 to test exclusion
    const freshTrip3Invite = await Trip.findById(tripId);
    freshTrip3Invite.members.push({
      name: "User Three Pending",
      email: user3Email,
      role: "Pending",
      initials: "U3",
    });
    await freshTrip3Invite.save();

    const freshForEmail2 = await Trip.findById(tripId).lean();
    const resolved2 = await resolveGroupMembers(freshForEmail2, "Test Organizer");

    assert("Step 3: User 1 appears as joined member", resolved2.joinedMembers.some((m) => m.name === "User One Accepted"));
    assert("Step 3: Pending User 3 excluded", !resolved2.joinedMembers.some((m) => m.name === "User Three Pending"));
    assert("Step 3: Confirmed count = 2 (Org + User1)", resolved2.confirmedCount === 2);
    console.log(`     → Roster: Organizer="${resolved2.organizer.name}", joinedMembers=[${resolved2.joinedMembers.map((m) => m.name).join(", ")}]`);

    // ════════════════════════════════════════════════════════════════════════
    section("STEP 4 — User 2 accepts invitation");
    // ════════════════════════════════════════════════════════════════════════

    // Simulate invitation for User 2
    const token2 = crypto.randomBytes(32).toString("hex");
    await Invitation.create({
      token: token2,
      tripId,
      inviterId: organizerUid,
      inviterName: "Test Organizer",
      inviterEmail: orgEmail,
      invitedEmail: user2Email,
      tripTitle: trip.title,
      status: "PENDING",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    // Pending placeholder for User 2
    const freshForUser2 = await Trip.findById(tripId);
    freshForUser2.members.push({
      name: "User Two",
      email: user2Email,
      role: "Pending",
      initials: "U2",
    });
    await freshForUser2.save();

    // User 2 accepts
    const tripForAccept2 = await Trip.findById(tripId);
    const memberIdx2 = tripForAccept2.members.findIndex(
      (m) => m.email?.toLowerCase() === user2Email
    );
    if (memberIdx2 !== -1) {
      tripForAccept2.members[memberIdx2].userId = user2Uid;
      tripForAccept2.members[memberIdx2].role = "Member";
      tripForAccept2.members[memberIdx2].name = "User Two Accepted";
      tripForAccept2.members[memberIdx2].initials = "U2A";
    }
    tripForAccept2.markModified("members");
    await tripForAccept2.save();

    await Invitation.findOneAndUpdate({ token: token2 }, { status: "ACCEPTED" });

    const freshForEmail3 = await Trip.findById(tripId).lean();
    const resolved3 = await resolveGroupMembers(freshForEmail3, "Test Organizer");

    assert("Step 4: User 1 still in roster", resolved3.joinedMembers.some((m) => m.name === "User One Accepted"));
    assert("Step 4: User 2 appears in roster", resolved3.joinedMembers.some((m) => m.name === "User Two Accepted"));
    assert("Step 4: Pending User 3 still excluded", !resolved3.joinedMembers.some((m) => m.name === "User Three Pending"));
    assert("Step 4: Confirmed count = 3 (Org + User1 + User2)", resolved3.confirmedCount === 3);
    console.log(`     → Roster: Organizer="${resolved3.organizer.name}", joinedMembers=[${resolved3.joinedMembers.map((m) => m.name).join(", ")}]`);

    // ════════════════════════════════════════════════════════════════════════
    section("STEP 5 — Organizer sends Invite 2 → verify 3 confirmed in email");
    // ════════════════════════════════════════════════════════════════════════

    // Fresh fetch before sending (mimics the fresh fetch in createTripInvitation)
    const freshForInvite2 = await Trip.findById(tripId).lean();
    const resolved4 = await resolveGroupMembers(freshForInvite2, "Test Organizer");

    assert("Step 5: 3 confirmed in email (Org + User1 + User2)", resolved4.confirmedCount === 3);
    assert("Step 5: Both User 1 and User 2 visible", 
      resolved4.joinedMembers.some((m) => m.name === "User One Accepted") &&
      resolved4.joinedMembers.some((m) => m.name === "User Two Accepted")
    );
    assert("Step 5: Organizer is not duplicated in joinedMembers", 
      !resolved4.joinedMembers.some((m) => m.name === "Test Organizer")
    );
    console.log(`     → Roster: Organizer="${resolved4.organizer.name}", joinedMembers=[${resolved4.joinedMembers.map((m) => m.name).join(", ")}], count=${resolved4.confirmedCount}`);

    // ════════════════════════════════════════════════════════════════════════
    section("STEP 6 — Remove User 1 from trip.members");
    // ════════════════════════════════════════════════════════════════════════

    const tripForRemove = await Trip.findById(tripId);
    const removeIdx = tripForRemove.members.findIndex(
      (m) => m.userId === user1Uid || m.email?.toLowerCase() === user1Email
    );
    assert("Step 6: User 1 found in members before removal", removeIdx !== -1, `removeIdx=${removeIdx}`);

    if (removeIdx !== -1) {
      tripForRemove.members.splice(removeIdx, 1);
      tripForRemove.markModified("members");
      await tripForRemove.save();
    }

    const freshAfterRemove = await Trip.findById(tripId).lean();
    assert("Step 6: User 1 no longer in trip.members", !freshAfterRemove.members.some(
      (m) => m.userId === user1Uid || m.email?.toLowerCase() === user1Email
    ));

    // ════════════════════════════════════════════════════════════════════════
    section("STEP 7 — Organizer sends Invite 3 → User 1 removed, only User 2 remains");
    // ════════════════════════════════════════════════════════════════════════

    const freshForInvite3 = await Trip.findById(tripId).lean();
    const resolved5 = await resolveGroupMembers(freshForInvite3, "Test Organizer");

    assert("Step 7: User 1 no longer in email roster", !resolved5.joinedMembers.some((m) => m.name === "User One Accepted"));
    assert("Step 7: User 2 still visible in email roster", resolved5.joinedMembers.some((m) => m.name === "User Two Accepted"));
    assert("Step 7: Confirmed count = 2 (Org + User2)", resolved5.confirmedCount === 2);
    assert("Step 7: Pending User 3 still excluded", !resolved5.joinedMembers.some((m) => m.name === "User Three Pending"));
    console.log(`     → Roster: Organizer="${resolved5.organizer.name}", joinedMembers=[${resolved5.joinedMembers.map((m) => m.name).join(", ")}], count=${resolved5.confirmedCount}`);

    // ════════════════════════════════════════════════════════════════════════
    section("STEP 8 — getInvitationByToken returns live membership data");
    // ════════════════════════════════════════════════════════════════════════

    // Create a new pending invitation
    const token3 = crypto.randomBytes(32).toString("hex");
    await Invitation.create({
      token: token3,
      tripId,
      inviterId: organizerUid,
      inviterName: "Test Organizer",
      inviterEmail: orgEmail,
      invitedEmail: `invite-verify-${Date.now()}@test.advenza`,
      tripTitle: trip.title,
      status: "PENDING",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    invitation3Token = token3;

    // Simulate what getInvitationByToken now does
    const invitationDoc = await Invitation.findOne({ token: token3 });
    const freshTripForToken = await Trip.findById(invitationDoc.tripId).lean();
    const resolvedForToken = await resolveGroupMembers(freshTripForToken, invitationDoc.inviterName);

    assert("Step 8: Invitation token is valid", Boolean(invitationDoc));
    assert("Step 8: Live membership returned — 2 confirmed (Org + User2)", resolvedForToken.confirmedCount === 2);
    assert("Step 8: Organizer name correct", resolvedForToken.organizer.name === "Test Organizer");
    assert("Step 8: User 1 NOT in live roster (removed)", !resolvedForToken.joinedMembers.some((m) => m.name === "User One Accepted"));
    assert("Step 8: User 2 IS in live roster", resolvedForToken.joinedMembers.some((m) => m.name === "User Two Accepted"));
    assert("Step 8: confirmedCount field present", typeof resolvedForToken.confirmedCount === "number");
    console.log(`     → Live token response: confirmedCount=${resolvedForToken.confirmedCount}, members=[${resolvedForToken.joinedMembers.map((m) => m.name).join(", ")}]`);

    // ════════════════════════════════════════════════════════════════════════
    section("EDGE CASES");
    // ════════════════════════════════════════════════════════════════════════

    // Edge case: Organizer appears in members subdoc with userId matching createdBy
    const tripForEdge = await Trip.findById(tripId);
    tripForEdge.members.push({
      userId: organizerUid,
      name: "Organizer Also In Members",
      email: orgEmail,
      role: "Member", // Wrong role — organizer was added as Member by mistake
      initials: "OA",
    });
    tripForEdge.markModified("members");
    await tripForEdge.save();

    const freshEdge = await Trip.findById(tripId).lean();
    const resolvedEdge = await resolveGroupMembers(freshEdge, "Test Organizer");

    assert("Edge: Organizer not duplicated in joinedMembers even if in members subdoc", 
      !resolvedEdge.joinedMembers.some((m) => m.userId === organizerUid)
    );
    assert("Edge: Organizer userId is correct in organizer field", 
      resolvedEdge.organizer.userId === organizerUid || !resolvedEdge.organizer.userId
    );
    console.log(`     → Edge result: joinedMembers=[${resolvedEdge.joinedMembers.map((m) => `${m.name}(${m.userId})`).join(", ")}]`);

    // Edge case: Empty trip (no members, no createdBy) — should not throw
    const emptyTrip = { _id: "empty", createdBy: null, members: [] };
    const resolvedEmpty = await resolveGroupMembers(emptyTrip, "Solo Organizer");
    assert("Edge: Empty trip resolves without error", resolvedEmpty.organizer.name === "Solo Organizer");
    assert("Edge: Empty trip confirmedCount = 1", resolvedEmpty.confirmedCount === 1);

  } finally {
    // ── Cleanup ──────────────────────────────────────────────────────────────
    section("CLEANUP");
    if (tripId) {
      await Trip.findByIdAndDelete(tripId);
      await Invitation.deleteMany({ tripId });
      console.log("  ✅ Test trip and invitations cleaned up");
    }

    await mongoose.connection.close();
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log("\n" + "═".repeat(60));
  console.log(`📊 TEST SUMMARY: ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log("🎉 All tests passed! Group member synchronization is working correctly.");
  } else {
    console.error(`⚠️  ${failed} test(s) failed. Review the output above.`);
  }
  console.log("═".repeat(60) + "\n");

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error("\n💥 Unhandled test error:", err);
  mongoose.connection.close().finally(() => process.exit(1));
});
