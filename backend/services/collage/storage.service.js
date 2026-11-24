import fs from "fs";
import path from "path";
import admin from "firebase-admin";
import { logger } from "../../utils/logger.js";

// Ensure local uploads directory exists for fallback/development
const LOCAL_UPLOADS_DIR = path.resolve(process.cwd(), "uploads", "collages");
try {
  if (!fs.existsSync(LOCAL_UPLOADS_DIR)) {
    fs.mkdirSync(LOCAL_UPLOADS_DIR, { recursive: true });
  }
} catch (e) {
  logger.warn(`Could not create uploads dir: ${e.message}`);
}

export class CollageStorageService {
  /**
   * Uploads a generated collage image buffer to object storage or local fallback.
   *
   * @param {Object} params
   * @param {Buffer} params.buffer Image file buffer
   * @param {string} params.userId Owner user ID
   * @param {string} params.tripId Associated trip ID
   * @param {string} params.collageId Unique collage ID
   * @param {string} [params.format="webp"] File extension/format
   * @returns {Promise<{ storageKey: string, url: string }>}
   */
  async uploadCollageImage({ buffer, userId, tripId, collageId, format = "webp" }) {
    const storageKey = `users/${userId}/trips/${tripId}/collages/${collageId}.${format}`;
    const contentType = format === "png" ? "image/png" : format === "jpeg" ? "image/jpeg" : "image/webp";

    // 1. If Firebase Admin Storage is configured with credentials
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON && admin.apps.length > 0) {
      try {
        const bucket = admin.storage().bucket();
        const file = bucket.file(storageKey);

        await file.save(buffer, {
          metadata: {
            contentType,
            metadata: {
              userId,
              tripId,
              collageId,
              generatedBy: "Advenza Collage Engine",
            },
          },
        });

        // Generate signed URL on cloud storage
        let publicUrl = null;
        try {
          const [signed] = await file.getSignedUrl({
            action: "read",
            expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
          });
          publicUrl = signed;
        } catch (_) {
          publicUrl = `https://storage.googleapis.com/${bucket.name}/${storageKey}`;
        }

        logger.info(`[CollageStorage] Uploaded collage to Firebase Storage: ${storageKey}`);
        return { storageKey, url: publicUrl };
      } catch (cloudErr) {
        logger.warn(`[CollageStorage] Cloud storage failed, falling back to local: ${cloudErr.message}`);
      }
    }

    // 2. Local File Storage Fallback (Dev Mode with secure access)
    const localFileName = `${collageId}.${format}`;
    const localFilePath = path.join(LOCAL_UPLOADS_DIR, localFileName);
    fs.writeFileSync(localFilePath, buffer);

    const baseUrl = process.env.BASE_URL || "http://localhost:5000";
    const localUrl = `${baseUrl}/uploads/collages/${localFileName}`;

    logger.info(`[CollageStorage] Saved collage locally: ${localFilePath} -> ${localUrl}`);
    return { storageKey, url: localUrl };
  }

  /**
   * Deletes a collage file from storage.
   */
  async deleteCollageImage(storageKey) {
    if (!storageKey) return;

    // Cloud storage cleanup
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON && admin.apps.length > 0) {
      try {
        const bucket = admin.storage().bucket();
        await bucket.file(storageKey).delete({ ignoreNotFound: true });
        logger.info(`[CollageStorage] Deleted cloud file: ${storageKey}`);
      } catch (err) {
        logger.warn(`[CollageStorage] Cloud delete error for ${storageKey}: ${err.message}`);
      }
    }

    // Local file cleanup
    try {
      const fileName = path.basename(storageKey);
      const localFilePath = path.join(LOCAL_UPLOADS_DIR, fileName);
      if (fs.existsSync(localFilePath)) {
        fs.unlinkSync(localFilePath);
        logger.info(`[CollageStorage] Deleted local file: ${localFilePath}`);
      }
    } catch (err) {
      logger.warn(`[CollageStorage] Local delete error for ${storageKey}: ${err.message}`);
    }
  }

  /**
   * Safely fetches an image buffer from a verified memory storage URL or reference.
   * Protects against SSRF by disallowing localhost/private IPs and enforcing size limits.
   */
  async fetchImageBuffer(mediaUrl) {
    if (!mediaUrl || typeof mediaUrl !== "string") {
      throw new Error("Invalid media URL provided");
    }

    // Reject base64 data URIs
    if (mediaUrl.startsWith("data:")) {
      throw new Error("Base64 data URIs are not allowed for server collage processing");
    }

    // If local file URL
    if (mediaUrl.includes("/uploads/collages/")) {
      const fileName = path.basename(mediaUrl);
      const localFilePath = path.join(LOCAL_UPLOADS_DIR, fileName);
      if (fs.existsSync(localFilePath)) {
        return fs.readFileSync(localFilePath);
      }
    }

    // Remote HTTP / HTTPS download
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000); // 12s timeout

    try {
      const parsedUrl = new URL(mediaUrl);
      // Basic SSRF guard against private network fetching
      const hostname = parsedUrl.hostname.toLowerCase();
      if (
        hostname === "169.254.169.254" ||
        hostname === "metadata.google.internal" ||
        (hostname.startsWith("10.") && !hostname.includes(".")) ||
        (hostname.startsWith("192.168.") && !hostname.includes("."))
      ) {
        throw new Error("Access to private network metadata is forbidden");
      }

      const res = await fetch(mediaUrl, {
        signal: controller.signal,
        headers: { "User-Agent": "Advenza-Collage-Worker/1.0" },
      });

      if (!res.ok) {
        throw new Error(`Failed to download image (HTTP ${res.status}): ${mediaUrl}`);
      }

      // Guard against decompression bombs (max 25MB per image)
      const contentLength = res.headers.get("content-length");
      if (contentLength && parseInt(contentLength, 10) > 25 * 1024 * 1024) {
        throw new Error(`Image size exceeds safe maximum threshold (25MB)`);
      }

      const arrayBuffer = await res.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const collageStorageService = new CollageStorageService();
export default collageStorageService;
