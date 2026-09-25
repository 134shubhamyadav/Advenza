import fs from "fs";
import path from "path";
import crypto from "crypto";
import admin from "firebase-admin";
import { logger } from "../../utils/logger.js";

const UPLOADS_BASE = path.resolve(process.cwd(), "uploads", "receipts");

// Ensure local receipts directory exists
if (!fs.existsSync(UPLOADS_BASE)) {
  fs.mkdirSync(UPLOADS_BASE, { recursive: true });
}

export class ReceiptStorageService {
  /**
   * Uploads a receipt buffer to cloud storage or local disk fallback.
   */
  async uploadReceipt({ fileBuffer, fileName, mimeType = "image/jpeg", userId = "user", tripId = "trip" }) {
    const ext = path.extname(fileName || "receipt.jpg") || ".jpg";
    const uniqueId = crypto.randomBytes(12).toString("hex");
    const safeName = `receipt_${uniqueId}${ext}`;
    const storageKey = `users/${userId}/trips/${tripId}/receipts/${safeName}`;

    // 1. Cloud Storage via Firebase Admin if available
    try {
      if (admin.apps.length > 0 && process.env.FIREBASE_STORAGE_BUCKET) {
        const bucket = admin.storage().bucket();
        const file = bucket.file(storageKey);

        await file.save(fileBuffer, {
          metadata: {
            contentType: mimeType,
            metadata: { uploadedBy: userId, tripId },
          },
          resumable: false,
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

        logger.info(`[ReceiptStorage] Uploaded receipt to Firebase: ${storageKey}`);
        return { receiptUrl: publicUrl, receiptStorageKey: storageKey };
      }
    } catch (cloudErr) {
      logger.warn(`[ReceiptStorage] Cloud upload failed, saving locally: ${cloudErr.message}`);
    }

    // 2. Local File Storage Fallback
    const localDest = path.join(UPLOADS_BASE, safeName);
    fs.writeFileSync(localDest, fileBuffer);

    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
    const localUrl = `${baseUrl}/uploads/receipts/${safeName}`;

    logger.info(`[ReceiptStorage] Stored receipt locally: ${localUrl}`);
    return { receiptUrl: localUrl, receiptStorageKey: storageKey };
  }

  /**
   * Deletes a receipt file.
   */
  async deleteReceipt(storageKey) {
    if (!storageKey) return;

    try {
      if (admin.apps.length > 0 && process.env.FIREBASE_STORAGE_BUCKET) {
        const bucket = admin.storage().bucket();
        await bucket.file(storageKey).delete({ ignoreNotFound: true });
        logger.info(`[ReceiptStorage] Deleted cloud receipt: ${storageKey}`);
      }
    } catch (_) {}

    try {
      const fileName = path.basename(storageKey);
      const localFilePath = path.join(UPLOADS_BASE, fileName);
      if (fs.existsSync(localFilePath)) {
        fs.unlinkSync(localFilePath);
        logger.info(`[ReceiptStorage] Deleted local receipt: ${localFilePath}`);
      }
    } catch (_) {}
  }
}

export const receiptStorageService = new ReceiptStorageService();
export default receiptStorageService;
