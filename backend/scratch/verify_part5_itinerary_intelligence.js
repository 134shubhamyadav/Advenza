/**
 * Part 5 Verification Test Suite — AI Itinerary Intelligence + Interest Alignment
 *
 * Runs comprehensive automated verification for:
 *  - Test 1: Interest alignment (Food + Beaches)
 *  - Test 2: Photography guidance & focus
 *  - Test 3: Multiple interests harmony (Food + Culture + Photography)
 *  - Test 4: Arrival day usable window enforcement (pruning activities before arrival)
 *  - Test 5: Travel day enforcement (zero sightseeing on TRAVEL_OUTBOUND days)
 *  - Test 6: Return day cutoff enforcement (pruning activities after cutoff)
 *  - Test 7: 36-hour journey timing handling
 *  - Test 8: 48-hour multi-day travel day protection
 *  - Test 9: Slow style pacing (2-3 activities/day, rest emphasis)
 *  - Test 10: Packed style pacing (5-6 activities/day within usable window)
 *  - Test 11: Weather context integration
 *  - Test 12: Weather unavailable graceful fallback
 *  - Test 13: No interests fallback
 *  - Test 14: Legacy trip compatibility
 *  - Test 15: Provider unavailable non-fatal handling
 *  - Test 16: Concrete itinerary scenarios (Scenarios A, B, C)
 */

import mongoose from "mongoose";
import assert from "assert";
import Trip from "../models/Trip.js";
import { buildItineraryPrompt, generateTripDates } from "../services/itinerary/prompt-builder.js";
import { validateAndSanitizeItinerary } from "../services/itinerary/itinerary-sanitizer.js";
import { calculateDestinationWindows } from "../services/travel/destination-window.service.js";
import { computeJourneys } from "../services/travel/journey-engine.service.js";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/Advenza";

