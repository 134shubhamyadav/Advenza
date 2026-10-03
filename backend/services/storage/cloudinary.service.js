import { v2 as cloudinary } from "cloudinary";
import { env } from "../../config/env.js";
import { logger } from "../../utils/logger.js";

// Configure Cloudinary SDK
if (env.CLOUDINARY_URL) {
  cloudinary.config({
    cloudinary_url: env.CLOUDINARY_URL,
  });
} else if (env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export class CloudinaryService {
  constructor() {
    this.isConfigured = Boolean(
      env.CLOUDINARY_URL ||
      (env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET)
    );
  }

  /**
   * Upload a media buffer (image or video) directly to Cloudinary.
   * @param {Object} options
   * @param {Buffer} options.fileBuffer - The raw binary file buffer
   * @param {string} options.fileName - Original file name
   * @param {string} options.mimeType - MIME type of the file
   * @param {string} options.userId - Authenticated user ID
   * @param {string} [options.tripId] - Associated trip ID (optional)
   * @returns {Promise<Object>} Formatted media metadata object
   */
  async uploadMedia({ fileBuffer, fileName = "media", mimeType = "image/jpeg", userId = "anonymous", tripId = null }) {
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new Error("Cannot upload empty file buffer to Cloudinary.");
    }

    const isVideo = mimeType.startsWith("video/") || /\.(mp4|mov|webm|avi|mkv)$/i.test(fileName);
    const resourceType = isVideo ? "video" : "image";
    const folder = `advenza/users/${userId}/memories`;

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: resourceType,
          use_filename: false,
          unique_filename: true,
          overwrite: false,
          context: {
            uploadedBy: userId,
            tripId: tripId || "",
            originalName: fileName,
          },
        },
        (error, result) => {
          if (error) {
            logger.error(`[CloudinaryService] Upload failed for ${fileName}: ${error.message}`);
            return reject(new Error(`Cloudinary upload failed: ${error.message}`));
          }

          const mediaInfo = {
            url: result.secure_url || result.url,
            publicId: result.public_id,
            resourceType: result.resource_type === "video" ? "video" : "image",
            format: result.format || (isVideo ? "mp4" : "jpg"),
            width: Number(result.width) || 0,
            height: Number(result.height) || 0,
            duration: Number(result.duration) || 0,
            originalName: fileName,
            bytes: Number(result.bytes) || fileBuffer.length,
          };

          logger.info(`[CloudinaryService] ✅ Successfully uploaded ${mediaInfo.resourceType} (${mediaInfo.publicId})`);
          resolve(mediaInfo);
        }
      );

      uploadStream.end(fileBuffer);
    });
  }

  /**
   * Delete a single asset from Cloudinary by publicId.
   * @param {string} publicId - Cloudinary asset public ID
   * @param {string} [resourceType="image"] - "image" or "video"
   */
  async deleteMedia(publicId, resourceType = "image") {
    if (!publicId) return;
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType === "video" ? "video" : "image",
        invalidate: true,
      });
      logger.info(`[CloudinaryService] Deleted asset ${publicId} (result: ${result?.result || "ok"})`);
      return result;
    } catch (err) {
      logger.warn(`[CloudinaryService] Failed to delete asset ${publicId}: ${err.message}`);
    }
  }

  /**
   * Delete multiple assets in batch rollback / cleanup.
   * @param {Array<{ publicId: string, resourceType?: string }>} items
   */
  async deleteMediaBatch(items = []) {
    if (!Array.isArray(items) || items.length === 0) return;
    const deletePromises = items.map((item) => {
      const publicId = typeof item === "string" ? item : item.publicId;
      const resourceType = typeof item === "object" ? item.resourceType : "image";
      return this.deleteMedia(publicId, resourceType);
    });
    await Promise.allSettled(deletePromises);
  }
}

export const cloudinaryService = new CloudinaryService();
export default cloudinaryService;
