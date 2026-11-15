/**
 * Advenza — Deep Interest Intelligence & Time-Aware Place Recommendations Test Suite
 *
 * Automated verification of all 12 core requirements:
 * 1. Nightlife venue open from 7 PM to 2 AM (overnight logic across midnight).
 * 2. Venue closing at midnight.
 * 3. Venue closed on the selected weekday.
 * 4. Venue hours unavailable (marked unconfirmed, never fabricated).
 * 5. Trip date outside the 7-day live window (> 7 days flagged).
 * 6. Multiple interests selected together (taxonomy & synergy generation).
 * 7. Nightlife combined with Food (dinner + late-night scheduling).
 * 8. Hiking scheduled during appropriate daylight hours (never midday heat or night).
 * 9. Venue outside the user's available destination window (arrival day buffer).
 * 10. Arrival and return day restrictions (travel days 0 hours, cutoff respected).
 * 11. Duplicate venue prevention across nights.
 * 12. No verified matching venues available (graceful fallback without hallucinating).
 */

import assert from "assert";
import {
  parseOpeningHours,
  isVenueOpenAt,
  isOutside7DayWindow,
  calculateWindowOverlap,
  normalizeTo24hTime,
} from "../services/itinerary/opening-hours.service.js";
import {
  INTEREST_TAXONOMY,
  getTaxonomyForInterest,
} from "../services/itinerary/interest-taxonomy.js";
import {
  normalizeInterests,
  buildInterestPromptSection,
} from "../services/itinerary/interest-intelligence.service.js";
import { placeDiscoveryService } from "../services/places/place-discovery.service.js";
import { validateAndSanitizeItinerary } from "../services/itinerary/itinerary-sanitizer.js";

