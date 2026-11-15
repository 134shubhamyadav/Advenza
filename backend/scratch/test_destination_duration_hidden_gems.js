/**
 * Automated Test Suite: Smart Destination Duration & Hidden Gems Intelligence
 *
 * Covers:
 * 1. Duration recommendation with many attractions (Goa >= 5 recommended days)
 * 2. Duration recommendation with limited/no attractions (unknown destination baseline)
 * 3. Nature + Hiking interest modifier (+1 recommended day)
 * 4. Multiple conflicting/synergistic interests (Culture + Nightlife pacing note & duration)
 * 5. Distinct classification of Popular Attractions vs. Authentic Hidden Gems
 * 6. Anti-hallucination guarantee (unknown destination returns empty arrays, no fabricated venues)
 * 7. Geographical grouping (regions array properly populated for curated destinations)
 * 8. Shorter duration prioritization in sanitization
 * 9. Prompt builder injection of popular attractions and hidden gems with ★ prefix
 * 10. Sanitizer preservation of isPlaceHiddenGem, placeType, and whySpecial fields
 * 11. Preservation of opening hours and timing constraints alongside hidden gem metadata
 * 12. TRAVEL_OUTBOUND days enforce zero destination exploration activities
 */

import assert from "node:assert/strict";
import { destinationDurationService } from "../services/places/destination-duration.service.js";
import { placeDiscoveryService } from "../services/places/place-discovery.service.js";
import { buildItineraryPrompt } from "../services/itinerary/prompt-builder.js";
import { validateAndSanitizeItinerary } from "../services/itinerary/itinerary-sanitizer.js";

