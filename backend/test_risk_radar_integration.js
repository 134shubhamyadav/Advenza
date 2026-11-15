import assert from "node:assert/strict";
import { evaluateRiskEngine } from "./services/travel/risk-engine.service.js";
import { getRegionalSafetyFallback } from "./services/ai/ai.service.js";

console.log("=================================================");
console.log(" ADVENZA RISK RADAR REALISTIC INTEGRATION TEST   ");
console.log("=================================================\n");

let passedCount = 0;
let totalCount = 0;

function runTest(name, fn) {
  totalCount++;
  try {
    fn();
    console.log(`[PASS] Test ${totalCount}: ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`[FAIL] Test ${totalCount}: ${name}`);
    console.error(`       Error: ${err.message}`);
  }
}

// -------------------------------------------------------------------------
// Scenario 1: Adverse Weather Trip (Rain Hazard + Outdoor Activity Conflict)
// -------------------------------------------------------------------------
runTest("Trip with Adverse Weather (Rain Hazard & Outdoor Activity Conflict)", () => {
  const trip = {
    _id: "trip_adverse_1",
    destination: "Goa",
    startDate: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
    days: [
      {
        dayNumber: 1,
        date: "2026-11-16",
        activities: [
          { title: "Baga Beach stroll and water sports" },
          { title: "Aguada Fort exploration" },
          { title: "Seafood dinner at Calangute" },
        ],
      },
    ],
  };

  const weatherData = {
    temp: 27,
    rainChance: 85,
    windSpeed: 20,
    condition: "Heavy Rain / Thunderstorm",
    alerts: [],
    provider: "OpenWeatherMap",
  };

  const result = evaluateRiskEngine({ destination: "Goa", trip, weatherData });

  // Assert rain hazard is flagged
  const rainRisk = result.risks.find((r) => r.key === "weather_rain");
  assert.ok(rainRisk, "Must flag weather_rain");
  assert.equal(rainRisk.level, "high", "85% rain should be high severity");

  // Assert outdoor activity conflict is flagged and grouped cleanly
  const activityRisk = result.risks.find((r) => r.key === "activity_conflict_day_1");
  assert.ok(activityRisk, "Must flag activity_conflict_day_1");
  assert.ok(activityRisk.summary.includes("Baga Beach"), "Must mention outdoor activities");
  assert.equal(activityRisk.source, "Itinerary Conflict Engine");

  // Assert score increases from baseline
  assert.ok(result.score > 30, `Score should be elevated, got: ${result.score}`);
  assert.ok(["MEDIUM", "HIGH", "CRITICAL"].includes(result.overallLevel));
});

// -------------------------------------------------------------------------
// Scenario 2: Trip with No Detected Risks (Optimal Weather & Paced Schedule)
// -------------------------------------------------------------------------
runTest("Trip with No Detected Risks (Favorable Weather & Optimal Schedule)", () => {
  const trip = {
    _id: "trip_optimal_2",
    destination: "Goa",
    startDate: new Date(Date.now() + 86400000).toISOString(),
    arrivalTime: "14:00",
    departureTime: "17:00",
    checkOutTime: "11:00", // 6 hours buffer
    days: [
      {
        dayNumber: 1,
        date: "2026-11-16",
        activities: [
          { title: "Check-in and lunch" },
          { title: "Museum of Goa" },
          { title: "Evening cafe" },
        ],
      },
    ],
  };

  const weatherData = {
    temp: 28,
    rainChance: 10,
    windSpeed: 12,
    condition: "Sunny / Clear",
    alerts: [],
    provider: "WeatherAPI",
  };

  const result = evaluateRiskEngine({ destination: "Goa", trip, weatherData });

  // Favorable weather must be recorded without adding risk penalty
  const favorableWeather = result.risks.find((r) => r.key === "weather_favorable");
  assert.ok(favorableWeather, "Must record favorable weather signal");
  assert.equal(favorableWeather.level, "low");

  // No activity conflicts
  const conflicts = result.risks.filter((r) => r.key.startsWith("activity_conflict"));
  assert.equal(conflicts.length, 0, "No activity conflicts should be present");

  // Score must remain at baseline low (10)
  assert.equal(result.score, 10, `Expected base score 10, got: ${result.score}`);
  assert.equal(result.overallLevel, "LOW");
});

// -------------------------------------------------------------------------
// Scenario 3: Trip with Missing External Weather API Data
// -------------------------------------------------------------------------
runTest("Trip with Missing External API Data (weatherData = null)", () => {
  const trip = {
    _id: "trip_missing_weather",
    destination: "Jaipur",
    days: [
      {
        dayNumber: 1,
        activities: [{ title: "City Palace" }],
      },
    ],
  };

  const result = evaluateRiskEngine({ destination: "Jaipur", trip, weatherData: null });

  // Engine must not crash and should report weather_unavailable system notice
  const statusRisk = result.risks.find((r) => r.key === "weather_unavailable");
  assert.ok(statusRisk, "Must return weather_unavailable notice");
  assert.equal(statusRisk.source, "System Notice");
  assert.equal(result.score, 10, "Missing weather should not artificially penalize risk score");
  assert.equal(result.overallLevel, "LOW");
});

// -------------------------------------------------------------------------
// Scenario 4: Changed Destination / Dates (Beyond 14-day Weather Horizon)
// -------------------------------------------------------------------------
runTest("Future Trip Beyond 14-day Horizon (No False Activity Rain Conflict)", () => {
  // Trip 60 days in the future
  const futureTrip = {
    _id: "trip_future_dates",
    destination: "Goa",
    startDate: new Date(Date.now() + 60 * 86400000).toISOString(),
    days: [
      {
        dayNumber: 1,
        activities: [{ title: "Baga Beach relaxation" }, { title: "Boat cruise" }],
      },
    ],
  };

  // Live telemetry for today reports a storm
  const todayWeather = {
    temp: 26,
    rainChance: 90,
    windSpeed: 30,
    condition: "Heavy Rain",
    alerts: [],
  };

  const result = evaluateRiskEngine({ destination: "Goa", trip: futureTrip, weatherData: todayWeather });

  // Today's weather hazard is noted for the city
  assert.ok(result.risks.find((r) => r.key === "weather_rain"));

  // BUT future activities 60 days away must NOT be flagged as conflicting with today's weather
  const conflict = result.risks.find((r) => r.key === "activity_conflict_day_1");
  assert.equal(conflict, undefined, "Future trip beyond 14 days must not conflict with current daily weather");
});

// -------------------------------------------------------------------------
// Scenario 5: Resolved Risk (Overpacked Schedule Reduced from 6 to 3)
// -------------------------------------------------------------------------
runTest("Resolved Risk (Overpacked schedule pruned)", () => {
  const overpackedTrip = {
    _id: "trip_overpacked",
    days: [
      {
        dayNumber: 1,
        activities: [
          { title: "Spot 1" },
          { title: "Spot 2" },
          { title: "Spot 3" },
          { title: "Spot 4" },
          { title: "Spot 5" },
          { title: "Spot 6" },
        ],
      },
    ],
  };

  const result1 = evaluateRiskEngine({ destination: "Delhi", trip: overpackedTrip, weatherData: null });
  assert.ok(result1.risks.find((r) => r.key === "schedule_overpacked_day_1"), "Must flag overpacked schedule");

  // User prunes itinerary to 3 activities
  const resolvedTrip = {
    ...overpackedTrip,
    days: [
      {
        dayNumber: 1,
        activities: [{ title: "Spot 1" }, { title: "Spot 2" }, { title: "Spot 3" }],
      },
    ],
  };

  const result2 = evaluateRiskEngine({ destination: "Delhi", trip: resolvedTrip, weatherData: null });
  assert.equal(
    result2.risks.find((r) => r.key === "schedule_overpacked_day_1"),
    undefined,
    "Overpacked risk must disappear when activities are pruned"
  );
  assert.equal(result2.score, 10, "Score should revert to baseline 10");
});

// -------------------------------------------------------------------------
// Scenario 6: Regional Safety Advisory Fallback
// -------------------------------------------------------------------------
runTest("Regional Safety Advisory Fallback (Offline / AI unavailable)", () => {
  const fallbackRisks = getRegionalSafetyFallback("Goa");
  assert.ok(Array.isArray(fallbackRisks), "Fallback must be an array");
  assert.equal(fallbackRisks.length, 3, "Goa fallback must provide 3 localized advisories");

  const transport = fallbackRisks.find((r) => r.key === "transport_local");
  assert.ok(transport, "Must include transport_local");
  assert.ok(
    transport.summary.includes("Two-wheelers") || transport.label.includes("Scooter"),
    "Must be specific to coastal/Goa destination"
  );
  assert.ok(transport.source.includes("Advisory"), "Source should be properly attributed");
});

// -------------------------------------------------------------------------
// Scenario 7: Multiple Simultaneous Risks (Weather + Logistics + Transit)
// -------------------------------------------------------------------------
runTest("Multiple Simultaneous Risks (Weather + Late Arrival + Tight Checkout Buffer)", () => {
  const complexTrip = {
    _id: "trip_multi_risk",
    destination: "Goa",
    startDate: new Date(Date.now() + 86400000).toISOString(),
    arrivalTime: "23:45", // Late arrival
    departureTime: "12:30", // Departs 90 mins after checkout (tight buffer)
    checkOutTime: "11:00",
    days: [
      {
        dayNumber: 1,
        date: "2026-11-16",
        activities: [{ title: "Dudhsagar waterfall trek" }, { title: "Candolim beach" }],
      },
    ],
  };

  const adverseWeather = {
    temp: 39, // Heat hazard
    rainChance: 90, // Rain hazard
    windSpeed: 42, // Wind hazard
    condition: "Tropical Thunderstorm",
    alerts: [{ event: "Orange Alert", headline: "Severe thunderstorm warning" }],
    provider: "OpenWeatherMap",
  };

  const result = evaluateRiskEngine({ destination: "Goa", trip: complexTrip, weatherData: adverseWeather });

  // Verify all hazards detected
  assert.ok(result.risks.find((r) => r.key === "weather_advisory"), "Must flag weather advisory");
  assert.ok(result.risks.find((r) => r.key === "weather_rain"), "Must flag rain hazard");
  assert.ok(result.risks.find((r) => r.key === "weather_heat"), "Must flag heat advisory");
  assert.ok(result.risks.find((r) => r.key === "weather_wind"), "Must flag wind hazard");
  assert.ok(result.risks.find((r) => r.key === "activity_conflict_day_1"), "Must flag activity conflict");
  assert.ok(result.risks.find((r) => r.key === "logistics_late_arrival"), "Must flag late arrival");
  assert.ok(result.risks.find((r) => r.key === "logistics_tight_buffer"), "Must flag tight return connection");

  // Calibrated score checks
  assert.ok(result.score >= 75, `Expected score >= 75 for multiple severe hazards, got: ${result.score}`);
  assert.equal(result.overallLevel, "CRITICAL", "Overall level should be CRITICAL");
});

// -------------------------------------------------------------------------
// Scenario 8: Risk Key Uniqueness & Deduplication
// -------------------------------------------------------------------------
runTest("Risk Key Uniqueness Guarantee (No Duplicate React Keys)", () => {
  const trip = {
    _id: "trip_keys",
    days: [
      {
        dayNumber: 1,
        activities: [
          { title: "Beach 1" },
          { title: "Beach 2" },
          { title: "Boat 1" },
          { title: "Fort 1" },
        ],
      },
    ],
  };

  const weather = {
    temp: 25,
    rainChance: 80,
    windSpeed: 10,
    condition: "Rain",
  };

  const result = evaluateRiskEngine({ destination: "Goa", trip, weatherData: weather });
  const keys = result.risks.map((r) => r.key);
  const uniqueKeys = new Set(keys);

  assert.equal(keys.length, uniqueKeys.size, `Duplicate keys detected: ${JSON.stringify(keys)}`);
});

// -------------------------------------------------------------------------
// Scenario 9: Early Morning Departure Logistics Detection
// -------------------------------------------------------------------------
runTest("Early Morning Departure Logistics Detection", () => {
  const trip = {
    _id: "trip_early_departure",
    destination: "Bengaluru",
    departureTime: "06:15",
    checkOutTime: "11:00",
  };

  const result = evaluateRiskEngine({ destination: "Bengaluru", trip, weatherData: null });
  const earlyCheckoutRisk = result.risks.find((r) => r.key === "logistics_early_checkout");

  assert.ok(earlyCheckoutRisk, "Must flag early checkout logistics");
  assert.equal(earlyCheckoutRisk.level, "low");
  assert.ok(earlyCheckoutRisk.tips[0].includes("settlement") || earlyCheckoutRisk.tips[0].includes("bill"));
});

// -------------------------------------------------------------------------
// Scenario 11: Trip Beyond 5-day Horizon Displays "Forecast Not Yet Available"
// -------------------------------------------------------------------------
runTest("Trip Beyond 5-day Horizon Displays Weather Forecast Not Yet Available", () => {
  const trip = {
    _id: "trip_out_of_horizon",
    destination: "Goa",
    startDate: "2026-12-10",
    endDate: "2026-12-15",
    days: [{ dayNumber: 1, date: "2026-12-10", activities: [{ title: "Beach party" }] }],
  };

  const outOfHorizonWeather = {
    temp: null,
    condition: "Weather forecast not yet available",
    rainChance: null,
    pop: null,
    forecastStatus: "OUT_OF_HORIZON",
    isForecastAvailable: false,
    maxSupportedHorizonDate: "2026-11-20",
    summary: "Weather forecast not yet available for Goa for travel dates (2026-12-10 to 2026-12-15). Live 5-day forecast horizon currently covers through 2026-11-20 (UTC+5.5).",
    provider: "OpenWeatherMap",
  };

  const result = evaluateRiskEngine({ destination: "Goa", trip, weatherData: outOfHorizonWeather });
  const pendingRisk = result.risks.find((r) => r.key === "weather_horizon_pending");

  assert.ok(pendingRisk, "Must flag weather_horizon_pending");
  assert.equal(pendingRisk.level, "low");
  assert.ok(pendingRisk.summary.includes("not yet available"));
  assert.equal(result.score, 10, "Out-of-horizon trip must not have risk penalty");

  // Verify no false activity conflicts
  const conflicts = result.risks.filter((r) => r.key.startsWith("activity_conflict"));
  assert.equal(conflicts.length, 0, "No false activity conflicts for out-of-horizon trip");
});

// -------------------------------------------------------------------------
// Scenario 12: Multi-day Trip with Day-Specific Rain Forecast Accuracy
// -------------------------------------------------------------------------
runTest("Multi-day Trip with Day-Specific Rain Forecast Accuracy", () => {
  const multiDayTrip = {
    _id: "trip_multi_day",
    destination: "Goa",
    startDate: "2026-11-16",
    endDate: "2026-11-18",
    days: [
      {
        dayNumber: 1,
        date: "2026-11-16",
        activities: [{ title: "Anjuna beach walk" }],
      },
      {
        dayNumber: 2,
        date: "2026-11-17",
        activities: [{ title: "Aguada fort trek" }],
      },
    ],
  };

  const multiDayWeather = {
    temp: 26,
    condition: "Scattered Showers",
    rainChance: 85,
    isForecastAvailable: true,
    dailyForecasts: [
      {
        date: "2026-11-16",
        maxRainChance: 10, // Dry on Day 1
        avgTemp: 27,
        condition: "Clear",
      },
      {
        date: "2026-11-17",
        maxRainChance: 85, // Heavy rain on Day 2
        avgTemp: 25,
        condition: "Heavy Rain / Thunderstorm",
      },
    ],
    provider: "OpenWeatherMap",
  };

  const result = evaluateRiskEngine({ destination: "Goa", trip: multiDayTrip, weatherData: multiDayWeather });

  // Day 1 (Dry) should NOT have an activity conflict
  const day1Conflict = result.risks.find((r) => r.key === "activity_conflict_day_1");
  assert.equal(day1Conflict, undefined, "Day 1 is dry (10% rain), so no conflict should be flagged");

  // Day 2 (Heavy rain 85%) MUST have an activity conflict
  const day2Conflict = result.risks.find((r) => r.key === "activity_conflict_day_2");
  assert.ok(day2Conflict, "Day 2 has 85% rain, so conflict must be flagged");
  assert.equal(day2Conflict.level, "high");
  assert.ok(day2Conflict.summary.includes("85% rain probability"));
});

console.log("\n=================================================");
console.log(` RESULTS: ${passedCount} / ${totalCount} TESTS PASSED `);
console.log("=================================================\n");
if (passedCount === totalCount) {
  process.exit(0);
} else {
  process.exit(1);
}
