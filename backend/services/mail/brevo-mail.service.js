import { config } from "../../config/env.js";
import { logger } from "../../utils/logger.js";

/**
 * Safely masks an email address for logging without leaking PII.
 * Example: "traveler.john@gmail.com" -> "t***n@g***l.com"
 */
export function maskEmail(email) {
  if (!email || typeof email !== "string") return "***";
  const [user, domain] = email.trim().toLowerCase().split("@");
  if (!domain) return "***";
  const maskedUser = user.length <= 2 ? user[0] + "***" : user[0] + "***" + user[user.length - 1];
  const domainParts = domain.split(".");
  const maskedDomain = domainParts[0].length <= 2 ? domainParts[0][0] + "***" : domainParts[0][0] + "***" + domainParts[0][domainParts[0].length - 1];
  return `${maskedUser}@${maskedDomain}.${domainParts.slice(1).join(".")}`;
}

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
 * Classifies Brevo API responses into clear, unambiguous failure categories.
 * Distinguishes IP authorization rejections from invalid keys, unverified senders, and rate limits.
 *
 * @param {Object} data - Brevo JSON response payload
 * @param {number} httpStatus - HTTP response status
 * @returns {{ category: string, isIpUnauthorized: boolean, detectedIp: string|null, cleanMessage: string, guidance: string }}
 */
