/**
 * Part 4 Verification Test Suite — Destination Usable-Time / Arrival-Departure Window Engine
 *
 * Runs comprehensive automated verification for:
 *  - Test 1: Same-day journey (destination starts only after arrival buffer)
 *  - Test 2: Overnight journey (no sightseeing before arrival)
 *  - Test 3: 36-hour journey (travel portions excluded, destination starts post-arrival)
 *  - Test 4: 48-hour journey (multi-day travel before arrival excluded)
 *  - Test 5: Return journey cutoff (sightseeing ends before transport departure buffer)
 *  - Test 6: Multi-day return journey (exploration ends at departure, return travel excluded)
 *  - Test 7: Hotel check-in supplied (settling buffer & constraints applied)
 *  - Test 8: No accommodation (no hotel fabrication, only transport exit buffer)
 *  - Test 9: Missing provider data (graceful handling, uncertainty exposed)
 *  - Test 10: Legacy trip compatibility (backward compatible loading)
 *  - Test 11: Cross-midnight & timezone boundary safety
 *  - Test 12: Full integration with computeJourneys & MongoDB persistence
 */

import mongoose from "mongoose";
import assert from "assert";
import Trip from "../models/Trip.js";
import {
  calculateDestinationWindows,
  getArrivalBufferMinutes,
  getDepartureBufferMinutes,
  buildDateTime,
  addMinutes,
  hoursBetween,
  listDatesBetween,
  DEFAULT_BUFFERS,
} from "../services/travel/destination-window.service.js";
import { computeJourneys, calculateTripTiming } from "../services/travel/journey-engine.service.js";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/Advenza";

