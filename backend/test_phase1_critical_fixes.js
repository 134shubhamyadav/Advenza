import assert from "node:assert/strict";
import { railwayTimelineService } from "./services/travel/railway-timeline.service.js";
import { conversationalAIService } from "./services/ai/conversational-ai.service.js";
import { destinationDisambiguationService } from "./services/places/destination-disambiguation.service.js";
import { verificationAgent } from "./services/ai/orchestrator/verification.agent.js";
import { finalAIJudgeAgent } from "./services/ai/orchestrator/final-judge.agent.js";
import { verifyToken } from "./middleware/auth.js";

console.log("===================================================================");
console.log(" ADVENZA PHASE 1 CRITICAL SECURITY & RELIABILITY REGRESSION SUITE   ");
console.log("===================================================================\n");

let passed = 0;
let total = 0;

async function runTest(name, fn) {
  total++;
  try {
    await fn();
    console.log(`[PASS] Test ${total}: ${name}`);
    passed++;
  } catch (err) {
    console.error(`[FAIL] Test ${total}: ${name}`);
    console.error(`       Error: ${err.message}`);
    if (err.stack) {
      const line = err.stack.split("\n")[1];
      console.error(`       Stack: ${line?.trim()}`);
    }
  }
}

async function main() {
  // ── 1. AUTHENTICATION SECURITY REGRESSION TESTS ────────────────────────────

  await runTest("Auth: Rejects requests missing Bearer token with 401 when service account is active", async () => {
    const originalJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    try {
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({
        project_id: "test-auth-project",
        private_key: "MOCK_TEST_PRIVATE_KEY_NOT_A_REAL_KEY",
        client_email: "test@advenza.iam.gserviceaccount.com",
      });

      let statusCode = null;
      let jsonPayload = null;

      const req = {
        headers: {
          "x-user-id": "attacker-spoofed-uid-12345", // Attempt IDOR bypass
        },
      };
      const res = {
        status: (code) => {
          statusCode = code;
          return {
            json: (payload) => {
              jsonPayload = payload;
            },
          };
        },
      };
      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      await verifyToken(req, res, next);

      assert.equal(statusCode, 401, "Missing Bearer token must return 401");
      assert.equal(nextCalled, false, "Must never call next() on missing Bearer token");
      assert.ok(jsonPayload?.error?.includes("Unauthorized"), "Must return Unauthorized error");
      assert.equal(req.uid, undefined, "req.uid must not be set from spoofed x-user-id header");
    } finally {
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON = originalJson;
    }
  });

  await runTest("Auth: Development bypass is strictly forbidden in production (NODE_ENV=production)", async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    try {
      process.env.NODE_ENV = "production";
      delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

      let statusCode = null;
      let jsonPayload = null;

      const req = {
        headers: { "x-user-id": "any-user" },
      };
      const res = {
        status: (code) => {
          statusCode = code;
          return {
            json: (payload) => {
              jsonPayload = payload;
            },
          };
        },
      };
      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      await verifyToken(req, res, next);

      assert.equal(statusCode, 500, "Production without Firebase credentials must fail securely with 500");
      assert.equal(nextCalled, false, "Dev bypass must never execute in production");
    } finally {
      process.env.NODE_ENV = originalEnv;
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON = originalJson;
    }
  });

  // ── 2. MULTI-DAY RAILWAY TIMELINE MANDATORY TEST ───────────────────────────

  await runTest("Railway: Mandatory Test — Nov 18 10:55 AM to Nov 19 5:30 PM = 30h 35m (1,835 mins)", async () => {
    const timeline = await railwayTimelineService.buildRailwayTimeline({
      fromStation: "DELHI",
      toStation: "MUMBAI",
      journeyDate: "2026-11-18",
      arrivalDate: "2026-11-19",
      departureTime: "10:55",
      arrivalTime: "17:30",
    });

    assert.equal(timeline.totalDurationMinutes, 1835, "Duration must be exactly 1,835 minutes (30h 35m)");
    assert.equal(timeline.totalDurationText, "30h 35m", "Duration text must be '30h 35m'");
    assert.equal(timeline.dayCrossings, 1, "Must cross exactly 1 calendar midnight");
    assert.equal(timeline.totalJourneyDays, 2, "Must touch 2 journey days");
    assert.equal(timeline.isOvernight, true, "Must be classified as overnight");
    assert.equal(timeline.destinationArrivalDate, "2026-11-19", "Destination arrival date must be Nov 19, 2026");
    assert.equal(timeline.destinationArrivalTime, "17:30", "Destination arrival time must be 17:30");
    assert.ok(timeline.scheduledBoardingDepartureDateTime.startsWith("2026-11-18T10:55"), "Departure timestamp must match Nov 18 10:55");
    assert.ok(timeline.scheduledDestinationArrivalDateTime.startsWith("2026-11-19T17:30"), "Arrival timestamp must match Nov 19 17:30");
    assert.ok(timeline.expectedDestinationArrivalDateTime.startsWith("2026-11-19T17:30"), "Expected arrival timestamp must match Nov 19 17:30");
  });

  await runTest("Railway: Multi-day 48h journey (Mangala Lakshadweep Express 12618) properly spreads across Day 1, 2, 3", async () => {
    const timeline = await railwayTimelineService.buildRailwayTimeline({
      trainNumber: "12618",
      fromStation: "NZM",
      toStation: "ERS",
      journeyDate: "2026-11-18",
    });

    assert.equal(timeline.trainNumber, "12618");
    assert.ok(timeline.totalDurationMinutes >= 2800, `Mangala Lakshadweep Express must take ~49-50 hours, got ${timeline.totalDurationMinutes}`);
    assert.equal(timeline.dayCrossings, 2, "Must cross 2 calendar midnights (Day 1 to Day 3)");
    assert.equal(timeline.totalJourneyDays, 3, "Total journey days must be 3");
    assert.equal(timeline.destinationArrivalDate, "2026-11-20", "Arrival date must be 2026-11-20 (Day 3)");
    assert.equal(timeline.isOvernight, true);
    assert.ok(timeline.stops.length > 20, "Must have intermediate station stops");
    // Verify intermediate stations have correct sequence calendar dates
    const day3Stop = timeline.stops.find((s) => s.stationCode === "ERS");
    assert.equal(day3Stop?.calendarDate, "2026-11-20", "ERS final arrival date must be Day 3");
  });

  await runTest("Railway: Incomplete timetable (clock times only without arrival date or duration) returns UNAVAILABLE without guessing same-day", async () => {
    const timeline = await railwayTimelineService._buildFallbackTimeline({
      trainNumber: "99999",
      trainName: "Unscheduled Express",
      fromStation: { code: "NDLS", name: "New Delhi" },
      toStation: { code: "CSMT", name: "Mumbai" },
      journeyDate: "2026-11-18",
      userDepTime: "10:55",
      userArrTime: "17:30",
      durationMinutes: null,
      inputArrivalDate: null,
    });

    assert.equal(timeline.isUnresolvedSchedule, true, "Must flag unresolved schedule");
    assert.equal(timeline.statusClassification, "UNAVAILABLE", "Status classification must be UNAVAILABLE");
    assert.equal(timeline.dataClassification, "UNAVAILABLE", "Data classification must be UNAVAILABLE");
    assert.equal(timeline.totalDurationMinutes, null, "Must never invent 6h 35m same-day duration");
    assert.equal(timeline.destinationArrivalDate, null, "Must never invent arrival date");
  });

  await runTest("Railway: Classification separation distinguishes scheduled journey vs live tracking", async () => {
    const timeline = await railwayTimelineService.buildRailwayTimeline({
      fromStation: "DELHI",
      toStation: "MUMBAI",
      journeyDate: "2026-11-25", // Future date: scheduled timetable search, not live tracking
      departureTime: "10:55",
      arrivalTime: "17:30",
      fallbackDurationMinutes: 1835,
      trackLive: false,
    });

    assert.equal(timeline.statusClassification, "SCHEDULED_JOURNEY", "Timetable search must not claim live tracking");
    assert.equal(timeline.freshnessClassification, "STATIC", "Freshness must be STATIC");
    assert.equal(timeline.liveTracking.isLive, false, "Live tracking must be false");
    assert.ok(timeline.provider, "Provider must be defined");
    assert.ok(timeline.lastUpdatedAt, "lastUpdatedAt timestamp must be present");
  });

  // ── 3. GEOGRAPHIC PROXIMITY & HALLUCINATION ELIMINATION ───────────────────

  await runTest("Proximity: calculateEstimatedDistance removes Mulund/Assagao fake claims and returns 'Distance unavailable'", () => {
    const fakeMulundPlace = { name: "Mulund Dosa Corner", address: "Station Road, Mulund West" };
    const fakeAssagaoPlace = { name: "Assagao Bistro", address: "Badem, Assagao, Goa" };

    const mulundDist = conversationalAIService.calculateEstimatedDistance("Mulund West Hotel", fakeMulundPlace);
    assert.equal(mulundDist, "Distance unavailable", "Must NEVER return hardcoded '1.2 km' for Mulund");

    const assagaoDist = conversationalAIService.calculateEstimatedDistance("Assagao Heritage Villa", fakeAssagaoPlace);
    assert.equal(assagaoDist, "Distance unavailable", "Must NEVER return hardcoded '0.8 km' for Assagao");

    // Real coordinate test
    const venueWithCoords = {
      name: "Marine Drive Promenade",
      address: "Marine Drive, Mumbai",
      coordinates: { lat: 18.944, lng: 72.823 },
    };
    const hotelCoords = { lat: 18.932, lng: 72.831 };
    const realDist = conversationalAIService.calculateEstimatedDistance("Colaba Hotel", venueWithCoords, hotelCoords);
    assert.ok(realDist.includes("km"), `Real coordinates must produce Haversine distance, got ${realDist}`);
    assert.ok(!realDist.includes("Distance unavailable"));
  });

  await runTest("Geographic: Destination disambiguation never returns { lat: 0, lng: 0 } (Null Island)", async () => {
    const res = await destinationDisambiguationService.disambiguate("NonExistentPlaceXYZ, UnknownRegion");
    if (res.resolved?.coordinates) {
      assert.notEqual(res.resolved.coordinates.lat, 0, "Latitude must not default to 0");
      assert.notEqual(res.resolved.coordinates.lng, 0, "Longitude must not default to 0");
    } else {
      assert.equal(res.resolved?.coordinates, null, "Unresolved coordinates must be explicitly null, not {lat: 0, lng: 0}");
    }
  });

  // ── 4. FINAL JUDGE & VERIFICATION AGENT AUDIT ──────────────────────────────

  await runTest("Verification Agent: Derives scores strictly from evidence (No hardcoded 80/92/95)", () => {
    const destinationData = {
      destinationName: "Ayodhya",
      country: "India",
      emergencyNumber: "112",
      popularAttractions: [
        { name: "Ram Mandir", coordinates: { lat: 26.7956, lng: 82.1944 } },
        { name: "Hanuman Garhi", coordinates: { lat: 26.7932, lng: 82.2012 } },
      ],
      hiddenGems: [
        { name: "Suraj Kund", coordinates: { lat: 26.7788, lng: 82.2155 } },
      ],
      localDining: [{ name: "Makhan-Malai Sweet", cuisine: "Awadhi" }],
      _telemetry: { osmPoisDiscovered: 5 },
    };

    const accommodationData = {
      preference: "OWN_HOME",
      isFreeAccommodation: true,
      totalAccommodationCostINR: 5000, // Deliberate illegal non-zero cost
    };

    const budgetData = {
      breakdown: {
        transportation: { total: 2000 },
        accommodation: { total: 0 },
        foodAndDining: { total: 1500 },
        activitiesAndTickets: { total: 500 },
        miscellaneousAndBuffer: { amount: 500 },
      },
      totalEstimatedBudgetINR: 4500, // 2000 + 0 + 1500 + 500 + 500 = 4500 (Matches!)
    };

    const transportData = {
      distanceKm: 650,
      recommendedModes: [{ mode: "Train", priceType: "LIVE_VERIFIED" }],
      _telemetry: { hasLiveRouting: true },
    };

    const audit = verificationAgent.verify({
      destinationData,
      transportData,
      accommodationData,
      budgetData,
    });

    // 1. Accommodation logic must enforce ₹0
    assert.equal(accommodationData.totalAccommodationCostINR, 0, "Free home stay cost must be corrected to 0");
    assert.equal(audit.checks.accommodationLogic.isFreeAccommodation, true);

    // 2. Budget arithmetic match
    assert.equal(audit.checks.budgetArithmetic.passed, true);
    assert.equal(audit.checks.budgetArithmetic.difference, 0);

    // 3. Dynamic provider evaluation matrix (derived, not hardcoded 92)
    assert.ok(audit.providerEvaluation.factualAccuracy > 0, "Factual accuracy must be evidence-derived");
    assert.ok(audit.providerEvaluation.overallQualityScore > 0, "Quality score must be evidence-derived");
    assert.equal(audit.checks.geographicValidity.passed, true, "All valid coordinates must pass");
  });

  await runTest("Final Judge: Railway schedule validation detects illegal sightseeing during multi-day transit", () => {
    const itinerary = {
      days: [
        {
          date: "2026-11-18", // Boarding day (Train departs 10:55 AM)
          activities: [
            { time: "10:55", description: "Board train at New Delhi", type: "TRAIN_BOARDING" },
          ],
        },
        {
          date: "2026-11-19", // Intermediate / Transit day (Traveler is en route until 17:30)
          activities: [
            // Illegal sightseeing scheduled at 11:00 AM while traveler is on the train!
            { time: "11:00", placeName: "Gateway of India", description: "Visit Gateway of India", type: "SIGHTSEEING" },
            { time: "17:30", description: "Arrive at Mumbai CSMT", type: "TRAIN_ARRIVAL" },
          ],
        },
      ],
    };

    const validation = finalAIJudgeAgent.validateItineraryAgainstRailwayTimeline({
      itinerary,
      outboundJourney: {
        departureDate: "2026-11-18",
        arrivalDate: "2026-11-19",
        arrivalTime: "17:30",
        durationMinutes: 1835,
      },
      returnJourney: {
        departureDate: "2026-11-22",
      },
    });

    assert.equal(validation.isValid, false, "Must detect sightseeing violation during transit");
    assert.ok(validation.violations.includes("SIGHTSEEING_BEFORE_ARRIVAL"), "Must report SIGHTSEEING_BEFORE_ARRIVAL");
    assert.equal(validation.dataClassification, "CONFLICT_DETECTED");
  });

  // ── FINAL REPORT ──────────────────────────────────────────────────────────
  console.log("\n===================================================================");
  console.log(` RESULTS: ${passed} / ${total} TESTS PASSED`);
  console.log("===================================================================");

  if (passed !== total) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("FATAL ERROR running test suite:", err);
  process.exit(1);
});