export function classifyBrevoError(data, httpStatus) {
  const message = data?.message || data?.error || "";
  const code = (data?.code || "").toLowerCase();

  // 1. IP Authorization Failure (HTTP 401 with unrecognized IP address pattern)
  const ipMatch = message.match(/unrecognised IP address\s+([0-9.]+)/i)
    || message.match(/unrecognized IP address\s+([0-9.]+)/i)
    || message.match(/IP address\s+([0-9.]+)\s+is not authorised/i);

  if (code === "unauthorized" && (Boolean(ipMatch) || /unrecognised IP|unrecognized IP/i.test(message))) {
    const detectedIp = ipMatch ? ipMatch[1] : null;
    return {
      category: "BREVO_IP_UNAUTHORIZED",
      isIpUnauthorized: true,
      detectedIp,
      cleanMessage: `Brevo rejected request because outgoing IP (${detectedIp || "unknown"}) is not authorized in Brevo Security settings.`,
      guidance: `Add ${detectedIp || "your current IP"} to Brevo Security → Authorised IPs (https://app.brevo.com/security/authorised_ips).`,
    };
  }

  // 2. Invalid API Key Authentication Failure (HTTP 401 without IP restriction)
  if (httpStatus === 401 || code === "unauthorized") {
    return {
      category: "BREVO_INVALID_API_KEY",
      isIpUnauthorized: false,
      detectedIp: null,
      cleanMessage: "Brevo rejected request because the configured API key is invalid or has expired.",
      guidance: "Verify that BREVO_API_KEY in backend/.env matches the active API v3 key in your Brevo account.",
    };
  }

  // 3. Sender Verification / Bad Request (HTTP 400)
  if (httpStatus === 400) {
    const isSenderIssue = /sender/i.test(message);
    return {
      category: isSenderIssue ? "BREVO_SENDER_UNVERIFIED" : "BREVO_BAD_REQUEST",
      isIpUnauthorized: false,
      detectedIp: null,
      cleanMessage: `Brevo rejected request: ${message}`,
      guidance: isSenderIssue
        ? "Ensure the sender email configured in BREVO_SENDER_EMAIL is verified in Brevo Senders & Domains."
        : "Check recipient email address and payload formatting.",
    };
  }

  // 4. Rate Limit / Quota Exceeded (HTTP 429)
  if (httpStatus === 429) {
    return {
      category: "BREVO_RATE_LIMITED",
      isIpUnauthorized: false,
      detectedIp: null,
      cleanMessage: "Brevo transactional email rate limit or daily sending quota reached.",
      guidance: "Wait for quota reset or upgrade your Brevo plan credits.",
    };
  }

  // 5. Generic Gateway / Server Error (HTTP 5xx or others)
  return {
    category: "BREVO_GATEWAY_ERROR",
    isIpUnauthorized: false,
    detectedIp: null,
    cleanMessage: `Brevo API returned error (HTTP ${httpStatus}): ${message || "Unknown error"}`,
    guidance: "Check Brevo system status and network connectivity.",
  };
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
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeSubject}</title>
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    body { margin: 0; padding: 0; width: 100% !important; background-color: #06090e; }
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; border-radius: 0 !important; }
      .content-cell { padding: 24px 18px !important; }
      .header-cell { padding: 26px 18px 18px 18px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #06090e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e2e8f0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #06090e; padding: 36px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" class="email-container" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 580px; background-color: #0e1624; border: 1px solid #1c2738; border-radius: 18px; overflow: hidden; box-shadow: 0 24px 60px rgba(0, 0, 0, 0.65);">
          <!-- Top Multi-Stop Luxury Gradient Line -->
          <tr>
            <td style="background: linear-gradient(90deg, #0ea5e9 0%, #6366f1 45%, #a855f7 75%, #06b6d4 100%); height: 3px; font-size: 1px; line-height: 1px;">&nbsp;</td>
          </tr>

          <!-- Header / Brand Section -->
          <tr>
            <td class="header-cell" style="padding: 30px 32px 20px 32px; border-bottom: 1px solid #192333; text-align: center;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
                <tr>
                  <td style="vertical-align: middle; padding-right: 12px;">
                    <div style="width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, #0ea5e9 0%, #4f46e5 100%); text-align: center; line-height: 36px; box-shadow: 0 4px 12px rgba(14, 165, 233, 0.35); border: 1px solid rgba(255, 255, 255, 0.15);">
                      <span style="font-size: 18px; color: #ffffff; font-weight: 800; display: inline-block; vertical-align: middle;">✦</span>
                    </div>
                  </td>
                  <td style="vertical-align: middle; text-align: left;">
                    <div style="font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: 2px; line-height: 1.1; text-transform: uppercase;">
                      ADVENZA
                    </div>
                    <div style="font-size: 9px; font-weight: 700; color: #38bdf8; letter-spacing: 1.8px; text-transform: uppercase; margin-top: 3px;">
                      AUTONOMOUS TRAVEL INTELLIGENCE
                    </div>
                  </td>
                </tr>
              </table>
              ${safeTripTitle ? `
              <div style="margin-top: 14px;">
                <span style="font-size: 12px; color: #94a3b8;">Trip Expedition: <strong style="color: #7dd3fc;">${safeTripTitle}</strong></span>
              </div>
              ` : ""}
            </td>
          </tr>

          <!-- Subject Banner -->
          <tr>
            <td style="padding: 24px 32px 10px 32px;">
              <h2 style="margin: 0; font-size: 18px; font-weight: 700; color: #f8fafc; line-height: 1.4;">
                ${safeSubject}
              </h2>
            </td>
          </tr>

          <!-- Message Body -->
          <tr>
            <td class="content-cell" style="padding: 10px 32px 28px 32px;">
              <div style="background-color: #131d2c; border: 1px solid #1f2f45; border-radius: 12px; padding: 22px; font-size: 14px; line-height: 1.65; color: #cbd5e1;">
                ${formattedBody}
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 22px 32px; border-top: 1px solid #192434; background-color: #090e17; text-align: center;">
              <p style="margin: 0 0 4px 0; font-size: 12px; color: #64748b; line-height: 1.5;">
                Sent via <strong>${safeSenderName}</strong>
              </p>
              <p style="margin: 0; font-size: 11px; color: #475569;">
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

  const maskedTo = maskEmail(to);
  const startTime = Date.now();
  logger.info(`[Brevo Mail Service] Attempting to send email to ${maskedTo} (Subject: "${subject.slice(0, 35)}...", Sender: "${effectiveSenderName}" <${effectiveSenderEmail}>)`);

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000), // 10-second timeout guard
    });

    const durationMs = Date.now() - startTime;
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const classified = classifyBrevoError(data, response.status);
      logger.error(`[Brevo Mail Service] Brevo API rejected request in ${durationMs}ms (Category: ${classified.category}, HTTP ${response.status}): ${classified.cleanMessage}`);
      const err = new Error(`Brevo sending failed: ${classified.cleanMessage}`);
      err.status = response.status;
      err.brevoCode = data?.code;
      err.durationMs = durationMs;
      err.failureCategory = classified.category;
      err.isIpUnauthorized = classified.isIpUnauthorized;
      err.detectedIp = classified.detectedIp;
      err.cleanMessage = classified.cleanMessage;
      err.guidance = classified.guidance;
      throw err;
    }

    logger.info(`[Brevo Mail Service] Email accepted by Brevo for ${maskedTo} in ${durationMs}ms. MessageId: ${data.messageId}`);
    return {
      success: true,
      messageId: data.messageId,
      recipient: to,
      durationMs,
    };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    if (err.name === "TimeoutError") {
      logger.error(`[Brevo Mail Service] Request to Brevo timed out after 10000ms`);
      const timeoutErr = new Error("Brevo API request timed out after 10 seconds. Please check network connectivity.");
      timeoutErr.status = 504;
      timeoutErr.durationMs = durationMs;
      throw timeoutErr;
    }
    logger.error(`[Brevo Mail Service] Error sending email after ${durationMs}ms: ${err.message}`);
    throw err;
  }
}

