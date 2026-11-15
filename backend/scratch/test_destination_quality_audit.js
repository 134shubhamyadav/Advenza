/**
 * Quality Audit Test Suite: Smart Destination Duration & Hidden Gems Intelligence
 *
 * Rigorously verifies:
 * 1. Multi-signal hidden gem classification (CONFIRMED_HIDDEN_GEM, POTENTIAL_HIDDEN_GEM, POPULAR_ATTRACTION, UNCLASSIFIED)
 * 2. Commercial chain and generic utility exclusions (no fast food or ATMs as gems)
 * 3. Low-review count rejection (under 40 reviews rejected even if 5.0★)
 * 4. High-volume tourist attraction classification (>= 5000 reviews is POPULAR_ATTRACTION)
 * 5. End-to-end real destination tests:
 *    - Goa (multi-cluster, confirmed gems, day trips, recommended duration >= 5)
 *    - Jaipur (heritage clusters, Panna Meena ka Kund, Amer Fort, recommended duration >= 4)
 *    - Unknown / uncataloged destination (conservative baseline, 0 invented counts, uncertain notice)
 * 6. Deduplication and clustering in duration calculation
 * 7. Sanitizer anti-hallucination verification (unverified places cannot self-certify as gems)
 * 8. Popular attractions are strictly barred from displaying hidden gem badges
 */

import assert from "node:assert/strict";
import { placeDiscoveryService } from "../services/places/place-discovery.service.js";
import { destinationDurationService } from "../services/places/destination-duration.service.js";
import { validateAndSanitizeItinerary } from "../services/itinerary/itinerary-sanitizer.js";

