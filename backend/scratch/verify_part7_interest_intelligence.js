/**
 * Part 7 Verification Test Suite — Interest Intelligence & Alignment
 *
 * Automated verification testing all Part 7 capabilities:
 *   - Test 1: Food normalization and guidance
 *   - Test 2: History mapping to Culture & Heritage
 *   - Test 3: Museums mapping to Culture & Heritage
 *   - Test 4: Hiking mapping to Adventure & Nature
 *   - Test 5: Architecture mapping to Culture & Photography/Visuals
 *   - Test 6: Cafes mapping to Food & Culinary
 *   - Test 7: Food + Photography + Culture composite synergy & multi-tagging
 *   - Test 8: Beaches + Food + Nightlife composite coastal/nightlife intent
 *   - Test 9: No interests fallback behavior (graceful handling, no crash)
 *   - Test 10: Legacy itinerary without interestTags (backward compatibility)
 *   - Test 11: Interest-rich trip + overnight arrival (usable window protection)
 *   - Test 12: MongoDB persistence of interestTags & clean retrieval
 */

import mongoose from "mongoose";
import assert from "assert";
import { config } from "../config/env.js";
import Trip from "../models/Trip.js";
import {
  normalizeInterests,
  buildInterestPromptSection,
  sanitizeActivityInterestTags,
  NORMALIZED_DOMAINS,
} from "../services/itinerary/interest-intelligence.service.js";
import { buildItineraryPrompt, generateTripDates } from "../services/itinerary/prompt-builder.js";
import { validateAndSanitizeItinerary } from "../services/itinerary/itinerary-sanitizer.js";

const MONGODB_URI = config.mongodbUri || process.env.MONGODB_URI || "mongodb://localhost:27017/Advenza";

