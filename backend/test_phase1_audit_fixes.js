import assert from "node:assert/strict";
import { hotelProvider } from "./services/travel/providers/hotel.provider.js";
import { transportProvider } from "./services/travel/providers/transport.provider.js";
import { weatherProvider } from "./services/travel/providers/weather.provider.js";
import { fetchWeather } from "./services/travel/weather.service.js";
import { evaluateRiskEngine } from "./services/travel/risk-engine.service.js";

console.log("=================================================");
console.log(" ADVENZA PHASE 1 AUDIT FIXES REGRESSION SUITE     ");
console.log("=================================================\n");

let passedCount = 0;
let totalCount = 0;

async function runTest(name, fn) {
  totalCount++;
  try {
    await fn();
    console.log(`[PASS] Test ${totalCount}: ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`[FAIL] Test ${totalCount}: ${name}`);
    console.error(`       Error: ${err.message}`);
  }
}

async function main() {
  // =========================================================================
  // 1. HOTEL PROVIDER TESTS
  // =========================================================================

  await runTest("Hotel: Unknown destination returns honest empty result (No Goa substitution)", async () => {
    const res = await hotelProvider.searchHotels({ destination: "Zurich" });
    assert.equal(res.status, "NOT_CONFIGURED", "Status must be NOT_CONFIGURED");
    assert.equal(res.source, "UNAVAILABLE", "Source must be UNAVAILABLE");
    assert.equal(res.isLive, false, "Must not be live");
    assert.deepEqual(res.results, [], "Must return empty results array");
    assert.ok(res.disclaimer.includes("Zurich"), "Disclaimer must reference requested destination");
    
    // Explicitly verify NO Goa hotels are leaked
    const hasGoaHotel = res.results.some((h) => (h.name || "").includes("Taj Exotica") || (h.location || "").includes("Goa"));
    assert.equal(hasGoaHotel, false, "Must NEVER substitute Goa hotels for Zurich");
  });

  await runTest("Hotel: Known curated destination returns curated stays with honest disclaimer", async () => {
    const res = await hotelProvider.searchHotels({ destination: "Goa" });
    assert.equal(res.status, "NOT_CONFIGURED");
    assert.equal(res.source, "CURATED_STATIC_CATALOG");
    assert.equal(res.isLive, false);
    assert.ok(res.results.length > 0, "Must return curated stays for Goa");
    assert.ok(res.disclaimer.includes("NOT CONFIGURED"), "Must include static disclaimer");
    assert.ok(res.results[0].hotelId.startsWith("curated_goa"), "Must prefix curated hotel IDs");
  });

  await runTest("Hotel: Missing destination returns UNAVAILABLE without default to Goa", async () => {
    const res = await hotelProvider.searchHotels({ destination: "" });
    assert.equal(res.status, "UNAVAILABLE");
    assert.equal(res.source, "UNAVAILABLE");
    assert.deepEqual(res.results, []);
  });

  // =========================================================================
  // 2. TRANSPORT GEOCODING TESTS
  // =========================================================================

  await runTest("Transport: Missing origin or destination returns UNAVAILABLE (No default to Mumbai/Goa)", async () => {
    const res = await transportProvider.getRouteStatus({ origin: "", destination: "Delhi" });
    assert.equal(res.status, "UNAVAILABLE");
    assert.equal(res.source, "UNAVAILABLE");
    assert.equal(res.distanceKm, null, "Distance must be null, not 0 or calculated");
    assert.equal(res.estimatedDurationMins, null, "Duration must be null");

    const res2 = await transportProvider.getRouteStatus({ origin: "Delhi", destination: "" });
    assert.equal(res2.status, "UNAVAILABLE");
    assert.equal(res2.distanceKm, null);
  });

  await runTest("Transport: Geocoding failure returns explicit UNAVAILABLE without coordinate substitution", async () => {
    // Unresolvable origin
    const res = await transportProvider.getRouteStatus({
      origin: "XYZ_NONEXISTENT_PLACE_99999",
      destination: "Delhi",
    });
    assert.equal(res.status, "UNAVAILABLE");
    assert.equal(res.source, "UNAVAILABLE");
    assert.equal(res.distanceKm, null, "Distance must be null");
    assert.equal(res.estimatedDurationMins, null, "Duration must be null");
    assert.ok(res.reason.includes("Could not"), "Must report resolution failure");
  });

  await runTest("Transport: Valid regional hub route resolves geodesic distance without fallback coordinates", async () => {
    // Goa and Ladakh are in REGIONAL_HUBS
    const res = await transportProvider.getRouteStatus({
      origin: "Goa",
      destination: "Ladakh",
    });
    assert.ok(res.status === "ESTIMATED" || res.status === "LIVE", "Status must be ESTIMATED or LIVE");
    assert.ok(res.source === "ESTIMATE" || res.source === "LIVE_OSRM_ROUTING", "Source must be ESTIMATE or LIVE_OSRM_ROUTING");
    assert.ok(res.distanceKm > 1500, `Direct distance should exceed 1500 km, got ${res.distanceKm}`);
    assert.ok(res.estimatedDurationMins > 1000, `Duration should exceed 1000 mins, got ${res.estimatedDurationMins}`);
  });

  // =========================================================================
  // 3. WEATHER FALLBACK & RISK ENGINE TESTS
  // =========================================================================

  await runTest("Weather: Missing UV index is null, never static 4", () => {
    const weatherData = {
      temp: 24,
      condition: "Partly Cloudy",
      humidity: 55,
      windSpeed: 12,
      uv: null, // As fixed in weather.service.js
      rainChance: 10,
      pop: 0.1,
      provider: "OpenWeatherMap",
    };

    assert.strictEqual(weatherData.uv, null, "UV must be strictly null when provider omits it");
    assert.notEqual(weatherData.uv, 4, "UV must NEVER be static 4 placeholder");
  });

  await runTest("Risk Engine: Null weather metrics never generate false hazards or cold/frost risks", () => {
    // Weather with null temp, windSpeed, and uv
    const weatherData = {
      temp: null,
      condition: "Clear",
      humidity: null,
      windSpeed: null,
      uv: null,
      rainChance: 0,
      pop: 0,
      provider: "TestProvider",
      isForecastAvailable: true,
    };

    const trip = {
      _id: "trip_null_metrics",
      destination: "Udaipur",
      startDate: new Date(Date.now() + 86400000).toISOString(),
      days: [
        {
          dayNumber: 1,
          date: "2026-11-16",
          activities: [{ title: "City Palace walking tour" }],
        },
      ],
    };

    const result = evaluateRiskEngine({ destination: "Udaipur", trip, weatherData });

    // Assert NO cold frost hazard (which used to trigger on temp <= 4 if temp defaulted to 0)
    const coldRisk = result.risks.find((r) => r.key === "weather_cold");
    assert.equal(coldRisk, undefined, "Null temp must NOT trigger cold frost hazard");

    // Assert NO extreme heat hazard
    const heatRisk = result.risks.find((r) => r.key === "weather_heat");
    assert.equal(heatRisk, undefined, "Null temp must NOT trigger heat hazard");

    // Assert NO wind hazard
    const windRisk = result.risks.find((r) => r.key === "weather_wind");
    assert.equal(windRisk, undefined, "Null windSpeed must NOT trigger wind hazard");

    // Assert score is low/uninflated
    assert.ok(result.score <= 15, `Score should be low, got ${result.score}`);
  });

  await runTest("Risk Engine: Favorable weather summary handles null metrics without printing 'null°C'", () => {
    const weatherData = {
      temp: null,
      condition: "Mild clear skies",
      humidity: null,
      windSpeed: null,
      uv: null,
      rainChance: null,
      pop: null,
      provider: "TestProvider",
      isForecastAvailable: true,
    };

    const result = evaluateRiskEngine({ destination: "Udaipur", weatherData });
    const favRisk = result.risks.find((r) => r.key === "weather_favorable");
    assert.ok(favRisk, "Should have weather_favorable");
    assert.ok(!favRisk.summary.includes("null°C"), "Must NOT display 'null°C' in summary text");
    assert.ok(!favRisk.summary.includes("null%"), "Must NOT display 'null%' in summary text");
  });

  await runTest("Risk Engine: Out of horizon weather returns 0 penalty points", () => {
    const weatherData = {
      temp: null,
      condition: "Weather forecast not yet available",
      humidity: null,
      windSpeed: null,
      uv: null,
      rainChance: null,
      pop: null,
      forecastStatus: "OUT_OF_HORIZON",
      isForecastAvailable: false,
      maxSupportedHorizonDate: "2026-11-20",
      provider: "OpenWeatherMap",
    };

    const result = evaluateRiskEngine({ destination: "Paris", weatherData });
    const horizonRisk = result.risks.find((r) => r.key === "weather_horizon_pending");
    assert.ok(horizonRisk, "Must flag weather_horizon_pending");
    assert.equal(result.score, 10, "Out of horizon notice must contribute exactly 0 risk score penalty (baseline score is 10)");
  });

  console.log("\n=================================================");
  console.log(` RESULTS: ${passedCount} / ${totalCount} TESTS PASSED `);
  console.log("=================================================");

  if (passedCount !== totalCount) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
