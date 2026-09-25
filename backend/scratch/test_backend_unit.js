import assert from "node:assert";
import { parseAIJson } from "../services/ai/ai-parser.js";
import { normalizeTime, generateTripDates, validateAndSanitizeItinerary } from "../services/itinerary/itinerary-sanitizer.js";
import { normalizeDestination } from "../services/travel/weather.service.js";
import { evaluateRiskEngine } from "../services/travel/risk-engine.service.js";
import { AppError, ValidationError, NotFoundError, ForbiddenError, AIProviderError } from "../utils/errors.js";
import { generateTripInputSchema, planBInputSchema, ItineraryOutputSchema } from "../schemas/ai.schemas.js";

console.log("=== RUNNING ADVENZA BACKEND UNIT TESTS ===");

// 1. Test AI JSON Parser
console.log("\n[Test 1] AI JSON Parser...");
{
  const testThink = "<think>Here is some internal reasoning\nmore reasoning</think>```json\n{\"title\": \"Goa Trip\", \"days\": []}\n```";
  const parsed = parseAIJson(testThink);
  assert.strictEqual(parsed.title, "Goa Trip");

  const testEmbedded = "Here is the response: {\"valid\": true} hope you like it!";
  const parsedEmbedded = parseAIJson(testEmbedded);
  assert.strictEqual(parsedEmbedded.valid, true);

  assert.throws(() => parseAIJson(""), /empty content/i);
}
console.log("✅ AI JSON Parser tests passed!");

// 2. Test Itinerary Sanitizer & Time Normalization
console.log("\n[Test 2] Time Normalizer & Date Generator...");
{
  assert.strictEqual(normalizeTime("2:30 PM"), "14:30");
  assert.strictEqual(normalizeTime("9:15 AM"), "09:15");
  assert.strictEqual(normalizeTime("12:00 PM"), "12:00");
  assert.strictEqual(normalizeTime("12:00 AM"), "00:00");
  assert.strictEqual(normalizeTime("14:30"), "14:30");
  assert.strictEqual(normalizeTime("09:00"), "09:00");
  assert.strictEqual(normalizeTime("1430"), "14:30");
  assert.strictEqual(normalizeTime(null, "10:00"), "10:00");

  const dates = generateTripDates("2026-10-01", "2026-10-03");
  assert.strictEqual(dates.length, 3);
  assert.strictEqual(dates[0].dayNumber, 1);
  assert.strictEqual(dates[0].date, "2026-10-01");
  assert.strictEqual(dates[2].dayNumber, 3);
  assert.strictEqual(dates[2].date, "2026-10-03");

  const sanitized = validateAndSanitizeItinerary(
    { title: "Custom Title", days: [] },
    dates,
    { destination: "Jaipur", budgetNum: 15000 }
  );
  assert.strictEqual(sanitized.title, "Custom Title");
  assert.strictEqual(sanitized.destination, "Jaipur");
  assert.strictEqual(sanitized.days.length, 3);
  assert.strictEqual(sanitized.days[0].activities.length >= 2, true);
}
console.log("✅ Time Normalizer & Date Generator tests passed!");

// 3. Test Destination Normalizer
console.log("\n[Test 3] Destination Normalizer...");
{
  assert.strictEqual(normalizeDestination("  hyderbad "), "Hyderabad");
  assert.strictEqual(normalizeDestination("mumabi"), "Mumbai");
  assert.strictEqual(normalizeDestination("banglore"), "Bangalore");
  assert.strictEqual(normalizeDestination("new deli"), "New Delhi");
  assert.strictEqual(normalizeDestination("londun"), "London");
  assert.strictEqual(normalizeDestination("Jaipur"), "Jaipur");
}
console.log("✅ Destination Normalizer tests passed!");

// 4. Test Deterministic Risk Radar Engine
console.log("\n[Test 4] Risk Radar Engine...");
{
  const result = evaluateRiskEngine({
    destination: "Goa",
    trip: {
      arrivalTime: "23:30",
      days: [
        {
          dayNumber: 1,
          date: "2026-10-01",
          activities: [
            { time: "09:00", description: "Beach trek" },
            { time: "11:00", description: "Water sports" },
          ],
        },
      ],
    },
    weatherData: {
      temp: 32,
      condition: "Heavy Rain",
      rainChance: 85,
      windSpeed: 25,
      alerts: [],
    },
  });

  assert.strictEqual(result.risks.length > 0, true);
  assert.strictEqual(result.score >= 10 && result.score <= 98, true);
  assert.ok(["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(result.overallLevel));

  const rainRisk = result.risks.find((r) => r.key === "weather_rain");
  assert.ok(rainRisk, "Must detect heavy rain risk");

  const lateArrival = result.risks.find((r) => r.key === "logistics_late_arrival");
  assert.ok(lateArrival, "Must detect late arrival risk");
}
console.log("✅ Risk Radar Engine tests passed!");

// 5. Test Zod Request Schemas
console.log("\n[Test 5] Zod Request Schemas...");
{
  // Valid generate
  const validGen = generateTripInputSchema.safeParse({
    destination: "Manali",
    startDate: "2026-11-01",
    endDate: "2026-11-05",
    budget: 20000,
    travelers: "2",
  });
  assert.strictEqual(validGen.success, true);
  assert.strictEqual(validGen.data.travelers, 2);

  // Invalid generate (missing dates)
  const invalidGen = generateTripInputSchema.safeParse({
    destination: "Manali",
  });
  assert.strictEqual(invalidGen.success, false);

  // Valid plan B
  const validPlanB = planBInputSchema.safeParse({
    tripId: "trip_123",
    question: "We missed our morning flight, what to do?",
    currentDay: "2",
  });
  assert.strictEqual(validPlanB.success, true);
  assert.strictEqual(validPlanB.data.currentDay, 2);

  // Invalid plan B (no question and no messages)
  const invalidPlanB = planBInputSchema.safeParse({
    tripId: "trip_123",
  });
  assert.strictEqual(invalidPlanB.success, false);
}
console.log("✅ Zod Request Schemas tests passed!");

// 6. Test Error Hierarchy
console.log("\n[Test 6] Domain Error Classes...");
{
  const valErr = new ValidationError("Invalid field", [{ field: "name", message: "Required" }]);
  assert.strictEqual(valErr.statusCode, 400);
  assert.strictEqual(valErr.code, "VALIDATION_ERROR");

  const notFound = new NotFoundError("Trip not found");
  assert.strictEqual(notFound.statusCode, 404);
  assert.strictEqual(notFound.code, "NOT_FOUND");

  const forbidden = new ForbiddenError();
  assert.strictEqual(forbidden.statusCode, 403);
  assert.strictEqual(forbidden.code, "FORBIDDEN");

  const aiErr = new AIProviderError("All providers failed", 502, "Groq");
  assert.strictEqual(aiErr.statusCode, 502);
  assert.strictEqual(aiErr.code, "AI_PROVIDER_ERROR");
  assert.strictEqual(aiErr.provider, "Groq");
}
console.log("✅ Domain Error Classes tests passed!");

console.log("\n🎉 ALL UNIT TESTS PASSED SUCCESSFULLY! 🎉\n");
