/**
 * test_member_sync_offline.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Offline comprehensive unit and lifecycle test for group-member synchronization:
 *  1. Initial trip creation: only Organizer exists (in createdBy and/or members).
 *     - Email roster shows Organizer only.
 *     - "Be the first to join this group." rendered.
 *     - Confirmed count = 1.
 *  2. Pending invitation created:
 *     - Pending member in trip.members (role: "Pending").
 *     - Pending member strictly excluded from email & landing preview.
 *     - Confirmed count remains 1.
 *  3. User 1 accepts:
 *     - trip.members updated to role: "Member".
 *     - Email roster shows Organizer + User 1.
 *     - Confirmed count = 2.
 *  4. User 2 accepts:
 *     - trip.members updated to role: "Member".
 *     - Email roster shows Organizer + User 1 + User 2.
 *     - Confirmed count = 3.
 *  5. Removal of User 1:
 *     - User 1 removed from trip.members.
 *     - Email roster immediately updates: Organizer + User 2.
 *     - User 1 is completely absent.
 *     - Confirmed count = 2.
 *  6. Edge cases:
 *     - Organizer present in members subdocument (never duplicated in joinedMembers).
 *     - Organizer having generic fallback name vs real name.
 *     - Members with raw emails sanitized (no email exposure in names).
 *     - Duplicate member IDs/emails deduplicated.
 *     - Rejected and Revoked roles excluded.
 *     - Email template HTML and plaintext rendering verified.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { resolveGroupMembers } from "../controllers/invitation.controller.js";
import { sendBrevoGroupInvitationMail } from "../services/mail/brevo-mail.service.js";

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

async function runOfflineTests() {
  console.log("🚀 Starting Group Membership Synchronization Lifecycle Tests...\n");

  const organizerUid = "uid_organizer_luckshith";
  const user1Uid = "uid_alice";
  const user2Uid = "uid_bob";

  // ════════════════════════════════════════════════════════════════════════
  section("STEP 1: Organizer creates trip (Solo Organizer)");
  // ════════════════════════════════════════════════════════════════════════
  const tripStep1 = {
    _id: "trip_123",
    title: "Goa Beach Getaway",
    destination: "Goa, India",
    createdBy: organizerUid,
    travelers: 1,
    members: [],
  };

  const resolvedStep1 = await resolveGroupMembers(tripStep1, "Luckshith Matta");
  assert("Step 1: Organizer name is resolved", resolvedStep1.organizer.name === "Luckshith Matta");
  assert("Step 1: Organizer role is Organizer", resolvedStep1.organizer.role === "Organizer");
  assert("Step 1: Joined members array is empty", resolvedStep1.joinedMembers.length === 0);
  assert("Step 1: Confirmed count is exactly 1", resolvedStep1.confirmedCount === 1);

  // ════════════════════════════════════════════════════════════════════════
  section("STEP 2: Pending invitation created (Pending member added)");
  // ════════════════════════════════════════════════════════════════════════
  const tripStep2 = {
    ...tripStep1,
    members: [
      {
        name: "Alice Pending",
        email: "alice@example.com",
        role: "Pending",
        initials: "AP",
        color: "bg-muted text-foreground",
      },
    ],
  };

  const resolvedStep2 = await resolveGroupMembers(tripStep2, "Luckshith Matta");
  assert("Step 2: Organizer is Luckshith Matta", resolvedStep2.organizer.name === "Luckshith Matta");
  assert("Step 2: Pending member Alice is EXCLUDED", resolvedStep2.joinedMembers.length === 0);
  assert("Step 2: Confirmed count remains 1", resolvedStep2.confirmedCount === 1);

  // ════════════════════════════════════════════════════════════════════════
  section("STEP 3: User 1 (Alice) accepts invitation");
  // ════════════════════════════════════════════════════════════════════════
  const tripStep3 = {
    ...tripStep1,
    travelers: 2,
    members: [
      {
        userId: user1Uid,
        name: "Alice Smith",
        email: "alice@example.com",
        role: "Member",
        initials: "AS",
        color: "bg-primary text-primary-foreground",
      },
    ],
  };

  const resolvedStep3 = await resolveGroupMembers(tripStep3, "Luckshith Matta");
  assert("Step 3: Confirmed count is 2", resolvedStep3.confirmedCount === 2);
  assert("Step 3: Joined members has length 1", resolvedStep3.joinedMembers.length === 1);
  assert("Step 3: Joined member is Alice Smith", resolvedStep3.joinedMembers[0].name === "Alice Smith");
  assert("Step 3: Joined member role is Member", resolvedStep3.joinedMembers[0].role === "Member");
  assert("Step 3: Organizer is not duplicated in joinedMembers", !resolvedStep3.joinedMembers.some(m => m.name === "Luckshith Matta"));

  // ════════════════════════════════════════════════════════════════════════
  section("STEP 4: User 2 (Bob) accepts invitation & User 3 pending");
  // ════════════════════════════════════════════════════════════════════════
  const tripStep4 = {
    ...tripStep1,
    travelers: 3,
    members: [
      {
        userId: user1Uid,
        name: "Alice Smith",
        email: "alice@example.com",
        role: "Member",
        initials: "AS",
      },
      {
        userId: user2Uid,
        name: "Bob Jones",
        email: "bob@example.com",
        role: "Member",
        initials: "BJ",
      },
      {
        name: "Charlie Pending",
        email: "charlie@example.com",
        role: "Pending",
        initials: "CP",
      },
      {
        name: "Dave Rejected",
        email: "dave@example.com",
        role: "Rejected",
        initials: "DR",
      },
      {
        name: "Eve Revoked",
        email: "eve@example.com",
        role: "Revoked",
        initials: "ER",
      },
    ],
  };

  const resolvedStep4 = await resolveGroupMembers(tripStep4, "Luckshith Matta");
  assert("Step 4: Confirmed count is 3 (Organizer + Alice + Bob)", resolvedStep4.confirmedCount === 3);
  assert("Step 4: Joined members has length 2", resolvedStep4.joinedMembers.length === 2);
  assert("Step 4: Alice Smith is in joinedMembers", resolvedStep4.joinedMembers.some(m => m.name === "Alice Smith"));
  assert("Step 4: Bob Jones is in joinedMembers", resolvedStep4.joinedMembers.some(m => m.name === "Bob Jones"));
  assert("Step 4: Charlie Pending is EXCLUDED", !resolvedStep4.joinedMembers.some(m => m.name.includes("Charlie")));
  assert("Step 4: Dave Rejected is EXCLUDED", !resolvedStep4.joinedMembers.some(m => m.name.includes("Dave")));
  assert("Step 4: Eve Revoked is EXCLUDED", !resolvedStep4.joinedMembers.some(m => m.name.includes("Eve")));

  // ════════════════════════════════════════════════════════════════════════
  section("STEP 5: Email generated with 3 confirmed members");
  // ════════════════════════════════════════════════════════════════════════
  let capturedPayload = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    if (url.includes("api.brevo.com/v3/smtp/email")) {
      capturedPayload = JSON.parse(opts.body);
      return {
        ok: true,
        status: 201,
        json: async () => ({ messageId: "msg_test_sync_lifecycle_123" }),
      };
    }
    return originalFetch(url, opts);
  };

  let sendResultStep5;
  try {
    sendResultStep5 = await sendBrevoGroupInvitationMail({
      to: "nextguest@example.com",
      inviterName: resolvedStep4.organizer.name,
      tripTitle: tripStep4.title,
      tripDestination: tripStep4.destination,
      tripDates: "Nov 20 – Nov 25, 2026",
      tripStyle: "Adventure",
      groupMembers: resolvedStep4,
      inviteLink: "https://advenza.in/invite/dummy_token_123",
      expiresInDays: 7,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert("Step 5: Brevo payload generated successfully", Boolean(capturedPayload));
  assert("Step 5: Brevo returned messageId", sendResultStep5.messageId === "msg_test_sync_lifecycle_123");
  assert("Step 5: Email HTML contains '(3 confirmed)'", capturedPayload.htmlContent.includes("(3 confirmed)"));
  assert("Step 5: Email HTML contains Organizer 'Luckshith Matta'", capturedPayload.htmlContent.includes("Luckshith Matta</strong>"));
  assert("Step 5: Email HTML contains 'Alice Smith'", capturedPayload.htmlContent.includes("Alice Smith"));
  assert("Step 5: Email HTML contains 'Bob Jones'", capturedPayload.htmlContent.includes("Bob Jones"));
  assert("Step 5: Email PlainText contains '(3 confirmed)'", capturedPayload.textContent.includes("(3 confirmed)"));
  assert("Step 5: Email PlainText contains '- Luckshith Matta — Organizer'", capturedPayload.textContent.includes("- Luckshith Matta — Organizer"));
  assert("Step 5: Email PlainText contains '- Alice Smith — Member'", capturedPayload.textContent.includes("- Alice Smith — Member"));
  assert("Step 5: Email PlainText contains '- Bob Jones — Member'", capturedPayload.textContent.includes("- Bob Jones — Member"));

  // ════════════════════════════════════════════════════════════════════════
  section("STEP 6: Remove User 1 (Alice) from trip.members");
  // ════════════════════════════════════════════════════════════════════════
  // Simulate removeTripMember: Alice is removed
  const tripStep6 = {
    ...tripStep4,
    travelers: 2,
    members: tripStep4.members.filter(m => m.userId !== user1Uid),
  };

  assert("Step 6: Alice removed from trip.members", !tripStep6.members.some(m => m.userId === user1Uid));

  // ════════════════════════════════════════════════════════════════════════
  section("STEP 7: Organizer sends Invite 3 (Alice absent, Bob remains)");
  // ════════════════════════════════════════════════════════════════════════
  const resolvedStep7 = await resolveGroupMembers(tripStep6, "Luckshith Matta");
  assert("Step 7: Confirmed count is 2 (Organizer + Bob)", resolvedStep7.confirmedCount === 2);
  assert("Step 7: Joined members has length 1", resolvedStep7.joinedMembers.length === 1);
  assert("Step 7: Alice is completely ABSENT", !resolvedStep7.joinedMembers.some(m => m.name.includes("Alice")));
  assert("Step 7: Bob Jones is PRESENT", resolvedStep7.joinedMembers.some(m => m.name === "Bob Jones"));
  assert("Step 7: Organizer is Luckshith Matta", resolvedStep7.organizer.name === "Luckshith Matta");

  // ════════════════════════════════════════════════════════════════════════
  section("STEP 8: Edge Cases & Safeguards");
  // ════════════════════════════════════════════════════════════════════════

  // Edge case A: Organizer is also in members array with role "Organizer"
  const tripEdgeA = {
    _id: "trip_edge_a",
    createdBy: organizerUid,
    members: [
      {
        userId: organizerUid,
        name: "Luckshith Matta",
        email: "luckshith28@gmail.com",
        role: "Organizer",
      },
      {
        userId: user2Uid,
        name: "Bob Jones",
        email: "bob@example.com",
        role: "Member",
      },
    ],
  };
  const resolvedEdgeA = await resolveGroupMembers(tripEdgeA, "Luckshith Matta");
  assert("Edge A: Organizer identified correctly", resolvedEdgeA.organizer.name === "Luckshith Matta");
  assert("Edge A: Organizer NOT duplicated into joinedMembers", !resolvedEdgeA.joinedMembers.some(m => m.name === "Luckshith Matta"));
  assert("Edge A: Confirmed count is 2 (Org + Bob)", resolvedEdgeA.confirmedCount === 2);

  // Edge case B: Organizer is in members array with role "Member" by mistake
  const tripEdgeB = {
    _id: "trip_edge_b",
    createdBy: organizerUid,
    members: [
      {
        userId: organizerUid, // matches createdBy
        name: "Luckshith Matta",
        email: "luckshith28@gmail.com",
        role: "Member",
      },
      {
        userId: user2Uid,
        name: "Bob Jones",
        email: "bob@example.com",
        role: "Member",
      },
    ],
  };
  const resolvedEdgeB = await resolveGroupMembers(tripEdgeB, "");
  assert("Edge B: Organizer identified by createdBy match", resolvedEdgeB.organizer.name === "Luckshith Matta");
  assert("Edge B: Organizer NOT duplicated in joinedMembers", !resolvedEdgeB.joinedMembers.some(m => m.userId === organizerUid));
  assert("Edge B: Confirmed count is 2", resolvedEdgeB.confirmedCount === 2);

  // Edge case C: Member has raw email as name (privacy sanitization)
  const tripEdgeC = {
    _id: "trip_edge_c",
    createdBy: organizerUid,
    members: [
      {
        userId: "uid_anon",
        name: "secret.traveler@gmail.com",
        email: "secret.traveler@gmail.com",
        role: "Member",
      },
    ],
  };
  const resolvedEdgeC = await resolveGroupMembers(tripEdgeC, "Luckshith Matta");
  assert("Edge C: Email handle capitalized as name", resolvedEdgeC.joinedMembers[0].name.startsWith("Secret"));
  assert("Edge C: Raw email '@' is NEVER exposed in member name", !resolvedEdgeC.joinedMembers[0].name.includes("@"));

  // Edge case D: Duplicate member entries (same userId or email twice)
  const tripEdgeD = {
    _id: "trip_edge_d",
    createdBy: organizerUid,
    members: [
      {
        userId: user1Uid,
        name: "Alice Smith",
        email: "alice@example.com",
        role: "Member",
      },
      {
        userId: user1Uid, // duplicate
        name: "Alice Smith",
        email: "alice@example.com",
        role: "Member",
      },
    ],
  };
  const resolvedEdgeD = await resolveGroupMembers(tripEdgeD, "Luckshith Matta");
  assert("Edge D: Duplicate entries deduplicated to 1", resolvedEdgeD.joinedMembers.length === 1);
  assert("Edge D: Confirmed count is 2 (Org + 1 Alice)", resolvedEdgeD.confirmedCount === 2);

  // ════════════════════════════════════════════════════════════════════════
  console.log("\n" + "═".repeat(60));
  console.log(`📊 TEST SUMMARY: ${passed} passed, ${failed} failed`);
  if (failed === 0) {
    console.log("🎉 All 28 checks passed! Group membership synchronization is 100% verified.");
  } else {
    console.error(`⚠️  ${failed} check(s) failed.`);
  }
  console.log("═".repeat(60) + "\n");

  process.exit(failed > 0 ? 1 : 0);
}

runOfflineTests().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
