/**
 * Advenza — Controlled Live Brevo Delivery Inspector
 *
 * Usage:
 *   1. Check IP authorization status:
 *      node backend/scratch/test_live_brevo_delivery.js
 *
 *   2. Perform controlled live test email dispatch:
 *      node backend/scratch/test_live_brevo_delivery.js <your-authorized-test-email@example.com>
 */

import { config, getClientBaseUrl } from "../config/env.js";
import {
  maskEmail,
  sendBrevoMail,
  sendBrevoGroupInvitationMail,
  checkBrevoDiagnostics,
  getBrevoEmailDeliveryStatus,
} from "../services/mail/brevo-mail.service.js";
import fs from "fs";

async function main() {
  console.log("==============================================================");
  console.log("ADVENZA — LIVE BREVO API & DELIVERY INSPECTOR");
  console.log("==============================================================\n");

  const apiKey = (config.BREVO_API_KEY || "").trim();
  if (!apiKey) {
    console.error("❌ BREVO_API_KEY is not configured in backend/.env!");
    process.exit(1);
  }

  // 1. Check current outgoing public IP
  let publicIp = "Unknown";
  try {
    const ipRes = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(4000) });
    const ipData = await ipRes.json();
    publicIp = ipData.ip;
  } catch (_) {}

  console.log(`[Diagnostic] Outgoing Server Public IP: ${publicIp}`);
  console.log(`[Diagnostic] Configured Sender:         "${config.BREVO_SENDER_NAME}" <${config.BREVO_SENDER_EMAIL}>\n`);

  // 2. Query Brevo Account & Sender Status
  console.log("Querying Brevo Account & IP Authorization Status...");
  const diag = await checkBrevoDiagnostics();

  if (!diag.authenticated) {
    console.log("\n❌ Brevo API Authentication FAILED:");
    console.log(`- Failure Category: ${diag.failureCategory || "BREVO_UNKNOWN_ERROR"}`);
    console.log(`- HTTP Status:      ${diag.httpStatus}`);
    console.log(`- Code:             ${diag.code}`);
    console.log(`- Message:          ${diag.message}`);

    if (diag.isIpBlocked || diag.failureCategory === "BREVO_IP_UNAUTHORIZED") {
      const targetIp = diag.detectedIp || publicIp;
      console.log("\n⚠️ IP AUTHORIZATION REQUIRED:");
      console.log(`Brevo is actively rejecting requests from ${targetIp}.`);
      console.log(`Please add ${targetIp} to your authorized list at:`);
      console.log("👉 https://app.brevo.com/security/authorised_ips");
    } else if (diag.guidance) {
      console.log(`\n💡 Guidance: ${diag.guidance}`);
    }
    return;
  }

  console.log("\n✅ Brevo API Authenticated Successfully!");
  console.log(`- Account Email:     ${diag.email}`);
  console.log(`- Account Company:   ${diag.company}`);
  console.log(`- Daily Credits:     ${diag.credits}`);
  console.log(`- Sender Verified:   ${diag.isSenderVerified ? "YES ✅" : "NO ⚠️ (Unverified Sender)"}`);
  console.log(`- Available Senders: ${diag.availableSenders?.map((s) => `${s.email} (${s.active ? "Active" : "Inactive"})`).join(", ") || "None"}\n`);

  // 3. Controlled Live Test Dispatch (Only if explicitly passed via CLI argument)
  const testRecipient = process.argv[2];

  if (!testRecipient) {
    console.log("--------------------------------------------------------------");
    console.log("ℹ️ No test recipient email provided.");
    console.log("To perform a live controlled send test, run:");
    console.log("  node backend/scratch/test_live_brevo_delivery.js <your-test-email@example.com>");
    console.log("--------------------------------------------------------------");
    return;
  }

  const maskedTo = maskEmail(testRecipient);
  const clientBaseUrl = getClientBaseUrl();
  const testInviteToken = "demo_invite_token_7f9c2d1e";
  const testInviteLink = `${clientBaseUrl}/invite/${testInviteToken}`;

  console.log(`--------------------------------------------------------------`);
  console.log(`Initiating Controlled Live Group Invitation Test to: ${maskedTo}`);
  console.log(`Resolved Base URL: ${clientBaseUrl}`);
  console.log(`Invite Link:       ${testInviteLink}`);
  console.log(`--------------------------------------------------------------`);

  try {
    const sendResult = await sendBrevoGroupInvitationMail({
      to: testRecipient,
      inviterName: "Alex Chen",
      tripTitle: "Royal Heritage Expedition — Rajasthan",
      tripDestination: "Udaipur & Jodhpur, Rajasthan",
      tripDates: "Nov 20 – Nov 25",
      groupMembers: {
        organizer: {
          name: "Alex Chen",
          role: "Organizer",
        },
        joinedMembers: [
          { name: "Priya Sharma", role: "Member" },
          { name: "Kabir Mehta", role: "Member" },
        ],
      },
      inviteLink: testInviteLink,
      expiresInDays: 7,
    });

    console.log("\n✅ Invitation Email Accepted by Brevo Gateway!");
    console.log(`- MessageId:   ${sendResult.messageId}`);
    console.log(`- Recipient:   ${maskedTo}`);
    console.log(`- Duration:    ${sendResult.durationMs}ms`);

    // 4. Inspect real delivery status via Brevo
    console.log("\nPolling Brevo for Real-Time Delivery Confirmation (waiting 3 seconds)...");
    await new Promise((r) => setTimeout(r, 3000));

    const statusResult = await getBrevoEmailDeliveryStatus(sendResult.messageId);
    console.log("\nBrevo Delivery Status Response:");
    console.log(`- Gateway Status: ${statusResult.status || "PROCESSING"}`);
    if (statusResult.deliveredAt) {
      console.log(`- Delivered At:   ${statusResult.deliveredAt} ✅`);
    } else {
      console.log("- Status Note:    Message is queued/processing on Brevo relay.");
    }
  } catch (sendErr) {
    console.error("\n❌ Live Send Failed:", sendErr.message);
    if (sendErr.brevoCode) console.error("- Brevo Error Code:", sendErr.brevoCode);
  }
}

main().catch((err) => {
  console.error("Fatal Error:", err);
  process.exit(1);
});
