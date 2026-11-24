import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseAIJson, repairTruncatedJson } from "./services/ai/ai-parser.js";
import {
  providerHealth,
  recordProviderFailure,
  recordProviderSuccess,
  isProviderAvailable,
  resetProviderHealth,
  aiRouter,
} from "./services/ai/ai-router.service.js";
import { destinationResearchAgent } from "./services/ai/orchestrator/destination-research.agent.js";

describe("AI Pipeline Resilience & Error Classification Suite", () => {
  it("Test 1: OpenAI 401 marks provider AUTH_FAILED with 24h cooldown and is skipped", () => {
    resetProviderHealth();
    assert.equal(isProviderAvailable("OpenAI"), true);

    const err401 = new Error("Incorrect API key provided");
    err401.status = 401;
    recordProviderFailure("OpenAI", err401);

    assert.equal(isProviderAvailable("OpenAI"), false);
    const health = providerHealth.get("openai");
    assert.equal(health.status, "AUTH_FAILED");
    assert.ok(health.cooldownUntil > Date.now() + 23 * 3600 * 1000);
  });

  it("Test 2: Cerebras 402 marks provider BILLING_EXHAUSTED with 6h cooldown", () => {
    resetProviderHealth();
    assert.equal(isProviderAvailable("Cerebras"), true);

    const err402 = new Error("Payment required: credits exhausted");
    err402.status = 402;
    recordProviderFailure("Cerebras", err402);

    assert.equal(isProviderAvailable("Cerebras"), false);
    const health = providerHealth.get("cerebras");
    assert.equal(health.status, "BILLING_EXHAUSTED");
    assert.ok(health.cooldownUntil > Date.now() + 5 * 3600 * 1000);
  });

  it("Test 3: Groq 429 respects Retry-After header and applies cooldown", () => {
    resetProviderHealth();
    assert.equal(isProviderAvailable("Groq"), true);

    const err429 = new Error("Rate limit exceeded: 8000 TPM");
    err429.status = 429;
    err429.headers = { "retry-after": "50" };
    recordProviderFailure("Groq", err429);

    assert.equal(isProviderAvailable("Groq"), false);
    const health = providerHealth.get("groq");
    assert.equal(health.status, "RATE_LIMITED");
    assert.ok(health.cooldownUntil >= Date.now() + 49 * 1000);
  });

  it("Test 4: Provider timeout applies TIMEOUT cooldown", () => {
    resetProviderHealth();
    assert.equal(isProviderAvailable("NVIDIA"), true);

    const timeoutErr = new Error("Timed out after 25000ms");
    timeoutErr.isTimeout = true;
    recordProviderFailure("NVIDIA", timeoutErr);

    assert.equal(isProviderAvailable("NVIDIA"), false);
    const health = providerHealth.get("nvidia");
    assert.equal(health.status, "TIMEOUT");
    assert.ok(health.cooldownUntil >= Date.now() + 29 * 1000);
  });

  it("Test 5: Truncated JSON parser recovers truncated strings and unclosed structures", () => {
    // Simulated Gemini truncation near 16k chars: cut off mid-activity
    const truncatedPayload = `\`\`\`json
{
  "title": "Coastal Exploration of Goa",
  "destination": "Goa",
  "summary": "A 5-day journey exploring heritage forts, scenic shores, and regional spice markets.",
  "days": [
    {
      "dayNumber": 1,
      "date": "2026-11-21",
      "title": "North Shore Arrival",
      "activities": [
        {
          "time": "14:00",
          "description": "Hotel check-in at Candolim followed by coastal sunset walk",
          "placeName": "Candolim Beach",
          "region": "North Goa"
        }
      ]
    },
    {
      "dayNumber": 2,
      "date": "2026-11-22",
      "title": "Heritage Forts",
      "activities": [
        {
          "time": "09:30",
          "description": "Exploration of historic ramparts and lighthouse views at Fort Aguada
`;
    // Notice Fort Aguada was truncated mid-string and has 5 unclosed delimiters!
    const parsed = parseAIJson(truncatedPayload);
    assert.ok(parsed, "Parsed result must not be null");
    assert.equal(parsed.title, "Coastal Exploration of Goa");
    assert.equal(parsed.destination, "Goa");
    assert.equal(parsed.days.length, 2);
    assert.equal(parsed.days[0].activities[0].placeName, "Candolim Beach");
    assert.ok(parsed.days[1].activities[0].description.includes("Fort Aguada"));
  });

  it("Test 6: Truncated JSON parser handles dangling commas and unclosed arrays", () => {
    const danglingCommaPayload = `{"title": "Jaipur Tour", "days": [{"dayNumber": 1, "activities": [{"time": "10:00", "description": "Hawa Mahal"}]}, `;
    const parsed = parseAIJson(danglingCommaPayload);
    assert.ok(parsed);
    assert.equal(parsed.title, "Jaipur Tour");
    assert.equal(parsed.days.length, 1);
  });

  it("Test 7: Destination research in-flight deduplication shares single promise for concurrent requests", async () => {
    let executionCount = 0;
    // Mock aiRouter.execute temporarily
    const originalExecute = aiRouter.execute;
    aiRouter.execute = async () => {
      executionCount++;
      await new Promise((resolve) => setTimeout(resolve, 50));
      return {
        content: JSON.stringify({
          destinationName: "Udaipur",
          country: "India",
          currency: "INR",
          language: "Hindi",
          emergencyNumber: "112",
          overview: "City of Lakes in Rajasthan.",
          bestTimeToVisit: "October to March",
          regions: ["Old City", "Fateh Sagar"],
          popularAttractions: [{ name: "City Palace", description: "Royal palace complex" }],
          hiddenGems: [{ name: "Ambrai Ghat", whySpecial: "Lake view", description: "Waterfront ghat" }],
          localDining: [{ name: "Tribute Restaurant", cuisine: "Rajasthani" }],
          transportTips: "Auto rickshaws are readily available.",
        }),
        provider: "MockAI",
        model: "mock-model",
        durationMs: 50,
      };
    };

    try {
      const [res1, res2, res3] = await Promise.all([
        destinationResearchAgent.research({ destination: "Udaipur", interests: ["heritage"] }),
        destinationResearchAgent.research({ destination: "Udaipur", interests: ["lakes"] }),
        destinationResearchAgent.research({ destination: "Udaipur", interests: ["food"] }),
      ]);

      assert.equal(executionCount, 1, "Three concurrent calls for Udaipur must execute AI only ONCE");
      assert.equal(res1.destinationName, "Udaipur");
      assert.equal(res2.destinationName, "Udaipur");
      assert.equal(res3.destinationName, "Udaipur");
    } finally {
      aiRouter.execute = originalExecute;
    }
  });
});
