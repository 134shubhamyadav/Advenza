import { sendMailSchema } from "../schemas/mail.schemas.js";
import { sendBrevoMail, checkBrevoDiagnostics, getBrevoEmailDeliveryStatus } from "../services/mail/brevo-mail.service.js";
import { logger } from "../utils/logger.js";

/**
 * Controller to send email via Brevo transactional service.
 */
export async function sendMail(req, res, next) {
  try {
    // Validate request body
    const parseResult = sendMailSchema.safeParse(req.body);
    if (!parseResult.success) {
      // Zod v4 uses .issues; fall back to .errors for backwards compat
      const issues = parseResult.error.issues ?? parseResult.error.errors ?? [];
      const errorMsg = issues.map((e) => e.message).join(", ") || "Invalid request payload";
      return res.status(400).json({
        success: false,
        error: errorMsg,
        message: errorMsg,
      });
    }

    const { to, subject, message, recipientName, tripTitle, tripId } = parseResult.data;

    // Call existing Brevo service
    const result = await sendBrevoMail({
      to,
      subject,
      message,
      recipientName,
      tripTitle,
    });

    return res.status(200).json({
      success: true,
      message: `Email successfully sent to ${to}`,
      messageId: result.messageId,
      recipient: result.recipient,
    });
  } catch (error) {
    logger.error(`[Mail Controller] Failed to send email: ${error.message}`);

    // If Brevo returned a client/bad request error, map to 400 or 502
    const statusCode = error.status && error.status >= 400 && error.status < 500 ? 400 : 502;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to send email via Brevo. Please check parameters and try again.",
    });
  }
}

/**
 * Controller to check Brevo service diagnostics, authorized IP status, and verified senders.
 */
export async function getMailStatus(req, res, next) {
  try {
    const diagnostics = await checkBrevoDiagnostics();
    return res.status(200).json({
      success: true,
      service: "Brevo Email Provider",
      diagnostics,
    });
  } catch (error) {
    logger.error(`[Mail Controller] Diagnostics error: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * Controller to query message delivery status by Brevo messageId.
 */
export async function getMessageDeliveryStatus(req, res, next) {
  try {
    const { messageId } = req.params;
    const status = await getBrevoEmailDeliveryStatus(messageId);
    return res.status(200).json(status);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
