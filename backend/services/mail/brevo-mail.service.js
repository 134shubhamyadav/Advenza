import { config } from "../../config/env.js";
import { logger } from "../../utils/logger.js";

/**
 * Escapes HTML characters to prevent XSS in email bodies.
 */
function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Builds a clean, branded HTML email template for Advenza Travel Companion.
 */
function buildEmailTemplate({ subject, message, tripTitle, senderName }) {
  const safeSubject = escapeHtml(subject);
  const safeTripTitle = tripTitle ? escapeHtml(tripTitle) : null;
  const safeSenderName = escapeHtml(senderName || "Advenza Travel Companion");
  
  // Format message lines safely preserving whitespace
  const formattedBody = escapeHtml(message)
    .split("\n")
    .map((line) => line.trim() === "" ? "<br/>" : `<p style="margin: 0 0 12px 0; line-height: 1.6;">${line}</p>`)
    .join("");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeSubject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b1118; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e2e8f0;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #0b1118; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #131c27; border: 1px solid #1e293b; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);">
          <!-- Header with Gradient Accent -->
          <tr>
            <td style="background: linear-gradient(135deg, #0ea5e9 0%, #6366f1 50%, #d946ef 100%); height: 4px;"></td>
          </tr>
          <tr>
            <td style="padding: 28px 32px; border-bottom: 1px solid #1e293b;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">
                      ✦ Advenza <span style="font-size: 13px; font-weight: 500; color: #38bdf8; background-color: rgba(56, 189, 248, 0.12); padding: 3px 8px; border-radius: 9999px; margin-left: 8px;">Travel Companion</span>
                    </h1>
                  </td>
                </tr>
                ${safeTripTitle ? `
                <tr>
                  <td style="padding-top: 6px;">
                    <span style="font-size: 12px; color: #94a3b8;">Trip: <strong style="color: #cbd5e1;">${safeTripTitle}</strong></span>
                  </td>
                </tr>
                ` : ""}
              </table>
            </td>
          </tr>

          <!-- Subject Banner -->
          <tr>
            <td style="padding: 24px 32px 12px 32px;">
              <h2 style="margin: 0; font-size: 18px; font-weight: 600; color: #f8fafc; line-height: 1.4;">
                ${safeSubject}
              </h2>
            </td>
          </tr>

          <!-- Message Body -->
          <tr>
            <td style="padding: 12px 32px 28px 32px;">
              <div style="background-color: #182230; border: 1px solid #243245; border-radius: 12px; padding: 20px; font-size: 14px; color: #cbd5e1;">
                ${formattedBody}
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px 24px 32px; border-top: 1px solid #1e293b; background-color: #0f1722; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.5;">
                Sent via <strong>${safeSenderName}</strong>
              </p>
              <p style="margin: 6px 0 0 0; font-size: 11px; color: #475569;">
                Advenza AI-powered Travel Platform • Plan beyond the map.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Sends an email using the Brevo (Sendinblue) Transactional REST API v3.
 *
 * @param {Object} params
 * @param {string} params.to - Recipient email address
 * @param {string} [params.recipientName] - Recipient name
 * @param {string} params.subject - Email subject
 * @param {string} params.message - Email plain text content
 * @param {string} [params.tripTitle] - Optional trip context
 * @param {string} [params.senderEmail] - Optional custom sender email
 * @param {string} [params.senderName] - Optional custom sender name
 * @returns {Promise<{ success: boolean, messageId: string, recipient: string }>}
 */
export async function sendBrevoMail({
  to,
  recipientName,
  subject,
  message,
  tripTitle,
  senderEmail,
  senderName,
}) {
  const apiKey = (config.BREVO_API_KEY || "").trim();

  if (!apiKey) {
    const errorMsg = "Brevo API key is not configured on the server.";
    logger.error(`[Brevo Mail Service] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  const effectiveSenderEmail = senderEmail || config.BREVO_SENDER_EMAIL || "advenzaaa@gmail.com";
  const effectiveSenderName = senderName || config.BREVO_SENDER_NAME || "Advenza Travel Companion";

  const htmlContent = buildEmailTemplate({
    subject,
    message,
    tripTitle,
    senderName: effectiveSenderName,
  });

  const payload = {
    sender: {
      name: effectiveSenderName,
      email: effectiveSenderEmail,
    },
    to: [
      {
        email: to.trim().toLowerCase(),
        name: (recipientName || to.split("@")[0]).trim(),
      },
    ],
    subject: subject.trim(),
    htmlContent,
    textContent: message.trim(),
  };

  logger.info(`[Brevo Mail Service] Sending email to ${payload.to[0].email} with subject "${subject}"...`);

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      const errorDetail = data?.message || data?.error || `HTTP ${response.status} from Brevo API`;
      logger.error(`[Brevo Mail Service] Brevo API rejected request (${response.status}):`, data);
      const err = new Error(`Brevo sending failed: ${errorDetail}`);
      err.status = response.status;
      err.brevoCode = data?.code;
      throw err;
    }

    logger.info(`[Brevo Mail Service] Email successfully sent to ${to}. MessageId: ${data.messageId}`);
    return {
      success: true,
      messageId: data.messageId,
      recipient: to,
    };
  } catch (err) {
    logger.error(`[Brevo Mail Service] Error sending email: ${err.message}`);
    throw err;
  }
}

/**
 * Builds a dedicated branded HTML invitation template for joining an Advenza trip / consensus group.
 */
function buildInvitationEmailTemplate({
  inviterName,
  tripTitle,
  inviteLink,
  expiresInDays = 7,
  senderName,
}) {
  const safeInviter = escapeHtml(inviterName || "A fellow traveler");
  const safeTripTitle = escapeHtml(tripTitle || "Trip Group");
  const safeLink = escapeHtml(inviteLink);
  const safeSenderName = escapeHtml(senderName || "Advenza Travel Companion");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You've been invited to join ${safeTripTitle} on Advenza</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b1118; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e2e8f0;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #0b1118; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 580px; background-color: #131c27; border: 1px solid #1e293b; border-radius: 20px; overflow: hidden; box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);">
          <!-- Gradient Top Accent Bar -->
          <tr>
            <td style="background: linear-gradient(135deg, #0ea5e9 0%, #6366f1 50%, #d946ef 100%); height: 5px;"></td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px 32px; border-bottom: 1px solid #1e293b; text-align: center;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
                ✦ Advenza
              </h1>
              <p style="margin: 6px 0 0 0; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; color: #38bdf8;">
                Trip Group Invitation
              </p>
            </td>
          </tr>

          <!-- Invitation Hero Body -->
          <tr>
            <td style="padding: 32px 32px 24px 32px; text-align: center;">
              <div style="display: inline-block; background-color: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 9999px; padding: 6px 16px; margin-bottom: 20px;">
                <span style="font-size: 13px; font-weight: 600; color: #38bdf8;">
                  ✨ Consensus & Group Planning
                </span>
              </div>
              
              <h2 style="margin: 0 0 14px 0; font-size: 20px; font-weight: 700; color: #f8fafc; line-height: 1.35;">
                ${safeInviter} has invited you to join <br/>
                <span style="color: #38bdf8; font-style: normal;">"${safeTripTitle}"</span>
              </h2>

              <p style="margin: 0 0 28px 0; font-size: 14px; color: #94a3b8; line-height: 1.6; max-width: 460px; margin-left: auto; margin-right: auto;">
                You've been invited to collaborate on this trip group. Cast your votes in Consensus, decide on activities, and coordinate group travel plans seamlessly together.
              </p>

              <!-- Join CTA Button -->
              <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
                <tr>
                  <td align="center" style="border-radius: 12px; background: linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%); box-shadow: 0 4px 16px rgba(14, 165, 233, 0.35);">
                    <a href="${safeLink}" target="_blank" style="display: inline-block; padding: 14px 36px; font-size: 15px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 12px; letter-spacing: 0.2px;">
                      Join Group & Vote →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Direct Link Fallback -->
              <p style="margin: 28px 0 0 0; font-size: 11px; color: #64748b; line-height: 1.5; word-break: break-all;">
                Or copy and paste this link in your browser:<br/>
                <a href="${safeLink}" style="color: #38bdf8; text-decoration: underline;">${safeLink}</a>
              </p>
            </td>
          </tr>

          <!-- Expiration Notice -->
          <tr>
            <td style="padding: 0 32px 24px 32px;">
              <div style="background-color: #182230; border: 1px solid #243245; border-radius: 12px; padding: 14px 20px; text-align: center;">
                <p style="margin: 0; font-size: 12px; color: #cbd5e1;">
                  ⏳ <strong>Note:</strong> This invitation link is personal and expires in <strong>${expiresInDays} days</strong>.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px 24px 32px; border-top: 1px solid #1e293b; background-color: #0f1722; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #64748b;">
                Sent via <strong>${safeSenderName}</strong>
              </p>
              <p style="margin: 6px 0 0 0; font-size: 11px; color: #475569;">
                Advenza AI-powered Travel Platform • Plan beyond the map.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Sends a Group / Consensus invitation email via Brevo transactional service.
 *
 * @param {Object} params
 * @param {string} params.to - Recipient email address
 * @param {string} [params.inviterName] - Name of user sending the invitation
 * @param {string} params.tripTitle - Name of the trip/group
 * @param {string} params.inviteLink - Full secure invitation link
 * @param {number} [params.expiresInDays=7] - Number of days until token expires
 * @returns {Promise<{ success: boolean, messageId: string, recipient: string }>}
 */
export async function sendBrevoGroupInvitationMail({
  to,
  inviterName,
  tripTitle,
  inviteLink,
  expiresInDays = 7,
}) {
  const apiKey = (config.BREVO_API_KEY || "").trim();

  if (!apiKey) {
    const errorMsg = "Brevo API key is not configured on the server.";
    logger.error(`[Brevo Mail Service] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  const effectiveSenderEmail = config.BREVO_SENDER_EMAIL || "advenzaaa@gmail.com";
  const effectiveSenderName = config.BREVO_SENDER_NAME || "Advenza Travel Companion";

  const subject = `${inviterName || "A fellow traveler"} invited you to join "${tripTitle}" on Advenza`;

  const htmlContent = buildInvitationEmailTemplate({
    inviterName,
    tripTitle,
    inviteLink,
    expiresInDays,
    senderName: effectiveSenderName,
  });

  const textContent = `${inviterName || "A fellow traveler"} has invited you to join the trip "${tripTitle}" on Advenza.\n\nClick the link below to join the group and participate in consensus decisions:\n${inviteLink}\n\nThis invitation link expires in ${expiresInDays} days.`;

  const payload = {
    sender: {
      name: effectiveSenderName,
      email: effectiveSenderEmail,
    },
    to: [
      {
        email: to.trim().toLowerCase(),
        name: to.split("@")[0].trim(),
      },
    ],
    subject,
    htmlContent,
    textContent,
  };

  logger.info(`[Brevo Mail Service] Sending group invitation email to ${payload.to[0].email} for trip "${tripTitle}"...`);

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      const errorDetail = data?.message || data?.error || `HTTP ${response.status} from Brevo API`;
      logger.error(`[Brevo Mail Service] Brevo API rejected invitation request (${response.status}):`, data);
      const err = new Error(`Brevo invitation failed: ${errorDetail}`);
      err.status = response.status;
      err.brevoCode = data?.code;
      throw err;
    }

    logger.info(`[Brevo Mail Service] Group invitation successfully sent to ${to}. MessageId: ${data.messageId}`);
    return {
      success: true,
      messageId: data.messageId,
      recipient: to,
    };
  } catch (err) {
    logger.error(`[Brevo Mail Service] Error sending invitation email: ${err.message}`);
    throw err;
  }
}

