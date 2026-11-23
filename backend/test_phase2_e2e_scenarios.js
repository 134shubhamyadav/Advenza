/**
 * ADVENZA — PHASE 2: END-TO-END TRIP GENERATION VALIDATION & RELIABILITY TEST SUITE
 *
 * Validates realistic travel scenarios, multi-agent orchestration, geographic verification,
 * railway timeline calculations, budget feasibility, and accommodation resolution.
 */

import assert from "node:assert/strict";
import { computeJourneys, calculateTripTiming } from "./services/travel/journey-engine.service.js";
import { osrmRoutingService } from "./services/travel/osrm-routing.service.js";
import { transportProvider } from "./services/travel/providers/transport.provider.js";
import { hotelProvider } from "./services/travel/providers/hotel.provider.js";
import { accommodationAgent, ACCOMMODATION_TYPES } from "./services/ai/orchestrator/accommodation.agent.js";
import { budgetIntelligenceAgent } from "./services/ai/orchestrator/budget-intelligence.agent.js";
import { destinationDisambiguationService } from "./services/places/destination-disambiguation.service.js";
import { orchestratorService } from "./services/ai/orchestrator/orchestrator.service.js";
import { aiService } from "./services/ai/ai.service.js";

const results = [];

function recordTest(num, name, passed, details = "") {
  results.push({
    num,
    name,
    passed,
    details: typeof details === "object" ? JSON.stringify(details) : String(details),
  });
  console.log(`${passed ? "✅ PASS" : "❌ FAIL"} [Check ${num}] ${name}`);
  if (!passed && details) {
    console.error(`   Details: ${typeof details === "object" ? JSON.stringify(details, null, 2) : details}`);
  }
}

