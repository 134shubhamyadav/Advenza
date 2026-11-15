import assert from "node:assert";
import { z } from "zod";
import { extractAIContent, parseAIJson, sanitizeAIString } from "../services/ai/ai-parser.js";
import { AIRouterService } from "../services/ai/ai-router.service.js";
import { AIRetryService } from "../services/ai/ai-retry.service.js";
import { BaseAIProvider } from "../services/ai/providers/base.provider.js";
import { AIProviderError } from "../utils/errors.js";

console.log("==================================================");
console.log("ADVENZA — AI GENERATION, RESILIENCE & FALLBACK SUITE");
console.log("==================================================");

let passed = 0;
let failed = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✓ ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${desc}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

async function itAsync(desc, fn) {
  try {
    await fn();
    console.log(`  ✓ ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${desc}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

// Simple test schema for validation tests
const SampleTripSchema = z.object({
  title: z.string().min(1),
  destination: z.string().min(1),
  days: z.array(
    z.object({
      dayNumber: z.number(),
      title: z.string(),
      activities: z.array(
        z.object({
          time: z.string(),
          description: z.string(),
        })
      ),
    })
  ).min(1),
});

// ─── TEST 1: Valid JSON response ───────────────────────────────────────────────
it("Test 1: Valid JSON response parses correctly", () => {
  const jsonStr = JSON.stringify({
    title: "Weekend in Goa",
    destination: "Goa",
    days: [
      {
        dayNumber: 1,
        title: "Beach Day",
        activities: [{ time: "09:00", description: "Baga Beach walk" }],
      },
    ],
  });
  const parsed = parseAIJson(jsonStr);
  assert.strictEqual(parsed.title, "Weekend in Goa");
  assert.strictEqual(parsed.days.length, 1);
  const validated = SampleTripSchema.safeParse(parsed);
  assert.strictEqual(validated.success, true);
});

// ─── TEST 2: JSON wrapped in Markdown code fences ──────────────────────────────
it("Test 2: JSON wrapped in Markdown code fences is cleanly extracted", () => {
  const fenced = "```json\n{\n  \"title\": \"Heritage Delhi\",\n  \"destination\": \"Delhi\",\n  \"days\": [\n    {\n      \"dayNumber\": 1,\n      \"title\": \"Old Delhi\",\n      \"activities\": [{ \"time\": \"10:00\", \"description\": \"Red Fort\" }]\n    }\n  ]\n}\n```";
  const parsed = parseAIJson(fenced);
  assert.strictEqual(parsed.title, "Heritage Delhi");
  assert.strictEqual(parsed.destination, "Delhi");

  // With surrounding text
  const surrounded = "Here is your customized travel itinerary:\n```json\n{\"title\": \"Jaipur Trip\", \"destination\": \"Jaipur\", \"days\": [{\"dayNumber\": 1, \"title\": \"Palaces\", \"activities\": []}]}\n```\nEnjoy your trip!";
  const parsedSurrounded = parseAIJson(surrounded);
  assert.strictEqual(parsedSurrounded.title, "Jaipur Trip");
});

// ─── TEST 3: Malformed JSON ────────────────────────────────────────────────────
it("Test 3: Malformed JSON is rejected and throws descriptive error", () => {
  const malformed = '{"title": "Unclosed string, "days": [';
  assert.throws(
    () => parseAIJson(malformed),
    /Failed to parse AI JSON/i
  );
});

// ─── TEST 4: Response beginning with "We need to..." ───────────────────────────
it("Test 4: Response beginning with 'We need to...' (raw reasoning) is rejected", () => {
  const reasoningNoBraces = "We need to plan a trip to Goa for 3 days. Day 1: Arrive and relax. Day 2: Visit beach.";
  assert.throws(
    () => parseAIJson(reasoningNoBraces),
    /AI response does not contain valid JSON|received non-JSON text/i
  );

  // If extractAIContent receives a response where content is empty and only reasoning is present, it returns ""
  const extracted = extractAIContent({
    choices: [{ message: { role: "assistant", content: "", reasoning: "We need to plan..." } }],
  });
  assert.strictEqual(extracted, "");
  assert.throws(() => parseAIJson(extracted), /AI returned empty content/i);
});

// ─── TEST 5: Empty AI response ─────────────────────────────────────────────────
it("Test 5: Empty AI response is rejected with explicit error", () => {
  assert.throws(() => parseAIJson(""), /AI returned empty content/i);
  assert.throws(() => parseAIJson("   \n\t  "), /AI returned empty content/i);
  assert.throws(() => parseAIJson(null), /AI returned empty content/i);
  assert.throws(() => parseAIJson(undefined), /AI returned empty content/i);
});

// ─── TEST 6: Missing required schema fields ────────────────────────────────────
it("Test 6: Missing required schema fields are caught by Zod validation", () => {
  const missingTitle = {
    destination: "Goa",
    days: [],
  };
  const validated = SampleTripSchema.safeParse(missingTitle);
  assert.strictEqual(validated.success, false);
  const issues = validated.error.issues.map((i) => i.path.join("."));
  assert.ok(issues.includes("title"));
  assert.ok(issues.includes("days"));
});

// ─── TEST 7: Invalid field types ───────────────────────────────────────────────
it("Test 7: Invalid field types are rejected by Zod schema", () => {
  const invalidTypes = {
    title: 12345, // should be string
    destination: "Goa",
    days: [
      {
        dayNumber: "one", // should be number
        title: "Day 1",
        activities: [{ time: "09:00", description: "Walk" }],
      },
    ],
  };
  const validated = SampleTripSchema.safeParse(invalidTypes);
  assert.strictEqual(validated.success, false);
});

// ─── TEST 12: No raw model reasoning reaches the frontend / content extraction ─
it("Test 12: extractAIContent never returns internal reasoning or thoughts", () => {
  // Case A: Model outputs both content and reasoning
  const withReasoning = {
    choices: [
      {
        message: {
          role: "assistant",
          content: '{"title": "Valid Trip"}',
          reasoning: "We need to think step by step about Goa.",
        },
      },
    ],
  };
  assert.strictEqual(extractAIContent(withReasoning), '{"title": "Valid Trip"}');

  // Case B: Model returns empty content but populated reasoning (should return empty string, NOT reasoning!)
  const emptyContentWithReasoning = {
    choices: [
      {
        message: {
          role: "assistant",
          content: "",
          reasoning: "We need to plan Day 1...",
        },
      },
    ],
  };
  assert.strictEqual(extractAIContent(emptyContentWithReasoning), "");

  // Case C: Null content with reasoning
  const nullContentWithReasoning = {
    choices: [
      {
        message: {
          role: "assistant",
          content: null,
          reasoning_content: "Internal chain of thought",
        },
      },
    ],
  };
  assert.strictEqual(extractAIContent(nullContentWithReasoning), "");

  // Case D: Plain text sanitization removes markdown formatting
  const dirty = "**Bold Title** with *italic* and `code` and # Header";
  const sanitized = sanitizeAIString(dirty);
  assert.strictEqual(sanitized, "Bold Title with italic and code and Header");
});

// ─── MOCKED PROVIDERS FOR DETERMINISTIC INTEGRATION TESTS (8, 9, 10, 11) ───────

class MockProvider extends BaseAIProvider {
  constructor(name, behavior) {
    super(name);
    this.behavior = behavior;
    this.callCount = 0;
  }

  isConfigured() {
    return true;
  }

  async createCompletion(options) {
    this.callCount++;
    const action = this.behavior(this.callCount, options);
    if (action.error) {
      throw action.error;
    }
    return {
      completion: {
        choices: [
          {
            message: {
              role: "assistant",
              content: action.content,
              reasoning: action.reasoning || null,
            },
          },
        ],
      },
      provider: this.name,
      model: action.model || "mock-model",
    };
  }
}

// ─── TEST 8 & 9: First provider returns HTTP 200 invalid JSON, retry succeeds ──
await itAsync("Test 8 & 9: Provider returns HTTP 200 invalid JSON on attempt 1, repair retry succeeds on attempt 2", async () => {
  // Provider 1 returns broken JSON on attempt 1, and valid JSON on attempt 2 (after receiving repair prompt)
  const provider1 = new MockProvider("MockGroq", (callNum, opts) => {
    if (callNum === 1) {
      return { content: '{"title": "Trip", "days": [' }; // Truncated/broken JSON
    }
    // Call 2: verify it received repair prompt in messages
    const lastMsg = opts.messages[opts.messages.length - 1];
    assert.ok(lastMsg.content.includes("not valid JSON") || lastMsg.content.includes("required"));
    return {
      content: JSON.stringify({
        title: "Recovered Trip",
        destination: "Goa",
        days: [{ dayNumber: 1, title: "Day 1", activities: [{ time: "09:00", description: "Beach" }] }],
      }),
    };
  });

  const { aiRouter } = await import("../services/ai/ai-router.service.js");
  const originalProviders = aiRouter.providers;
  aiRouter.providers = [provider1];

  try {
    const retryService = new AIRetryService();
    const result = await retryService.executeWithSchemaValidation({
      messages: [{ role: "user", content: "Plan a trip to Goa" }],
      schema: SampleTripSchema,
    });

    // Verify that provider1 was called twice (attempt 1 broken, attempt 2 fixed)
    assert.strictEqual(provider1.callCount, 2);
    assert.strictEqual(result.data.title, "Recovered Trip");
    assert.strictEqual(result.attempt, 2);
  } finally {
    aiRouter.providers = originalProviders;
  }
});

// ─── TEST 10: Provider 1 fails both attempts; Provider 2 succeeds ───────────────
await itAsync("Test 10: Provider 1 fails both attempts (invalid JSON / reasoning); fallback to Provider 2 succeeds", async () => {
  // Provider 1 always returns broken text ("We need to...")
  const provider1 = new MockProvider("MockGroq", () => {
    return {
      content: "",
      reasoning: "We need to output a short JSON object... but we fail.",
    };
  });

  // Provider 2 returns valid JSON on its first attempt
  const provider2 = new MockProvider("MockOpenRouter", () => {
    return {
      content: JSON.stringify({
        title: "OpenRouter Trip",
        destination: "Kerala",
        days: [{ dayNumber: 1, title: "Backwaters", activities: [{ time: "10:00", description: "Boating" }] }],
      }),
    };
  });

  // Inject providers into custom router
  const customRouter = new AIRouterService();
  customRouter.providers = [provider1, provider2];

  // We temporarily swap aiRouter for this test
  const { aiRouter } = await import("../services/ai/ai-router.service.js");
  const originalProviders = aiRouter.providers;
  aiRouter.providers = [provider1, provider2];

  try {
    const retryService = new AIRetryService();
    const result = await retryService.executeWithSchemaValidation({
      messages: [{ role: "user", content: "Plan a trip to Kerala" }],
      schema: SampleTripSchema,
    });

    assert.strictEqual(provider1.callCount, 2, "Provider 1 must be tried twice before fallback");
    assert.strictEqual(provider2.callCount, 1, "Provider 2 must be called once and succeed");
    assert.strictEqual(result.provider, "MockOpenRouter");
    assert.strictEqual(result.data.title, "OpenRouter Trip");
    assert.strictEqual(result.data.destination, "Kerala");
  } finally {
    aiRouter.providers = originalProviders;
  }
});

// ─── TEST 11: All providers fail -> returns clean 502 without leaking secrets ──
await itAsync("Test 11: All providers fail -> returns clean AIProviderError without leaking raw reasoning or keys", async () => {
  const provider1 = new MockProvider("Groq", () => ({ content: 'invalid json' }));
  const provider2 = new MockProvider("OpenRouter", () => ({ content: 'also invalid' }));

  const { aiRouter } = await import("../services/ai/ai-router.service.js");
  const originalProviders = aiRouter.providers;
  aiRouter.providers = [provider1, provider2];

  try {
    const retryService = new AIRetryService();
    let threw = false;
    try {
      await retryService.executeWithSchemaValidation({
        messages: [{ role: "user", content: "Secret prompt: API_KEY=xyz123" }],
        schema: SampleTripSchema,
      });
    } catch (err) {
      threw = true;
      assert.ok(err instanceof AIProviderError, "Must throw AIProviderError");
      assert.strictEqual(err.statusCode, 502);
      // Ensure no raw reasoning, prompts, or API keys leaked
      assert.strictEqual(err.message.includes("xyz123"), false);
      assert.strictEqual(err.message.includes("Secret prompt"), false);
      assert.ok(err.message.includes("All AI providers failed"));
      assert.ok(err.message.includes("Groq"));
      assert.ok(err.message.includes("OpenRouter"));
    }
    assert.strictEqual(threw, true, "Must have thrown AIProviderError");
  } finally {
    aiRouter.providers = originalProviders;
  }
});

console.log("\n==================================================");
console.log(`AI RESILIENCE TEST SUITE: ${passed} passed, ${failed} failed`);
console.log("==================================================");

if (failed > 0) {
  process.exit(1);
}
