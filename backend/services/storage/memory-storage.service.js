import fs from "fs";
import path from "path";
import crypto from "crypto";
import admin from "firebase-admin";
import sharp from "sharp";
import { logger } from "../../utils/logger.js";
import { env } from "../../config/env.js";

const UPLOADS_BASE = path.resolve(process.cwd(), "uploads", "memories");

// Ensure local memories directory exists
if (!fs.existsSync(UPLOADS_BASE)) {
  fs.mkdirSync(UPLOADS_BASE, { recursive: true });
}

export class MemoryStorageService {
  /**
   * Upload a memory media file (image or video) and generate a thumbnail.
   */
  async uploadMemoryMedia({ fileBuffer, fileName = "memory.jpg", mimeType = "image/jpeg", userId = "user", tripId = null }) {
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new Error("File buffer is empty");
    }

    const timestamp = Date.now();
    const uniqueId = crypto.randomBytes(8).toString("hex");
    const rawExt = path.extname(fileName || "").toLowerCase() || (mimeType.includes("png") ? ".png" : (mimeType.includes("webp") ? ".webp" : ".jpg"));
    const safeExt = rawExt.replace(/[^a-z0-9.]/g, "");
    const safeBaseName = `${timestamp}_${uniqueId}${safeExt}`;
    const safeThumbName = `thumb_${timestamp}_${uniqueId}.webp`;

    const storageKey = `users/${userId}/memories/${safeBaseName}`;
    const thumbnailKey = `users/${userId}/memories/${safeThumbName}`;

    let width = 0;
    let height = 0;
    let thumbBuffer = null;
    const isImage = mimeType.startsWith("image/");

    // Process image & generate thumbnail with Sharp
    if (isImage) {
      try {
        const metadata = await sharp(fileBuffer).metadata();
        width = metadata.width || 0;
        height = metadata.height || 0;

        thumbBuffer = await sharp(fileBuffer)
          .resize(360, 360, { fit: "cover", position: "centre" })
          .webp({ quality: 80 })
          .toBuffer();
      } catch (sharpErr) {
        logger.warn(`[MemoryStorage] Sharp image inspection notice: ${sharpErr.message}`);
      }
    }

    // 1. Cloud Storage via Firebase Admin if configured
    try {
      if (admin.apps.length > 0 && env.FIREBASE_STORAGE_BUCKET) {
        const bucket = admin.storage().bucket();
        const mainFile = bucket.file(storageKey);

        await mainFile.save(fileBuffer, {
          metadata: {
            contentType: mimeType,
            metadata: { uploadedBy: userId, tripId: tripId || "" },
          },
          resumable: false,
        });

        let mediaUrl = null;
        try {
          const [signed] = await mainFile.getSignedUrl({
            action: "read",
            expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
          });
          mediaUrl = signed;
        } catch {
          mediaUrl = `https://storage.googleapis.com/${bucket.name}/${storageKey}`;
        }

        let thumbnailUrl = mediaUrl;
        if (thumbBuffer) {
          const thumbFile = bucket.file(thumbnailKey);
          await thumbFile.save(thumbBuffer, {
            metadata: { contentType: "image/webp", metadata: { uploadedBy: userId } },
            resumable: false,
          });
          try {
            const [signedThumb] = await thumbFile.getSignedUrl({
              action: "read",
              expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
            });
            thumbnailUrl = signedThumb;
          } catch {
            thumbnailUrl = `https://storage.googleapis.com/${bucket.name}/${thumbnailKey}`;
          }
        }

        logger.info(`[MemoryStorage] Successfully stored memory in Firebase: ${storageKey}`);
        return {
          mediaUrl,
          thumbnailUrl,
          storageKey,
          thumbnailKey: thumbBuffer ? thumbnailKey : "",
          width,
          height,
          mediaType: isImage ? "image" : "video",
        };
      }
    } catch (cloudErr) {
      logger.warn(`[MemoryStorage] Cloud upload notice, saving locally: ${cloudErr.message}`);
    }

    // 2. Local File Storage Fallback
    const localDest = path.join(UPLOADS_BASE, safeBaseName);
    fs.writeFileSync(localDest, fileBuffer);

    let localThumbUrl = null;
    if (thumbBuffer) {
      const localThumbDest = path.join(UPLOADS_BASE, safeThumbName);
      fs.writeFileSync(localThumbDest, thumbBuffer);
      localThumbUrl = `/uploads/memories/${safeThumbName}`;
    }

    const localUrl = `/uploads/memories/${safeBaseName}`;
    logger.info(`[MemoryStorage] Stored memory locally: ${localUrl}`);

    return {
      mediaUrl: localUrl,
      thumbnailUrl: localThumbUrl || localUrl,
      storageKey,
      thumbnailKey: thumbBuffer ? thumbnailKey : "",
      width,
      height,
      mediaType: isImage ? "image" : "video",
    };
  }

  /**
   * Delete memory files from storage.
   */
  async deleteMemoryMedia(storageKey, thumbnailKey) {
    if (storageKey) {
      try {
        if (admin.apps.length > 0 && env.FIREBASE_STORAGE_BUCKET) {
          const bucket = admin.storage().bucket();
          await bucket.file(storageKey).delete({ ignoreNotFound: true });
          if (thumbnailKey) {
            await bucket.file(thumbnailKey).delete({ ignoreNotFound: true });
          }
        }
      } catch (_) {}

      try {
        const fileName = path.basename(storageKey);
        const localPath = path.join(UPLOADS_BASE, fileName);
        if (fs.existsSync(localPath)) fs.unlinkSync(localPath);

        if (thumbnailKey) {
          const thumbName = path.basename(thumbnailKey);
          const localThumbPath = path.join(UPLOADS_BASE, thumbName);
          if (fs.existsSync(localThumbPath)) fs.unlinkSync(localThumbPath);
        }
      } catch (_) {}
    }
  }
}

export const memoryStorageService = new MemoryStorageService();
export default memoryStorageService;