async function runPhase2Validation() {
  console.log("===============================================================================");
  console.log("       ADVENZA PHASE 2: END-TO-END VALIDATION & RELIABILITY SUITE              ");
  console.log("===============================================================================\n");

  // ─────────────────────────────────────────────────────────────────────────────
  // CHECK 2: Scenario B — Nearby Local Trip (Bhandup to Mulund, Mumbai, 1 day)
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    const bhandupCoords = { lat: 19.1458, lon: 72.9365 };
    const mulundCoords = { lat: 19.1726, lon: 72.9565 };

    const roadRoute = await osrmRoutingService.calculateDrivingRoute({
      origin: bhandupCoords,
      destination: mulundCoords,
    });

    assert.ok(roadRoute != null, "OSRM road route calculated");
    // Road distance between Bhandup and Mulund along LBS Marg is ~4 to 7 km
    assert.ok(roadRoute.distanceKm >= 3 && roadRoute.distanceKm <= 8, `Distance between Bhandup and Mulund ~4-7km, got ${roadRoute.distanceKm}km`);
    // Road distance must be explicitly labelled
    assert.equal(roadRoute.distanceLabel, "road distance", `Distance labelled 'road distance'`);
    assert.equal(roadRoute.trafficStatus, "FREE_FLOW_ESTIMATE", `Traffic condition labelled free-flow estimate, not live traffic`);

    // Transport provider verification
    const transportResult = await transportProvider.calculateIntercityTransit({
      origin: "Bhandup, Mumbai",
      destination: "Mulund, Mumbai",
      mode: "driving",
    });

    assert.equal(transportResult.distanceLabel, "road distance", "Transport provider labels road distance");
    assert.equal(transportResult.priceType, "ESTIMATED", "Transport provider labels fuel/tolls as ESTIMATED, not OSRM live");
    assert.notEqual(transportResult.trafficStatus, "LIVE_ROUTING", "Does not claim public OSRM is live traffic");

    recordTest(2, "Scenario B: Nearby Local Trip (Bhandup to Mulund Road Distance ~4-6 km, Non-Live Attribution)", true, {
      distanceKm: roadRoute.distanceKm,
      distanceLabel: roadRoute.distanceLabel,
      trafficStatus: roadRoute.trafficStatus,
      durationMins: roadRoute.durationMins,
    });
  } catch (err) {
    recordTest(2, "Scenario B: Nearby Local Trip", false, err.message);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CHECK 3: Scenario C — Free Accommodation (Relative's Home / Own Home)
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    const stayResult = await accommodationAgent.evaluate({
      destination: "Pune",
      preference: ACCOMMODATION_TYPES.RELATIVES_HOME,
      nights: 3,
      travelers: 2,
    });

    assert.equal(stayResult.isFreeAccommodation, true, "isFreeAccommodation must be true");
    assert.equal(stayResult.totalAccommodationCostINR, 0, "totalAccommodationCostINR must be exactly 0");

    const budgetEval = budgetIntelligenceAgent.evaluate({
      userBudget: 5000,
      transportCost: 1200,
      lastMileCost: 400,
      accommodationResult: stayResult,
      durationDays: 3,
      travelers: 2,
    });

    assert.equal(budgetEval.breakdown.accommodation.total, 0, "Budget breakdown assigns ₹0 to accommodation");
    assert.equal(budgetEval.breakdown.accommodation.isFree, true, "Breakdown flags isFree: true");

    recordTest(3, "Scenario C: Free Accommodation (₹0 Lodging Expense, Relative's Home)", true, {
      preference: stayResult.preference,
      totalAccommodationCostINR: stayResult.totalAccommodationCostINR,
      isFreeAccommodation: stayResult.isFreeAccommodation,
      budgetAccommodationTotal: budgetEval.breakdown.accommodation.total,
    });
  } catch (err) {
    recordTest(3, "Scenario C: Free Accommodation", false, err.message);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CHECK 4: Scenario D — Budget Infeasibility Detection
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    // A 4-day trip to Kochi for 2 persons with insufficient userBudget of ₹1,500
    const stayHostel = await accommodationAgent.evaluate({
      destination: "Kochi",
      preference: ACCOMMODATION_TYPES.BUDGET,
      nights: 3,
      travelers: 2,
    });

    const budgetEval = budgetIntelligenceAgent.evaluate({
      userBudget: 1500, // Deficit budget
      transportCost: 3200, // Mandatory train round trip
      lastMileCost: 600,
      accommodationResult: stayHostel,
      durationDays: 4,
      travelers: 2,
      destinationPriceTier: "standard",
    });

    assert.equal(budgetEval.isFeasible, false, "Must detect budget infeasibility");
    assert.equal(budgetEval.budgetStatus, "EXCEEDS_BUDGET", "Status must be EXCEEDS_BUDGET");
    assert.ok(budgetEval.shortfallAmountINR > 0, `Shortfall must be > 0, got ₹${budgetEval.shortfallAmountINR}`);
    assert.equal(budgetEval.userBudgetINR, 1500, "User budget is preserved without silent inflation");
    assert.ok(budgetEval.costDrivers.length > 0, "Cost drivers identified");
    assert.ok(budgetEval.actionableSavingsOptions.length > 0, "Savings options provided");

    recordTest(4, "Scenario D: Budget Infeasibility Detection (Shortfall Identified, No Silent Budget Inflation)", true, {
      userBudget: budgetEval.userBudgetINR,
      totalEstimated: budgetEval.totalEstimatedBudgetINR,
      shortfall: budgetEval.shortfallAmountINR,
      budgetStatus: budgetEval.budgetStatus,
      costDrivers: budgetEval.costDrivers.slice(0, 2),
    });
  } catch (err) {
    recordTest(4, "Scenario D: Budget Infeasibility Detection", false, err.message);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CHECK 5: Scenario E — Ambiguous Destination Disambiguation (Hyderabad)
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    const disambiguation = await destinationDisambiguationService.disambiguate("Hyderabad");

    assert.ok(disambiguation != null, "Disambiguation response received");
    assert.equal(disambiguation.isAmbiguous, true, "Hyderabad flagged as ambiguous");
    assert.ok(Array.isArray(disambiguation.candidates) && disambiguation.candidates.length >= 2, "Contains at least 2 candidates");

    const countries = disambiguation.candidates.map((c) => c.country);
    assert.ok(countries.includes("India"), "Candidates include Hyderabad, India");
    assert.ok(countries.includes("Pakistan"), "Candidates include Hyderabad, Pakistan");

    // Coordinates must be valid and non-zero
    for (const c of disambiguation.candidates) {
      assert.ok(c.coordinates.lat !== 0 && c.coordinates.lng !== 0, `Valid coordinates for ${c.name}, ${c.country}`);
    }

    recordTest(5, "Scenario E: Ambiguous Destination Disambiguation (India vs Pakistan, Non-Zero Coords)", true, {
      query: "Hyderabad",
      isAmbiguous: disambiguation.isAmbiguous,
      candidatesCount: disambiguation.candidates.length,
      countries,
    });
  } catch (err) {
    recordTest(5, "Scenario E: Ambiguous Destination Disambiguation", false, err.message);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CHECK 6: Geographic Verification Rules (Haversine Straight-Line & OSRM Road Distance)
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    // (0,0) coordinate rejection
    const invalidRoute = await osrmRoutingService.calculateDrivingRoute({
      origin: { lat: 0, lon: 0 },
      destination: { lat: 19.076, lon: 72.8777 },
    });
    assert.equal(invalidRoute, null, "Must reject (0,0) coordinates");

    const invalidTransit = await transportProvider.calculateIntercityTransit({
      origin: "Null Island",
      destination: "Mumbai",
      mode: "driving",
    });
    // Either null or UNAVAILABLE
    assert.ok(invalidTransit.status === "UNAVAILABLE" || invalidTransit.disclaimer?.includes("0,0") || invalidTransit.disclaimer?.includes("geodesic"),
      "Null Island transit handled safely");

    recordTest(6, "Geographic Verification: Null Island (0,0) Rejection & Distance Labelling", true, {
      nullIslandRejected: invalidRoute === null,
      transitSafeHandling: true,
    });
  } catch (err) {
    recordTest(6, "Geographic Verification Rules", false, err.message);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CHECK 7: Accommodation Search & Curated Inventory Reliability
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    // Ayodhya Search
    const ayodhyaHotels = await hotelProvider.searchHotels({
      destination: "Ayodhya",
      checkIn: "2026-11-19",
      checkOut: "2026-11-22",
      guests: 2,
    });
    assert.ok(ayodhyaHotels.results.length >= 4, `Ayodhya curated stays >= 4, got ${ayodhyaHotels.results.length}`);
    assert.equal(ayodhyaHotels.source, "CURATED_STATIC_CATALOG", "Sourced from CURATED_STATIC_CATALOG");
    assert.equal(ayodhyaHotels.isLive, false, "isLive is false (static curated)");

    // Kochi Search
    const kochiHotels = await hotelProvider.searchHotels({
      destination: "Kochi",
      checkIn: "2026-11-20",
      checkOut: "2026-11-24",
      guests: 2,
    });
    assert.ok(kochiHotels.results.length >= 2, `Kochi curated stays >= 2, got ${kochiHotels.results.length}`);

    // Missing destination safety check
    const emptyDestHotels = await hotelProvider.searchHotels({ destination: "" });
    assert.equal(emptyDestHotels.results.length, 0, "Empty destination returns 0 results safely");

    recordTest(7, "Accommodation Search: Curated Stays for Ayodhya & Kochi (Explicit Static Labelling)", true, {
      ayodhyaStaysCount: ayodhyaHotels.results.length,
      kochiStaysCount: kochiHotels.results.length,
      classification: ayodhyaHotels.source,
    });
  } catch (err) {
    recordTest(7, "Accommodation Search & Curated Inventory", false, err.message);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CHECK 8: Multi-Agent Orchestration & Research Integration
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    const researchDossier = await orchestratorService.conductComprehensiveResearch({
      destination: "Kochi",
      origin: "Mumbai",
      interests: ["Beaches", "Local Food", "Heritage"],
      travelers: 2,
      durationDays: 4,
      userBudget: 8000,
      preferredTransportMode: "Train",
      accommodationPreference: "BUDGET",
    });

    assert.ok(researchDossier != null, "Research dossier returned");
    assert.ok(researchDossier.destination != null, "Destination research present");
    assert.ok(researchDossier.transportation != null, "Transportation research present");
    assert.ok(researchDossier.accommodation != null, "Accommodation research present");
    assert.ok(researchDossier.budget != null, "Budget intelligence present");
    assert.ok(researchDossier.verificationAudit != null, "Verification audit present");
    assert.ok(researchDossier.audit != null, "Agent audit telemetry present");

    recordTest(8, "Multi-Agent Orchestration: Complete Research Dossier & Verification Agent Audit", true, {
      destination: researchDossier.destination.destinationName,
      bestTransport: researchDossier.transportation.bestOption,
      budgetFeasible: researchDossier.budget.isFeasible,
      agentsExecuted: Object.keys(researchDossier.audit.agents || {}).length,
    });
  } catch (err) {
    recordTest(8, "Multi-Agent Orchestration", false, err.message);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CHECK 9: Regenerate Itinerary Variable Scope & Safety
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    // Verify that regenerateItinerary does not reference undeclared variables
    const regenStr = aiService.regenerateItinerary.toString();
    assert.ok(regenStr.includes("const accommodation ="), "accommodation is declared in regenerateItinerary");
    assert.ok(regenStr.includes("let researchDossier ="), "researchDossier is declared in regenerateItinerary");

    recordTest(9, "Regenerate Itinerary: Scope Integrity (accommodation & researchDossier Declared)", true, {
      accommodationDeclared: true,
      researchDossierDeclared: true,
    });
  } catch (err) {
    recordTest(9, "Regenerate Itinerary Variable Scope", false, err.message);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CHECK 10: Authentication Gatekeeper & IDOR Security
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    // Test that protected travel endpoints reject requests without token
    const fetchRes = await fetch("http://localhost:5000/api/travel/hotels/search?destination=Ayodhya");
    const json = await fetchRes.json();

    assert.equal(fetchRes.status, 401, `Status must be 401 Unauthorized, got ${fetchRes.status}`);
    assert.ok(json.error?.includes("Unauthorized"), `Error message must indicate Unauthorized, got: ${json.error}`);

    recordTest(10, "Security: Protected Travel Endpoints Require Authentication (401 on missing token)", true, {
      httpStatus: fetchRes.status,
      errorResponse: json.error,
    });
  } catch (err) {
    recordTest(10, "Authentication Gatekeeper Security", false, err.message);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n===============================================================================");
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;
  console.log(`TOTAL CHECKS: ${total} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("===============================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase2Validation();
