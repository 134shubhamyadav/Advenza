import assert from "node:assert";
import { validate } from "../middleware/validate.js";
import { errorHandler } from "../middleware/errorHandler.js";
import { requestId } from "../middleware/requestId.js";
import { ValidationError, NotFoundError, AppError } from "../utils/errors.js";
import { z } from "zod";
import { BaseAIProvider } from "../services/ai/providers/base.provider.js";
import { AIRouterService } from "../services/ai/ai-router.service.js";

console.log("=== RUNNING MIDDLEWARE & GATEWAY INTEGRATION TESTS ===");

// 1. Test Request ID Middleware
console.log("\n[Test 1] Request ID Middleware...");
{
  const req = { headers: {} };
  const res = {
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
  };
  let nextCalled = false;
  requestId(req, res, () => { nextCalled = true; });

  assert.strictEqual(nextCalled, true);
  assert.ok(req.id, "req.id should be generated");
  assert.strictEqual(res.headers["X-Request-Id"], req.id);
  assert.strictEqual(typeof req.id, "string");
  assert.strictEqual(req.id.length >= 32, true);

  // Incoming header check
  const req2 = { headers: { "x-request-id": "client_custom_id_99" } };
  const res2 = { headers: {}, setHeader(k, v) { this.headers[k] = v; } };
  requestId(req2, res2, () => {});
  assert.strictEqual(req2.id, "client_custom_id_99");
  assert.strictEqual(res2.headers["X-Request-Id"], "client_custom_id_99");
}
console.log("✅ Request ID Middleware passed!");

// 2. Test Zod Validation Middleware
console.log("\n[Test 2] Zod Validation Middleware...");
{
  const schema = z.object({
    destination: z.string().min(1),
  });

  const middleware = validate({ body: schema });

  // Valid body
  {
    const req = { body: { destination: "Goa" } };
    let nextCalled = false;
    let errPassed = null;
    middleware(req, {}, (err) => {
      nextCalled = true;
      errPassed = err;
    });
    assert.strictEqual(nextCalled, true);
    assert.strictEqual(errPassed, undefined);
  }

  // Invalid body
  {
    const req = { body: {} };
    let nextCalled = false;
    let errPassed = null;
    middleware(req, {}, (err) => {
      nextCalled = true;
      errPassed = err;
    });
    assert.strictEqual(nextCalled, true);
    assert.ok(errPassed instanceof ValidationError);
    assert.strictEqual(errPassed.statusCode, 400);
    assert.strictEqual(errPassed.code, "VALIDATION_ERROR");
  }
}
console.log("✅ Zod Validation Middleware passed!");

// 3. Test Centralized Error Handler
console.log("\n[Test 3] Centralized Error Handler...");
{
  // Test AppError
  {
    const err = new NotFoundError("Trip not found");
    const req = { id: "req_test_123" };
    let responseStatus = null;
    let responseJson = null;
    const res = {
      status(s) { responseStatus = s; return this; },
      json(j) { responseJson = j; return this; },
    };

    errorHandler(err, req, res, () => {});

    assert.strictEqual(responseStatus, 404);
    assert.strictEqual(responseJson.success, false);
    assert.strictEqual(responseJson.error, "Trip not found");
    assert.strictEqual(responseJson.code, "NOT_FOUND");
    assert.strictEqual(responseJson.requestId, "req_test_123");
  }

  // Test payload too large (entity.too.large)
  {
    const err = new Error("request entity too large");
    err.type = "entity.too.large";
    const req = { id: "req_test_456" };
    let responseStatus = null;
    let responseJson = null;
    const res = {
      status(s) { responseStatus = s; return this; },
      json(j) { responseJson = j; return this; },
    };

    errorHandler(err, req, res, () => {});

    assert.strictEqual(responseStatus, 413);
    assert.strictEqual(responseJson.success, false);
    assert.strictEqual(responseJson.code, "PAYLOAD_TOO_LARGE");
    assert.strictEqual(responseJson.error, "Payload too large. Request body exceeds the maximum permitted limit.");
  }
}
console.log("✅ Centralized Error Handler passed!");

// 4. Test AI Router Gateway Fallback Logic
console.log("\n[Test 4] AI Router Gateway Fallback...");
{
  // Mock Provider 1: Fails with 500 internal server error
  class MockFailingProvider extends BaseAIProvider {
    constructor() {
      super("FailingProvider");
    }
    isConfigured() { return true; }
    async createCompletion() {
      const err = new Error("Internal server error from upstream provider");
      err.status = 500;
      throw err;
    }
  }

  // Mock Provider 2: Succeeds
  class MockSucceedingProvider extends BaseAIProvider {
    constructor() {
      super("SucceedingProvider");
    }
    isConfigured() { return true; }
    async createCompletion() {
      return {
        completion: {
          choices: [
            { message: { content: JSON.stringify({ title: "Fallback Success Trip", days: [] }) } },
          ],
        },
        model: "success-v1",
        usage: { prompt_tokens: 10, completion_tokens: 20 },
      };
    }
  }

  const router = new AIRouterService();
  // Override providers list with mocks
  router.providers = [
    new MockFailingProvider(),
    new MockSucceedingProvider(),
  ];

  const result = await router.callAI({
    messages: [{ role: "user", content: "hello" }],
  });

  assert.strictEqual(result.provider, "SucceedingProvider");
  assert.ok(result.content.includes("Fallback Success Trip"));
}
console.log("✅ AI Router Gateway Fallback passed!");

console.log("\n🎉 ALL MIDDLEWARE & GATEWAY TESTS PASSED! 🎉\n");
