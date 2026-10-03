import express from "express";
import { sendMail } from "../controllers/mail.controller.js";

const router = express.Router();

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