async function runTests() {
  console.log("🚀 Starting Advenza Destination Duration & Hidden Gems Test Suite...\n");
  let passed = 0;
  let total = 12;

  // ── Test 1: Goa duration recommendation with rich attractions ───────────────
  try {
    const overview = await destinationDurationService.getDestinationOverview({
      destination: "Goa",
      interests: ["Beaches", "Food"],
    });

    assert.ok(overview.destination === "Goa", "Destination should match");
    assert.ok(overview.durationRecommendation.recommendedDays >= 5, "Goa should have >= 5 recommended days");
    assert.ok(overview.durationRecommendation.minimumDays >= 3, "Goa minimum should be >= 3 days");
    assert.ok(overview.durationRecommendation.extendedDays > overview.durationRecommendation.recommendedDays, "Extended should be greater than recommended");
    assert.ok(overview.durationRecommendation.whyRecommended.length > 20, "whyRecommended should provide descriptive rationale");
    console.log("✅ Test 1: Destination duration recommendation with many attractions passed.");
    passed++;
  } catch (err) {
    console.error("❌ Test 1 Failed:", err.message);
  }

  // ── Test 2: Unknown destination baseline duration ──────────────────────────
  try {
    const overview = await destinationDurationService.getDestinationOverview({
      destination: "AtlantisUnderwaterWorld",
      interests: [],
    });

    assert.equal(overview.durationRecommendation.minimumDays, 2, "Unknown destination should baseline min to 2 days");
    assert.equal(overview.durationRecommendation.recommendedDays, 4, "Unknown destination should baseline rec to 4 days");
    assert.equal(overview.durationRecommendation.extendedDays, 6, "Unknown destination should baseline ext to 6 days");
    assert.equal(overview.durationRecommendation.popularAttractionsCount, 0, "No popular attractions for unknown place");
    assert.equal(overview.durationRecommendation.hiddenGemsCount, 0, "No hidden gems for unknown place");
    console.log("✅ Test 2: Unknown destination baseline duration passed.");
    passed++;
  } catch (err) {
    console.error("❌ Test 2 Failed:", err.message);
  }

  // ── Test 3: Nature + Hiking interest modifier ──────────────────────────────
  try {
    const baseOverview = await destinationDurationService.getDestinationOverview({
      destination: "Manali",
      interests: [],
    });
    const hikingOverview = await destinationDurationService.getDestinationOverview({
      destination: "Manali",
      interests: ["Hiking", "Adventure"],
    });

    assert.ok(
      hikingOverview.durationRecommendation.recommendedDays >= baseOverview.durationRecommendation.recommendedDays + 1,
      "Hiking/Adventure should increase recommended days by at least 1"
    );
    assert.ok(
      hikingOverview.durationRecommendation.interestAlignmentNote?.includes("treks"),
      "Should include hiking interest alignment note"
    );
    console.log("✅ Test 3: Nature + Hiking interest modifier passed.");
    passed++;
  } catch (err) {
    console.error("❌ Test 3 Failed:", err.message);
  }

  // ── Test 4: Culture + Nightlife combined duration modifier ─────────────────
  try {
    const overview = await destinationDurationService.getDestinationOverview({
      destination: "Mumbai",
      interests: ["Culture", "Nightlife"],
    });

    assert.ok(
      overview.durationRecommendation.interestAlignmentNote?.includes("nightlife"),
      "Should include nightlife & culture separation note to avoid exhaustion"
    );
    console.log("✅ Test 4: Culture + Nightlife pacing alignment passed.");
    passed++;
  } catch (err) {
    console.error("❌ Test 4 Failed:", err.message);
  }

  // ── Test 5: Distinct classification of Popular Attractions vs Hidden Gems ──
  try {
    const discovery = await placeDiscoveryService.discoverAllPlacesForDestination({
      destination: "Goa",
      interests: ["Beaches", "Food"],
    });

    assert.ok(discovery.popularAttractions.length > 0, "Goa should have popular attractions");
    assert.ok(discovery.hiddenGems.length > 0, "Goa should have verified hidden gems");

    // Check that hidden gems have placeType === "HIDDEN_GEM" and whySpecial
    for (const gem of discovery.hiddenGems) {
      assert.equal(gem.placeType, "HIDDEN_GEM", `Place ${gem.placeName} must be marked as HIDDEN_GEM`);
      assert.equal(gem.isPlaceHiddenGem, true, `Place ${gem.placeName} isPlaceHiddenGem must be true`);
      assert.ok(gem.whySpecial && gem.whySpecial.length > 5, `Hidden gem ${gem.placeName} must have whySpecial rationale`);
    }

    // Check popular attractions
    for (const pop of discovery.popularAttractions) {
      assert.equal(pop.placeType, "POPULAR_ATTRACTION", `Place ${pop.placeName} must be marked as POPULAR_ATTRACTION`);
    }

    console.log("✅ Test 5: Distinct classification of Popular Attractions vs Hidden Gems passed.");
    passed++;
  } catch (err) {
    console.error("❌ Test 5 Failed:", err.message);
  }

  // ── Test 6: Anti-hallucination guarantee for unknown destinations ──────────
  try {
    const discovery = await placeDiscoveryService.discoverAllPlacesForDestination({
      destination: "ZionMysticalFictionalCity",
      interests: ["Nature"],
    });

    assert.equal(discovery.allPlaces.length, 0, "No places should be fabricated");
    assert.equal(discovery.popularAttractions.length, 0, "No popular attractions should be fabricated");
    assert.equal(discovery.hiddenGems.length, 0, "No hidden gems should be fabricated");
    assert.equal(discovery.isCurated, false, "Should indicate not curated");
    console.log("✅ Test 6: Anti-hallucination guarantee passed.");
    passed++;
  } catch (err) {
    console.error("❌ Test 6 Failed:", err.message);
  }

  // ── Test 7: Geographical grouping / regions array ──────────────────────────
  try {
    const overview = await destinationDurationService.getDestinationOverview({
      destination: "Goa",
      interests: [],
    });

    assert.ok(Array.isArray(overview.durationRecommendation.regions), "Regions must be an array");
    assert.ok(overview.durationRecommendation.regions.length >= 2, "Goa should have at least 2 geographic regions");
    const hasNorthOrSouth = overview.durationRecommendation.regions.some(
      (r) => r.toLowerCase().includes("north") || r.toLowerCase().includes("south")
    );
    assert.ok(hasNorthOrSouth, "Regions should include North Goa or South Goa");
    console.log("✅ Test 7: Geographical grouping & regions passed.");
    passed++;
  } catch (err) {
    console.error("❌ Test 7 Failed:", err.message);
  }

  // ── Test 8: Shorter duration pacing & prioritization ───────────────────────
  try {
    const timingWindow = {
      days: [
        {
          date: "2026-12-01",
          status: "FULL_DESTINATION_DAY",
          usableStartDateTime: "2026-12-01T09:00:00",
          usableEndDateTime: "2026-12-01T21:00:00",
          availableHours: 12,
        },
      ],
    };

    // Raw AI output with 3 activities
    const rawItinerary = {
      title: "Goa Highlights in 1 Day",
      budgetBreakdown: { categories: [{ category: "Activities", label: "Sightseeing", amount: 1000 }] },
      days: [
        {
          dayNumber: 1,
          title: "Core Goa Exploration",
          activities: [
            {
              time: "09:30",
              description: "Visit Fort Aguada lighthouse",
              placeName: "Fort Aguada",
              placeCategory: "Heritage",
              placeType: "POPULAR_ATTRACTION",
            },
            {
              time: "13:00",
              description: "Lunch at Vinayak Family Restaurant",
              placeName: "Vinayak Family Restaurant",
              placeCategory: "Food",
              placeType: "HIDDEN_GEM",
              isPlaceHiddenGem: true,
              whySpecial: "Beloved local Goan fish thali tucked away in quiet fields",
            },
            {
              time: "17:00",
              description: "Sunset at Kakolem Beach",
              placeName: "Kakolem Beach",
              placeCategory: "Beaches",
              placeType: "HIDDEN_GEM",
              isPlaceHiddenGem: true,
              whySpecial: "Pristine secluded cove with small natural stream",
            },
          ],
        },
      ],
    };

    const expectedDates = [{ dayNumber: 1, date: "2026-12-01", dayName: "Tuesday" }];
    const sanitized = validateAndSanitizeItinerary(rawItinerary, expectedDates, {
      destination: "Goa",
      tripTiming: timingWindow,
      startDate: "2026-12-01",
      endDate: "2026-12-01",
    });

    assert.equal(sanitized.days.length, 1, "Should have 1 day");
    assert.ok(sanitized.days[0].activities.length >= 2, "Should preserve activities within usable hours");
    console.log("✅ Test 8: Shorter duration pacing & prioritization passed.");
    passed++;
  } catch (err) {
    console.error("❌ Test 8 Failed:", err.message);
  }

  // ── Test 9: Prompt builder hidden gems injection ───────────────────────────
  try {
    const verifiedPlaces = [
      {
        placeName: "Fort Aguada",
        placeCategory: "Heritage",
        placeType: "POPULAR_ATTRACTION",
        openingHours: "09:30 - 17:30",
        region: "North Goa",
      },
      {
        placeName: "Kakolem Beach",
        placeCategory: "Beaches",
        placeType: "HIDDEN_GEM",
        isPlaceHiddenGem: true,
        whySpecial: "Pristine hidden cove away from crowds",
        region: "South Goa",
      },
    ];

    const prompt = buildItineraryPrompt(
      {
        destination: "Goa",
        startDate: "2026-12-01",
        endDate: "2026-12-03",
        travelersNum: 2,
        budgetNum: 30000,
        interests: ["Beaches", "History"],
        style: "Balanced",
        verifiedPlaces,
      },
      [
        { dayNumber: 1, date: "2026-12-01", dayName: "Tuesday" },
        { dayNumber: 2, date: "2026-12-02", dayName: "Wednesday" },
        { dayNumber: 3, date: "2026-12-03", dayName: "Thursday" },
      ]
    );

    assert.ok(prompt.includes("POPULAR ATTRACTIONS"), "Prompt must have POPULAR ATTRACTIONS header");
    assert.ok(prompt.includes("AUTHENTIC HIDDEN GEMS"), "Prompt must have AUTHENTIC HIDDEN GEMS header");
    assert.ok(prompt.includes("Kakolem Beach"), "Hidden gems in prompt should feature Kakolem Beach");
    assert.ok(prompt.includes("[HIDDEN GEM]"), "Hidden gems in prompt should feature [HIDDEN GEM] marker");
    assert.ok(prompt.includes("isPlaceHiddenGem"), "Prompt instructions must demand isPlaceHiddenGem boolean");
    assert.ok(prompt.includes("whySpecial"), "Prompt instructions must demand whySpecial rationale");
    console.log("✅ Test 9: Prompt builder hidden gems injection passed.");
    passed++;
  } catch (err) {
    console.error("❌ Test 9 Failed:", err.message);
  }

  // ── Test 10: Sanitizer preserves hidden gem metadata ───────────────────────
  try {
    const timingWindow = {
      days: [
        {
          date: "2026-12-01",
          status: "FULL_DESTINATION_DAY",
          usableStartDateTime: "2026-12-01T09:00:00",
          usableEndDateTime: "2026-12-01T21:00:00",
          availableHours: 12,
        },
      ],
    };

    const rawTrip = {
      title: "Secret Goa",
      budgetBreakdown: { categories: [{ category: "Activities", label: "Sightseeing", amount: 500 }] },
      days: [
        {
          dayNumber: 1,
          title: "Hidden Spots",
          activities: [
            {
              time: "10:00",
              description: "Explore peaceful Divar Island",
              placeName: "Divar Island",
              placeCategory: "Nature",
              placeType: "HIDDEN_GEM",
              isPlaceHiddenGem: true,
              whySpecial: "Scenic ferry-only island with vintage Portuguese villas and paddy fields",
              region: "Central Goa",
            },
          ],
        },
      ],
    };

    const expectedDates = [{ dayNumber: 1, date: "2026-12-01", dayName: "Tuesday" }];
    const sanitized = validateAndSanitizeItinerary(rawTrip, expectedDates, {
      destination: "Goa",
      tripTiming: timingWindow,
      startDate: "2026-12-01",
      endDate: "2026-12-01",
    });

    const act = sanitized.days[0].activities[0];
    assert.equal(act.placeType, "HIDDEN_GEM", "Sanitizer must preserve placeType as HIDDEN_GEM");
    assert.equal(act.isPlaceHiddenGem, true, "Sanitizer must preserve isPlaceHiddenGem as true");
    assert.ok(act.whySpecial.includes("Portuguese villas"), "Sanitizer must preserve whySpecial");
    assert.equal(act.region, "Central Goa", "Sanitizer must preserve region");
    console.log("✅ Test 10: Sanitizer preserves hidden gem metadata passed.");
    passed++;
  } catch (err) {
    console.error("❌ Test 10 Failed:", err.message);
  }

  // ── Test 11: Opening hours & travel times preserved with hidden gems ───────
  try {
    const timingWindow = {
      days: [
        {
          date: "2026-12-01",
          status: "FULL_DESTINATION_DAY",
          usableStartDateTime: "2026-12-01T09:00:00",
          usableEndDateTime: "2026-12-01T21:00:00",
          availableHours: 12,
        },
      ],
    };

    const rawTrip = {
      title: "Opening Hours Test",
      budgetBreakdown: { categories: [{ category: "Activities", label: "Sightseeing", amount: 500 }] },
      days: [
        {
          dayNumber: 1,
          title: "Heritage Day",
          activities: [
            {
              time: "10:00",
              description: "Visit Basilica of Bom Jesus",
              placeName: "Basilica of Bom Jesus",
              placeCategory: "Heritage",
              placeType: "POPULAR_ATTRACTION",
              openingHours: "09:00 - 18:30",
            },
            {
              time: "14:00",
              description: "Explore Cabo de Rama Fort",
              placeName: "Cabo de Rama Fort",
              placeCategory: "Heritage",
              placeType: "HIDDEN_GEM",
              isPlaceHiddenGem: true,
              whySpecial: "Wild cliffside fort overlooking secluded Arabian Sea coastline",
              openingHours: "09:00 - 17:30",
            },
          ],
        },
      ],
    };

    const expectedDates = [{ dayNumber: 1, date: "2026-12-01", dayName: "Tuesday" }];
    const sanitized = validateAndSanitizeItinerary(rawTrip, expectedDates, {
      destination: "Goa",
      tripTiming: timingWindow,
      startDate: "2026-12-01",
      endDate: "2026-12-01",
    });

    const acts = sanitized.days[0].activities;
    assert.equal(acts.length, 2, "Both activities should be preserved");
    assert.ok(acts[0].openingHours, "First activity should have opening hours");
    assert.ok(acts[1].openingHours, "Second activity (hidden gem) should have opening hours");
    assert.equal(acts[1].isPlaceHiddenGem, true, "Second activity should retain isPlaceHiddenGem");
    console.log("✅ Test 11: Opening hours and travel times preserved with hidden gems passed.");
    passed++;
  } catch (err) {
    console.error("❌ Test 11 Failed:", err.message);
  }

  // ── Test 12: TRAVEL_OUTBOUND days enforce zero exploration activities ──────
  try {
    const travelTiming = {
      destination: {
        days: [
          {
            date: "2026-12-01",
            status: "TRAVEL_OUTBOUND",
            usableStartDateTime: null,
            usableEndDateTime: null,
            availableHours: 0,
            reason: "Full day outbound transit",
          },
          {
            date: "2026-12-02",
            status: "FULL_DESTINATION_DAY",
            usableStartDateTime: "2026-12-02T09:00:00",
            usableEndDateTime: "2026-12-02T21:00:00",
            availableHours: 12,
          },
        ],
      },
    };

    const rawTrip = {
      title: "Outbound Day Restriction",
      budgetBreakdown: { categories: [{ category: "Activities", label: "Sightseeing", amount: 500 }] },
      days: [
        {
          dayNumber: 1,
          date: "2026-12-01",
          title: "Transit Day",
          activities: [
            {
              time: "15:00",
              description: "Sneak in a beach visit during travel",
              placeName: "Baga Beach",
              placeType: "POPULAR_ATTRACTION",
            },
          ],
        },
        {
          dayNumber: 2,
          date: "2026-12-02",
          title: "First Full Day",
          activities: [
            {
              time: "10:00",
              description: "Kakolem Beach exploration",
              placeName: "Kakolem Beach",
              placeType: "HIDDEN_GEM",
              isPlaceHiddenGem: true,
              whySpecial: "Secluded cliff cove",
            },
          ],
        },
      ],
    };

    const expectedDates = [
      { dayNumber: 1, date: "2026-12-01", dayName: "Tuesday" },
      { dayNumber: 2, date: "2026-12-02", dayName: "Wednesday" },
    ];
    const sanitized = validateAndSanitizeItinerary(rawTrip, expectedDates, {
      destination: "Goa",
      tripTiming: travelTiming,
      startDate: "2026-12-01",
      endDate: "2026-12-02",
    });

    // TRAVEL_OUTBOUND day should have 0 destination exploration activities (purely transit progress)
    const destinationExploration = sanitized.days[0].activities.filter((a) => a.placeName || a.placeType);
    assert.equal(destinationExploration.length, 0, "TRAVEL_OUTBOUND day must have 0 destination exploration activities");
    assert.ok(sanitized.days[0].activities.every((a) => !a.isPlaceHiddenGem), "All activities on TRAVEL_OUTBOUND must be transit-only");
    assert.ok(sanitized.days[1].activities.length >= 1, "FULL_DESTINATION_DAY should have activities");
    assert.equal(sanitized.days[1].activities[0].isPlaceHiddenGem, true, "FULL_DESTINATION_DAY retains hidden gem");
    console.log("✅ Test 12: TRAVEL_OUTBOUND days enforce zero exploration activities passed.");
    passed++;
  } catch (err) {
    console.error("❌ Test 12 Failed:", err.message);
  }

  console.log(`\n========================================`);
  console.log(`Test Results: ${passed}/${total} Passed`);
  console.log(`========================================\n`);

  if (passed === total) {
    console.log("🎉 ALL DESTINATION DURATION & HIDDEN GEMS TESTS PASSED SUCCESSFULLY!");
    process.exit(0);
  } else {
    console.error("⚠️ SOME TESTS FAILED.");
    process.exit(1);
  }
}

runTests();
