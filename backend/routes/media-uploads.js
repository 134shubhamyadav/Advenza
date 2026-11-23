import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import admin from "firebase-admin";
import Collage from "../models/Collage.js";
import Expense from "../models/Expense.js";
import Trip from "../models/Trip.js";
import { logger } from "../utils/logger.js";
import { env } from "../config/env.js";

const router = express.Router();

const ALLOWED_TYPES = new Set(["collages", "receipts"]);
const MIME_TYPES = {
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".mp4": "video/mp4",
  ".pdf": "application/pdf",
};

/**
 * Generate a short-lived HMAC signature for private media access.
 */
export function generateMediaSignature(filePath, userId, expiresInSeconds = 3600) {
  const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const secret = process.env.MEDIA_SECRET || process.env.JWT_SECRET || "advenza-media-protection-salt";
  const data = `${filePath}:${userId}:${expires}`;
  const sig = crypto.createHmac("sha256", secret).update(data).digest("hex");
  return { sig, expires, uid: userId };
}

/**
 * Verify HMAC signature.
 */
function verifyMediaSignature(filePath, userId, expires, sig) {
  if (!sig || !userId || !expires) return false;
  if (Math.floor(Date.now() / 1000) > parseInt(expires, 10)) return false;
  const secret = process.env.MEDIA_SECRET || process.env.JWT_SECRET || "advenza-media-protection-salt";
  const data = `${filePath}:${userId}:${expires}`;
  const expectedSig = crypto.createHmac("sha256", secret).update(data).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig));
}

/**
 * Extract authenticated user ID from Bearer token, query token, or signature.
 */
async function authenticateMediaRequest(req, filePath) {
  // 1. Check Bearer Header
  const authHeader = req.headers.authorization;
  let token = null;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split("Bearer ")[1].trim();
  } else if (req.query.token) {
    token = String(req.query.token).trim();
  }

  if (token) {
    try {
      if (admin.apps.length > 0) {
        const decoded = await admin.auth().verifyIdToken(token);
        return { uid: decoded.uid, method: "token" };
      } else {
        // Dev fallback if Firebase admin is uninitialized
        return { uid: token, method: "dev_token" };
      }
    } catch (e) {
      logger.debug(`[MediaAuth] Token verification failed: ${e.message}`);
    }
  }

  // 2. Check HMAC Signature
  const { sig, expires, uid } = req.query;
  if (sig && expires && uid) {
    if (verifyMediaSignature(filePath, String(uid), String(expires), String(sig))) {
      return { uid: String(uid), method: "signature" };
    }
  }

  return null;
}

/**
 * GET /uploads/:type/:filename
 * Secure handler for local server-side files with strict ownership and authorization checks.
 */
router.get("/:type/:filename", async (req, res) => {
  const { type, filename } = req.params;

  // 1. Validate type and filename against directory traversal
  const safeType = path.basename(type);
  const safeFilename = path.basename(filename);

  if (!ALLOWED_TYPES.has(safeType) || safeType !== type || safeFilename !== filename) {
    return res.status(400).json({ error: "Invalid media path or type" });
  }

  const uploadsDir = path.resolve(process.cwd(), "uploads", safeType);
  const fullPath = path.join(uploadsDir, safeFilename);

  // Path traversal assertion
  if (!fullPath.startsWith(uploadsDir)) {
    return res.status(403).json({ error: "Path traversal forbidden" });
  }

  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ error: "Media file not found" });
  }

  const relativePath = `${safeType}/${safeFilename}`;
  const shareToken = req.query.shareToken ? String(req.query.shareToken).trim() : null;

  // 2. Check public share token first (Collages)
  if (shareToken) {
    if (safeType === "collages") {
      const collage = await Collage.findOne({
        shareToken,
        shareAccess: { $in: ["public", "unlisted", "link"] },
      }).lean();
      if (collage) {
        return streamFile(fullPath, res);
      }
    }
  }

  // 3. Authenticate User
  const auth = await authenticateMediaRequest(req, relativePath);
  if (!auth || !auth.uid) {
    return res.status(401).json({
      error: "Authentication required to access private media. Provide Authorization header, ?token=, ?sig=, or a valid ?shareToken=",
    });
  }

  const uid = auth.uid;

  // 4. Verify Ownership & Authorization based on media category
  try {
    if (safeType === "collages") {
      const idOrPart = safeFilename.split(".")[0];
      const collage = await Collage.findOne({
        $or: [
          { _id: idOrPart.length === 24 ? idOrPart : null },
          { localFileName: safeFilename },
          { imageUrl: new RegExp(safeFilename) },
        ],
      }).lean();

      if (collage) {
        if (collage.userId !== uid) {
          // Check if user is collaborator on the trip
          const trip = await Trip.findById(collage.tripId).lean();
          const isMember = trip?.members?.some((m) => m.userId === uid || m.email === uid);
          if (!isMember) {
            return res.status(403).json({ error: "Access denied to private collage" });
          }
        }
      }
    } else if (safeType === "receipts") {
      const expense = await Expense.findOne({
        $or: [
          { receiptUrl: new RegExp(safeFilename) },
          { receiptStorageKey: new RegExp(safeFilename) },
        ],
      }).lean();

      if (expense) {
        if (expense.userId !== uid) {
          const trip = await Trip.findById(expense.tripId).lean();
          const isOwner = String(trip?.createdBy) === String(uid);
          const isMember = trip?.members?.some((m) => m.userId === uid || m.email === uid);
          if (!isOwner && !isMember) {
            return res.status(403).json({ error: "Access denied to private receipt" });
          }
        }
      }
    }

    return streamFile(fullPath, res);
  } catch (err) {
    logger.error(`[MediaAuth] Ownership verification error: ${err.message}`);
    return res.status(500).json({ error: "Internal authorization error" });
  }
});

function streamFile(fullPath, res) {
  const ext = path.extname(fullPath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  res.setHeader("Content-Type", contentType);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "private, max-age=86400");

  const stream = fs.createReadStream(fullPath);
  stream.on("error", (err) => {
    logger.warn(`[MediaAuth] Stream error: ${err.message}`);
    if (!res.headersSent) res.status(500).end();
  });
  stream.pipe(res);
}

export default router;
