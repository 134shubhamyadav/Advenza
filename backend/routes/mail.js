import express from "express";
import { sendMail, getMailStatus, getMessageDeliveryStatus } from "../controllers/mail.controller.js";

const router = express.Router();

/**
 * @route   GET /api/mail/status
 * @desc    Check Brevo API connectivity, authorized IP status, and verified senders
 * @access  Public / Diagnostics
 */
router.get("/status", getMailStatus);

/**
 * @route   GET /api/mail/status/:messageId
 * @desc    Query delivery status of a specific message ID from Brevo
 * @access  Public / Diagnostics
 */
router.get("/status/:messageId", getMessageDeliveryStatus);

/**
 * @route   POST /api/mail/send
 * @desc    Send an email via Brevo transactional service
 * @access  Public / Authenticated
 */
router.post("/send", sendMail);

/**
 * @route   POST /api/mail
 * @desc    Alias route for sending mail
 * @access  Public / Authenticated
 */
router.post("/", sendMail);

export default router;
