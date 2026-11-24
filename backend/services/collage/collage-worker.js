import Collage from "../../models/Collage.js";
import Memory from "../../models/Memory.js";
import { collageEngine } from "./collage-engine.js";
import { collageStorageService } from "./storage.service.js";
import { logger } from "../../utils/logger.js";

export class CollageWorker {
  constructor(concurrency = 2) {
    this.concurrency = concurrency;
    this.activeWorkers = 0;
    this.queue = [];
    this.maxRetries = 3;
  }

  /**
   * Enqueues a collage ID for background Sharp image generation.
   *
   * @param {string} collageId MongoDB Collage document ID
   */
  enqueueJob(collageId) {
    if (!collageId) return;

    // Prevent duplicate entries in active queue
    if (!this.queue.includes(String(collageId))) {
      this.queue.push(String(collageId));
      logger.info(`[CollageWorker] Enqueued collage job ${collageId}. Queue length: ${this.queue.length}`);
    }

    this._triggerNext();
  }

  /**
   * Internal scheduler to trigger next job if below concurrency limit.
   */
  _triggerNext() {
    if (this.activeWorkers >= this.concurrency || this.queue.length === 0) {
      return;
    }

    const nextCollageId = this.queue.shift();
    this.activeWorkers++;

    this.processJob(nextCollageId)
      .catch((err) => {
        logger.error(`[CollageWorker] Unhandled error processing job ${nextCollageId}: ${err.message}`);
      })
      .finally(() => {
        this.activeWorkers--;
        this._triggerNext();
      });
  }

  /**
   * Processes a single collage generation job.
   */
  async processJob(collageId) {
    const startTime = Date.now();
    logger.info(`[CollageWorker] Starting generation for collage: ${collageId}`);

    const collage = await Collage.findById(collageId);
    if (!collage) {
      logger.warn(`[CollageWorker] Collage record not found: ${collageId}`);
      return;
    }

    // Idempotency check: if already completed and output is intact, skip
    if (collage.status === "completed" && collage.output?.url) {
      logger.info(`[CollageWorker] Collage ${collageId} is already completed. Skipping.`);
      return;
    }

    // Mark status as processing
    await Collage.findByIdAndUpdate(collageId, {
      status: "processing",
      error: null,
    });

    let lastError = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        // 1. Fetch memories from database
        const memories = await Memory.find({
          _id: { $in: collage.memoryIds },
          isDeleted: false,
        });

        // Preserve user's specified memory ordering
        const memoryMap = new Map(memories.map((m) => [String(m._id), m]));
        const orderedMemories = collage.memoryIds
          .map((id) => memoryMap.get(String(id)))
          .filter(Boolean);

        // 2. Fetch image buffers (preferring thumbnail/optimized to avoid huge downloads)
        const imageBuffers = [];

        // Priority 1: explicitly selected photo URLs in collage.imageUrls
        if (Array.isArray(collage.imageUrls) && collage.imageUrls.length >= 2) {
          for (const url of collage.imageUrls) {
            if (url) {
              try {
                const buffer = await collageStorageService.fetchImageBuffer(url);
                imageBuffers.push(buffer);
              } catch (dlErr) {
                logger.warn(`[CollageWorker] Failed to download selected imageUrl ${url}: ${dlErr.message}`);
              }
            }
          }
        } else {
          // Priority 2: Extract all photos from orderedMemories (supporting multi-media per memory)
          for (const mem of orderedMemories) {
            const memUrls = [];
            if (Array.isArray(mem.media) && mem.media.length > 0) {
              mem.media.forEach((item) => {
                if (item && item.url && item.resourceType !== "video") {
                  memUrls.push(item.url);
                }
              });
            }
            if (memUrls.length === 0 && Array.isArray(mem.mediaItems)) {
              mem.mediaItems.forEach((item) => {
                const u = item.storageUrl || item.url;
                if (u && item.type !== "video") memUrls.push(u);
              });
            }
            if (memUrls.length === 0 && mem.thumbnailUrl) memUrls.push(mem.thumbnailUrl);
            if (memUrls.length === 0 && mem.mediaUrl) memUrls.push(mem.mediaUrl);

            for (const sourceUrl of memUrls) {
              try {
                const buffer = await collageStorageService.fetchImageBuffer(sourceUrl);
                imageBuffers.push(buffer);
              } catch (dlErr) {
                logger.warn(`[CollageWorker] Failed to download image for memory ${mem._id}: ${dlErr.message}`);
              }
            }
          }
        }

        if (imageBuffers.length < 2) {
          throw new Error(`Insufficient images to compose collage (successfully loaded ${imageBuffers.length}, required at least 2)`);
        }

        // 3. Compose Collage using Sharp Engine
        const collageResult = await collageEngine.generateCollage({
          imageBuffers,
          layout: collage.layout,
          aspectRatio: collage.aspectRatio,
          theme: collage.theme,
          title: collage.title,
          subtitle: collage.subtitle,
          format: collage.output?.format || "webp",
          quality: "standard",
        });

        // 4. Upload generated image to Object Storage
        const uploadResult = await collageStorageService.uploadCollageImage({
          buffer: collageResult.buffer,
          userId: collage.userId,
          tripId: String(collage.tripId),
          collageId: String(collage._id),
          format: collageResult.format,
        });

        const processingTimeMs = Date.now() - startTime;

        // 5. Update Collage record in MongoDB
        await Collage.findByIdAndUpdate(collageId, {
          status: "completed",
          output: {
            storageKey: uploadResult.storageKey,
            url: uploadResult.url,
            width: collageResult.width,
            height: collageResult.height,
            format: collageResult.format,
            fileSize: collageResult.size,
          },
          processingTimeMs,
          error: null,
          retryCount: attempt - 1,
        });

        logger.info(
          `[CollageWorker] Successfully completed collage ${collageId} in ${processingTimeMs}ms (${collageResult.width}x${collageResult.height}, ${(
            collageResult.size / 1024
          ).toFixed(1)}KB)`
        );
        return;
      } catch (err) {
        lastError = err;
        logger.warn(`[CollageWorker] Attempt ${attempt} failed for collage ${collageId}: ${err.message}`);

        if (attempt < this.maxRetries) {
          // Exponential backoff
          await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
        }
      }
    }

    // If all retries failed, update document to failed status
    const failureTimeMs = Date.now() - startTime;
    await Collage.findByIdAndUpdate(collageId, {
      status: "failed",
      error: lastError?.message || "Failed to generate collage after multiple attempts",
      processingTimeMs: failureTimeMs,
      retryCount: this.maxRetries,
    });

    logger.error(`[CollageWorker] Collage ${collageId} permanently failed: ${lastError?.message}`);
  }

  /**
   * Recovers any queued or stuck jobs on startup.
   */
  async recoverStuckJobs() {
    try {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

      // Re-enqueue queued jobs
      const queuedJobs = await Collage.find({
        status: "queued",
        isDeleted: false,
      }).select("_id");

      for (const job of queuedJobs) {
        this.enqueueJob(String(job._id));
      }

      // Reset stale processing jobs
      const stuckJobs = await Collage.find({
        status: "processing",
        updatedAt: { $lt: tenMinutesAgo },
        isDeleted: false,
      }).select("_id");

      for (const job of stuckJobs) {
        logger.info(`[CollageWorker] Re-queueing stale processing job ${job._id}`);
        this.enqueueJob(String(job._id));
      }
    } catch (err) {
      logger.warn(`[CollageWorker] Error recovering stuck jobs: ${err.message}`);
    }
  }
}

export const collageWorker = new CollageWorker(2);
export default collageWorker;
