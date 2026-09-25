import Collage from "../models/Collage.js";
import Memory from "../models/Memory.js";
import Trip from "../models/Trip.js";
import { collageWorker } from "../services/collage/collage-worker.js";
import { collageStorageService } from "../services/collage/storage.service.js";
import { NotFoundError, ForbiddenError, ValidationError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

export class CollageController {
  /**
   * Enqueue a new collage generation job.
   * POST /api/collages
   */
  async createCollage(req, res, next) {
    try {
      const {
        tripId,
        memoryIds,
        layout = "grid",
        aspectRatio = "1:1",
        theme = "dark",
        title = "",
        subtitle = "",
        format = "webp",
        quality = "standard",
      } = req.body;

      // 1. Verify Trip Access
      const trip = await Trip.findById(tripId);
      if (!trip) {
        throw new NotFoundError("Associated trip not found.");
      }

      const isTripOwner = trip.createdBy === req.uid;
      const isTripMember = trip.members?.some((m) => m.userId === req.uid);

      if (!isTripOwner && !isTripMember && req.uid !== "guest") {
        throw new ForbiddenError("You do not have permission to create a collage for this trip.");
      }

      // 2. Verify Memory Ownership & Isolation
      // Ensure all requested memoryIds belong to the authenticated user and specified trip
      const memories = await Memory.find({
        _id: { $in: memoryIds },
        isDeleted: false,
      });

      if (memories.length !== memoryIds.length) {
        throw new ValidationError(
          `Some requested memories could not be found or have been deleted (found ${memories.length} of ${memoryIds.length}).`
        );
      }

      const unauthorizedMemories = memories.filter((mem) => {
        const memUserId = String(mem.userId);
        const memTripId = String(mem.tripId);
        // In dev bypass mode, allow guest
        if (req.uid === "guest") return false;
        return memUserId !== req.uid || (tripId && memTripId !== String(tripId));
      });

      if (unauthorizedMemories.length > 0) {
        throw new ForbiddenError(
          "Access denied: One or more selected memories do not belong to you or this trip."
        );
      }

      // 3. Create Collage Document in queued state
      const collage = await Collage.create({
        userId: req.uid,
        tripId,
        memoryIds,
        layout,
        aspectRatio,
        theme,
        title: title || trip.title || trip.destination,
        subtitle: subtitle || trip.destination,
        output: {
          format,
        },
        status: "queued",
      });

      // 4. Enqueue in Background Sharp Worker
      collageWorker.enqueueJob(String(collage._id));

      logger.info(
        `[CollageController] Created collage ${collage._id} for user ${req.uid}. Enqueued in background worker.`
      );

      return res.status(202).json({
        message: "Collage generation job queued successfully",
        collageId: collage._id,
        status: "queued",
        layout,
        aspectRatio,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get single collage details (for polling or preview).
   * GET /api/collages/:id
   */
  async getCollage(req, res, next) {
    try {
      const collage = await Collage.findById(req.params.id);
      if (!collage || collage.isDeleted) {
        throw new NotFoundError("Collage not found");
      }

      // Authorization check (owner or shared)
      if (collage.userId !== req.uid && collage.shareAccess !== "shared" && req.uid !== "guest") {
        throw new ForbiddenError("You do not have access to this collage.");
      }

      return res.json(collage);
    } catch (err) {
      next(err);
    }
  }

  /**
   * List collages for the user or trip.
   * GET /api/collages
   */
  async listCollages(req, res, next) {
    try {
      const { tripId, limit = 20, cursor } = req.query;

      const filter = {
        userId: req.uid,
        isDeleted: false,
      };

      if (tripId && tripId !== "ALL") {
        filter.tripId = tripId;
      }

      if (cursor) {
        filter.createdAt = { $lt: new Date(cursor) };
      }

      const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));

      const collages = await Collage.find(filter)
        .sort({ createdAt: -1 })
        .limit(limitNum + 1);

      const hasMore = collages.length > limitNum;
      const results = hasMore ? collages.slice(0, limitNum) : collages;
      const nextCursor = hasMore ? results[results.length - 1].createdAt.toISOString() : null;

      return res.json({
        collages: results,
        nextCursor,
        hasMore,
        count: results.length,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Soft-delete a collage.
   * DELETE /api/collages/:id
   */
  async deleteCollage(req, res, next) {
    try {
      const collage = await Collage.findOne({
        _id: req.params.id,
        userId: req.uid,
        isDeleted: false,
      });

      if (!collage) {
        throw new NotFoundError("Collage not found or already deleted");
      }

      collage.isDeleted = true;
      collage.status = "deleted";
      collage.deletedAt = new Date();
      await collage.save();

      // Asynchronously cleanup storage file
      if (collage.output?.storageKey) {
        collageStorageService.deleteCollageImage(collage.output.storageKey).catch((e) => {
          logger.warn(`Storage delete failed for collage ${collage._id}: ${e.message}`);
        });
      }

      return res.json({ success: true, message: "Collage deleted successfully" });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Download the generated collage image.
   * GET /api/collages/:id/download
   */
  async downloadCollage(req, res, next) {
    try {
      const collage = await Collage.findById(req.params.id);
      if (!collage || collage.isDeleted) {
        throw new NotFoundError("Collage not found");
      }

      if (collage.userId !== req.uid && collage.shareAccess !== "shared" && req.uid !== "guest") {
        throw new ForbiddenError("Unauthorized to download this collage.");
      }

      if (collage.status !== "completed" || !collage.output?.url) {
        throw new ValidationError("Collage is still processing and not ready for download.");
      }

      const ext = collage.output.format || "webp";
      const filename = `Advenza_Collage_${collage.layout}_${collage._id}.${ext}`;

      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      return res.redirect(collage.output.url);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Enable sharing and generate public share URL.
   * POST /api/collages/:id/share
   */
  async shareCollage(req, res, next) {
    try {
      const collage = await Collage.findOne({
        _id: req.params.id,
        userId: req.uid,
        isDeleted: false,
      });

      if (!collage) {
        throw new NotFoundError("Collage not found");
      }

      collage.shareAccess = "shared";
      await collage.save();

      const host = req.get("host") || "localhost:5000";
      const protocol = req.protocol || "http";
      const shareUrl = `${protocol}://${host}/api/collages/share/${collage.shareToken}`;

      return res.json({
        shareUrl,
        shareToken: collage.shareToken,
        shareAccess: "shared",
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Public preview endpoint via unguessable share token.
   * GET /api/collages/share/:shareToken
   */
  async getSharedCollage(req, res, next) {
    try {
      const collage = await Collage.findOne({
        shareToken: req.params.shareToken,
        shareAccess: "shared",
        isDeleted: false,
      });

      if (!collage) {
        throw new NotFoundError("Shared collage not found or sharing has been revoked.");
      }

      // Return sanitized public representation (never leaking internal userId or private keys)
      return res.json({
        id: collage._id,
        title: collage.title,
        subtitle: collage.subtitle,
        layout: collage.layout,
        aspectRatio: collage.aspectRatio,
        theme: collage.theme,
        output: collage.output,
        status: collage.status,
        createdAt: collage.createdAt,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const collageController = new CollageController();
export default collageController;