async function runTests() {
  console.log("==================================================");
  console.log("ADVENZA PART 7 — INTEREST INTELLIGENCE VERIFICATION");
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

  // Connect to DB for model tests
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB for testing.");
  }

  // ── [TEST 1] Food Normalization & Guidance ──────────────────────────────────
  console.log("\n[TEST 1] Food Normalization & Guidance");
  test("Food maps to FOOD_CULINARY domain with specialized guidance", () => {
    const profile = normalizeInterests(["Food"]);
    assert.deepStrictEqual(profile.normalizedDomains, [NORMALIZED_DOMAINS.FOOD_CULINARY]);
    assert.strictEqual(profile.selected[0], "Food");
    
    const prompt = buildItineraryPrompt(
      {
        destination: "Amritsar",
        origin: "Delhi",
        startDate: "2026-10-10",
        endDate: "2026-10-12",
        interests: ["Food"],
      },
      generateTripDates("2026-10-10", "2026-10-12")
    );
    assert(prompt.includes("FOOD & CULINARY FOCUS"), "Contains Food guidance");
    assert(prompt.includes("iconic local eateries"), "Contains culinary directives");
  });

  // ── [TEST 2] History Mapping ───────────────────────────────────────────────
  console.log("\n[TEST 2] History Mapping");
  test("History maps to CULTURE_HERITAGE domain without being dropped", () => {
    const profile = normalizeInterests(["History"]);
    assert.deepStrictEqual(profile.normalizedDomains, [NORMALIZED_DOMAINS.CULTURE_HERITAGE]);
    assert.strictEqual(profile.domainLabels[0], "Culture & Heritage");

    const prompt = buildItineraryPrompt(
      {
        destination: "Hampi",
        origin: "Bengaluru",
        startDate: "2026-10-10",
        endDate: "2026-10-12",
        interests: ["History"],
      },
      generateTripDates("2026-10-10", "2026-10-12")
    );
    assert(prompt.includes("CULTURE & HERITAGE FOCUS"), "Contains Culture/Heritage directive for History");
    assert(prompt.includes("historical monuments"), "Contains monuments directives");
  });

  // ── [TEST 3] Museums Mapping ───────────────────────────────────────────────
  console.log("\n[TEST 3] Museums Mapping");
  test("Museums maps to CULTURE_HERITAGE domain", () => {
    const profile = normalizeInterests(["Museums"]);
    assert.deepStrictEqual(profile.normalizedDomains, [NORMALIZED_DOMAINS.CULTURE_HERITAGE]);

    const prompt = buildItineraryPrompt(
      {
        destination: "Kolkata",
        origin: "Delhi",
        startDate: "2026-10-10",
        endDate: "2026-10-12",
        interests: ["Museums"],
      },
      generateTripDates("2026-10-10", "2026-10-12")
    );
    assert(prompt.includes("CULTURE & HERITAGE FOCUS"), "Contains Culture/Heritage directive for Museums");
  });

  // ── [TEST 4] Hiking Mapping ────────────────────────────────────────────────
  console.log("\n[TEST 4] Hiking Mapping");
  test("Hiking maps to ADVENTURE_OUTDOORS & NATURE_SCENIC domains", () => {
    const profile = normalizeInterests(["Hiking"]);
    assert(profile.normalizedDomains.includes(NORMALIZED_DOMAINS.ADVENTURE_OUTDOORS), "Includes Adventure");
    assert(profile.normalizedDomains.includes(NORMALIZED_DOMAINS.NATURE_SCENIC), "Includes Nature");

    const prompt = buildItineraryPrompt(
      {
        destination: "Manali",
        origin: "Delhi",
        startDate: "2026-10-10",
        endDate: "2026-10-12",
        interests: ["Hiking"],
      },
      generateTripDates("2026-10-10", "2026-10-12")
    );
    assert(prompt.includes("ADVENTURE & OUTDOORS FOCUS"), "Contains Adventure directive");
    assert(prompt.includes("NATURE & SCENIC FOCUS"), "Contains Nature directive");
  });

  // ── [TEST 5] Architecture Mapping ──────────────────────────────────────────
  console.log("\n[TEST 5] Architecture Mapping");
  test("Architecture maps to CULTURE_HERITAGE & PHOTOGRAPHY_VISUAL domains", () => {
    const profile = normalizeInterests(["Architecture"]);
    assert(profile.normalizedDomains.includes(NORMALIZED_DOMAINS.CULTURE_HERITAGE), "Includes Culture");
    assert(profile.normalizedDomains.includes(NORMALIZED_DOMAINS.PHOTOGRAPHY_VISUAL), "Includes Photography");

    const prompt = buildItineraryPrompt(
      {
        destination: "Jaipur",
        origin: "Delhi",
        startDate: "2026-10-10",
        endDate: "2026-10-12",
        interests: ["Architecture"],
      },
      generateTripDates("2026-10-10", "2026-10-12")
    );
    assert(prompt.includes("CULTURE & HERITAGE FOCUS"), "Contains Culture directive");
    assert(prompt.includes("PHOTOGRAPHY & VISUALS FOCUS"), "Contains Photography directive");
  });

  // ── [TEST 6] Cafes Mapping ─────────────────────────────────────────────────
  console.log("\n[TEST 6] Cafes Mapping");
  test("Cafes maps to FOOD_CULINARY domain", () => {
    const profile = normalizeInterests(["Cafes"]);
    assert.deepStrictEqual(profile.normalizedDomains, [NORMALIZED_DOMAINS.FOOD_CULINARY]);

    const prompt = buildItineraryPrompt(
      {
        destination: "Pondicherry",
        origin: "Chennai",
        startDate: "2026-10-10",
        endDate: "2026-10-12",
        interests: ["Cafes"],
      },
      generateTripDates("2026-10-10", "2026-10-12")
    );
    assert(prompt.includes("FOOD & CULINARY FOCUS"), "Contains Food directive for Cafes");
  });

  // ── [TEST 7] Food + Photography + Culture Synergies ────────────────────────
  console.log("\n[TEST 7] Food + Photography + Culture Multi-Domain Synergy");
  test("Generates multiple normalized domains and composite synergy intents", () => {
    const profile = normalizeInterests(["Food", "Photography", "Culture"]);
    assert(profile.normalizedDomains.includes(NORMALIZED_DOMAINS.FOOD_CULINARY));
    assert(profile.normalizedDomains.includes(NORMALIZED_DOMAINS.PHOTOGRAPHY_VISUAL));
    assert(profile.normalizedDomains.includes(NORMALIZED_DOMAINS.CULTURE_HERITAGE));

    // Check composite intents
    const intentIds = profile.compositeIntents.map((c) => c.intentId);
    assert(intentIds.includes("CULINARY_HERITAGE"), "Includes Culinary Heritage synergy");
    assert(intentIds.includes("VISUAL_CULINARY"), "Includes Visual Culinary synergy");
    assert(intentIds.includes("HERITAGE_PHOTOGRAPHY"), "Includes Heritage Photography synergy");

    const prompt = buildItineraryPrompt(
      {
        destination: "Varanasi",
        origin: "Delhi",
        startDate: "2026-10-10",
        endDate: "2026-10-13",
        interests: ["Food", "Photography", "Culture"],
      },
      generateTripDates("2026-10-10", "2026-10-13")
    );
    assert(prompt.includes("COMPOSITE MULTI-INTEREST SYNERGY DIRECTIVES"), "Prompt includes composite synergy section");
    assert(prompt.includes("CULINARY HERITAGE & HISTORIC EATERIES"), "Prompt mentions culinary heritage directive");
    assert(prompt.includes("PHOTOGRAPHIC HERITAGE & ARCHITECTURE"), "Prompt mentions photographic heritage directive");
  });

  // ── [TEST 8] Beaches + Food + Nightlife ─────────────────────────────────────
  console.log("\n[TEST 8] Beaches + Food + Nightlife Synergies");
  test("Generates coastal, culinary, and evening composite intent", () => {
    const profile = normalizeInterests(["Beaches", "Food", "Nightlife"]);
    const intentIds = profile.compositeIntents.map((c) => c.intentId);
    assert(intentIds.includes("COASTAL_CULINARY"), "Includes Coastal Culinary synergy");
    assert(intentIds.includes("COASTAL_NIGHTLIFE"), "Includes Coastal Nightlife synergy");
    assert(intentIds.includes("EVENING_SOCIAL_CULINARY"), "Includes Evening Culinary synergy");
  });

  // ── [TEST 9] No Interests Fallback ──────────────────────────────────────────
  console.log("\n[TEST 9] No Interests Fallback");
  test("Gracefully operates with general exploration when no interests specified", () => {
    const profile = normalizeInterests([]);
    assert.strictEqual(profile.hasInterests, false);
    assert.strictEqual(profile.normalizedDomains.length, 0);
    assert.strictEqual(profile.compositeIntents.length, 0);

    const prompt = buildItineraryPrompt(
      {
        destination: "Ooty",
        origin: "Coimbatore",
        startDate: "2026-10-10",
        endDate: "2026-10-12",
        interests: [],
      },
      generateTripDates("2026-10-10", "2026-10-12")
    );
    assert(prompt.includes("GENERAL EXPLORATION"), "Falls back to General Exploration");
    assert(!prompt.includes("COMPOSITE MULTI-INTEREST"), "Does not include empty composite section");
  });

  // ── [TEST 10] Legacy Itinerary Compatibility ───────────────────────────────
  console.log("\n[TEST 10] Legacy Itinerary Compatibility");
  test("Sanitizes legacy AI response without interestTags safely", () => {
    const legacyParsed = {
      title: "Trip to Goa",
      destination: "Goa",
      days: [
        {
          dayNumber: 1,
          date: "2026-10-10",
          title: "Day 1",
          activities: [
            { time: "09:00", description: "Visit Aguada Fort" },
            { time: "13:00", description: "Lunch at local shack" },
          ],
        },
      ],
    };

    const sanitized = validateAndSanitizeItinerary(
      legacyParsed,
      [{ dayNumber: 1, date: "2026-10-10", dayName: "Saturday" }],
      { destination: "Goa", interests: ["Food", "Culture"] }
    );

    assert.strictEqual(sanitized.days.length, 1);
    assert(Array.isArray(sanitized.days[0].activities[0].interestTags), "interestTags is initialized as array");
    assert.strictEqual(sanitized.days[0].activities[0].time, "09:00");
  });

  // ── [TEST 11] Interest-Rich Trip + Overnight Usable Window Protection ──────
  console.log("\n[TEST 11] Interest-Rich Trip + Overnight Usable Window Protection");
  test("Interest-rich trip never violates travel day zero-hour constraint or usable start time", () => {
    const aiOutputWithSightseeingOnTravelDay = {
      title: "Mumbai to Goa Train Voyage",
      destination: "Goa",
      days: [
        {
          dayNumber: 1,
          date: "2026-10-10",
          title: "Food tour on Day 1",
          activities: [
            { time: "10:00", description: "Breakfast food tour in Goa", interestTags: ["Food"] },
            { time: "14:00", description: "Museum visit in Goa", interestTags: ["Culture"] },
          ],
        },
        {
          dayNumber: 2,
          date: "2026-10-11",
          title: "Arrival Day",
          activities: [
            { time: "07:00", description: "Sunrise photography at beach", interestTags: ["Photography"] },
            { time: "14:00", description: "Afternoon heritage walk", interestTags: ["Culture"] },
          ],
        },
      ],
    };

    const sanitized = validateAndSanitizeItinerary(
      aiOutputWithSightseeingOnTravelDay,
      [
        { dayNumber: 1, date: "2026-10-10", dayName: "Saturday" },
        { dayNumber: 2, date: "2026-10-11", dayName: "Sunday" },
      ],
      {
        destination: "Goa",
        origin: "Mumbai",
        interests: ["Food", "Culture", "Photography"],
        tripTiming: {
          destination: {
            days: [
              {
                date: "2026-10-10",
                status: "TRAVEL_OUTBOUND",
                availableHours: 0,
              },
              {
                date: "2026-10-11",
                status: "ARRIVAL_DAY",
                usableStartDateTime: "2026-10-11T12:00:00.000Z",
                availableHours: 9,
              },
            ],
          },
        },
      }
    );

    // Day 1 must have 0 destination activities despite selected interests
    const day1Descs = sanitized.days[0].activities.map((a) => a.description.toLowerCase()).join(" ");
    assert(!day1Descs.includes("food tour in goa"), "Day 1 transit day blocked destination food tour");
    assert(day1Descs.includes("outbound journey departure"), "Day 1 contains transit journey departure");

    // Day 2 must prune 07:00 activity (before 12:00 arrival usable start)
    const day2Times = sanitized.days[1].activities.map((a) => a.time);
    assert(!day2Times.includes("07:00"), "Day 2 pruned 07:00 activity before usable window");
    assert(day2Times.includes("14:00"), "Day 2 preserved 14:00 activity within usable window");
  });

  // ── [TEST 12] MongoDB Persistence with Structured Interest Tags ────────────
  console.log("\n[TEST 12] MongoDB Model Persistence & Retrieval");
  await testAsync("Trip model persists and retrieves activities with interestTags cleanly", async () => {
    const testTrip = new Trip({
      title: "Part 7 Persistence Test Trip",
      destination: "Udaipur",
      origin: "Jaipur",
      startDate: "2026-11-01",
      endDate: "2026-11-02",
      interests: ["Food", "Photography", "History"],
      createdBy: "verify_part7_user",
      days: [
        {
          dayNumber: 1,
          date: "2026-11-01",
          title: "Heritage & Culinary Exploration",
          activities: [
            {
              time: "14:30",
              description: "City Palace architectural photography walk",
              interestTags: ["History", "Photography"],
            },
            {
              time: "19:30",
              description: "Traditional Rajasthani dinner overlooking Lake Pichola",
              interestTags: ["Food", "Photography"],
            },
          ],
        },
      ],
    });

    const saved = await testTrip.save();
    assert(saved._id, "Trip saved to MongoDB");

    const fetched = await Trip.findById(saved._id);
    assert.strictEqual(fetched.days[0].activities.length, 2);
    assert.deepStrictEqual(fetched.days[0].activities[0].interestTags, ["History", "Photography"]);
    assert.deepStrictEqual(fetched.days[0].activities[1].interestTags, ["Food", "Photography"]);

    // Cleanup
    await Trip.deleteOne({ _id: saved._id });
  });

  console.log("\n==================================================");
  console.log(`PART 7 VERIFICATION COMPLETE: ${passed} passed, ${failed} failed`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests()
  .catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });
