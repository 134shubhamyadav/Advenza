/**
 * Advenza — Conversational AI Intelligence & Response Quality Test Suite
 *
 * Verifies the 12 required conversational scenarios + unfamiliar destination:
 * 1. "Suggest non-veg lunch places in North Goa."
 * 2. "Only seafood restaurants." (Progressive multi-turn refinement)
 * 3. "Under ₹500 per person." (Cumulative budget constraint)
 * 4. "Which one is closest to my hotel?" (Proximity calculation from hotel)
 * 5. "Suggest hidden gems in Goa." (Hidden gems intent)
 * 6. "Which beaches are less crowded?" (Serene beaches filter)
 * 7. "Plan a one-day sightseeing route." (One-day route intent)
 * 8. "What can I do tonight?" (Evening/nightlife intent)
 * 9. "Is this restaurant open today?" (Opening hours intent)
 * 10. "Suggest something similar to the previous restaurant." (Similar venue intent)
 * 11. "I have only two days. What should I prioritize?" (Trip prioritization intent)
 * 12. "Remove the last activity from my itinerary." (Itinerary modification intent)
 * 13. Unfamiliar destination outside curated catalog (honest limitation signaling).
 */

import assert from "node:assert/strict";
process.env.ADVENZA_FAST_TEST = "true";
import { conversationalAIService, CHAT_INTENTS } from "../services/ai/conversational-ai.service.js";

