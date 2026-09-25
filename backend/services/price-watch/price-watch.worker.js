import PriceWatch from "../../models/PriceWatch.js";
import PriceHistory from "../../models/PriceHistory.js";
import { flightProvider } from "../travel/providers/flight.provider.js";
import { hotelProvider } from "../travel/providers/hotel.provider.js";
import { logger } from "../../utils/logger.js";

let schedulerInterval = null;
let isProcessing = false;

// 6-hour alert cooldown against spamming the same price event
const ALERT_COOLDOWN_MS = 6 * 60 * 60 * 1000;

/**
 * Execute a check for a single PriceWatch record.
 */
export async function processSingleWatch(watch) {
  try {
    let lowestPrice = null;
    let providerName = "Travel Data API";

    if (watch.type === "flight") {
      const searchRes = await flightProvider.searchFlights({
        origin: watch.origin,
        destination: watch.destination,
        departureDate: watch.departureDate,
        returnDate: watch.returnDate,
        passengers: watch.passengers || 1,
        cabin: watch.cabin || "ECONOMY",
      });

      if (searchRes.results && searchRes.results.length > 0) {
        const sorted = [...searchRes.results].sort((a, b) => a.price - b.price);
        lowestPrice = sorted[0].price;
        providerName = sorted[0].provider || searchRes.provider;
      }
    } else if (watch.type === "hotel") {
      const searchRes = await hotelProvider.searchHotels({
        destination: watch.destination,
        checkIn: watch.checkIn,
        checkOut: watch.checkOut,
        guests: watch.guests || 2,
        rooms: watch.rooms || 1,
      });

      if (searchRes.results && searchRes.results.length > 0) {
        const sorted = [...searchRes.results].sort((a, b) => a.price - b.price);
        lowestPrice = sorted[0].price;
        providerName = sorted[0].provider || searchRes.provider;
      }
    }

    if (lowestPrice == null) {
      logger.warn(`[PriceWatch] No offers found for watch ${watch._id}`);
      watch.lastCheckedAt = new Date();
      watch.nextCheckAt = new Date(Date.now() + (watch.checkIntervalHours || 12) * 3600000);
      await watch.save();
      return null;
    }

    const previousPrice = watch.lastPrice ?? lowestPrice;
    const isLowestEver = watch.lowestPrice == null || lowestPrice < watch.lowestPrice;

    // Record historical price observation
    await PriceHistory.create({
      watchId: watch._id,
      price: lowestPrice,
      currency: watch.currency || "INR",
      provider: providerName,
      observedAt: new Date(),
    });

    // Check alert trigger condition
    let shouldAlert = false;
    let alertReason = "";

    if (watch.alertCondition === "below_target" && lowestPrice <= watch.targetPrice) {
      shouldAlert = true;
      alertReason = `Current price of ₹${lowestPrice.toLocaleString("en-IN")} is below your target of ₹${watch.targetPrice.toLocaleString("en-IN")}.`;
    } else if (watch.alertCondition === "percentage_drop" && previousPrice > 0) {
      const dropPct = ((previousPrice - lowestPrice) / previousPrice) * 100;
      if (dropPct >= (watch.alertThresholdPercent || 10)) {
        shouldAlert = true;
        alertReason = `Price dropped by ${Math.round(dropPct)}% (from ₹${previousPrice.toLocaleString("en-IN")} to ₹${lowestPrice.toLocaleString("en-IN")}).`;
      }
    } else if (watch.alertCondition === "any_drop" && lowestPrice < previousPrice) {
      shouldAlert = true;
      alertReason = `Price dropped from ₹${previousPrice.toLocaleString("en-IN")} to ₹${lowestPrice.toLocaleString("en-IN")}.`;
    }

    // Apply alert cooldown
    const now = Date.now();
    const hasActiveCooldown =
      watch.lastAlertedAt &&
      now - new Date(watch.lastAlertedAt).getTime() < ALERT_COOLDOWN_MS &&
      watch.lastAlertedPrice != null &&
      lowestPrice >= watch.lastAlertedPrice;

    if (shouldAlert && !hasActiveCooldown) {
      watch.lastAlertedPrice = lowestPrice;
      watch.lastAlertedAt = new Date();
      watch.lastAlertedEvent = "PRICE_DROP";
      logger.info(`[PriceWatch Alert] User ${watch.userId}: ${alertReason}`);
    }

    // Update watch state
    watch.previousPrice = previousPrice;
    watch.lastPrice = lowestPrice;
    watch.lowestPrice = Math.min(watch.lowestPrice ?? lowestPrice, lowestPrice);
    watch.provider = providerName;
    watch.lastCheckedAt = new Date();
    watch.nextCheckAt = new Date(Date.now() + (watch.checkIntervalHours || 12) * 3600000);
    await watch.save();

    return {
      watchId: watch._id,
      lowestPrice,
      previousPrice,
      shouldAlert: shouldAlert && !hasActiveCooldown,
      alertReason,
    };
  } catch (err) {
    logger.error(`[PriceWatch] Error processing watch ${watch._id}:`, err);
    watch.lastCheckedAt = new Date();
    watch.nextCheckAt = new Date(Date.now() + 60 * 60 * 1000); // Retry in 1 hour
    await watch.save().catch(() => {});
    return null;
  }
}

/**
 * Check all currently due active price watches.
 */
export async function checkDuePriceWatches() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const dueWatches = await PriceWatch.find({
      status: "active",
      nextCheckAt: { $lte: new Date() },
    })
      .limit(20)
      .sort({ nextCheckAt: 1 });

    if (dueWatches.length > 0) {
      logger.info(`[PriceWatch Worker] Found ${dueWatches.length} due watches to inspect.`);
      for (const watch of dueWatches) {
        await processSingleWatch(watch);
      }
    }
  } catch (err) {
    logger.warn(`[PriceWatch Worker] Check cycle error: ${err.message}`);
  } finally {
    isProcessing = false;
  }
}

/**
 * Start background scheduler.
 */
export function startPriceWatchScheduler(intervalMs = 5 * 60 * 1000) {
  if (schedulerInterval) return;

  // Run initial check after 10s delay to allow DB connection to stabilize
  setTimeout(() => {
    checkDuePriceWatches().catch(() => {});
  }, 10000);

  schedulerInterval = setInterval(() => {
    checkDuePriceWatches().catch(() => {});
  }, intervalMs);

  logger.info(`[PriceWatch Scheduler] Started with cycle interval of ${intervalMs / 1000}s`);
}

/**
 * Stop background scheduler.
 */
export function stopPriceWatchScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    logger.info("[PriceWatch Scheduler] Stopped.");
  }
}