async function runQualityAudit() {
  console.log("==============================================================");
  console.log("ADVENZA — DESTINATION INTELLIGENCE FINAL QUALITY AUDIT SUITE");
  console.log("==============================================================\n");

  let passed = 0;
  let total = 10;

  // ── Test 1: Multi-signal classification - Commercial Chains & Utilities Rejected ──
  try {
    const chainPlace = {
      name: "Starbucks Coffee & Cafe",
      rating: 4.8,
      userRatingsCount: 300,
      types: ["cafe", "food"],
    };
    const c1 = placeDiscoveryService.classifyPlace(chainPlace);
    assert.equal(c1.gemConfidence, "UNCLASSIFIED", "Commercial chain must be UNCLASSIFIED");
    assert.equal(c1.isPlaceHiddenGem, false, "Commercial chain cannot be a hidden gem");

    const gasStation = {
      name: "Highway Fuel & Mart",
      rating: 4.6,
      userRatingsCount: 150,
      types: ["gas_station", "convenience_store"],
    };
    const c2 = placeDiscoveryService.classifyPlace(gasStation);
    assert.equal(c2.gemConfidence, "UNCLASSIFIED", "Gas station must be UNCLASSIFIED");
    assert.equal(c2.isPlaceHiddenGem, false, "Gas station cannot be a hidden gem");

    console.log("  ✓ Test 1: Commercial chains and utility amenities are rejected from gem status");
    passed++;
  } catch (err) {
    console.error("  ❌ Test 1 Failed:", err.message);
  }

  // ── Test 2: Multi-signal classification - Low Review Count Rejection ─────────
  try {
    const obscurePlace = {
      name: "Random Brand New Corner Shack",
      rating: 5.0,
      userRatingsCount: 12, // insufficient reviews to verify
      types: ["restaurant"],
    };
    const c = placeDiscoveryService.classifyPlace(obscurePlace);
    assert.equal(c.gemConfidence, "UNCLASSIFIED", "Places with < 40 reviews must be UNCLASSIFIED");
    assert.equal(c.isPlaceHiddenGem, false, "Under-reviewed places cannot be certified as gems");

    console.log("  ✓ Test 2: Low-review places (<40 reviews) rejected without sufficient evidence");
    passed++;
  } catch (err) {
    console.error("  ❌ Test 2 Failed:", err.message);
  }

  // ── Test 3: Multi-signal classification - High Volume Mainstream Attraction ──
  try {
    const megaLandmark = {
      name: "Baga Beach Promenade",
      rating: 4.5,
      userRatingsCount: 28000,
      types: ["tourist_attraction", "natural_feature"],
    };
    const c = placeDiscoveryService.classifyPlace(megaLandmark);
    assert.equal(c.gemConfidence, "POPULAR_ATTRACTION", "High-volume places must be POPULAR_ATTRACTION");
    assert.equal(c.isPlaceHiddenGem, false, "Mass tourist attractions cannot be hidden gems");

    console.log("  ✓ Test 3: High-volume tourist attractions (>=5000 reviews) classified as POPULAR_ATTRACTION");
    passed++;
  } catch (err) {
    console.error("  ❌ Test 3 Failed:", err.message);
  }

  // ── Test 4: Multi-signal classification - Standout Discovery Sweet Spot ──────
  try {
    const discoveryGem = {
      name: "Chorão Island Bird Sanctuary & Mangrove Trail",
      rating: 4.7,
      userRatingsCount: 420,
      types: ["scenic_viewpoint", "park", "natural_feature"],
    };
    const c = placeDiscoveryService.classifyPlace(discoveryGem);
    assert.equal(c.gemConfidence, "POTENTIAL_HIDDEN_GEM", "Standout niche place in sweet spot should be POTENTIAL_HIDDEN_GEM");
    assert.equal(c.isPlaceHiddenGem, true, "Should be flagged as a hidden gem");
    assert.ok(c.whySpecial && c.whySpecial.length > 10, "Must have grounded whySpecial");

    console.log("  ✓ Test 4: Standout experiential discovery with 40-3500 reviews classified as POTENTIAL_HIDDEN_GEM");
    passed++;
  } catch (err) {
    console.error("  ❌ Test 4 Failed:", err.message);
  }

  // ── Test 5: End-to-End Test: Goa ───────────────────────────────────────────
  try {
    const goa = await destinationDurationService.getDestinationOverview({
      destination: "Goa",
      interests: ["Beaches", "History"],
    });

    assert.equal(goa.destination, "Goa");
    assert.equal(goa.dataConfidence, "VERIFIED");
    assert.ok(goa.durationRecommendation.recommendedDays >= 5, "Goa recommended days must be >= 5");
    assert.ok(goa.durationRecommendation.popularAttractionsCount >= 3, "Goa must have popular attractions");
    assert.ok(goa.durationRecommendation.hiddenGemsCount >= 3, "Goa must have verified hidden gems");
    assert.ok(goa.durationRecommendation.regions.length >= 2, "Goa must have distinct geographic clusters");
    assert.ok(goa.durationRecommendation.dayTrips.length >= 1, "Goa must include curated day trips");

    // Verify hidden gems in Goa have CONFIRMED_HIDDEN_GEM confidence
    for (const gem of goa.durationRecommendation.hiddenGemHighlights) {
      assert.equal(gem.gemConfidence, "CONFIRMED_HIDDEN_GEM");
      assert.ok(gem.whySpecial && gem.whySpecial.length > 10);
    }

    console.log("  ✓ Test 5: End-to-End Goa test passed (multi-region, confirmed gems, day trips)");
    passed++;
  } catch (err) {
    console.error("  ❌ Test 5 Failed:", err.message);
  }

  // ── Test 6: End-to-End Test: Jaipur ─────────────────────────────────────────
  try {
    const jaipur = await destinationDurationService.getDestinationOverview({
      destination: "Jaipur",
      interests: ["Culture", "Architecture"],
    });

    assert.equal(jaipur.destination, "Jaipur");
    assert.equal(jaipur.dataConfidence, "VERIFIED");
    assert.ok(jaipur.durationRecommendation.recommendedDays >= 4, "Jaipur recommended days must be >= 4");
    assert.ok(jaipur.durationRecommendation.popularAttractionsCount >= 2, "Jaipur must have popular attractions");
    assert.ok(jaipur.durationRecommendation.hiddenGemsCount >= 2, "Jaipur must have verified hidden gems");

    // Amer Fort should be popular, Panna Meena ka Kund should be hidden gem
    const hasAmer = jaipur.durationRecommendation.popularHighlights.some((p) => p.name.includes("Amer Fort"));
    const hasPannaMeena = jaipur.durationRecommendation.hiddenGemHighlights.some((g) => g.name.includes("Panna Meena"));
    assert.ok(hasAmer, "Amer Fort must be in popular highlights");
    assert.ok(hasPannaMeena, "Panna Meena ka Kund must be in hidden gem highlights");

    console.log("  ✓ Test 6: End-to-End Jaipur test passed (Amer Fort popular vs Panna Meena gem)");
    passed++;
  } catch (err) {
    console.error("  ❌ Test 6 Failed:", err.message);
  }

  // ── Test 7: End-to-End Test: Unknown / Uncataloged Destination ──────────────
  try {
    const unknownDest = "ZanskarHighMountainPass99";
    const unknown = await destinationDurationService.getDestinationOverview({
      destination: unknownDest,
      interests: ["Hiking"],
    });

    assert.equal(unknown.destination, unknownDest);
    assert.equal(unknown.dataConfidence, "UNCERTAIN_BASELINE", "Unknown destination must report UNCERTAIN_BASELINE");
    assert.equal(unknown.isUncertain, true, "Must flag isUncertain: true");
    assert.ok(unknown.uncertaintyReason.includes("No verified local"), "Must provide honest uncertaintyReason");

    // Strictly 0 invented counts and 0 fabricated places
    assert.equal(unknown.durationRecommendation.popularAttractionsCount, 0, "No popular attractions fabricated");
    assert.equal(unknown.durationRecommendation.hiddenGemsCount, 0, "No hidden gems fabricated");
    assert.equal(unknown.durationRecommendation.popularHighlights.length, 0, "No invented popular highlights");
    assert.equal(unknown.durationRecommendation.hiddenGemHighlights.length, 0, "No invented gem highlights");
    assert.equal(unknown.durationRecommendation.regions.length, 0, "No invented regions");

    // Conservative baseline pacing
    assert.equal(unknown.durationRecommendation.minimumDays, 2);
    assert.equal(unknown.durationRecommendation.recommendedDays, 4);
    assert.equal(unknown.durationRecommendation.extendedDays, 6);

    console.log("  ✓ Test 7: Unknown destination handled with honest uncertainty & 0 fabricated places");
    passed++;
  } catch (err) {
    console.error("  ❌ Test 7 Failed:", err.message);
  }

  // ── Test 8: Deduplication and Clustering in Duration Calculation ───────────
  try {
    // 5 places with 2 duplicate names in the same region
    const rawPlaces = [
      { placeName: "Fort Aguada", region: "North Goa Coast", placeType: "POPULAR_ATTRACTION" },
      { placeName: "fort aguada", region: "North Goa Coast", placeType: "POPULAR_ATTRACTION" }, // duplicate!
      { placeName: "FORT AGUADA", region: "North Goa Coast", placeType: "POPULAR_ATTRACTION" }, // duplicate!
      { placeName: "Sinquerim Beach", region: "North Goa Coast", placeType: "POPULAR_ATTRACTION" },
    ];

    const duration = destinationDurationService.calculateDynamicDuration({
      destination: "Goa",
      popularAttractions: rawPlaces,
      hiddenGems: [],
      regions: [{ name: "North Goa Coast", count: 2 }],
      interests: [],
      isCurated: true,
    });

    // 2 unique places in 1 cluster should require only 2-3 minimum days, not inflated by duplicates
    assert.ok(duration.minimumDays <= 3, "Duplicates must not inflate minimum duration");
    assert.ok(duration.recommendedDays <= 5, "Duplicates must not inflate recommended duration");

    console.log("  ✓ Test 8: Place deduplication prevents artificial duration inflation");
    passed++;
  } catch (err) {
    console.error("  ❌ Test 8 Failed:", err.message);
  }

  // ── Test 9: Sanitizer Anti-Hallucination: AI cannot self-certify gems ────────
  try {
    const rawAIItinerary = {
      title: "Secret Journey",
      budgetBreakdown: { categories: [{ category: "Activities", label: "Sightseeing", amount: 500 }] },
      days: [
        {
          dayNumber: 1,
          title: "Day 1",
          activities: [
            {
              time: "10:00",
              description: "Secret Beach Cove",
              placeName: "Hallucinated Non-Existent Beach",
              isPlaceHiddenGem: true, // AI trying to self-certify!
              placeType: "HIDDEN_GEM",
              whySpecial: "Fake mythological folklore invented by AI",
            },
          ],
        },
      ],
    };

    const expectedDates = [{ dayNumber: 1, date: "2026-12-01", dayName: "Tuesday" }];
    const sanitized = validateAndSanitizeItinerary(rawAIItinerary, expectedDates, {
      destination: "Goa",
      verifiedPlaces: [], // No verified match!
      startDate: "2026-12-01",
      endDate: "2026-12-01",
    });

    const act = sanitized.days[0].activities[0];
    assert.equal(act.isPlaceHiddenGem, false, "Sanitizer must reject self-certified unverified gem");
    assert.equal(act.gemConfidence, "UNCLASSIFIED", "Unverified place must be UNCLASSIFIED");
    assert.equal(act.whySpecial, "", "Fake whySpecial must be cleared");

    console.log("  ✓ Test 9: Sanitizer strips unverified self-certified hidden gem claims");
    passed++;
  } catch (err) {
    console.error("  ❌ Test 9 Failed:", err.message);
  }

  // ── Test 10: Popular attractions never receive hidden gem badges ───────────
  try {
    const verifiedPlaces = [
      {
        placeName: "Fort Aguada",
        placeCategory: "History",
        placeType: "POPULAR_ATTRACTION",
        gemConfidence: "POPULAR_ATTRACTION",
        isPlaceHiddenGem: false,
        verificationStatus: "CURATED_VERIFIED",
        region: "North Goa Coast",
      },
    ];

    const rawAIItinerary = {
      title: "Goa Trip",
      budgetBreakdown: { categories: [{ category: "Activities", label: "Sightseeing", amount: 500 }] },
      days: [
        {
          dayNumber: 1,
          title: "Day 1",
          activities: [
            {
              time: "10:00",
              description: "Visit Fort Aguada",
              placeName: "Fort Aguada",
              isPlaceHiddenGem: true, // AI mistakenly marked popular landmark as gem
              placeType: "HIDDEN_GEM",
            },
          ],
        },
      ],
    };

    const expectedDates = [{ dayNumber: 1, date: "2026-12-01", dayName: "Tuesday" }];
    const sanitized = validateAndSanitizeItinerary(rawAIItinerary, expectedDates, {
      destination: "Goa",
      verifiedPlaces,
      startDate: "2026-12-01",
      endDate: "2026-12-01",
    });

    const act = sanitized.days[0].activities[0];
    assert.equal(act.isPlaceHiddenGem, false, "Popular attraction must NEVER have isPlaceHiddenGem: true");
    assert.equal(act.gemConfidence, "POPULAR_ATTRACTION", "Must retain POPULAR_ATTRACTION confidence");
    assert.equal(act.placeType, "POPULAR_ATTRACTION", "Must retain POPULAR_ATTRACTION placeType");

    console.log("  ✓ Test 10: Popular attractions are strictly barred from receiving hidden gem badges");
    passed++;
  } catch (err) {
    console.error("  ❌ Test 10 Failed:", err.message);
  }

  console.log("\n==============================================================");
  console.log(`QUALITY AUDIT SUITE RESULTS: ${passed}/${total} Passed`);
  console.log("==============================================================\n");

  if (passed === total) {
    console.log("🎉 ALL QUALITY AUDIT TESTS PASSED WITH 100% SUCCESS!");
    process.exit(0);
  } else {
    console.error("⚠️ SOME QUALITY AUDIT TESTS FAILED.");
    process.exit(1);
  }
}

runQualityAudit();