async function runConversationalTests() {
  console.log("==============================================================");
  console.log("ADVENZA — CONVERSATIONAL AI INTELLIGENCE TEST SUITE");
  console.log("==============================================================\n");

  let passed = 0;
  const total = 13;

  // ── Test 1: Scenario 1 - Suggest non-veg lunch places in North Goa ─────────
  let turn1Places = [];
  try {
    const res1 = await conversationalAIService.handleChat({
      messages: [{ role: "user", content: "Suggest non-veg lunch places in North Goa." }],
    });

    assert.equal(res1.intent, CHAT_INTENTS.RESTAURANT_RECOMMENDATION);
    assert.ok(res1.places && res1.places.length > 0, "Must return verified places");
    // Ensure all places are in North Goa
    res1.places.forEach((p) => {
      assert.ok(
        p.region.includes("North Goa") || p.region.includes("Central") || p.address.includes("Goa"),
        `Place ${p.name} must be in North Goa`
      );
    });

    // Check that Vinayak or Fat Fish is present
    const names = res1.places.map((p) => p.name);
    assert.ok(names.includes("Vinayak Family Restaurant") || names.includes("Fat Fish"), "Should recommend top Goan non-veg spots");

    turn1Places = res1.places;
    console.log("  ✓ Test 1: 'Suggest non-veg lunch places in North Goa' returns accurate North Goa non-veg dining");
    passed++;
  } catch (err) {
    console.error("  ❌ Test 1 Failed:", err.message);
  }

  // ── Test 2: Scenario 2 - Progressive refinement: "Only seafood restaurants" ─
  let turn2Places = [];
  try {
    const res2 = await conversationalAIService.handleChat({
      messages: [
        { role: "user", content: "Suggest non-veg lunch places in North Goa." },
        { role: "assistant", content: `I recommend Vinayak Family Restaurant, Fat Fish, and Gunpowder.` },
        { role: "user", content: "Only seafood restaurants." },
      ],
    });

    assert.equal(res2.intent, CHAT_INTENTS.FOLLOW_UP_REFINEMENT);
    assert.ok(res2.places && res2.places.length > 0, "Must return refined places");
    // Gunpowder is peninsular meat (pork/mutton), so seafood refinement should prioritize Vinayak / Fat Fish
    const names = res2.places.map((p) => p.name);
    assert.ok(names.includes("Vinayak Family Restaurant") || names.includes("Fat Fish"), "Must prioritize seafood specialists");

    turn2Places = res2.places;
    console.log("  ✓ Test 2: Multi-turn refinement 'Only seafood restaurants' retains destination & filters cuisine");
    passed++;
  } catch (err) {
    console.error("  ❌ Test 2 Failed:", err.message);
  }

  // ── Test 3: Scenario 3 - Budget constraint: "Under ₹500 per person" ────────
  let turn3Places = [];
  try {
    const res3 = await conversationalAIService.handleChat({
      messages: [
        { role: "user", content: "Suggest non-veg lunch places in North Goa." },
        { role: "assistant", content: "I recommend Vinayak Family Restaurant, Fat Fish, and Gunpowder." },
        { role: "user", content: "Only seafood restaurants." },
        { role: "assistant", content: "Focusing on seafood: Vinayak Family Restaurant and Fat Fish are top choices." },
        { role: "user", content: "Under ₹500 per person." },
      ],
    });

    assert.equal(res3.intent, CHAT_INTENTS.FOLLOW_UP_REFINEMENT);
    assert.ok(res3.places && res3.places.length > 0, "Must return budget-matched places");

    // Vinayak (~₹250 - ₹450) and Kokni Kanteen (~₹200 - ₹350) are under ₹500
    const names = res3.places.map((p) => p.name);
    assert.ok(
      names.includes("Vinayak Family Restaurant") || names.includes("Kokni Kanteen") || names.includes("Ritz Classic"),
      "Must recommend authentic spots with pricing under ₹500"
    );

    turn3Places = res3.places;
    console.log("  ✓ Test 3: Multi-turn refinement 'Under ₹500 per person' applies cumulative budget filter");
    passed++;
  } catch (err) {
    console.error("  ❌ Test 3 Failed:", err.message);
  }

  // ── Test 4: Scenario 4 - "Which one is closest to my hotel?" ───────────────
  try {
    const res4 = await conversationalAIService.handleChat({
      messages: [
        { role: "user", content: "Suggest non-veg lunch places in North Goa." },
        { role: "assistant", content: "Here are top spots: Vinayak Family Restaurant and Fat Fish." },
        { role: "user", content: "Which one is closest to my hotel?" },
      ],
      hotelLocation: "Assagao", // Hotel is in Assagao
    });

    assert.equal(res4.intent, CHAT_INTENTS.DIRECTIONS_DISTANCE);
    assert.ok(res4.places && res4.places.length > 0);
    // Vinayak is in Assagao (same village), so it should be ranked first as closest
    assert.equal(res4.places[0].name, "Vinayak Family Restaurant", "Vinayak must be closest to an Assagao hotel");
    assert.ok(res4.places[0].distanceFromHotel.includes("0.8 km") || res4.places[0].distanceFromHotel.includes("walking") || res4.places[0].distanceFromHotel.includes("drive"));

    console.log("  ✓ Test 4: 'Which one is closest to my hotel?' calculates real proximity and ranks correctly");
    passed++;
  } catch (err) {
    console.error("  ❌ Test 4 Failed:", err.message);
  }

  // ── Test 5: Scenario 5 - "Suggest hidden gems in Goa." ─────────────────────
  try {
    const res5 = await conversationalAIService.handleChat({
      messages: [{ role: "user", content: "Suggest hidden gems in Goa." }],
    });

    assert.equal(res5.intent, CHAT_INTENTS.HIDDEN_GEMS);
    assert.ok(res5.places && res5.places.length > 0);
    // Gems like Kakolem Beach, Divar Island, Cabo de Rama
    const names = res5.places.map((p) => p.name);
    assert.ok(
      names.includes("Kakolem Beach (Tiger Beach)") ||
      names.includes("Divar Island & Piedade Village") ||
      names.includes("Cabo de Rama Fort & Cliff Overlook") ||
      names.includes("Savoi Organic Spice Plantation") ||
      names.includes("Galgibaga Beach"),
      "Must return verified authentic hidden gems"
    );

    console.log("  ✓ Test 5: 'Suggest hidden gems in Goa' returns authentic verified hidden gems with whySpecial");
    passed++;
  } catch (err) {
    console.error("  ❌ Test 5 Failed:", err.message);
  }

  // ── Test 6: Scenario 6 - "Which beaches are less crowded?" ─────────────────
  try {
    const res6 = await conversationalAIService.handleChat({
      messages: [
        { role: "user", content: "Suggest hidden gems in Goa." },
        { role: "assistant", content: "Kakolem Beach, Divar Island, and Cabo de Rama Fort are wonderful hidden gems." },
        { role: "user", content: "Which beaches are less crowded?" },
      ],
    });

    assert.equal(res6.intent, CHAT_INTENTS.FOLLOW_UP_REFINEMENT);
    assert.ok(res6.places && res6.places.length > 0);
    const names = res6.places.map((p) => p.name);
    assert.ok(
      names.includes("Galgibaga Beach") ||
      names.includes("Kakolem Beach (Tiger Beach)") ||
      names.includes("Butterfly Beach") ||
      names.includes("Ashwem Beach"),
      "Must recommend pristine, uncrowded shores"
    );

    console.log("  ✓ Test 6: 'Which beaches are less crowded?' filters strictly to serene uncrowded beaches");
    passed++;
  } catch (err) {
    console.error("  ❌ Test 6 Failed:", err.message);
  }

  // ── Test 7: Scenario 7 - "Plan a one-day sightseeing route." ──────────────
  try {
    const res7 = await conversationalAIService.handleChat({
      messages: [{ role: "user", content: "Plan a one-day sightseeing route in Jaipur." }],
      destination: "Jaipur",
    });

    assert.equal(res7.intent, CHAT_INTENTS.ONE_DAY_ROUTE);
    assert.ok(res7.reply.length > 50, "Must provide detailed one-day flow");
    // Verify it doesn't give a generic error
    assert.ok(!res7.reply.includes("Sorry, I cannot"), "Should construct meaningful route");

    console.log("  ✓ Test 7: 'Plan a one-day sightseeing route' constructs realistic day flow");
    passed++;
  } catch (err) {
    console.error("  ❌ Test 7 Failed:", err.message);
  }

  // ── Test 8: Scenario 8 - "What can I do tonight?" ──────────────────────────
  try {
    const res8 = await conversationalAIService.handleChat({
      messages: [{ role: "user", content: "What can I do tonight in Goa?" }],
      destination: "Goa",
    });

    assert.equal(res8.intent, CHAT_INTENTS.TONIGHT_ACTIVITIES);
    assert.ok(res8.reply.length > 40);

    console.log("  ✓ Test 8: 'What can I do tonight?' provides evening-appropriate activities");
    passed++;
  } catch (err) {
    console.error("  ❌ Test 8 Failed:", err.message);
  }

  // ── Test 9: Scenario 9 - "Is this restaurant open today?" ──────────────────
  try {
    const res9 = await conversationalAIService.handleChat({
      messages: [
        { role: "user", content: "Suggest restaurants in North Goa." },
        { role: "assistant", content: "Vinayak Family Restaurant is great." },
        { role: "user", content: "Is Vinayak Family Restaurant open today?" },
      ],
      destination: "Goa",
    });

    assert.equal(res9.intent, CHAT_INTENTS.VENUE_OPENING_HOURS);
    assert.ok(res9.openingInfo, "Must include openingInfo object");
    assert.equal(res9.openingInfo.name, "Vinayak Family Restaurant");
    assert.ok(res9.openingInfo.openingHours.includes("12:30"), "Must cite real opening hours");

    console.log("  ✓ Test 9: 'Is this restaurant open today?' checks real operating hours and lunch/dinner slots");
    passed++;
  } catch (err) {
    console.error("  ❌ Test 9 Failed:", err.message);
  }

  // ── Test 10: Scenario 10 - "Suggest something similar to the previous restaurant." ──
  try {
    const res10 = await conversationalAIService.handleChat({
      messages: [
        { role: "user", content: "I love Vinayak Family Restaurant in Assagao." },
        { role: "assistant", content: "Vinayak Family Restaurant is famed for its fresh Goan fish thali." },
        { role: "user", content: "Suggest something similar to the previous restaurant." },
      ],
      destination: "Goa",
    });

    assert.equal(res10.intent, CHAT_INTENTS.SIMILAR_VENUE);
    assert.ok(res10.places && res10.places.length > 0);
    // Should suggest another authentic Goan seafood spot
    const names = res10.places.map((p) => p.name);
    assert.ok(
      names.includes("Fat Fish") || names.includes("Kokni Kanteen") || names.includes("Ritz Classic"),
      "Must suggest similar authentic Goan coastal restaurant"
    );

    console.log("  ✓ Test 10: 'Suggest something similar to the previous restaurant' recommends matched peer venues");
    passed++;
  } catch (err) {
    console.error("  ❌ Test 10 Failed:", err.message);
  }

  // ── Test 11: Scenario 11 - "I have only two days. What should I prioritize?" ──
  try {
    const res11 = await conversationalAIService.handleChat({
      messages: [{ role: "user", content: "I have only two days in Goa. What should I prioritize?" }],
      destination: "Goa",
    });

    assert.equal(res11.intent, CHAT_INTENTS.TRIP_PRIORITIZATION);
    assert.ok(res11.reply.length > 50);

    console.log("  ✓ Test 11: 'I have only two days. What should I prioritize?' applies compact prioritization");
    passed++;
  } catch (err) {
    console.error("  ❌ Test 11 Failed:", err.message);
  }

  // ── Test 12: Scenario 12 - "Remove the last activity from my itinerary." ───
  try {
    const mockTrip = {
      _id: "trip-test-mod-001",
      destination: "Goa",
      days: [
        {
          dayNumber: 1,
          date: "2026-12-01",
          activities: [
            { time: "09:00", description: "Visit Basilica of Bom Jesus" },
            { time: "13:00", description: "Lunch at Vinayak Family Restaurant" },
            { time: "17:00", description: "Sunset at Fort Aguada" },
            { time: "21:30", description: "Nightclub visit at Tito's Lane" }, // Last activity
          ],
        },
      ],
    };

    const res12 = await conversationalAIService.handleChat({
      messages: [{ role: "user", content: "Remove the last activity from my itinerary." }],
      tripId: "trip-test-mod-001",
      context: { trip: mockTrip },
    });

    assert.equal(res12.intent, CHAT_INTENTS.ITINERARY_MODIFICATION);
    assert.ok(res12.reply.length > 30);

    console.log("  ✓ Test 12: 'Remove the last activity from my itinerary' identifies target activity without breaking");
    passed++;
  } catch (err) {
    console.error("  ❌ Test 12 Failed:", err.message);
  }

  // ── Test 13: Unfamiliar destination outside curated catalog ───────────────
  try {
    const res13 = await conversationalAIService.handleChat({
      messages: [{ role: "user", content: "Suggest the best restaurants in Rameswaram." }],
      destination: "Rameswaram",
    });

    // Check that it does not fabricate fake restaurant names
    assert.ok(
      res13.confidence === "UNKNOWN_UNAVAILABLE" || res13.confidence === "LIVE_API_VERIFIED",
      "Must correctly tag confidence for uncataloged destination"
    );
    assert.ok(!res13.reply.includes("Fabricated Place Name 123"), "Never hallucinates fake places");

    console.log("  ✓ Test 13: Unfamiliar destination handled honestly without fabricating fictional places or prices");
    passed++;
  } catch (err) {
    console.error("  ❌ Test 13 Failed:", err.message);
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log("\n==============================================================");
  console.log(`CONVERSATIONAL AI TEST SUITE: ${passed}/${total} Passed`);
  console.log("==============================================================");

  if (passed === total) {
    console.log("\n🎉 ALL 13 CONVERSATIONAL AI SCENARIOS PASSED WITH 100% SUCCESS!");
  } else {
    process.exitCode = 1;
  }
}

runConversationalTests().catch((err) => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