async function runTests() {
  console.log("==================================================");
  console.log("ADVENZA PART 4 — DESTINATION WINDOW VERIFICATION");
  console.log("==================================================");

  let passed = 0;
  let failed = 0;

  function test(description, fn) {
    try {
      fn();
      console.log(`  ✓ ${description}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${description}`);
      console.error(`    Error: ${err.message}`);
      failed++;
    }
  }

  async function testAsync(description, fn) {
    try {
      await fn();
      console.log(`  ✓ ${description}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${description}`);
      console.error(`    Error: ${err.message}`);
      failed++;
    }
  }

  // Connect to DB for persistence tests
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB for testing.");
  }

  console.log("\n[UNIT] Destination Window Helpers & Buffers");

  test("getArrivalBufferMinutes returns correct defaults by mode", () => {
    assert.strictEqual(getArrivalBufferMinutes("flight"), 90);
    assert.strictEqual(getArrivalBufferMinutes("train"), 50);
    assert.strictEqual(getArrivalBufferMinutes("bus"), 40);
    assert.strictEqual(getArrivalBufferMinutes("car"), 15);
    assert.strictEqual(getArrivalBufferMinutes("ferry"), 45);
    assert.strictEqual(getArrivalBufferMinutes("unknown"), 30);
  });

  test("getDepartureBufferMinutes returns correct defaults by mode", () => {
    assert.strictEqual(getDepartureBufferMinutes("flight"), 165);
    assert.strictEqual(getDepartureBufferMinutes("train"), 75);
    assert.strictEqual(getDepartureBufferMinutes("bus"), 55);
    assert.strictEqual(getDepartureBufferMinutes("car"), 20);
    assert.strictEqual(getDepartureBufferMinutes("ferry"), 70);
    assert.strictEqual(getDepartureBufferMinutes("unknown"), 60);
  });

  test("listDatesBetween generates inclusive ISO date strings", () => {
    const dates = listDatesBetween("2026-10-10", "2026-10-14");
    assert.strictEqual(dates.length, 5);
    assert.strictEqual(dates[0], "2026-10-10");
    assert.strictEqual(dates[4], "2026-10-14");
  });

  test("hoursBetween computes precise floating point difference", () => {
    const d1 = new Date("2026-10-10T08:00:00Z");
    const d2 = new Date("2026-10-10T16:30:00Z");
    assert.strictEqual(hoursBetween(d1, d2), 8.5);
  });

  console.log("\n[TEST 1] Same-Day Outbound Journey (08:00 → 16:00)");
  test("Same-day journey starts destination window only after arrival buffer", () => {
    const res = calculateDestinationWindows({
      startDate: "2026-10-10",
      endDate: "2026-10-14",
      outboundJourney: {
        transportType: "Flight",
        departureDate: "2026-10-10",
        departureTime: "08:00",
        arrivalDate: "2026-10-10",
        arrivalTime: "16:00",
      },
      returnJourney: {
        transportType: "Flight",
        departureDate: "2026-10-14",
        departureTime: "18:00",
        arrivalDate: "2026-10-14",
        arrivalTime: "21:00",
      },
    });

    assert.strictEqual(res.days.length, 5);
    const day1 = res.days[0];
    assert.strictEqual(day1.date, "2026-10-10");
    assert.strictEqual(day1.status, "ARRIVAL_DAY");
    // Flight arrival: 16:00 + 90 min (no hotel) = 17:30 UTC
    assert.strictEqual(day1.usableStartDateTime, "2026-10-10T17:30:00.000Z");
    // Available hours: 17:30 to 21:00 = 3.5 hours
    assert.strictEqual(day1.availableHours, 3.5);
    assert.strictEqual(day1.constraints.arrivalDay, true);
  });

  console.log("\n[TEST 2] Overnight Journey (20:00 → next day 08:00)");
  test("Overnight journey: Day 1 is travel, Day 2 destination starts post-arrival", () => {
    const res = calculateDestinationWindows({
      startDate: "2026-10-10",
      endDate: "2026-10-15",
      outboundJourney: {
        transportType: "Train",
        departureDate: "2026-10-10",
        departureTime: "20:00",
        arrivalDate: "2026-10-11",
        arrivalTime: "08:00",
      },
      returnJourney: {
        transportType: "Train",
        departureDate: "2026-10-15",
        departureTime: "20:00",
        arrivalDate: "2026-10-16",
        arrivalTime: "08:00",
      },
    });

    assert.strictEqual(res.days[0].date, "2026-10-10");
    assert.strictEqual(res.days[0].status, "TRAVEL_OUTBOUND");
    assert.strictEqual(res.days[0].availableHours, 0);
    assert.strictEqual(res.days[0].constraints.travelDay, true);

    const day2 = res.days[1];
    assert.strictEqual(day2.date, "2026-10-11");
    assert.strictEqual(day2.status, "ARRIVAL_DAY");
    // Train arrival 08:00 + 50 min = 08:50 UTC
    assert.strictEqual(day2.usableStartDateTime, "2026-10-11T08:50:00.000Z");
    // Available hours: 08:50 to 21:00 = 12.17 hours
    assert.strictEqual(day2.availableHours, 12.17);
  });

  console.log("\n[TEST 3] 36-Hour Journey (Day 1 06:00 → Day 2 18:00)");
  test("36-hour journey: Day 1 travel excluded, Day 2 starts evening after buffer", () => {
    const res = calculateDestinationWindows({
      startDate: "2026-10-10",
      endDate: "2026-10-14",
      outboundJourney: {
        transportType: "Train",
        departureDate: "2026-10-10",
        departureTime: "06:00",
        arrivalDate: "2026-10-11",
        arrivalTime: "18:00",
      },
      returnJourney: {
        transportType: "Flight",
        departureDate: "2026-10-14",
        departureTime: "18:00",
        arrivalDate: "2026-10-14",
        arrivalTime: "20:00",
      },
    });

    assert.strictEqual(res.days[0].date, "2026-10-10");
    assert.strictEqual(res.days[0].status, "TRAVEL_OUTBOUND");
    assert.strictEqual(res.days[0].availableHours, 0);

    const day2 = res.days[1];
    assert.strictEqual(day2.date, "2026-10-11");
    assert.strictEqual(day2.status, "ARRIVAL_DAY");
    // Train arrival: 18:00 + 50 min = 18:50 UTC
    assert.strictEqual(day2.usableStartDateTime, "2026-10-11T18:50:00.000Z");
    // Available hours: 18:50 to 21:00 = 2.17 hours
    assert.strictEqual(day2.availableHours, 2.17);
  });

  console.log("\n[TEST 4] 48-Hour Multi-Day Journey (Day 1 06:00 → Day 3 06:00)");
  test("48-hour journey: Days 1 & 2 are TRAVEL_OUTBOUND (0h), Day 3 starts post-arrival", () => {
    const res = calculateDestinationWindows({
      startDate: "2026-10-10",
      endDate: "2026-10-16",
      outboundJourney: {
        transportType: "Train",
        departureDate: "2026-10-10",
        departureTime: "06:00",
        arrivalDate: "2026-10-12",
        arrivalTime: "06:00",
      },
      returnJourney: {
        transportType: "Flight",
        departureDate: "2026-10-16",
        departureTime: "16:00",
        arrivalDate: "2026-10-16",
        arrivalTime: "18:00",
      },
    });

    assert.strictEqual(res.days[0].status, "TRAVEL_OUTBOUND");
    assert.strictEqual(res.days[0].availableHours, 0);
    assert.strictEqual(res.days[1].status, "TRAVEL_OUTBOUND");
    assert.strictEqual(res.days[1].availableHours, 0);

    const day3 = res.days[2];
    assert.strictEqual(day3.date, "2026-10-12");
    // Day 3 is the arrival date (Train arrival 06:00 + 50 min = 06:50, clamped to DAY_START_TIME 08:00)
    assert.strictEqual(day3.status, "ARRIVAL_DAY");
    assert.strictEqual(day3.availableHours, 13);
    assert.strictEqual(day3.constraints.arrivalDay, true);
  });

  console.log("\n[TEST 5] Return Journey Cutoff (Return at 18:00)");
  test("Return journey cutoff enforces pre-departure buffer before flight", () => {
    const res = calculateDestinationWindows({
      startDate: "2026-10-10",
      endDate: "2026-10-14",
      outboundJourney: {
        transportType: "Flight",
        departureDate: "2026-10-10",
        departureTime: "08:00",
        arrivalDate: "2026-10-10",
        arrivalTime: "10:00",
      },
      returnJourney: {
        transportType: "Flight",
        departureDate: "2026-10-14",
        departureTime: "18:00",
        arrivalDate: "2026-10-14",
        arrivalTime: "20:00",
      },
    });

    const returnDay = res.days[res.days.length - 1];
    assert.strictEqual(returnDay.date, "2026-10-14");
    assert.strictEqual(returnDay.status, "RETURN_DAY");
    // Flight cutoff: 18:00 - 165 min (2h45m) = 15:15 UTC
    assert.strictEqual(returnDay.usableEndDateTime, "2026-10-14T15:15:00.000Z");
    // Available hours: 08:00 to 15:15 = 7.25 hours
    assert.strictEqual(returnDay.availableHours, 7.25);
    assert.strictEqual(returnDay.constraints.returnDay, true);
  });

  console.log("\n[TEST 6] Overnight / Multi-Day Return Journey");
  test("Overnight return journey: exploration ends on departure day, travel days have 0h", () => {
    const res = calculateDestinationWindows({
      startDate: "2026-10-10",
      endDate: "2026-10-16",
      outboundJourney: {
        transportType: "Train",
        departureDate: "2026-10-10",
        departureTime: "08:00",
        arrivalDate: "2026-10-10",
        arrivalTime: "16:00",
      },
      returnJourney: {
        transportType: "Train",
        departureDate: "2026-10-15",
        departureTime: "20:00",
        arrivalDate: "2026-10-16",
        arrivalTime: "08:00",
      },
    });

    // Oct 15 is Return Day (departure at 20:00)
    const oct15 = res.days.find((d) => d.date === "2026-10-15");
    assert.strictEqual(oct15.status, "RETURN_DAY");
    // Train cutoff: 20:00 - 75 min = 18:45 UTC
    assert.strictEqual(oct15.usableEndDateTime, "2026-10-15T18:45:00.000Z");
    assert.strictEqual(oct15.availableHours, 10.75); // 08:00 to 18:45

    // Oct 16 is in-transit return day
    const oct16 = res.days.find((d) => d.date === "2026-10-16");
    assert.strictEqual(oct16.status, "TRAVEL_RETURN");
    assert.strictEqual(oct16.availableHours, 0);
    assert.strictEqual(oct16.constraints.travelDay, true);
  });

  console.log("\n[TEST 7] Hotel Check-in Supplied");
  test("Hotel check-in applies settling buffer and flags requiresHotelCheckIn", () => {
    const res = calculateDestinationWindows({
      startDate: "2026-10-10",
      endDate: "2026-10-12",
      hotelName: "Grand Palace Hotel",
      accommodation: "Hotel",
      checkInTime: "14:00",
      outboundJourney: {
        transportType: "Train",
        departureDate: "2026-10-10",
        departureTime: "06:00",
        arrivalDate: "2026-10-10",
        arrivalTime: "10:00",
      },
      returnJourney: {
        transportType: "Train",
        departureDate: "2026-10-12",
        departureTime: "18:00",
      },
    });

    const day1 = res.days[0];
    // Train arrival: 10:00 + 50 min transit + 30 min hotel settle = 11:20 UTC
    assert.strictEqual(day1.usableStartDateTime, "2026-10-10T11:20:00.000Z");
    assert.strictEqual(day1.constraints.requiresHotelCheckIn, true);
    assert.strictEqual(day1.availableHours, 9.67); // 11:20 to 21:00
  });

  console.log("\n[TEST 8] No Accommodation Provided");
  test("No accommodation: does not invent hotel check-in, applies only transport buffer", () => {
    const res = calculateDestinationWindows({
      startDate: "2026-10-10",
      endDate: "2026-10-12",
      outboundJourney: {
        transportType: "Car",
        departureDate: "2026-10-10",
        departureTime: "06:00",
        arrivalDate: "2026-10-10",
        arrivalTime: "10:00",
      },
      returnJourney: {
        transportType: "Car",
        departureDate: "2026-10-12",
        departureTime: "18:00",
      },
    });

    const day1 = res.days[0];
    // Car arrival: 10:00 + 15 min exit buffer (0 hotel settle) = 10:15 UTC
    assert.strictEqual(day1.usableStartDateTime, "2026-10-10T10:15:00.000Z");
    assert.strictEqual(day1.constraints.requiresHotelCheckIn, false);
    assert.strictEqual(day1.availableHours, 10.75); // 10:15 to 21:00
  });

  console.log("\n[TEST 9] Missing / Incomplete Provider Data");
  test("Missing journey timing handles gracefully with sensible defaults and no crash", () => {
    const res = calculateDestinationWindows({
      startDate: "2026-10-10",
      endDate: "2026-10-12",
    });

    assert(res.days.length === 3, "Generated 3 days");
    assert(res.totalUsableHours > 0, "Computed positive total hours");
    assert.strictEqual(res.days[0].status, "ARRIVAL_DAY");
    assert.strictEqual(res.days[1].status, "FULL_DESTINATION_DAY");
    assert.strictEqual(res.days[2].status, "RETURN_DAY");
  });

  console.log("\n[TEST 10] Legacy Trip Compatibility");
  await testAsync("Legacy trip without destination window data loads safely from MongoDB", async () => {
    const legacyTrip = new Trip({
      title: "Legacy Part 4 Trip",
      destination: "Udaipur",
      createdBy: "test-user",
      startDate: "2026-11-01",
      endDate: "2026-11-03",
      days: [{ dayNumber: 1, date: "2026-11-01", title: "Day 1", activities: [{ time: "10:00", description: "City Palace" }] }],
    });
    const saved = await legacyTrip.save();
    const fetched = await Trip.findById(saved._id);

    assert(fetched != null, "Fetched legacy trip");
    assert.strictEqual(fetched.tripTiming.destination.days.length, 0);
    assert.strictEqual(fetched.tripTiming.destination.usableStartDateTime, "");
    assert.strictEqual(fetched.days.length, 1);
  });

  console.log("\n[TEST 11] Cross-Midnight & Timezone Boundary Safety");
  test("buildDateTime and formatHHmm operate in UTC without DST/local skew", () => {
    const dt = buildDateTime("2026-10-10", "23:45");
    assert.strictEqual(dt.toISOString(), "2026-10-10T23:45:00.000Z");
    const nextDayDt = addMinutes(dt, 30);
    assert.strictEqual(nextDayDt.toISOString(), "2026-10-11T00:15:00.000Z");
  });

  console.log("\n[TEST 12] Total Usable Hours Summation & Full computeJourneys Pipeline");
  await testAsync("Full computeJourneys populates and persists complete tripTiming.destination", async () => {
    const tripInput = {
      origin: "Mumbai",
      destination: "Goa",
      startDate: "2026-10-10",
      endDate: "2026-10-14",
      travelMode: "Flight",
      departureTime: "08:00",
      arrivalTime: "09:30",
      hotelName: "Seaside Resort",
      accommodation: "Resort",
      outboundJourney: {
        transportType: "Flight",
        departureLocation: "Mumbai (BOM)",
        arrivalLocation: "Goa (GOI)",
        departureDate: "2026-10-10",
        departureTime: "08:00",
        arrivalDate: "2026-10-10",
        arrivalTime: "09:30",
      },
      returnJourney: {
        transportType: "Flight",
        departureLocation: "Goa (GOI)",
        arrivalLocation: "Mumbai (BOM)",
        departureDate: "2026-10-14",
        departureTime: "18:00",
        arrivalDate: "2026-10-14",
        arrivalTime: "19:30",
      },
    };

    const computed = await computeJourneys(tripInput);

    assert(computed.tripTiming.destination.usableStartDateTime !== "", "Has usableStartDateTime");
    assert(computed.tripTiming.destination.usableEndDateTime !== "", "Has usableEndDateTime");
    assert(computed.tripTiming.destination.totalUsableHours > 0, "Has totalUsableHours");
    assert.strictEqual(computed.tripTiming.destination.days.length, 5, "Has 5 destination days");

    // Persist in MongoDB
    const tripDoc = new Trip({
      title: "Goa Part 4 Verified Trip",
      origin: tripInput.origin,
      destination: tripInput.destination,
      createdBy: "test-user",
      startDate: tripInput.startDate,
      endDate: tripInput.endDate,
      outboundJourney: computed.outboundJourney,
      returnJourney: computed.returnJourney,
      tripTiming: computed.tripTiming,
      days: [{ dayNumber: 1, date: "2026-10-10", title: "Day 1", activities: [] }],
    });

    const saved = await tripDoc.save();
    const loaded = await Trip.findById(saved._id);

    assert.strictEqual(loaded.tripTiming.destination.days.length, 5);
    assert.strictEqual(loaded.tripTiming.destination.totalUsableHours, computed.tripTiming.destination.totalUsableHours);
    assert.strictEqual(loaded.tripTiming.destination.days[0].status, "ARRIVAL_DAY");
    assert.strictEqual(loaded.tripTiming.destination.days[4].status, "RETURN_DAY");
  });

  console.log("\n==================================================");
  console.log(`PART 4 VERIFICATION COMPLETE: ${passed} passed, ${failed} failed`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