/**
 * Builds a simple, clean, professional HTML invitation template matching the Advenza website UI.
 * - Advenza primary brand color: #004678 (Deep Ocean Blue)
 * - Neutral warm background: #f8fafc with clean white card #ffffff
 * - Displays existing group members (Organizer + confirmed joined members)
 * - Single solid primary button "Join Group" with Outlook VML fallback
 */
function buildInvitationEmailTemplate({
  to,
  inviterName,
  tripTitle,
  tripDestination,
  tripDates,
  groupMembers = { organizer: { name: "", role: "Organizer" }, joinedMembers: [] },
  inviteLink,
  expiresInDays = 7,
  senderName,
}) {
  const safeInviter = escapeHtml(inviterName || "A fellow traveler");
  const safeTripTitle = escapeHtml(tripTitle || "Trip Group");
  const safeDestination = escapeHtml(tripDestination || "");
  const safeDates = escapeHtml(tripDates || "");
  const safeLink = escapeHtml(inviteLink);
  const safeRecipient = escapeHtml(to || "traveler");

  const organizerName = groupMembers?.organizer?.name || inviterName || "Trip Organizer";
  const safeOrganizerName = escapeHtml(organizerName);
  const joinedMembers = Array.isArray(groupMembers?.joinedMembers) ? groupMembers.joinedMembers : [];
  const totalConfirmed = groupMembers?.confirmedCount || (1 + joinedMembers.length);

  // Build member rows
  let memberRowsHtml = "";
  if (joinedMembers.length > 0) {
    memberRowsHtml = joinedMembers
      .map((m, idx) => {
        const isLast = idx === joinedMembers.length - 1;
        const safeName = escapeHtml(m.name || "Traveler");
        return `
        <tr>
          <td style="padding: 10px 14px; ${isLast ? "" : "border-bottom: 1px solid #f1f5f9;"} font-size: 14px; color: #1e293b; line-height: 1.4;">
            ${safeName}
          </td>
          <td align="right" style="padding: 10px 14px; ${isLast ? "" : "border-bottom: 1px solid #f1f5f9;"} font-size: 12px;">
            <span style="background-color: #f8fafc; color: #64748b; border: 1px solid #e2e8f0; padding: 2px 8px; border-radius: 4px; font-weight: 500; font-size: 11px;">Member</span>
          </td>
        </tr>`;
      })
      .join("");
  } else {
    memberRowsHtml = `
      <tr>
        <td colspan="2" style="padding: 11px 14px; font-size: 13px; color: #64748b; font-style: italic;">
          Be the first to join this group.
        </td>
      </tr>`;
  }

  return `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Join ${safeTripTitle} on Advenza</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:AllowPNG/>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    
    @media only screen and (max-width: 600px) {
      .email-container {
        width: 100% !important;
        max-width: 100% !important;
        border-radius: 0 !important;
        border-left: none !important;
        border-right: none !important;
      }
      .content-cell {
        padding: 24px 20px !important;
      }
      .cta-button {
        display: block !important;
        width: 100% !important;
        box-sizing: border-box !important;
        text-align: center !important;
        padding: 14px 20px !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <!-- Outer Wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; padding: 36px 12px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" class="email-container" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 540px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <tr>
            <td class="content-cell" style="padding: 36px 32px; text-align: left;">

              <!-- 1. Advenza Logo / Name -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 24px;">
                <tr>
                  <td style="vertical-align: middle;">
                    <span style="font-size: 20px; font-weight: 800; color: #004678; letter-spacing: 0.5px;">✦ Advenza</span>
                  </td>
                </tr>
              </table>

              <!-- 2. Main Heading -->
              <h1 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #101c28; line-height: 1.35;">
                You've been invited to join a trip group!
              </h1>

              <!-- 3. Short Explanatory Message -->
              <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155;">
                <strong>${safeInviter}</strong> has invited you to collaborate on their upcoming trip:
              </p>

              <!-- 4. Trip Name Callout -->
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 3px solid #004678; border-radius: 4px; padding: 14px 18px; margin: 0 0 24px 0;">
                <div style="font-size: 16px; font-weight: 700; color: #004678;">
                  ${safeTripTitle}
                </div>
                ${(safeDestination || safeDates) ? `
                <div style="font-size: 13px; color: #64748b; margin-top: 4px;">
                  ${[safeDestination ? `📍 ${safeDestination}` : null, safeDates ? `📅 ${safeDates}` : null].filter(Boolean).join(" · ")}
                </div>
                ` : ""}
              </div>

              <!-- 5. Existing Group Members Section -->
              <div style="margin: 0 0 26px 0;">
                <div style="font-size: 14px; font-weight: 700; color: #101c28; margin-bottom: 10px;">
                  Who's already in this group? <span style="font-weight: 400; color: #64748b; font-size: 13px;">(${totalConfirmed} confirmed)</span>
                </div>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; background-color: #ffffff;">
                  <!-- Organizer Row -->
                  <tr>
                    <td style="padding: 10px 14px; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #1e293b; line-height: 1.4;">
                      <strong>${safeOrganizerName}</strong>
                    </td>
                    <td align="right" style="padding: 10px 14px; border-bottom: 1px solid #f1f5f9; font-size: 12px;">
                      <span style="background-color: #f1f5f9; color: #004678; border: 1px solid #cbd5e1; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 11px;">Organizer</span>
                    </td>
                  </tr>
                  <!-- Joined Members Rows -->
                  ${memberRowsHtml}
                </table>
              </div>

              <!-- 6. One Primary Button: Join Group -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 24px 0;">
                <tr>
                  <td>
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeLink}" style="height:44px;v-text-anchor:middle;width:180px;" arcsize="14%" stroke="f" fillcolor="#004678">
                      <w:anchorlock/>
                      <center style="color:#ffffff;font-family:sans-serif;font-size:15px;font-weight:600;">Join Group</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <a href="${safeLink}" target="_blank" class="cta-button" style="display: inline-block; background-color: #004678; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; padding: 12px 30px; border-radius: 6px; letter-spacing: 0.2px;">
                      Join Group
                    </a>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>

              <!-- 7. Fallback Invitation Link -->
              <p style="margin: 0 0 6px 0; font-size: 13px; color: #64748b; line-height: 1.5;">
                If the button above doesn't work, copy and paste this URL into your browser:
              </p>
              <p style="margin: 0 0 20px 0; font-size: 12px; line-height: 1.5; word-break: break-all; overflow-wrap: anywhere;">
                <a href="${safeLink}" target="_blank" style="color: #004678; text-decoration: underline;">${safeLink}</a>
              </p>

              <!-- 8. Expiry Information -->
              <p style="margin: 0 0 28px 0; font-size: 13px; color: #64748b;">
                This invitation link expires in <strong>${expiresInDays} days</strong>.
              </p>

              <!-- 9. Simple Advenza Footer -->
              <div style="padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                <p style="margin: 0 0 4px 0; color: #64748b; font-weight: 600;">
                  Advenza · Collaborative Travel Planning
                </p>
                <p style="margin: 0;">
                  This email was sent to ${safeRecipient} because ${safeInviter} invited you to a trip group on Advenza.
                </p>
              </div>

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
 * @param {string} [params.tripDestination] - Destination of the trip
 * @param {string} [params.tripDates] - Formatted dates or duration of trip
 * @param {Object} [params.groupMembers] - Authorized membership list { organizer, joinedMembers }
 * @param {string} params.inviteLink - Full secure invitation link
 * @param {number} [params.expiresInDays=7] - Number of days until token expires
 * @returns {Promise<{ success: boolean, messageId: string, recipient: string }>}
 */
export async function sendBrevoGroupInvitationMail({
  to,
  inviterName,
  tripTitle,
  tripDestination,
  tripDates,
  groupMembers = { organizer: { name: "", role: "Organizer" }, joinedMembers: [] },
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
    to,
    inviterName,
    tripTitle,
    tripDestination,
    tripDates,
    groupMembers,
    inviteLink,
    expiresInDays,
    senderName: effectiveSenderName,
  });

  const organizerName = groupMembers?.organizer?.name || inviterName || "Trip Organizer";
  const joinedMembers = Array.isArray(groupMembers?.joinedMembers) ? groupMembers.joinedMembers : [];
  const totalConfirmed = groupMembers?.confirmedCount || (1 + joinedMembers.length);
  const membersText = [
    `- ${organizerName} — Organizer`,
    ...(joinedMembers.length > 0
      ? joinedMembers.map((m) => `- ${m.name} — Member`)
      : ["Be the first to join this group."]),
  ].join("\n");

  const textContent = `
ADVENZA — TRIP GROUP INVITATION
==============================================================

You've been invited to join a trip group!

${inviterName || "A fellow traveler"} has invited you to collaborate on their upcoming trip:
"${tripTitle}"${tripDestination ? `\n📍 Destination: ${tripDestination}` : ""}${tripDates ? `\n📅 Dates: ${tripDates}` : ""}

Who's already in this group? (${totalConfirmed} confirmed)
${membersText}

Join Group:
${inviteLink}

If the link above doesn't work, copy and paste it into your browser.
This invitation link expires in ${expiresInDays} days.

--------------------------------------------------------------
Advenza · Collaborative Travel Planning
This email was sent to ${to} on behalf of ${inviterName || "a fellow traveler"}.
`.trim();

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

  const maskedTo = maskEmail(to);
  const startTime = Date.now();
  logger.info(`[Brevo Mail Service] Attempting to send group invitation email to ${maskedTo} for trip "${tripTitle}" (Sender: "${effectiveSenderName}" <${effectiveSenderEmail}>)`);

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000), // 10-second timeout guard
    });

    const durationMs = Date.now() - startTime;
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const classified = classifyBrevoError(data, response.status);
      logger.error(`[Brevo Mail Service] Brevo API rejected invitation request in ${durationMs}ms (Category: ${classified.category}, HTTP ${response.status}): ${classified.cleanMessage}`);
      const err = new Error(`Brevo invitation failed: ${classified.cleanMessage}`);
      err.status = response.status;
      err.brevoCode = data?.code;
      err.durationMs = durationMs;
      err.failureCategory = classified.category;
      err.isIpUnauthorized = classified.isIpUnauthorized;
      err.detectedIp = classified.detectedIp;
      err.cleanMessage = classified.cleanMessage;
      err.guidance = classified.guidance;
      throw err;
    }

    logger.info(`[Brevo Mail Service] Group invitation successfully accepted by Brevo for ${maskedTo} in ${durationMs}ms. MessageId: ${data.messageId}`);
    return {
      success: true,
      messageId: data.messageId,
      recipient: to,
      durationMs,
    };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    if (err.name === "TimeoutError") {
      logger.error(`[Brevo Mail Service] Group invitation request to Brevo timed out after 10000ms`);
      const timeoutErr = new Error("Brevo invitation request timed out after 10 seconds. Please check network connectivity.");
      timeoutErr.status = 504;
      timeoutErr.durationMs = durationMs;
      throw timeoutErr;
    }
    logger.error(`[Brevo Mail Service] Error sending invitation email after ${durationMs}ms: ${err.message}`);
    throw err;
  }
}

/**
 * Checks the real delivery status and event history of an email sent via Brevo.
 *
 * @param {string} messageId - The Brevo messageId (e.g. "<...@smtp-relay.mailin.fr>")
 * @returns {Promise<{ success: boolean, status: string, events?: Array, deliveredAt?: string, error?: string }>}
 */
export async function getBrevoEmailDeliveryStatus(messageId) {
  const apiKey = (config.BREVO_API_KEY || "").trim();
  if (!apiKey || !messageId) {
    return { success: false, status: "UNAVAILABLE", reason: "API key or messageId missing" };
  }

  try {
    const response = await fetch(`https://api.brevo.com/v3/smtp/emails/${encodeURIComponent(messageId)}`, {
      method: "GET",
      headers: {
        "api-key": apiKey,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return {
        success: false,
        status: "UNKNOWN",
        httpStatus: response.status,
        error: errData?.message || `HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      status: data.status || "ACCEPTED",
      events: data.events || [],
      deliveredAt: data.deliveredAt || null,
      details: data,
    };
  } catch (err) {
    return { success: false, status: "ERROR", error: err.message };
  }
}

/**
 * Diagnostic utility to check Brevo account status, authorized IPs, and verified senders.
 */
export async function checkBrevoDiagnostics() {
  const apiKey = (config.BREVO_API_KEY || "").trim();
  if (!apiKey) {
    return {
      configured: false,
      status: "NOT_CONFIGURED",
      message: "Brevo API key is not configured.",
    };
  }

  const startTime = Date.now();
  try {
    const response = await fetch("https://api.brevo.com/v3/account", {
      method: "GET",
      headers: {
        "api-key": apiKey,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(8000),
    });

    const durationMs = Date.now() - startTime;
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const classified = classifyBrevoError(data, response.status);
      return {
        configured: true,
        authenticated: false,
        httpStatus: response.status,
        code: data?.code || "UNAUTHORIZED",
        message: data?.message || "Failed to authenticate with Brevo API.",
        failureCategory: classified.category,
        isIpBlocked: classified.isIpUnauthorized,
        detectedIp: classified.detectedIp,
        cleanMessage: classified.cleanMessage,
        guidance: classified.guidance,
        durationMs,
      };
    }

    // Check sender status
    let senders = [];
    try {
      const sendersRes = await fetch("https://api.brevo.com/v3/senders", {
        headers: { "api-key": apiKey, Accept: "application/json" },
        signal: AbortSignal.timeout(6000),
      });
      if (sendersRes.ok) {
        const sendersData = await sendersRes.json();
        senders = sendersData.senders || [];
      }
    } catch (_) {}

    const configuredSender = config.BREVO_SENDER_EMAIL || "advenzaaa@gmail.com";
    const senderMatched = senders.find((s) => s.email?.toLowerCase() === configuredSender.toLowerCase());

    return {
      configured: true,
      authenticated: true,
      email: data.email,
      company: data.companyName,
      credits: data.plan?.map((p) => `${p.type}: ${p.credits}`).join(", ") || "Unknown",
      configuredSender,
      isSenderVerified: senderMatched ? senderMatched.active : false,
      availableSenders: senders.map((s) => ({ email: s.email, name: s.name, active: s.active })),
      durationMs,
    };
  } catch (err) {
    return {
      configured: true,
      authenticated: false,
      error: err.message,
      isTimeout: err.name === "TimeoutError",
    };
  }
}