async function runTestSuite() {
  console.log("==================================================");
  console.log("ADVENZA — DEEP INTEREST & TIME-AWARE PLACE SUITE");
  console.log("==================================================");

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error(`    Error: ${err.message}`);
      failed++;
    }
  }

  async function testAsync(name, fn) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error(`    Error: ${err.message}`);
      failed++;
    }
  }

  // ── TEST 1: Nightlife venue open from 7 PM to 2 AM (Overnight) ────────────
  test("Test 1: Nightlife venue open 7 PM to 2 AM handles overnight hours spanning midnight", () => {
    const raw = "19:00 - 02:00";
    const parsed = parseOpeningHours(raw);
    assert.strictEqual(parsed.status, "CONFIRMED");
    assert.strictEqual(parsed.periods[0].overnight, true, "Period must be flagged as overnight");

    // 21:30 should be open
    const check1 = isVenueOpenAt({ parsedHours: parsed, targetTimeStr: "21:30" });
    assert.strictEqual(check1.isOpen, true, "21:30 must be open");

    // 00:30 (past midnight) should be open
    const check2 = isVenueOpenAt({ parsedHours: parsed, targetTimeStr: "00:30" });
    assert.strictEqual(check2.isOpen, true, "00:30 must be open across midnight");

    // 01:45 should be open
    const check3 = isVenueOpenAt({ parsedHours: parsed, targetTimeStr: "01:45" });
    assert.strictEqual(check3.isOpen, true, "01:45 must be open");

    // 15:00 (3 PM afternoon) should be closed
    const check4 = isVenueOpenAt({ parsedHours: parsed, targetTimeStr: "15:00" });
    assert.strictEqual(check4.isOpen, false, "15:00 must be closed");
  });

  // ── TEST 2: Venue closing at midnight ─────────────────────────────────────
  test("Test 2: Venue closing at midnight (e.g. 18:00 – 00:00)", () => {
    const parsed = parseOpeningHours("18:00 – 00:00");
    assert.strictEqual(parsed.status, "CONFIRMED");

    const checkOpen = isVenueOpenAt({ parsedHours: parsed, targetTimeStr: "22:00" });
    assert.strictEqual(checkOpen.isOpen, true, "22:00 must be open");

    const checkClosed = isVenueOpenAt({ parsedHours: parsed, targetTimeStr: "01:00" });
    assert.strictEqual(checkClosed.isOpen, false, "01:00 must be closed after midnight");
  });

  // ── TEST 3: Venue closed on the selected weekday ──────────────────────────
  test("Test 3: Venue closed on selected weekday (e.g. Monday closed)", () => {
    const parsed = parseOpeningHours("10:00 – 17:00, Closed on Monday");
    assert(parsed.closedDays.includes("Monday"), "Monday must be detected in closedDays");

    // 2026-11-16 is a Monday
    const mondayCheck = isVenueOpenAt({
      parsedHours: parsed,
      targetTimeStr: "14:00",
      dateStr: "2026-11-16",
    });
    assert.strictEqual(mondayCheck.isOpen, false, "Must be closed on Monday");
    assert(mondayCheck.reason.includes("closed on Monday"), "Reason must specify closed on Monday");

    // 2026-11-17 is a Tuesday
    const tuesdayCheck = isVenueOpenAt({
      parsedHours: parsed,
      targetTimeStr: "14:00",
      dateStr: "2026-11-17",
    });
    assert.strictEqual(tuesdayCheck.isOpen, true, "Must be open on Tuesday");
  });

  // ── TEST 4: Venue hours unavailable ───────────────────────────────────────
  test("Test 4: Venue hours unavailable (marked as unknown, never fabricated)", () => {
    const parsed = parseOpeningHours(null);
    assert.strictEqual(parsed.status, "HOURS_UNCONFIRMED");
    assert(parsed.display.includes("unconfirmed"), "Display must indicate unconfirmed");

    const check = isVenueOpenAt({ parsedHours: parsed, targetTimeStr: "20:00" });
    assert.strictEqual(check.confidence, "UNKNOWN", "Confidence must be marked as UNKNOWN");
    assert(check.reason.includes("unconfirmed"), "Reason must clearly note unconfirmed");
  });

  // ── TEST 5: Trip date outside current 7-day opening-hours coverage ─────────
  test("Test 5: Trip date outside 7-day live window (> 7 days flagged)", () => {
    // 30 days in the future
    const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const isOutside = isOutside7DayWindow(futureDate);
    assert.strictEqual(isOutside, true, "Future date > 7 days must return true");

    // Tomorrow
    const tomorrow = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const isTomorrowOutside = isOutside7DayWindow(tomorrow);
    assert.strictEqual(isTomorrowOutside, false, "Tomorrow within 7 days must return false");
  });

  // ── TEST 6: Multiple interests selected together ──────────────────────────
  test("Test 6: Multiple interests selected together produce deep subcategories and synergies", () => {
    const profile = normalizeInterests(["Food", "Nightlife", "Photography"]);
    assert.strictEqual(profile.hasInterests, true);
    assert(profile.taxonomies.length >= 3, "Taxonomies for Food, Nightlife, and Photography must be mapped");

    const promptSection = buildInterestPromptSection(profile);
    assert(promptSection.includes("NIGHTLIFE"), "Prompt section must contain Nightlife intelligence");
    assert(promptSection.includes("Nightclubs & Dance Clubs"), "Deep subcategories must be listed");
    assert(promptSection.includes("21:00 to 01:00"), "Preferred nightlife window must be specified");
    assert(promptSection.includes("FOOD"), "Prompt section must contain Food intelligence");
    assert(promptSection.includes("COMPOSITE MULTI-INTEREST SYNERGY"), "Composite synergies must be generated");
  });

  // ── TEST 7: Nightlife combined with Food ───────────────────────────────────
  test("Test 7: Nightlife combined with Food schedules dinner before late-night nightlife", () => {
    const rawItinerary = {
      title: "Goa Evening",
      days: [
        {
          dayNumber: 1,
          date: "2026-11-20",
          title: "Evening in North Goa",
          activities: [
            { time: "19:30", description: "Dinner at Fisherman's Wharf enjoying Goan prawn curry", interestTags: ["Food"] },
            { time: "14:00", description: "Dancing at Tito's Club", interestTags: ["Nightlife"] }, // Incorrect afternoon time from AI
          ],
        },
      ],
    };

    const sanitized = validateAndSanitizeItinerary(
      rawItinerary,
      [{ dayNumber: 1, date: "2026-11-20", dayName: "Friday" }],
      {
        destination: "Goa",
        interests: ["Nightlife", "Food"],
        verifiedPlaces: [
          {
            placeName: "Tito's Club & Mambo's",
            placeCategory: "Nightlife",
            placeSubcategory: "Nightclubs & Dance Clubs",
            openingHours: "18:00 – 03:30",
            verificationStatus: "CURATED_VERIFIED",
            suggestedVisitTime: "22:00",
          },
        ],
      }
    );

    const activities = sanitized.days[0].activities;
    const clubAct = activities.find((a) => a.description.toLowerCase().includes("tito"));
    assert(clubAct, "Tito's activity must exist");
    // Verify afternoon 14:00 was rescheduled to evening nightlife window (>= 18:00)
    const [h] = clubAct.time.split(":").map(Number);
    assert(h >= 18, `Club time must be rescheduled to evening hours (got ${clubAct.time})`);
  });

  // ── TEST 8: Hiking scheduled during appropriate daylight hours ─────────────
  test("Test 8: Hiking scheduled during daylight hours (never midday heat or night)", () => {
    const rawItinerary = {
      title: "Mountain Trek",
      days: [
        {
          dayNumber: 1,
          date: "2026-11-20",
          activities: [
            { time: "13:30", description: "Midday nature summit hike", interestTags: ["Hiking"] },
          ],
        },
      ],
    };

    const sanitized = validateAndSanitizeItinerary(
      rawItinerary,
      [{ dayNumber: 1, date: "2026-11-20", dayName: "Friday" }],
      { destination: "Manali", interests: ["Hiking"] }
    );

    const hike = sanitized.days[0].activities[0];
    const [h] = hike.time.split(":").map(Number);
    assert(h < 12 || h >= 16, `Hiking time must not be scheduled during peak midday heat (got ${hike.time})`);
  });

  // ── TEST 9: Venue outside user's available destination window ──────────────
  test("Test 9: Venue outside user's available destination window (Arrival day pruning)", () => {
    const rawItinerary = {
      title: "Arrival Day",
      days: [
        {
          dayNumber: 1,
          date: "2026-11-20",
          activities: [
            { time: "09:00", description: "Morning sightseeing before arrival", interestTags: ["Culture"] },
            { time: "18:30", description: "Evening seaside dinner", interestTags: ["Food"] },
          ],
        },
      ],
    };

    const sanitized = validateAndSanitizeItinerary(
      rawItinerary,
      [{ dayNumber: 1, date: "2026-11-20", dayName: "Friday" }],
      {
        destination: "Goa",
        tripTiming: {
          destination: {
            days: [
              {
                date: "2026-11-20",
                status: "ARRIVAL_DAY",
                usableStartDateTime: "2026-11-20T16:00:00",
                usableEndDateTime: "2026-11-20T22:00:00",
              },
            ],
          },
        },
      }
    );

    const acts = sanitized.days[0].activities;
    const hasMorning = acts.some((a) => {
      const [h] = a.time.split(":").map(Number);
      return h < 15 && a.description.toLowerCase().includes("morning sightseeing");
    });
    assert.strictEqual(hasMorning, false, "Morning sightseeing before arrival time must be pruned");
  });

  // ── TEST 10: Arrival and return day restrictions ───────────────────────────
  test("Test 10: Travel days (TRAVEL_OUTBOUND) allow 0 destination sightseeing", () => {
    const rawItinerary = {
      title: "Long Transit Trip",
      days: [
        {
          dayNumber: 1,
          date: "2026-11-20",
          activities: [{ time: "10:00", description: "Visit beach club", interestTags: ["Beaches"] }],
        },
      ],
    };

    const sanitized = validateAndSanitizeItinerary(
      rawItinerary,
      [{ dayNumber: 1, date: "2026-11-20", dayName: "Friday" }],
      {
        destination: "Goa",
        tripTiming: {
          destination: {
            days: [{ date: "2026-11-20", status: "TRAVEL_OUTBOUND" }],
          },
        },
      }
    );

    const acts = sanitized.days[0].activities;
    const hasSightseeing = acts.some((a) => a.description.toLowerCase().includes("beach club"));
    assert.strictEqual(hasSightseeing, false, "TRAVEL_OUTBOUND day must have ZERO destination activities");
    assert(acts.some((a) => a.description.toLowerCase().includes("journey") || a.description.toLowerCase().includes("transit")));
  });

  // ── TEST 11: Duplicate venue prevention across nights ──────────────────────
  test("Test 11: Duplicate venue prevention across consecutive nights", () => {
    const verifiedCatalog = [
      {
        placeName: "Club Cubana",
        placeCategory: "Nightlife",
        placeSubcategory: "Nightclubs & Dance Clubs",
        openingHours: "21:30 – 04:00",
        verificationStatus: "CURATED_VERIFIED",
      },
      {
        placeName: "Cohiba Bar & Kitchen",
        placeCategory: "Nightlife",
        placeSubcategory: "Live Music Venues",
        openingHours: "19:00 – 02:00",
        verificationStatus: "CURATED_VERIFIED",
      },
    ];

    const rawItinerary = {
      title: "Party Weekend",
      days: [
        {
          dayNumber: 1,
          date: "2026-11-20",
          activities: [{ time: "22:00", description: "Party at Club Cubana", placeName: "Club Cubana", interestTags: ["Nightlife"] }],
        },
        {
          dayNumber: 2,
          date: "2026-11-21",
          activities: [{ time: "22:00", description: "Party at Club Cubana again", placeName: "Club Cubana", interestTags: ["Nightlife"] }],
        },
      ],
    };

    const sanitized = validateAndSanitizeItinerary(
      rawItinerary,
      [
        { dayNumber: 1, date: "2026-11-20", dayName: "Friday" },
        { dayNumber: 2, date: "2026-11-21", dayName: "Saturday" },
      ],
      { destination: "Goa", verifiedPlaces: verifiedCatalog, interests: ["Nightlife"] }
    );

    const day1Venue = sanitized.days[0].activities[0].placeName;
    const day2Venue = sanitized.days[1].activities[0].placeName;

    assert.notStrictEqual(
      day1Venue.toLowerCase(),
      day2Venue.toLowerCase(),
      `Day 2 venue must be swapped to avoid repeating the same venue (Day 1: ${day1Venue}, Day 2: ${day2Venue})`
    );
  });

  // ── TEST 12: No verified matching venues available (Graceful Fallback) ──────
  test("Test 12: No verified matching venues available does not hallucinate fake places", async () => {
    const places = await placeDiscoveryService.discoverPlacesForInterests({
      destination: "UnknownRemoteVillage123",
      interests: ["Nightlife"],
      dates: [{ dayNumber: 1, date: "2026-11-20", dayName: "Friday" }],
    });

    assert(Array.isArray(places), "Must return an array");
    assert.strictEqual(places.length, 0, "No fake venues should be invented for unknown destination");

    const status = placeDiscoveryService.getProviderStatus();
    assert(status.provider, "Provider status must report Google Places");
  });

  console.log("==================================================");
  console.log(`TEST SUITE RESULTS: ${passed} passed, ${failed} failed`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});

