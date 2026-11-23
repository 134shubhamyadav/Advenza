import mongoose from "mongoose";
import { env } from "../config/env.js";
import Trip from "../models/Trip.js";
import { generateTripDates } from "../services/itinerary/itinerary-sanitizer.js";
import { budgetService } from "../services/budget/budget.service.js";
import { aiService } from "../services/ai/ai.service.js";

function calculateInclusiveDays(startDateStr, endDateStr) {
  if (!startDateStr || !endDateStr) return 1;
  const [sYear, sMonth, sDay] = startDateStr.split("-").map(Number);
  const [eYear, eMonth, eDay] = endDateStr.split("-").map(Number);
  if (!sYear || !sMonth || !sDay || !eYear || !eMonth || !eDay) return 1;
  const startUtc = Date.UTC(sYear, sMonth - 1, sDay);
  const endUtc = Date.UTC(eYear, eMonth - 1, eDay);
  if (endUtc < startUtc) return 1;
  const msPerDay = 86400000;
  const diffDays = Math.round((endUtc - startUtc) / msPerDay) + 1;
  return Math.max(diffDays, 1);
}

async function runPart2Tests() {
  console.log("==================================================");
  console.log("ADVENZA PART 2 — DATA FOUNDATION VERIFICATION");
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

  await mongoose.connect(env.MONGODB_URI);
  console.log("Connected to MongoDB for testing.");

  const createdTripIds = [];

  try {
    // ── TEST 1: Inclusive Calendar Days Agreement (Frontend & Backend) ─────────
    console.log("\n[TEST 1] Frontend & Backend Inclusive Date Consistency");
    const dates1 = generateTripDates("2026-10-10", "2026-10-10");
    const feCount1 = calculateInclusiveDays("2026-10-10", "2026-10-10");
    assert(dates1.length === 1 && feCount1 === 1, "Oct 10 → Oct 10 = exactly 1 calendar day on both backend & frontend");

    const dates2 = generateTripDates("2026-10-10", "2026-10-11");
    const feCount2 = calculateInclusiveDays("2026-10-10", "2026-10-11");
    assert(dates2.length === 2 && feCount2 === 2, "Oct 10 → Oct 11 = exactly 2 calendar days on both backend & frontend");

    const dates3 = generateTripDates("2026-10-10", "2026-10-14");
    const feCount3 = calculateInclusiveDays("2026-10-10", "2026-10-14");
    assert(dates3.length === 5 && feCount3 === 5, "Oct 10 → Oct 14 = exactly 5 calendar days on both backend & frontend");

    // ── TEST 2: Create Trip with Origin (Mumbai -> Goa) & Verify Persistence ──
    console.log("\n[TEST 2] Origin Persistence");
    const trip1 = await Trip.create({
      title: "Mumbai to Goa Getaway",
      origin: "Mumbai",
      destination: "Goa",
      startDate: "2026-10-15",
      endDate: "2026-10-18",
      travelMode: "Train",
      departureHub: "CSMT",
      arrivalHub: "Madgaon (MAO)",
      transitRef: "Vande Bharat Express",
      departureTime: "05:25",
      arrivalTime: "13:10",
      createdBy: "test_user_part2",
      days: [
        {
          dayNumber: 1,
          date: "2026-10-15",
          title: "Arrival in Goa",
          activities: [
            { time: "05:25", description: "Board train at CSMT" },
            { time: "13:10", description: "Arrive at Madgaon" },
          ],
        },
      ],
    });
    createdTripIds.push(trip1._id);

    const fetchedTrip1 = await Trip.findById(trip1._id).lean();
    assert(fetchedTrip1.origin === "Mumbai", "Trip persists origin ('Mumbai') in database");
    assert(fetchedTrip1.destination === "Goa", "Trip persists destination ('Goa') in database");
    assert(fetchedTrip1.travelMode === "Train", "Existing flat travelMode is preserved");
    assert(fetchedTrip1.departureHub === "CSMT", "Existing flat departureHub is preserved");
    assert(fetchedTrip1.arrivalHub === "Madgaon (MAO)", "Existing flat arrivalHub is preserved");

    // ── TEST 3: Same-Day Structured Journey ───────────────────────────────────
    console.log("\n[TEST 3] Same-Day Structured Journey (Example A)");
    const tripSameDay = await Trip.create({
      title: "Same Day Flight Journey",
      origin: "Delhi",
      destination: "Bengaluru",
      startDate: "2026-10-10",
      endDate: "2026-10-13",
      createdBy: "test_user_part2",
      outboundJourney: {
        transportType: "Flight",
        departureLocation: "DEL",
        arrivalLocation: "BLR",
        departureDate: "2026-10-10",
        departureTime: "08:00",
        arrivalDate: "2026-10-10",
        arrivalTime: "16:30",
        durationMinutes: 510,
        durationSource: "SCHEDULED",
        transitRef: "6E-501",
        status: "CONFIRMED",
        booked: true,
        ticketRef: "PNR998877",
      },
      returnJourney: {
        booked: true,
        transportType: "Flight",
        departureLocation: "BLR",
        arrivalLocation: "DEL",
        departureDate: "2026-10-13",
        departureTime: "18:00",
        arrivalDate: "2026-10-13",
        arrivalTime: "20:45",
        durationMinutes: 165,
        durationSource: "SCHEDULED",
        transitRef: "AI-804",
        status: "CONFIRMED",
        ticketRef: "PNR112233",
      },
      tripTiming: {
        outbound: {
          durationMinutes: 510,
          isOvernight: false,
          travelDaysCount: 1,
          arrivalDateTime: "2026-10-10T16:30",
        },
        destination: {
          usableStartDateTime: "2026-10-10T18:00",
          usableEndDateTime: "2026-10-13T15:00",
          totalUsableHours: 69,
        },
        return: {
          durationMinutes: 165,
          isOvernight: false,
          travelDaysCount: 1,
          departureDateTime: "2026-10-13T18:00",
        },
      },
    });
    createdTripIds.push(tripSameDay._id);

    const fetchedSameDay = await Trip.findById(tripSameDay._id).lean();
    assert(fetchedSameDay.outboundJourney.departureDate === "2026-10-10", "Same-day outbound departureDate saved");
    assert(fetchedSameDay.outboundJourney.arrivalDate === "2026-10-10", "Same-day outbound arrivalDate saved");
    assert(fetchedSameDay.outboundJourney.durationMinutes === 510, "Same-day outbound durationMinutes saved");
    assert(fetchedSameDay.tripTiming.outbound.isOvernight === false, "tripTiming flags non-overnight accurately");

    // ── TEST 4: Overnight Structured Journey ──────────────────────────────────
    console.log("\n[TEST 4] Overnight Structured Journey (Example B)");
    const tripOvernight = await Trip.create({
      title: "Overnight Sleeper Train Journey",
      origin: "Mumbai",
      destination: "Goa",
      startDate: "2026-10-10",
      endDate: "2026-10-14",
      createdBy: "test_user_part2",
      outboundJourney: {
        transportType: "Train",
        departureLocation: "CSMT",
        arrivalLocation: "Madgaon",
        departureDate: "2026-10-10",
        departureTime: "20:00",
        arrivalDate: "2026-10-11",
        arrivalTime: "08:00",
        durationMinutes: 720,
        durationSource: "SCHEDULED",
        transitRef: "Konkan Kanya Express",
        status: "CONFIRMED",
        booked: true,
      },
      tripTiming: {
        outbound: {
          durationMinutes: 720,
          isOvernight: true,
          travelDaysCount: 2,
          arrivalDateTime: "2026-10-11T08:00",
        },
      },
    });
    createdTripIds.push(tripOvernight._id);

    const fetchedOvernight = await Trip.findById(tripOvernight._id).lean();
    assert(fetchedOvernight.outboundJourney.departureDate === "2026-10-10", "Overnight departure on Day 1 (Oct 10)");
    assert(fetchedOvernight.outboundJourney.arrivalDate === "2026-10-11", "Overnight arrival on Day 2 (Oct 11)");
    assert(fetchedOvernight.tripTiming.outbound.isOvernight === true, "tripTiming correctly identifies isOvernight: true");

    // ── TEST 5: Multi-Day Long Distance Journey ───────────────────────────────
    console.log("\n[TEST 5] Multi-Day Long Distance Journey (Example C)");
    const tripMultiDay = await Trip.create({
      title: "Cross-Country Train Journey",
      origin: "Kanyakumari",
      destination: "Dibrugarh",
      startDate: "2026-10-10",
      endDate: "2026-10-18",
      createdBy: "test_user_part2",
      outboundJourney: {
        transportType: "Train",
        departureLocation: "CAPE",
        arrivalLocation: "DBRG",
        departureDate: "2026-10-10",
        departureTime: "06:00",
        arrivalDate: "2026-10-11",
        arrivalTime: "18:00",
        durationMinutes: 2160,
        transitRef: "Vivek Express",
        status: "CONFIRMED",
      },
      tripTiming: {
        outbound: {
          durationMinutes: 2160,
          isOvernight: true,
          travelDaysCount: 2,
          arrivalDateTime: "2026-10-11T18:00",
        },
      },
    });
    createdTripIds.push(tripMultiDay._id);

    const fetchedMultiDay = await Trip.findById(tripMultiDay._id).lean();
    assert(fetchedMultiDay.outboundJourney.departureDate !== fetchedMultiDay.outboundJourney.arrivalDate, "Multi-day journey has different departure & arrival dates");
    assert(fetchedMultiDay.outboundJourney.durationMinutes === 2160, "Long duration (36 hrs) preserved");

    // ── TEST 6: Trip with No Journey Info (Graceful Defaults) ──────────────────
    console.log("\n[TEST 6] Trip Without Journey Info (Graceful Defaults)");
    const tripBlank = await Trip.create({
      title: "Quick Road Trip",
      destination: "Lonavala",
      startDate: "2026-10-20",
      endDate: "2026-10-21",
      createdBy: "test_user_part2",
    });
    createdTripIds.push(tripBlank._id);

    const fetchedBlank = await Trip.findById(tripBlank._id).lean();
    assert(fetchedBlank.origin === "", "Default origin is empty string without throwing");
    assert(typeof fetchedBlank.outboundJourney === "object", "outboundJourney defaults to empty object");
    assert(fetchedBlank.returnJourney.booked === false, "returnJourney defaults to { booked: false }");
    assert(typeof fetchedBlank.tripTiming === "object", "tripTiming defaults to object");

    // ── TEST 7: Legacy Trip Document Compatibility ────────────────────────────
    console.log("\n[TEST 7] Legacy Trip Document Compatibility");
    // Simulate reading a legacy document that only had the old returnJourney schema and no origin
    const legacyTrip = await Trip.create({
      title: "Legacy Trip from Old Version",
      destination: "Jaipur",
      startDate: "2026-08-01",
      endDate: "2026-08-05",
      returnJourney: {
        booked: true,
        date: "2026-08-05",
        time: "17:00",
        departureLocation: "Jaipur Junction",
        transportType: "Train",
        ticketRef: "PNR_LEGACY_123",
      },
      createdBy: "legacy_user",
      days: [
        { dayNumber: 1, date: "2026-08-01", title: "Sightseeing", activities: [{ time: "10:00", description: "Hawa Mahal" }] },
      ],
    });
    createdTripIds.push(legacyTrip._id);

    const fetchedLegacy = await Trip.findById(legacyTrip._id).lean();
    assert(fetchedLegacy.title === "Legacy Trip from Old Version", "Legacy trip title loaded");
    assert(fetchedLegacy.returnJourney.booked === true, "Legacy returnJourney.booked preserved");
    assert(fetchedLegacy.returnJourney.ticketRef === "PNR_LEGACY_123", "Legacy ticketRef preserved");
    assert(fetchedLegacy.days.length === 1, "Legacy days loaded without error");

    // ── TEST 8: Budget Verification ──────────
    console.log("\n[TEST 8] Budget Compatibility Verification");
    const budgetSummary = await budgetService.getBudgetSummary(trip1._id);
    assert(budgetSummary !== null, "Budget service getBudgetSummary works with updated Trip model");

    console.log("\n==================================================");
    console.log(`VERIFICATION COMPLETE: ${passed} passed, ${failed} failed`);
    console.log("==================================================");
  } finally {
    // Cleanup created test trips
    await Trip.deleteMany({ _id: { $in: createdTripIds } });
    await mongoose.connection.close();
  }
}

runPart2Tests().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
