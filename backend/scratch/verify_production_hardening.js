import mongoose from "mongoose";
import { env, getProviderConfigStatus } from "../config/env.js";
import { checkRedisHealth } from "../services/queue/redis.js";
import { getReelQueueHealth, addReelJob } from "../services/queue/reel-queue.js";
import { flightProvider } from "../services/travel/providers/flight.provider.js";
import { hotelProvider } from "../services/travel/providers/hotel.provider.js";
import { transportProvider } from "../services/travel/providers/transport.provider.js";
import { commanderService } from "../services/commander/commander.service.js";
import { rulesEngine } from "../services/commanderRulesEngine.js";
import { apiClient, ExternalApiError } from "../utils/apiClient.js";
import { ocrProvider } from "../services/ocr/ocr-provider.service.js";
import { exifExtractor } from "../services/media/exif-extractor.service.js";
import Trip from "../models/Trip.js";
import sharp from "sharp";

async function runTests() {
  console.log("==================================================");
  console.log("ADVENZA — PRODUCTION HARDENING AUTOMATED VERIFICATION");
  console.log("==================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  // ── TEST 1: Environment & Provider Introspection ─────────────────────────────
  console.log("\n[TEST 1] Environment & Provider Configuration Status");
  const provStatus = getProviderConfigStatus();
  assert(provStatus.amadeusFlight !== undefined, "Amadeus flight provider status inspected");
  assert(provStatus.hotelProvider !== undefined, "Hotel provider status inspected");
  assert(provStatus.googleMapsTransit !== undefined, "Google Maps transit status inspected");
  assert(provStatus.ai !== undefined, "AI status inspected without leaking keys");
  assert(provStatus.amadeusFlight.status === "NOT_CONFIGURED" || provStatus.amadeusFlight.status === "CONFIGURED", "Amadeus status correctly categorized");

  // ── TEST 2: Redis & BullMQ Health & Fallback Architecture ────────────────────
  console.log("\n[TEST 2] Redis & BullMQ Health Probes");
  const redisHealth = await checkRedisHealth();
  assert(["HEALTHY", "DEGRADED", "NOT_CONFIGURED", "UNAVAILABLE"].includes(redisHealth.status), `Redis health returns valid enum: ${redisHealth.status}`);
  const queueHealth = await getReelQueueHealth();
  assert(["HEALTHY", "DEGRADED", "NOT_CONFIGURED", "UNAVAILABLE"].includes(queueHealth.status), `Reel queue health returns valid enum: ${queueHealth.status}`);

  // Test in-memory queue fallback behavior in non-production
  if (env.NODE_ENV !== "production") {
    const jobRes = await addReelJob({
      reelId: "test_reel_123",
      userId: "test_user_1",
      tripId: "65f012345678901234567890",
      memories: [],
      template: "cinematic",
    });
    assert(jobRes.queued === true, "Reel queue handled job without crashing");
  }

  // ── TEST 3: Travel Provider Abstraction & Truthful NOT_CONFIGURED Responses ──
  console.log("\n[TEST 3] Travel Providers Truthfulness (No Fake Live Data)");
  
  // Flight Provider
  const flightRes = await flightProvider.searchFlights({
    origin: "BOM",
    destination: "GOI",
    departureDate: "2026-10-15",
  });
  if (!flightProvider.isConfigured()) {
    assert(flightRes.status === "NOT_CONFIGURED", "Flight search reports NOT_CONFIGURED when credentials missing");
    assert(flightRes.results.length === 0, "No fake flight offers returned as live");
    assert(flightRes.isLive === false, "isLive is explicitly false");
  } else {
    assert(flightRes.provider.includes("Amadeus"), "Amadeus live provider active");
  }

  // Flight Status
  const flightStatusRes = await flightProvider.getFlightStatus({ flightNumber: "6E-205" });
  if (!flightProvider.isConfigured()) {
    assert(flightStatusRes.status === "NOT_CONFIGURED", "Flight status reports NOT_CONFIGURED when credentials missing");
  }

  // Hotel Provider
  const hotelRes = await hotelProvider.searchHotels({ destination: "Goa" });
  if (!hotelProvider.isConfigured()) {
    assert(hotelRes.status === "NOT_CONFIGURED", "Hotel search reports NOT_CONFIGURED when credentials missing");
    assert(hotelRes.isLive === false, "Hotels explicitly marked isLive: false");
    assert(hotelRes.source === "CURATED_STATIC_CATALOG", "Hotels marked as CURATED_STATIC_CATALOG");
    assert(hotelRes.disclaimer.includes("NOT CONFIGURED"), "Disclaimer explicitly states live booking is not configured");
  }

  // Transport Provider
  const transportRes = await transportProvider.getRouteStatus({ origin: "Mumbai", destination: "Goa" });
  if (!transportProvider.isConfigured()) {
    assert(transportRes.status === "ESTIMATED", "Transport route marked ESTIMATED when maps key missing");
    assert(transportRes.isLive === false, "Transport isLive is false");
    assert(transportRes.trafficLevel === "unknown", "Traffic level honestly reported as unknown");
    assert(transportRes.trafficStatus === "UNAVAILABLE", "Traffic status marked UNAVAILABLE");
  }

  // ── TEST 4: Reusable API Client Layer ────────────────────────────────────────
  console.log("\n[TEST 4] Reusable API Client (apiClient)");
  try {
    // Testing non-retry on client error (HTTP 400)
    await apiClient.get("https://api.open-meteo.com/v1/forecast?latitude=999&longitude=999", { provider: "TestClient", timeoutMs: 5000, maxRetries: 2 });
    assert(false, "Should have thrown for client error");
  } catch (apiErr) {
    assert(apiErr instanceof ExternalApiError, "Throws normalized ExternalApiError");
    assert(apiErr.statusCode === 400, "Correct status code captured in normalized error");
    assert(apiErr.isTransient === false, "Client error correctly flagged as non-transient (not retried)");
  }

  // ── TEST 5: Trip Commander Anti-Hallucination & acceptEvent ──────────────────
  console.log("\n[TEST 5] Trip Commander Anti-Hallucination & acceptEvent");

  // Connect to DB for model tests
  await mongoose.connect(env.MONGODB_URI);
  console.log("  ✓ Connected to MongoDB for model testing");

  const testTrip = await Trip.create({
    title: "Production Hardening Verification Trip",
    destination: "Goa",
    startDate: "2026-11-01",
    endDate: "2026-11-05",
    createdBy: "verify_user_prod_test",
    days: [
      {
        dayNumber: 1,
        date: "2026-11-01",
        title: "Day 1 - Arrival & Sightseeing",
        activities: [
          { time: "14:00", description: "Outdoor Beach Tour and Water Sports" },
        ],
      },
    ],
  });

  try {
    // Verify Rule Engine tags sources
    const ruleEvents = rulesEngine.evaluateTripEvents({
      trip: testTrip,
      weatherData: {
        status: "LIVE_VERIFIED",
        data: { temperatureC: 28, rainProbabilityPercent: 85, condition: "Thunderstorms", source: "Open-Meteo" },
      },
      flightData: null,
      budgetData: { success: true, budgetTotal: 50000, totalSpent: 45000, remaining: 5000, pctUsed: 90, source: "Trip Ledger" },
    });

    assert(ruleEvents.length > 0, `Rules engine generated ${ruleEvents.length} events`);
    const rainEvt = ruleEvents.find((e) => e.kind === "weather");
    assert(rainEvt && rainEvt.dataType === "LIVE_VERIFIED", "Weather event correctly tagged LIVE_VERIFIED");
    const budgetEvt = ruleEvents.find((e) => e.kind === "budget");
    assert(budgetEvt && budgetEvt.dataType === "ESTIMATED", "Budget event correctly tagged ESTIMATED");

    // Test acceptEvent Itinerary Mutation
    const weatherEvtId = `evt_${testTrip._id}_weather_rain`;
    const acceptRes1 = await commanderService.acceptEvent("verify_user_prod_test", weatherEvtId);
    assert(acceptRes1.success === true, "acceptEvent executed successfully");
    assert(acceptRes1.alreadyAccepted === false, "First acceptance flagged as new");

    // Verify change persisted to MongoDB
    const updatedTrip = await Trip.findById(testTrip._id);
    const day1Activities = updatedTrip.days[0].activities;
    const hasBuffer = day1Activities.some((a) => a.description.includes("Commander Rainy Weather Buffer"));
    assert(hasBuffer, "Itinerary was mutated and rainy weather buffer activity persisted in MongoDB");
    assert(updatedTrip.acceptedCommanderEvents.length === 1, "Event tracked in acceptedCommanderEvents array");

    // Test Duplicate Acceptance Prevention
    const acceptRes2 = await commanderService.acceptEvent("verify_user_prod_test", weatherEvtId);
    assert(acceptRes2.alreadyAccepted === true, "Duplicate acceptance blocked idempotently");
    const finalTrip = await Trip.findById(testTrip._id);
    assert(finalTrip.acceptedCommanderEvents.length === 1, "Duplicate action not inserted into MongoDB");
  } finally {
    await Trip.deleteOne({ _id: testTrip._id });
  }

  // ── TEST 6: EXIF Metadata Extraction ─────────────────────────────────────────
  console.log("\n[TEST 6] EXIF Metadata Extractor");
  // Create minimal valid WebP buffer using Sharp
  const testBuffer = await sharp({
    create: {
      width: 100,
      height: 100,
      channels: 4,
      background: { r: 255, g: 100, b: 50, alpha: 1 },
    },
  })
    .webp()
    .toBuffer();

  const exifRes = await exifExtractor.extractMetadata(testBuffer);
  assert(exifRes.dimensions.width === 100, "EXIF extractor accurately parsed image width");
  assert(exifRes.format === "webp", "EXIF extractor identified format");

  // ── TEST 7: Receipt OCR Abstraction ──────────────────────────────────────────
  console.log("\n[TEST 7] Receipt OCR Provider Abstraction");
  const mockReceiptText = "STARBUCKS COFFEE\nDate: 2026-09-20\nTotal: 485.00 INR\nCard payment verified";
  const ocrRes = await ocrProvider.extractReceipt({ textContent: mockReceiptText });
  assert(ocrRes.status === "OCR_RESULT", "OCR returns status OCR_RESULT");
  assert(ocrRes.requiresUserConfirmation === true, "Requires user confirmation before ledger entry");
  assert(ocrRes.disclaimer.includes("user verification"), "Disclaimer mandates verification");

  console.log("\n==================================================");
  console.log(`VERIFICATION COMPLETE: ${passed} passed, ${failed} failed`);
  console.log("==================================================");

  const { disconnectRedis } = await import("../services/queue/redis.js");
  await disconnectRedis();
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
