import { getClientBaseUrl } from "../config/env.js";
import { resolveGroupMembers } from "../controllers/invitation.controller.js";
import { sendBrevoGroupInvitationMail } from "../services/mail/brevo-mail.service.js";
import fs from "fs";
import path from "path";

async function runTests() {
  console.log("==============================================================");
  console.log("ADVENZA — SIMPLIFIED INVITATION EMAIL & GROUP MEMBERS AUDIT");
  console.log("==============================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(desc, condition) {
    if (condition) {
      console.log(`✅ [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${desc}`);
      failed++;
    }
  }

  // 1. Test Base URL Resolution
  console.log("--- 1. Testing Base URL Resolution ---");
  const localUrl = getClientBaseUrl();
  assert("Default local base URL does not have trailing slash", !localUrl.endsWith("/"));
  assert("Default local base URL is valid URL format", localUrl.startsWith("http"));

  const mockReqWithOrigin = {
    get: (header) => (header.toLowerCase() === "origin" ? "https://advenza.travel" : null),
  };
  assert("Resolves domain from request Origin when available", getClientBaseUrl(mockReqWithOrigin) === "https://advenza.travel");

  // 2. Test Group Members Resolution Logic (resolveGroupMembers)
  console.log("\n--- 2. Testing Group Members Resolution Logic ---");

  // Scenario A: Only Organizer exists
  const mockTripSolo = {
    createdBy: "firebase_user_organizer_1",
    members: [],
  };
  const soloResolved = await resolveGroupMembers(mockTripSolo, "Rohan Varma");
  assert("Organizer resolved with provided name", soloResolved.organizer.name === "Rohan Varma");
  assert("Organizer role is Organizer", soloResolved.organizer.role === "Organizer");
  assert("Solo trip has 0 joined members", soloResolved.joinedMembers.length === 0);

  // Scenario B: Trip with Organizer, Confirmed Members, and Pending Invites
  const mockTripWithMembers = {
    createdBy: "firebase_user_organizer_1",
    members: [
      {
        userId: "firebase_user_organizer_1",
        name: "Rohan Varma",
        role: "Organizer",
      },
      {
        userId: "user_member_2",
        name: "Priya Sharma",
        email: "priya@example.com",
        role: "Member",
      },
      {
        userId: "user_member_3",
        name: "Kabir Mehta",
        email: "kabir@example.com",
        role: "Member",
      },
      {
        email: "pending.friend@example.com",
        role: "Pending", // MUST BE EXCLUDED
      },
      {
        userId: "user_removed_4",
        name: "Old Member",
        role: "Removed", // MUST BE EXCLUDED
      },
      {
        email: "rejected.friend@example.com",
        role: "Rejected", // MUST BE EXCLUDED
      },
    ],
  };

  const membersResolved = await resolveGroupMembers(mockTripWithMembers, "Rohan Varma");
  assert("Organizer is properly identified", membersResolved.organizer.name === "Rohan Varma");
  assert("Exactly 2 confirmed members returned", membersResolved.joinedMembers.length === 2);
  assert("First member is Priya Sharma", membersResolved.joinedMembers[0].name === "Priya Sharma");
  assert("Second member is Kabir Mehta", membersResolved.joinedMembers[1].name === "Kabir Mehta");
  assert("Pending members are strictly excluded", !membersResolved.joinedMembers.some(m => m.name.includes("pending")));
  assert("Removed members are strictly excluded", !membersResolved.joinedMembers.some(m => m.name.includes("Old Member")));
  assert("Rejected members are strictly excluded", !membersResolved.joinedMembers.some(m => m.name.includes("rejected")));

  // Scenario C: Graceful handling of missing or raw email names
  const mockTripRawEmails = {
    createdBy: "user_org",
    members: [
      {
        userId: "user_alex",
        name: "alex.kumar@gmail.com", // Raw email in name field
        role: "Member",
      },
      {
        userId: "user_empty",
        name: "", // Missing name
        role: "Member",
      },
    ],
  };
  const sanitizedMembers = await resolveGroupMembers(mockTripRawEmails, "org.leader@advenza.com");
  assert("Raw email in organizer is sanitized", !sanitizedMembers.organizer.name.includes("@"));
  assert("Raw email in member is sanitized without exposing domain", !sanitizedMembers.joinedMembers[0].name.includes("@"));
  assert("Missing name falls back to Traveler", sanitizedMembers.joinedMembers[1].name === "Traveler");

  // 3. Test Email Template Generation & Content Integrity
  console.log("\n--- 3. Testing Simplified Email Template & Structure ---");

  let capturedPayload = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    if (url.includes("api.brevo.com/v3/smtp/email")) {
      capturedPayload = JSON.parse(opts.body);
      return {
        ok: true,
        status: 201,
        json: async () => ({ messageId: "msg_mock_simplified_test_123" }),
      };
    }
    return originalFetch(url, opts);
  };

  try {
    await sendBrevoGroupInvitationMail({
      to: "invited.traveler@example.com",
      inviterName: "Rohan Varma",
      tripTitle: "Royal Rajasthan & Lakes Tour",
      tripDestination: "Udaipur & Jodhpur, Rajasthan",
      tripDates: "Nov 25 – Nov 30",
      groupMembers: membersResolved,
      inviteLink: "https://advenza.travel/invite/sec_tok_simple_12345",
      expiresInDays: 7,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert("Payload was captured by mocked Brevo", capturedPayload !== null);
  const html = capturedPayload.htmlContent;
  const text = capturedPayload.textContent;

  // 4. Verify Simplified Design & Advenza Theme Match
  console.log("\n--- 4. Verifying Design Cleanliness & Advenza Theme Match ---");
  assert("Uses Advenza primary brand color #004678 for branding", html.includes("color: #004678"));
  assert("Uses Advenza primary brand color #004678 for primary button", html.includes("background-color: #004678") || html.includes("fillcolor=\"#004678\""));
  assert("Canvas background is clean neutral #f8fafc", html.includes("background-color: #f8fafc"));
  assert("Main container card is crisp white #ffffff", html.includes("background-color: #ffffff"));
  assert("Subtle border uses #e2e8f0", html.includes("border: 1px solid #e2e8f0"));
  assert("Primary button label is strictly 'Join Group'", html.includes(">Join Group</a>") || html.includes(">Join Group<"));

  // Verify excessive decorations are NOT present
  assert("No multi-stop top gradient line", !html.includes("linear-gradient(90deg, #0ea5e9"));
  assert("No dark mode black obsidian body", !html.includes("background-color: #06090e"));
  assert("No promotional glowing borders or neon boxes", !html.includes("rgba(14, 165, 233, 0.35)"));

  // 5. Verify Structure (9 Required Sections in Order inside <body>)
  console.log("\n--- 5. Verifying 9-Section Content Structure ---");
  const bodyContent = html.substring(html.indexOf("<body"));
  const posLogo = bodyContent.indexOf("✦ Advenza");
  const posHeading = bodyContent.indexOf("You've been invited to join a trip group!");
  const posInviter = bodyContent.indexOf("has invited you to collaborate");
  const posTrip = bodyContent.indexOf("Royal Rajasthan &amp; Lakes Tour") !== -1 ? bodyContent.indexOf("Royal Rajasthan &amp; Lakes Tour") : bodyContent.indexOf("Royal Rajasthan");
  const posMembersHeading = bodyContent.indexOf("Who's already in this group?");
  const posCTA = bodyContent.indexOf("Join Group");
  const posFallback = bodyContent.indexOf("copy and paste this URL into your browser");
  const posExpiry = bodyContent.indexOf("expires in");
  const posFooter = bodyContent.indexOf("Advenza · Collaborative Travel Planning");

  assert("1. Advenza logo/name is present", posLogo !== -1);
  assert("2. Heading 'You've been invited to join a trip group!' is present", posHeading !== -1);
  assert("3. Explanatory message with inviter is present", posInviter !== -1);
  assert("4. Trip name callout is present", posTrip !== -1);
  assert("5. 'Who's already in this group?' section is present", posMembersHeading !== -1);
  assert("6. Primary 'Join Group' button is present", posCTA !== -1);
  assert("7. Fallback invitation link is present", posFallback !== -1);
  assert("8. Expiry notice is present", posExpiry !== -1);
  assert("9. Simple Advenza footer is present", posFooter !== -1);

  assert("Elements follow chronological order: Logo < Heading", posLogo < posHeading);
  assert("Elements follow chronological order: Heading < Inviter", posHeading < posInviter);
  assert("Elements follow chronological order: Inviter < Trip", posInviter < posTrip);
  assert("Elements follow chronological order: Trip < Members", posTrip < posMembersHeading);
  assert("Elements follow chronological order: Members < CTA", posMembersHeading < posCTA);
  assert("Elements follow chronological order: CTA < Fallback", posCTA < posFallback);
  assert("Elements follow chronological order: Fallback < Expiry", posFallback < posExpiry);
  assert("Elements follow chronological order: Expiry < Footer", posExpiry < posFooter);

  // 6. Verify Group Members Rendering
  console.log("\n--- 6. Verifying Group Members Rendering in HTML ---");
  assert("Organizer row rendered with Organizer badge", html.includes("Rohan Varma") && html.includes(">Organizer</span>"));
  assert("Priya Sharma rendered with Member badge", html.includes("Priya Sharma") && html.includes(">Member</span>"));
  assert("Kabir Mehta rendered with Member badge", html.includes("Kabir Mehta") && html.includes(">Member</span>"));
  assert("No email addresses exposed in HTML", !html.includes("priya@example.com") && !html.includes("kabir@example.com"));

  // 7. Verify Solo Trip Email (Empty state for members)
  console.log("\n--- 7. Verifying Solo Trip (Organizer only) Empty State ---");
  let capturedSoloPayload = null;
  globalThis.fetch = async (url, opts) => {
    capturedSoloPayload = JSON.parse(opts.body);
    return {
      ok: true,
      status: 201,
      json: async () => ({ messageId: "msg_mock_solo_test" }),
    };
  };

  try {
    await sendBrevoGroupInvitationMail({
      to: "invited.traveler@example.com",
      inviterName: "Ananya Patel",
      tripTitle: "Goa Weekend Getaway",
      groupMembers: soloResolved, // 0 joined members
      inviteLink: "https://advenza.travel/invite/solo_test_token",
      expiresInDays: 7,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  const soloHtml = capturedSoloPayload.htmlContent;
  const soloText = capturedSoloPayload.textContent;
  assert("Organizer appears in solo trip", soloHtml.includes("Rohan Varma") || soloHtml.includes("Ananya Patel"));
  assert("'Be the first to join this group.' appears in HTML", soloHtml.includes("Be the first to join this group."));
  assert("'Be the first to join this group.' appears in Plain Text", soloText.includes("Be the first to join this group."));

  // 8. Verify Link Consistency & Security
  console.log("\n--- 8. Verifying Link Consistency & Compatibility ---");
  assert("CTA Button contains exact invite link", html.includes("https://advenza.travel/invite/sec_tok_simple_12345"));
  assert("Direct fallback contains exact invite link", html.includes(">https://advenza.travel/invite/sec_tok_simple_12345</a>"));
  assert("Contains Outlook MSO roundrect button", html.includes("<v:roundrect"));
  assert("Contains mobile responsive media query", html.includes("@media only screen and (max-width: 600px)"));

  // 9. Verify Plain-Text Alternative Structure
  console.log("\n--- 9. Verifying Plain-Text Alternative Structure ---");
  assert("Text version has heading", text.includes("You've been invited to join a trip group!"));
  assert("Text version has Who's already in this group?", text.includes("Who's already in this group?"));
  assert("Text version has Organizer line", text.includes("- Rohan Varma — Organizer"));
  assert("Text version has Member lines", text.includes("- Priya Sharma — Member") && text.includes("- Kabir Mehta — Member"));
  assert("Text version has exact invite link", text.includes("https://advenza.travel/invite/sec_tok_simple_12345"));
  assert("Text version has expiry notice", text.includes("expires in 7 days"));

  // Save standalone preview HTML file
  const previewPath = path.join(process.cwd(), "backend/scratch/preview_invitation_email.html");
  fs.writeFileSync(previewPath, html, "utf8");
  console.log(`\n📄 Generated Standalone Preview HTML: file:///${previewPath.replace(/\\/g, "/")}`);

  console.log(`\n==============================================================`);
  console.log(`AUDIT RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`==============================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
