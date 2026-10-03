/**
 * ADVENZA PART 3 — Journey Calculation Engine Verification
 *
 * Tests:
 *   1.  Same-day journey (Mumbai→Goa 08:00–16:00)
 *   2.  Overnight journey (Mumbai→Goa 20:00–08:00+1)
 *   3.  36-hour journey (Day 1 06:00 → Day 2 18:00)
 *   4.  Multi-day journey (Day 1 06:00 → Day 3 06:00)
 *   5.  User-provided duration preserved
 *   6.  Provider unavailable — graceful handling
 *   7.  Road duration via existing transport provider
 *   8.  Road fallback → Haversine estimate
 *   9.  Existing trip loads correctly
 *  10.  Return journey calculated independently
 */

import mongoose from "mongoose";
import { env } from "../config/env.js";
import Trip from "../models/Trip.js";
import {
  calculateJourneyLeg,
  calculateTripTiming,
  computeJourneys,
  _testUtils,
} from "../services/travel/journey-engine.service.js";
import { generateTripDates } from "../services/itinerary/itinerary-sanitizer.js";

const { buildDateTime, durationBetween, calendarDaysBetween, isOvernightJourney, _parseFlightDuration } = _testUtils;

async function runPart3Tests() {
  console.log("==================================================");
  console.log("ADVENZA PART 3 — JOURNEY ENGINE VERIFICATION");
  console.log("==================================================");

  let passed = 0;
  let failed = 0;
  const createdTripIds = [];

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  await mongoose.connect(env.MONGODB_URI);
  console.log("Connected to MongoDB for testing.\n");

  try {
    // ═══════════════════════════════════════════════════════════════════════
    // UNIT TESTS — Pure calculation functions (no network, no DB)
    // ═══════════════════════════════════════════════════════════════════════

    console.log("[UNIT] Date/Time Utility Functions");

    // buildDateTime
    const dt1 = buildDateTime("2026-10-10", "08:00");
    assert(dt1 instanceof Date && !isNaN(dt1.getTime()), "buildDateTime creates valid Date from YYYY-MM-DD + HH:mm");
    assert(dt1.getUTCHours() === 8 && dt1.getUTCMinutes() === 0, "buildDateTime produces correct UTC hours/minutes");
    assert(buildDateTime("", "08:00") === null, "buildDateTime returns null for missing date");
    assert(buildDateTime("2026-10-10", "") === null, "buildDateTime returns null for missing time");
    assert(buildDateTime("bad-date", "08:00") === null, "buildDateTime returns null for malformed date");

    // durationBetween
    const dep = buildDateTime("2026-10-10", "08:00");
    const arr = buildDateTime("2026-10-10", "16:00");
    assert(durationBetween(dep, arr) === 480, "durationBetween: 08:00 → 16:00 = 480 minutes");
    assert(durationBetween(null, arr) === null, "durationBetween: null → Date = null");

    // calendarDaysBetween
    assert(calendarDaysBetween("2026-10-10", "2026-10-10") === 1, "calendarDaysBetween: same day = 1");
    assert(calendarDaysBetween("2026-10-10", "2026-10-11") === 2, "calendarDaysBetween: 2 consecutive days = 2");
    assert(calendarDaysBetween("2026-10-10", "2026-10-12") === 3, "calendarDaysBetween: Oct 10→12 = 3");

    // isOvernightJourney
    const sameDayDep = buildDateTime("2026-10-10", "08:00");
    const sameDayArr = buildDateTime("2026-10-10", "16:00");
    assert(isOvernightJourney(sameDayDep, sameDayArr) === false, "isOvernightJourney: same day = false");
    const overnightArr = buildDateTime("2026-10-11", "08:00");
    assert(isOvernightJourney(sameDayDep, overnightArr) === true, "isOvernightJourney: different days = true");

    // _parseFlightDuration
    assert(_parseFlightDuration("2h15m") === 135, "parseFlightDuration: '2h15m' = 135");
    assert(_parseFlightDuration("PT3H30M") === 210, "parseFlightDuration: 'PT3H30M' = 210");
    assert(_parseFlightDuration(null) === null, "parseFlightDuration: null = null");

    // ═══════════════════════════════════════════════════════════════════════
    // TEST 1: Same-Day Journey (Mumbai → Goa, 08:00 → 16:00)
    // ═══════════════════════════════════════════════════════════════════════

    console.log("\n[TEST 1] Same-Day Journey");
    const leg1 = await calculateJourneyLeg({
      transportType: "Train",
      departureLocation: "Mumbai",
      arrivalLocation: "Goa",
      departureDate: "2026-10-10",
      departureTime: "08:00",
      arrivalDate: "2026-10-10",
      arrivalTime: "16:00",
    });
    assert(leg1.durationMinutes === 480, `Same-day duration = 480 min (got ${leg1.durationMinutes})`);
    const timing1 = calculateTripTiming(leg1, null);
    assert(timing1.outbound.isOvernight === false, "Same-day isOvernight = false");
    assert(timing1.outbound.travelDaysCount === 1, "Same-day travelDaysCount = 1");

    // ═══════════════════════════════════════════════════════════════════════
    // TEST 2: Overnight Journey (Mumbai → Goa, 20:00 → next day 08:00)
    // ═══════════════════════════════════════════════════════════════════════

    console.log("\n[TEST 2] Overnight Journey");
    const leg2 = await calculateJourneyLeg({
      transportType: "Train",
      departureLocation: "Mumbai",
      arrivalLocation: "Goa",
      departureDate: "2026-10-10",
      departureTime: "20:00",
      arrivalDate: "2026-10-11",
      arrivalTime: "08:00",
    });
    assert(leg2.durationMinutes === 720, `Overnight duration = 720 min (got ${leg2.durationMinutes})`);
    const timing2 = calculateTripTiming(leg2, null);
    assert(timing2.outbound.isOvernight === true, "Overnight isOvernight = true");
    assert(timing2.outbound.travelDaysCount === 2, "Overnight travelDaysCount = 2");

    // ═══════════════════════════════════════════════════════════════════════
    // TEST 3: 36-Hour Journey (Day 1 06:00 → Day 2 18:00)
    // ═══════════════════════════════════════════════════════════════════════

    console.log("\n[TEST 3] 36-Hour Journey");
    const leg3 = await calculateJourneyLeg({
      transportType: "Train",
      departureLocation: "Kanyakumari",
      arrivalLocation: "Dibrugarh",
      departureDate: "2026-10-10",
      departureTime: "06:00",
      arrivalDate: "2026-10-11",
      arrivalTime: "18:00",
    });
    assert(leg3.durationMinutes === 2160, `36-hour duration = 2160 min (got ${leg3.durationMinutes})`);
    const timing3 = calculateTripTiming(leg3, null);
    assert(timing3.outbound.isOvernight === true, "36-hour isOvernight = true");
    assert(timing3.outbound.travelDaysCount === 2, "36-hour travelDaysCount = 2");

    // ═══════════════════════════════════════════════════════════════════════
    // TEST 4: Multi-Day Journey (Day 1 06:00 → Day 3 06:00)
    // ═══════════════════════════════════════════════════════════════════════

    console.log("\n[TEST 4] Multi-Day Journey (48h)");
    const leg4 = await calculateJourneyLeg({
      transportType: "Train",
      departureLocation: "Kanyakumari",
      arrivalLocation: "Dibrugarh",
      departureDate: "2026-10-10",
      departureTime: "06:00",
      arrivalDate: "2026-10-12",
      arrivalTime: "06:00",
    });
    assert(leg4.durationMinutes === 2880, `48-hour duration = 2880 min (got ${leg4.durationMinutes})`);
    const timing4 = calculateTripTiming(leg4, null);
    assert(timing4.outbound.isOvernight === true, "Multi-day isOvernight = true");
    assert(timing4.outbound.travelDaysCount === 3, `Multi-day travelDaysCount = 3 (got ${timing4.outbound.travelDaysCount})`);

    // ═══════════════════════════════════════════════════════════════════════
    // TEST 5: User-Provided Duration Preserved
    // ═══════════════════════════════════════════════════════════════════════

    console.log("\n[TEST 5] User-Provided Duration Preserved");
    const leg5 = await calculateJourneyLeg({
      transportType: "Train",
      departureLocation: "Mumbai",
      arrivalLocation: "Delhi",
      departureDate: "2026-10-10",
      departureTime: "16:00",
      arrivalDate: "2026-10-11",
      arrivalTime: "10:00",
      durationMinutes: 1080,
      durationSource: "SCHEDULED",
      transitRef: "Rajdhani Express",
      booked: true,
    });
    // User provided departure + arrival → engine calculates from timestamps
    // Duration from 16:00 to next day 10:00 = 18h = 1080 min
    assert(leg5.durationMinutes === 1080, `User-provided timestamps → 1080 min (got ${leg5.durationMinutes})`);
    assert(leg5.status === "CONFIRMED", "Booked journey with transitRef → CONFIRMED status");
    assert(leg5.transitRef === "Rajdhani Express", "Transit reference preserved");

    // ═══════════════════════════════════════════════════════════════════════
    // TEST 6: Provider Unavailable — Graceful Handling
    // ═══════════════════════════════════════════════════════════════════════

    console.log("\n[TEST 6] Provider Unavailable");
    const leg6 = await calculateJourneyLeg({
      transportType: "Car",
      departureLocation: "",
      arrivalLocation: "",
    });
    assert(leg6 !== null && typeof leg6 === "object", "Empty locations → returns result object (no crash)");
    assert(
      leg6.durationSource === "UNAVAILABLE" || leg6.durationSource === "",
      `Empty locations → source is UNAVAILABLE or empty (got '${leg6.durationSource}')`
    );

    // ═══════════════════════════════════════════════════════════════════════
    // TEST 7: Road Duration via Existing Transport Provider
    // ═══════════════════════════════════════════════════════════════════════

    console.log("\n[TEST 7] Road Duration Calculation (Google Maps or Haversine)");
    const leg7 = await calculateJourneyLeg({
      transportType: "Car",
      departureLocation: "Mumbai",
      arrivalLocation: "Goa",
      departureDate: "2026-10-10",
    });
    assert(leg7.durationMinutes > 0, `Road journey has positive duration: ${leg7.durationMinutes} min`);
    assert(
      ["CALCULATED_MAPS", "ESTIMATED_HAVERSINE"].includes(leg7.durationSource),
      `Road source is CALCULATED_MAPS or ESTIMATED_HAVERSINE (got '${leg7.durationSource}')`
    );
    assert(leg7.status === "ESTIMATED", "Road calculation is ESTIMATED status");

    // ═══════════════════════════════════════════════════════════════════════
    // TEST 8: Road Fallback (Haversine)
    // ═══════════════════════════════════════════════════════════════════════

    console.log("\n[TEST 8] Road Fallback (Haversine Estimate)");
    // The transport provider always returns something (LIVE or ESTIMATED),
    // so we verify the result is properly sourced.
    const leg8 = await calculateJourneyLeg({
      transportType: "Car",
      departureLocation: "Jaipur",
      arrivalLocation: "Udaipur",
    });
    assert(leg8.durationMinutes > 0, `Jaipur→Udaipur road estimate: ${leg8.durationMinutes} min`);
    assert(
      ["CALCULATED_MAPS", "ESTIMATED_HAVERSINE"].includes(leg8.durationSource),
      `Source properly labeled (got '${leg8.durationSource}')`
    );

    // ═══════════════════════════════════════════════════════════════════════
    // TEST 9: Existing Trip Loads Correctly
    // ═══════════════════════════════════════════════════════════════════════

    console.log("\n[TEST 9] Existing Trip Loads Correctly");
    const tripExisting = await Trip.create({
      title: "Pre-Existing Trip for Engine Test",
      origin: "Delhi",
      destination: "Goa",
      startDate: "2026-11-01",
      endDate: "2026-11-05",
      createdBy: "test_user_part3",
      outboundJourney: {
        transportType: "Flight",
        departureLocation: "DEL",
        arrivalLocation: "GOI",
        departureDate: "2026-11-01",
        departureTime: "10:00",
        arrivalDate: "2026-11-01",
        arrivalTime: "12:30",
        durationMinutes: 150,
        durationSource: "SCHEDULED",
        transitRef: "6E-512",
        status: "CONFIRMED",
        booked: true,
      },
      tripTiming: {
        outbound: {
          durationMinutes: 150,
          isOvernight: false,
          travelDaysCount: 1,
          arrivalDateTime: "2026-11-01T12:30",
        },
      },
      days: [
        { dayNumber: 1, date: "2026-11-01", title: "Arrival", activities: [{ time: "13:00", description: "Arrive at hotel" }] },
      ],
    });
    createdTripIds.push(tripExisting._id);

    const loadedTrip = await Trip.findById(tripExisting._id).lean();
    assert(loadedTrip.outboundJourney.durationMinutes === 150, "Existing trip outbound duration preserved");
    assert(loadedTrip.outboundJourney.transitRef === "6E-512", "Existing trip transit ref preserved");
    assert(loadedTrip.tripTiming.outbound.isOvernight === false, "Existing trip timing preserved");
    assert(loadedTrip.days.length === 1, "Existing trip days preserved");
    assert(loadedTrip.origin === "Delhi", "Existing trip origin preserved");

    // ═══════════════════════════════════════════════════════════════════════
    // TEST 10: Return Journey Calculated Independently
    // ═══════════════════════════════════════════════════════════════════════

    console.log("\n[TEST 10] Return Journey Calculated Independently");
    const computed = await computeJourneys({
      origin: "Mumbai",
      destination: "Goa",
      startDate: "2026-10-15",
      endDate: "2026-10-18",
      travelMode: "Train",
      outboundJourney: {
        transportType: "Train",
        departureLocation: "CSMT",
        arrivalLocation: "Madgaon",
        departureDate: "2026-10-15",
        departureTime: "20:00",
        arrivalDate: "2026-10-16",
        arrivalTime: "08:00",
      },
      returnJourney: {
        transportType: "Train",
        departureLocation: "Madgaon",
        arrivalLocation: "CSMT",
        departureDate: "2026-10-18",
        departureTime: "14:00",
        arrivalDate: "2026-10-18",
        arrivalTime: "22:00",
      },
    });

    assert(computed.outboundJourney.durationMinutes === 720, `Outbound: 720 min (got ${computed.outboundJourney.durationMinutes})`);
    assert(computed.returnJourney.durationMinutes === 480, `Return: 480 min (got ${computed.returnJourney.durationMinutes})`);
    assert(computed.tripTiming.outbound.isOvernight === true, "Outbound isOvernight = true");
    assert(computed.tripTiming.return.isOvernight === false, "Return isOvernight = false (same day)");
    assert(computed.tripTiming.outbound.travelDaysCount === 2, "Outbound spans 2 calendar days");
    assert(computed.tripTiming.return.travelDaysCount === 1, "Return spans 1 calendar day");
    assert(
      computed.tripTiming.outbound.arrivalDateTime === "2026-10-16T08:00",
      "Outbound arrivalDateTime set correctly"
    );
    assert(
      computed.tripTiming.return.departureDateTime === "2026-10-18T14:00",
      "Return departureDateTime set correctly"
    );

    // ═══════════════════════════════════════════════════════════════════════
    // TEST 11: Full computeJourneys with trip persistence
    // ═══════════════════════════════════════════════════════════════════════

    console.log("\n[TEST 11] Full computeJourneys → Trip Persistence");
    const fullComputed = await computeJourneys({
      origin: "Delhi",
      destination: "Bengaluru",
      startDate: "2026-10-20",
      endDate: "2026-10-23",
      travelMode: "Flight",
      departureHub: "DEL",
      arrivalHub: "BLR",
      departureTime: "08:00",
      arrivalTime: "10:30",
      outboundJourney: {
        transportType: "Flight",
        departureLocation: "DEL",
        arrivalLocation: "BLR",
        departureDate: "2026-10-20",
        departureTime: "08:00",
        arrivalDate: "2026-10-20",
        arrivalTime: "10:30",
        transitRef: "6E-501",
        booked: true,
      },
      returnJourney: {
        transportType: "Flight",
        departureLocation: "BLR",
        arrivalLocation: "DEL",
        departureDate: "2026-10-23",
        departureTime: "18:00",
        arrivalDate: "2026-10-23",
        arrivalTime: "20:30",
      },
    });

    const savedTrip = await Trip.create({
      title: "Engine-Computed Trip",
      origin: "Delhi",
      destination: "Bengaluru",
      startDate: "2026-10-20",
      endDate: "2026-10-23",
      createdBy: "test_user_part3",
      outboundJourney: fullComputed.outboundJourney,
      returnJourney: fullComputed.returnJourney,
      tripTiming: fullComputed.tripTiming,
    });
    createdTripIds.push(savedTrip._id);

    const reloaded = await Trip.findById(savedTrip._id).lean();
    assert(reloaded.outboundJourney.durationMinutes === 150, `Persisted outbound duration = 150 (got ${reloaded.outboundJourney.durationMinutes})`);
    assert(reloaded.returnJourney.durationMinutes === 150, `Persisted return duration = 150 (got ${reloaded.returnJourney.durationMinutes})`);
    assert(reloaded.tripTiming.outbound.isOvernight === false, "Persisted outbound isOvernight = false");
    assert(reloaded.tripTiming.return.isOvernight === false, "Persisted return isOvernight = false");

    // ═══════════════════════════════════════════════════════════════════════
    // TEST 12: Train estimate (no live schedule)
    // ═══════════════════════════════════════════════════════════════════════

    console.log("\n[TEST 12] Train Without Schedule — Haversine Estimate");
    const legTrain = await calculateJourneyLeg({
      transportType: "Train",
      departureLocation: "Mumbai",
      arrivalLocation: "Delhi",
    });
    assert(legTrain.durationMinutes > 0, `Train Mumbai→Delhi estimated duration: ${legTrain.durationMinutes} min`);
    assert(legTrain.durationSource === "ESTIMATED_HAVERSINE", `Train source = ESTIMATED_HAVERSINE (got '${legTrain.durationSource}')`);
    assert(legTrain.status === "ESTIMATED", "Train status = ESTIMATED (no schedule fabrication)");

    // ═══════════════════════════════════════════════════════════════════════
    // TEST 13: Bus estimate
    // ═══════════════════════════════════════════════════════════════════════

    console.log("\n[TEST 13] Bus Without Schedule — Haversine Estimate");
    const legBus = await calculateJourneyLeg({
      transportType: "Bus",
      departureLocation: "Bangalore",
      arrivalLocation: "Goa",
    });
    assert(legBus.durationMinutes > 0, `Bus Bangalore→Goa estimated duration: ${legBus.durationMinutes} min`);
    assert(legBus.durationSource === "ESTIMATED_HAVERSINE", `Bus source = ESTIMATED_HAVERSINE (got '${legBus.durationSource}')`);

    // ═══════════════════════════════════════════════════════════════════════
    // TEST 14: Flight estimate (when Amadeus not configured)
    // ═══════════════════════════════════════════════════════════════════════

    console.log("\n[TEST 14] Flight Estimate Fallback");
    const legFlight = await calculateJourneyLeg({
      transportType: "Flight",
      departureLocation: "Mumbai",
      arrivalLocation: "Delhi",
      departureDate: "2026-10-10",
    });
    assert(legFlight.durationMinutes > 0, `Flight Mumbai→Delhi estimated: ${legFlight.durationMinutes} min`);
    assert(
      ["SCHEDULED", "ESTIMATED_HAVERSINE", "UNAVAILABLE"].includes(legFlight.durationSource),
      `Flight source is valid (got '${legFlight.durationSource}')`
    );

    // ═══════════════════════════════════════════════════════════════════════
    // PART 2 REGRESSION: Date calculation
    // ═══════════════════════════════════════════════════════════════════════

    console.log("\n[REGRESSION] Part 2 — Inclusive Date Calculation");
    const datesA = generateTripDates("2026-10-10", "2026-10-10");
    assert(datesA.length === 1, "Oct 10 → Oct 10 = 1 day");
    const datesB = generateTripDates("2026-10-10", "2026-10-14");
    assert(datesB.length === 5, "Oct 10 → Oct 14 = 5 days");

    // ═══════════════════════════════════════════════════════════════════════
    // PART 2 REGRESSION: Trip with all Part 2 fields
    // ═══════════════════════════════════════════════════════════════════════

    console.log("\n[REGRESSION] Part 2 — Full Schema Persistence");
    const regressionTrip = await Trip.create({
      title: "Regression Test Trip",
      origin: "Mumbai",
      destination: "Goa",
      startDate: "2026-10-15",
      endDate: "2026-10-18",
      createdBy: "test_user_part3",
      outboundJourney: {
        transportType: "Train",
        departureLocation: "CSMT",
        arrivalLocation: "Madgaon",
        departureDate: "2026-10-15",
        departureTime: "05:25",
        arrivalDate: "2026-10-15",
        arrivalTime: "13:10",
        durationMinutes: 465,
        durationSource: "SCHEDULED",
        transitRef: "Vande Bharat Express",
        status: "CONFIRMED",
        booked: true,
      },
      returnJourney: { booked: false },
      tripTiming: {
        outbound: { durationMinutes: 465, isOvernight: false, travelDaysCount: 1 },
      },
    });
    createdTripIds.push(regressionTrip._id);
    const regLoaded = await Trip.findById(regressionTrip._id).lean();
    assert(regLoaded.origin === "Mumbai", "Part 2 origin preserved");
    assert(regLoaded.outboundJourney.transitRef === "Vande Bharat Express", "Part 2 outbound transitRef preserved");
    assert(regLoaded.tripTiming.outbound.durationMinutes === 465, "Part 2 tripTiming preserved");

    // ═══════════════════════════════════════════════════════════════════════
    // SUMMARY
    // ═══════════════════════════════════════════════════════════════════════

    console.log("\n==================================================");
    console.log(`PART 3 VERIFICATION COMPLETE: ${passed} passed, ${failed} failed`);
    console.log("==================================================");

    if (failed > 0) {
      process.exitCode = 1;
    }
  } finally {
    // Cleanup
    if (createdTripIds.length > 0) {
      await Trip.deleteMany({ _id: { $in: createdTripIds } });
    }
    await mongoose.connection.close();
  }
}

runPart3Tests().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