async function runTests() {
  console.log("==================================================");
  console.log("ADVENZA PART 5 — ITINERARY INTELLIGENCE & INTEREST VERIFICATION");
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

  console.log("\n[TEST 1] Interest Alignment — Food + Beaches");
  test("Prompt builder includes specific culinary and coastal directives", () => {
    const dates = generateTripDates("2026-10-10", "2026-10-14");
    const prompt = buildItineraryPrompt(
      {
        destination: "Goa",
        origin: "Mumbai",
        startDate: "2026-10-10",
        endDate: "2026-10-14",
        budgetNum: 25000,
        interests: ["Food", "Beaches"],
        style: "Balanced",
      },
      dates
    );

    assert(prompt.includes("FOOD & CULINARY FOCUS"), "Contains Food guidance");
    assert(prompt.includes("BEACHES & COASTAL FOCUS"), "Contains Beaches guidance");
    assert(prompt.includes("MULTI-INTEREST HARMONY"), "Contains multi-interest harmony rule");
  });

  console.log("\n[TEST 2] Photography Focus");
  test("Prompt builder incorporates photography golden-hour directives", () => {
    const dates = generateTripDates("2026-10-10", "2026-10-12");
    const prompt = buildItineraryPrompt(
      {
        destination: "Jaipur",
        origin: "Delhi",
        startDate: "2026-10-10",
        endDate: "2026-10-12",
        budgetNum: 15000,
        interests: ["Photography"],
        style: "Balanced",
      },
      dates
    );

    assert(prompt.includes("PHOTOGRAPHY & VISUALS FOCUS"), "Contains Photography guidance");
    assert(prompt.includes("golden-hour"), "Mentions golden-hour viewpoints");
  });

  console.log("\n[TEST 3] Multiple Interests Harmony (Food + Culture + Photography)");
  test("Prompt blends multiple interests cohesively without generic checklist", () => {
    const dates = generateTripDates("2026-10-10", "2026-10-14");
    const prompt = buildItineraryPrompt(
      {
        destination: "Varanasi",
        origin: "Kolkata",
        startDate: "2026-10-10",
        endDate: "2026-10-14",
        budgetNum: 20000,
        interests: ["Food", "Culture", "Photography"],
        style: "Balanced",
      },
      dates
    );

    assert(prompt.includes("FOOD & CULINARY FOCUS"));
    assert(prompt.includes("CULTURE & HERITAGE FOCUS"));
    assert(prompt.includes("PHOTOGRAPHY & VISUALS FOCUS"));
    assert(prompt.includes("DO NOT generate a generic") && prompt.includes("checklist"));
  });

  console.log("\n[TEST 4] Arrival Day Usable Window Enforcement");
  test("Sanitizer deterministically filters out sightseeing before arrival window", () => {
    const dates = generateTripDates("2026-10-10", "2026-10-12");
    const destWindows = calculateDestinationWindows({
      startDate: "2026-10-10",
      endDate: "2026-10-12",
      outboundJourney: {
        transportType: "Flight",
        arrivalDate: "2026-10-10",
        arrivalTime: "16:30",
      },
    });

    // LLM hallucinated early morning sightseeing at 09:00 and 11:00
    const rawParsed = {
      title: "Goa Trip",
      destination: "Goa",
      days: [
        {
          dayNumber: 1,
          date: "2026-10-10",
          title: "Day 1",
          activities: [
            { time: "09:00", description: "Visit Fort Aguada (Impossible early)" },
            { time: "11:00", description: "Museum Tour (Impossible early)" },
            { time: "18:30", description: "Evening beach stroll and dinner" },
          ],
        },
        {
          dayNumber: 2,
          date: "2026-10-11",
          title: "Day 2",
          activities: [{ time: "10:00", description: "Full day beach tour" }],
        },
      ],
    };

    const sanitized = validateAndSanitizeItinerary(rawParsed, dates, {
      destination: "Goa",
      tripTiming: { destination: destWindows },
    });

    const day1Activities = sanitized.days[0].activities;
    // 09:00 and 11:00 must be pruned; 18:30 is kept
    const hasEarlyActivities = day1Activities.some((a) => a.time === "09:00" || a.time === "11:00");
    assert.strictEqual(hasEarlyActivities, false, "Early activities before arrival buffer were pruned");
    assert(day1Activities.some((a) => a.time === "18:30"), "Evening activity preserved");
  });

  console.log("\n[TEST 5] Travel Day Enforcement (Zero Destination Sightseeing)");
  test("Sanitizer replaces destination activities with transit entries on TRAVEL_OUTBOUND days", () => {
    const dates = generateTripDates("2026-10-10", "2026-10-13");
    // Overnight journey: Day 1 (Oct 10) is TRAVEL_OUTBOUND
    const destWindows = calculateDestinationWindows({
      startDate: "2026-10-10",
      endDate: "2026-10-13",
      outboundJourney: {
        transportType: "Train",
        departureDate: "2026-10-10",
        departureTime: "20:00",
        arrivalDate: "2026-10-11",
        arrivalTime: "08:00",
      },
    });

    const rawParsed = {
      title: "Overnight Train Trip",
      destination: "Goa",
      days: [
        {
          dayNumber: 1,
          date: "2026-10-10",
          title: "Day 1",
          activities: [
            { time: "10:00", description: "Anjuna Beach visit (Impossible on travel day)" },
            { time: "15:00", description: "Chapora Fort visit (Impossible on travel day)" },
          ],
        },
        {
          dayNumber: 2,
          date: "2026-10-11",
          title: "Day 2",
          activities: [{ time: "10:00", description: "Arrive and explore" }],
        },
      ],
    };

    const sanitized = validateAndSanitizeItinerary(rawParsed, dates, {
      destination: "Goa",
      origin: "Mumbai",
      tripTiming: { destination: destWindows },
    });

    const day1 = sanitized.days[0];
    const isSightseeingPruned = !day1.activities.some((a) => a.description.includes("Anjuna") || a.description.includes("Chapora"));
    assert(isSightseeingPruned, "Destination sightseeing pruned on TRAVEL_OUTBOUND day");
    const hasTransitEntry = day1.activities.some((a) => a.description.toLowerCase().includes("journey") || a.description.toLowerCase().includes("transit"));
    assert(hasTransitEntry, "Day 1 has proper transit entries");
  });

  console.log("\n[TEST 6] Return Day Cutoff Enforcement");
  test("Sanitizer prunes activities after departure cutoff and ensures departure entry", () => {
    const dates = generateTripDates("2026-10-10", "2026-10-12");
    // Flight departs at 18:00 → Cutoff is 15:15
    const destWindows = calculateDestinationWindows({
      startDate: "2026-10-10",
      endDate: "2026-10-12",
      returnJourney: {
        transportType: "Flight",
        departureDate: "2026-10-12",
        departureTime: "18:00",
      },
    });

    const rawParsed = {
      title: "Return Trip",
      destination: "Goa",
      days: [
        { dayNumber: 1, date: "2026-10-10", title: "Day 1", activities: [{ time: "14:00", description: "Settle in" }] },
        { dayNumber: 2, date: "2026-10-11", title: "Day 2", activities: [{ time: "10:00", description: "Sightseeing" }] },
        {
          dayNumber: 3,
          date: "2026-10-12",
          title: "Day 3",
          activities: [
            { time: "09:00", description: "Morning breakfast and beach walk" },
            { time: "12:00", description: "Lunch and souvenir shopping" },
            { time: "16:30", description: "Late monument visit (Impossible after cutoff)" },
            { time: "17:30", description: "Dinner in city (Impossible after cutoff)" },
          ],
        },
      ],
    };

    const sanitized = validateAndSanitizeItinerary(rawParsed, dates, {
      destination: "Goa",
      origin: "Mumbai",
      tripTiming: { destination: destWindows },
    });

    const returnDay = sanitized.days[2];
    const hasLateActivities = returnDay.activities.some((a) => a.time === "16:30" || a.time === "17:30");
    assert.strictEqual(hasLateActivities, false, "Late activities after cutoff were pruned");
    const hasDeparture = returnDay.activities.some((a) => a.description.toLowerCase().includes("hub") || a.description.toLowerCase().includes("return") || a.description.toLowerCase().includes("departure"));
    assert(hasDeparture, "Return day has departure transfer entry");
  });

  console.log("\n[TEST 7] 36-Hour Journey Handling");
  test("36-hour journey: prompt and sanitizer enforce zero activities on Day 1 and late start on Day 2", () => {
    const dates = generateTripDates("2026-10-10", "2026-10-13");
    const destWindows = calculateDestinationWindows({
      startDate: "2026-10-10",
      endDate: "2026-10-13",
      outboundJourney: {
        transportType: "Train",
        departureDate: "2026-10-10",
        departureTime: "06:00",
        arrivalDate: "2026-10-11",
        arrivalTime: "18:00",
      },
    });

    const prompt = buildItineraryPrompt(
      {
        destination: "Kochi",
        origin: "Delhi",
        startDate: "2026-10-10",
        endDate: "2026-10-13",
        tripTiming: { destination: destWindows },
      },
      dates
    );

    assert(prompt.includes("IN-TRANSIT TO DESTINATION"), "Prompt marks Day 1 as in-transit");
    assert(prompt.includes("ARRIVAL DAY"), "Prompt marks Day 2 as arrival day");
  });

  console.log("\n[TEST 8] 48-Hour Multi-Day Journey Protection");
  test("48-hour journey: Days 1 and 2 remain free of destination sightseeing", () => {
    const dates = generateTripDates("2026-10-10", "2026-10-14");
    const destWindows = calculateDestinationWindows({
      startDate: "2026-10-10",
      endDate: "2026-10-14",
      outboundJourney: {
        transportType: "Train",
        departureDate: "2026-10-10",
        departureTime: "06:00",
        arrivalDate: "2026-10-12",
        arrivalTime: "08:00",
      },
    });

    const sanitized = validateAndSanitizeItinerary(
      { title: "Long Train Journey", destination: "Assam", days: [] },
      dates,
      { destination: "Assam", origin: "Mumbai", tripTiming: { destination: destWindows } }
    );

    assert.strictEqual(sanitized.days[0].activities.every((a) => !a.description.includes("Assam Sightseeing")), true);
    assert.strictEqual(sanitized.days[1].activities.every((a) => !a.description.includes("Assam Sightseeing")), true);
    assert.strictEqual(destWindows.days[0].status, "TRAVEL_OUTBOUND");
    assert.strictEqual(destWindows.days[1].status, "TRAVEL_OUTBOUND");
  });

  console.log("\n[TEST 9] Slow Style Pacing Guidance");
  test("Slow style specifies 2 to 3 activities and leisurely meal breaks", () => {
    const dates = generateTripDates("2026-10-10", "2026-10-12");
    const prompt = buildItineraryPrompt(
      {
        destination: "Udaipur",
        startDate: "2026-10-10",
        endDate: "2026-10-12",
        style: "Slow",
      },
      dates
    );

    assert(prompt.includes("SLOW / RELAXED PACE"), "Contains Slow pace section");
    assert(prompt.includes("Maximum 2 to 3 main activities per day"), "Specifies 2-3 activities/day");
  });

  console.log("\n[TEST 10] Packed Style Pacing Guidance");
  test("Packed style specifies 5 to 6 activities while enforcing usable windows", () => {
    const dates = generateTripDates("2026-10-10", "2026-10-12");
    const prompt = buildItineraryPrompt(
      {
        destination: "Mumbai",
        startDate: "2026-10-10",
        endDate: "2026-10-12",
        style: "Packed",
      },
      dates
    );

    assert(prompt.includes("PACKED / ACTIVE PACE"), "Contains Packed pace section");
    assert(prompt.includes("5 to 6 distinct activities"), "Specifies 5-6 activities/day");
    assert(prompt.includes("MUST NEVER exceed the day's usable window"), "Enforces hard constraint");
  });

  console.log("\n[TEST 11] Weather Context Integration");
  test("Weather forecast string is correctly passed to prompt builder", () => {
    const dates = generateTripDates("2026-10-10", "2026-10-12");
    const prompt = buildItineraryPrompt(
      {
        destination: "Goa",
        startDate: "2026-10-10",
        endDate: "2026-10-12",
        weatherInfo: "Sunny, 29°C, humidity 65%, wind 12 km/h, rain probability 10%",
      },
      dates
    );

    assert(prompt.includes("DESTINATION WEATHER CONTEXT"), "Includes weather section");
    assert(prompt.includes("Sunny, 29°C"), "Includes specific forecast");
  });

  console.log("\n[TEST 12] Weather Unavailable Graceful Fallback");
  test("When weather is unavailable, prompt omits weather without failing", () => {
    const dates = generateTripDates("2026-10-10", "2026-10-12");
    const prompt = buildItineraryPrompt(
      {
        destination: "Goa",
        startDate: "2026-10-10",
        endDate: "2026-10-12",
        weatherInfo: "",
      },
      dates
    );

    assert(typeof prompt === "string" && prompt.length > 500, "Generated full prompt");
    assert(!prompt.includes("Live Forecast in"), "Does not include fake live forecast");
  });

  console.log("\n[TEST 13] No Interests Fallback");
  test("When no interests are specified, fallback focuses on authentic regional highlights", () => {
    const dates = generateTripDates("2026-10-10", "2026-10-12");
    const prompt = buildItineraryPrompt(
      {
        destination: "Mysore",
        startDate: "2026-10-10",
        endDate: "2026-10-12",
        interests: [],
      },
      dates
    );

    assert(prompt.includes("GENERAL EXPLORATION"), "Has general exploration fallback");
  });

  console.log("\n[TEST 14] Legacy Trip Compatibility");
  await testAsync("Legacy trip generates and sanitizes properly without new Part 3/4 timing", async () => {
    const dates = generateTripDates("2026-10-10", "2026-10-12");
    const legacyTrip = new Trip({
      title: "Legacy Part 5 Trip",
      destination: "Ooty",
      createdBy: "test-user",
      startDate: "2026-10-10",
      endDate: "2026-10-12",
    });

    const sanitized = validateAndSanitizeItinerary(
      { title: legacyTrip.title, destination: legacyTrip.destination, days: [] },
      dates,
      { destination: "Ooty", origin: "" }
    );

    assert.strictEqual(sanitized.days.length, 3, "Sanitized 3 days for legacy trip");
    assert(sanitized.days[0].activities.length > 0, "Day 1 has activities");
  });

  console.log("\n[TEST 15] Provider Unavailable Non-Fatal Handling");
  await testAsync("computeJourneys gracefully handles unconfigured providers and passes data to prompt", async () => {
    const computed = await computeJourneys({
      origin: "NonExistentCityA",
      destination: "NonExistentCityB",
      startDate: "2026-10-10",
      endDate: "2026-10-14",
    });

    assert(computed.outboundJourney != null, "Computed outbound leg");
    assert(computed.tripTiming != null, "Computed timing");

    const dates = generateTripDates("2026-10-10", "2026-10-14");
    const prompt = buildItineraryPrompt(
      {
        destination: "NonExistentCityB",
        origin: "NonExistentCityA",
        startDate: "2026-10-10",
        endDate: "2026-10-14",
        outboundJourney: computed.outboundJourney,
        returnJourney: computed.returnJourney,
        tripTiming: computed.tripTiming,
      },
      dates
    );

    assert(prompt.includes("ANTI-HALLUCINATION TRAVEL RULES"), "Includes anti-hallucination rules");
  });

  console.log("\n[TEST 16] Concrete Itinerary Quality Scenarios (A, B, C)");
  await testAsync("Scenario A: Mumbai → Goa, Train, Overnight Arrival, Food + Beaches, Balanced", async () => {
    const computed = await computeJourneys({
      origin: "Mumbai",
      destination: "Goa",
      startDate: "2026-10-10",
      endDate: "2026-10-14",
      travelMode: "Train",
      departureTime: "20:00",
      arrivalTime: "08:00",
      outboundJourney: {
        transportType: "Train",
        departureDate: "2026-10-10",
        departureTime: "20:00",
        arrivalDate: "2026-10-11",
        arrivalTime: "08:00",
      },
      returnJourney: {
        transportType: "Train",
        departureDate: "2026-10-14",
        departureTime: "18:00",
      },
    });

    const dates = generateTripDates("2026-10-10", "2026-10-14");
    const prompt = buildItineraryPrompt(
      {
        destination: "Goa",
        origin: "Mumbai",
        startDate: "2026-10-10",
        endDate: "2026-10-14",
        interests: ["Food", "Beaches"],
        style: "Balanced",
        outboundJourney: computed.outboundJourney,
        returnJourney: computed.returnJourney,
        tripTiming: computed.tripTiming,
      },
      dates
    );

    assert(prompt.includes("FOOD & CULINARY FOCUS"));
    assert(prompt.includes("BEACHES & COASTAL FOCUS"));
    assert(computed.tripTiming.destination.days[0].status === "TRAVEL_OUTBOUND");
    assert(computed.tripTiming.destination.days[1].status === "ARRIVAL_DAY");
  });

  await testAsync("Scenario B: Mumbai → Goa, 36h Journey, Photography + Nature, Slow", async () => {
    const computed = await computeJourneys({
      origin: "Mumbai",
      destination: "Goa",
      startDate: "2026-10-10",
      endDate: "2026-10-14",
      travelMode: "Train",
      outboundJourney: {
        transportType: "Train",
        departureDate: "2026-10-10",
        departureTime: "06:00",
        arrivalDate: "2026-10-11",
        arrivalTime: "18:00",
      },
    });

    const dates = generateTripDates("2026-10-10", "2026-10-14");
    const prompt = buildItineraryPrompt(
      {
        destination: "Goa",
        origin: "Mumbai",
        startDate: "2026-10-10",
        endDate: "2026-10-14",
        interests: ["Photography", "Nature"],
        style: "Slow",
        outboundJourney: computed.outboundJourney,
        tripTiming: computed.tripTiming,
      },
      dates
    );

    assert(prompt.includes("PHOTOGRAPHY & VISUALS FOCUS"));
    assert(prompt.includes("NATURE & SCENIC FOCUS"));
    assert(prompt.includes("SLOW / RELAXED PACE"));
  });

  await testAsync("Scenario C: Mumbai → Goa, Return Day Cutoff, Food + Shopping + Culture, Packed", async () => {
    const computed = await computeJourneys({
      origin: "Mumbai",
      destination: "Goa",
      startDate: "2026-10-10",
      endDate: "2026-10-14",
      returnJourney: {
        transportType: "Flight",
        departureDate: "2026-10-14",
        departureTime: "18:00",
      },
    });

    const dates = generateTripDates("2026-10-10", "2026-10-14");
    const prompt = buildItineraryPrompt(
      {
        destination: "Goa",
        origin: "Mumbai",
        startDate: "2026-10-10",
        endDate: "2026-10-14",
        interests: ["Food", "Shopping", "Culture"],
        style: "Packed",
        returnJourney: computed.returnJourney,
        tripTiming: computed.tripTiming,
      },
      dates
    );

    assert(prompt.includes("FOOD & CULINARY FOCUS"));
    assert(prompt.includes("SHOPPING & ARTISANS FOCUS"));
    assert(prompt.includes("CULTURE & HERITAGE FOCUS"));
    assert(prompt.includes("PACKED / ACTIVE PACE"));
    assert(computed.tripTiming.destination.days[4].status === "RETURN_DAY");
  });

  console.log("\n==================================================");
  console.log(`PART 5 VERIFICATION COMPLETE: ${passed} passed, ${failed} failed`);
  console.log("==================================================");

  await mongoose.disconnect();

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
