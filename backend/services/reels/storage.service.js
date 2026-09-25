import fs from "fs";
import path from "path";
import admin from "firebase-admin";
import { logger } from "../../utils/logger.js";

const LOCAL_REELS_DIR = path.resolve(process.cwd(), "uploads", "reels");
try {
  if (!fs.existsSync(LOCAL_REELS_DIR)) {
    fs.mkdirSync(LOCAL_REELS_DIR, { recursive: true });
  }
} catch (e) {
  logger.warn(`Could not create uploads/reels dir: ${e.message}`);
}

export class ReelStorageService {
  /**
   * Uploads the final generated MP4 video to object storage or local fallback directory.
   */
  async uploadReelVideo({ filePath, userId, tripId, reelId, format = "mp4" }) {
    const storageKey = `users/${userId}/trips/${tripId}/reels/${reelId}.${format}`;
    const contentType = "video/mp4";

    // 1. Cloud Storage via Firebase Admin if configured
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON && admin.apps.length > 0) {
      try {
        const bucket = admin.storage().bucket();
        const file = bucket.file(storageKey);

        const videoBuffer = fs.readFileSync(filePath);
        await file.save(videoBuffer, {
          metadata: {
            contentType,
            metadata: {
              userId,
              tripId,
              reelId,
              generatedBy: "Advenza FFmpeg Reel Engine",
            },
          },
        });

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

        logger.info(`[ReelStorage] Uploaded Reel to Firebase Storage: ${storageKey}`);
        return { storageKey, url: publicUrl };
      } catch (cloudErr) {
        logger.warn(`[ReelStorage] Cloud upload failed, falling back to local: ${cloudErr.message}`);
      }
    }

    // 2. Local Fallback Delivery
    const localFileName = `${reelId}.${format}`;
    const destPath = path.join(LOCAL_REELS_DIR, localFileName);
    fs.copyFileSync(filePath, destPath);

    const baseUrl = process.env.BASE_URL || "http://localhost:5000";
    const localUrl = `${baseUrl}/uploads/reels/${localFileName}`;

    logger.info(`[ReelStorage] Stored Reel locally: ${destPath} -> ${localUrl}`);
    return { storageKey, url: localUrl };
  }

  /**
   * Deletes a reel file from cloud storage or local disk.
   */
  async deleteReelVideo(storageKey) {
    if (!storageKey) return;

    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON && admin.apps.length > 0) {
      try {
        const bucket = admin.storage().bucket();
        await bucket.file(storageKey).delete({ ignoreNotFound: true });
        logger.info(`[ReelStorage] Deleted cloud video: ${storageKey}`);
      } catch (err) {
        logger.warn(`[ReelStorage] Cloud delete error for ${storageKey}: ${err.message}`);
      }
    }

    try {
      const fileName = path.basename(storageKey);
      const localFilePath = path.join(LOCAL_REELS_DIR, fileName);
      if (fs.existsSync(localFilePath)) {
        fs.unlinkSync(localFilePath);
        logger.info(`[ReelStorage] Deleted local video: ${localFilePath}`);
      }
    } catch (err) {
      logger.warn(`[ReelStorage] Local delete error for ${storageKey}: ${err.message}`);
    }
  }

  /**
   * Downloads a remote memory photo or video into the local worker temporary directory.
   */
  async downloadAssetToLocal(mediaUrl, destPath) {
    if (!mediaUrl || mediaUrl.startsWith("data:")) {
      throw new Error("Invalid media URL (data URIs are not allowed)");
    }

    // If local file URL
    if (mediaUrl.includes("/uploads/")) {
      const relative = mediaUrl.substring(mediaUrl.indexOf("/uploads/"));
      const localSource = path.resolve(process.cwd(), `.${relative}`);
      if (fs.existsSync(localSource)) {
        fs.copyFileSync(localSource, destPath);
        return destPath;
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    try {
      const res = await fetch(mediaUrl, {
        signal: controller.signal,
        headers: { "User-Agent": "Advenza-Reel-Worker/1.0" },
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch media (HTTP ${res.status}): ${mediaUrl}`);
      }

      const buffer = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(destPath, buffer);
      return destPath;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Removes temporary working directory.
   */
  cleanupTempDir(dirPath) {
    if (!dirPath || !dirPath.includes("tmp")) return;
    try {
      if (fs.existsSync(dirPath)) {
        fs.rmSync(dirPath, { recursive: true, force: true });
      }
    } catch (err) {
      logger.warn(`Could not cleanup temp dir ${dirPath}: ${err.message}`);
    }
  }
}

export const reelStorageService = new ReelStorageService();

export function createReelWorkDir(reelId) {
  const workDir = path.resolve(process.cwd(), 'tmp', 'reels', reelId);
  if (!fs.existsSync(workDir)) {
    fs.mkdirSync(workDir, { recursive: true });
  }
  return workDir;
}

export function cleanupWorkDir(dirPath) {
  return reelStorageService.cleanupTempDir(dirPath);
}

export async function downloadMediaFile(mediaUrl, destPath) {
  // If destPath is already local file path and exists
  if (fs.existsSync(mediaUrl)) {
    fs.copyFileSync(mediaUrl, destPath);
    return destPath;
  }
  return reelStorageService.downloadAssetToLocal(mediaUrl, destPath);
}

export async function uploadReelVideo(params) {
  return reelStorageService.uploadReelVideo(params);
}

export async function deleteStoredFile(storageKey) {
  return reelStorageService.deleteReelVideo(storageKey);
}

export default reelStorageService;

