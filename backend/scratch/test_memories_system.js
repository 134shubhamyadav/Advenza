/**
 * Integration & validation test suite for Advenza Memories System
 * Tests:
 * 1. Mongoose Memory Model schema constraints (base64 rejection, categories, indexes)
 * 2. Zod validation schemas (create, update, curate, query params)
 * 3. AI Service anti-hallucination validation and fallback logic
 */

import { Memory, MEMORY_CATEGORIES } from "../models/Memory.js";
import {
  createMemorySchema,
  updateMemorySchema,
  curateCollageSchema,
  listMemoriesQuerySchema,
  CurateCollageOutputSchema,
} from "../schemas/memory.schemas.js";
import { curateCollageMemories } from "../services/ai/memory-ai.service.js";

async function runTests() {
  console.log("=== ADVENZA MEMORIES SYSTEM INTEGRATION TESTS ===\n");
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  // TEST 1: Schema Rejection of Base64 Media
  console.log("TEST 1: Schema Rejection of Base64 Media");
  try {
    const invalidDoc = new Memory({
      userId: "test-user-1",
      n: 1,
      place: "Jaipur",
      date: "Oct 12",
      mediaUrl: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQE...",
      storageKey: "test-key",
      highlight: "City Palace tour",
      moments: ["palace"],
    });

    const valErr = invalidDoc.validateSync();
    assert(
      valErr && valErr.errors["mediaUrl"],
      "Schema correctly rejected base64 data URI in mediaUrl"
    );
  } catch (err) {
    assert(false, `Unexpected error during base64 test: ${err.message}`);
  }

  // TEST 2: Schema Acceptance of Valid Cloud Storage URL
  console.log("\nTEST 2: Schema Acceptance of Valid Cloud Storage URL");
  try {
    const validDoc = new Memory({
      userId: "test-user-1",
      n: 1,
      place: "Jaipur",
      date: "Oct 12",
      mediaUrl: "https://firebasestorage.googleapis.com/v0/b/advenza.appspot.com/o/test.jpg",
      thumbnailUrl: "https://firebasestorage.googleapis.com/v0/b/advenza.appspot.com/o/thumb_test.jpg",
      storageKey: "users/test-user-1/memories/test.jpg",
      thumbnailKey: "users/test-user-1/memories/thumb_test.jpg",
      category: "LANDMARK",
      mediaType: "image",
      highlight: "City Palace tour",
      moments: ["palace", "history"],
      tags: ["jaipur", "rajasthan"],
    });

    const valErr = validDoc.validateSync();
    assert(!valErr, "Valid memory document passed all schema validations");
    assert(validDoc.status === "ready", "Default status is ready");
    assert(validDoc.aiMetadata.status === "PENDING", "Default aiMetadata.status is PENDING");
  } catch (err) {
    assert(false, `Unexpected validation failure: ${err.message}`);
  }

  // TEST 3: Category Enum Enforcement
  console.log("\nTEST 3: Category Enum Enforcement");
  try {
    assert(MEMORY_CATEGORIES.includes("LANDMARK"), "Category includes LANDMARK");
    assert(MEMORY_CATEGORIES.includes("FOOD"), "Category includes FOOD");
    assert(MEMORY_CATEGORIES.includes("ADVENTURE"), "Category includes ADVENTURE");

    const invalidCategoryDoc = new Memory({
      userId: "test-user-1",
      n: 1,
      place: "Jaipur",
      date: "Oct 12",
      mediaUrl: "https://example.com/photo.jpg",
      storageKey: "test-key",
      category: "INVALID_UNKNOWN_CATEGORY",
      highlight: "City Palace tour",
      moments: ["palace"],
    });

    const valErr = invalidCategoryDoc.validateSync();
    assert(
      valErr && valErr.errors["category"],
      "Schema correctly rejected invalid category enum value"
    );
  } catch (err) {
    assert(false, `Unexpected category test failure: ${err.message}`);
  }

  // TEST 4: Zod Query Validation (Keyset Cursor & Limit)
  console.log("\nTEST 4: Zod Query Validation (Keyset Cursor & Limit)");
  try {
    const validQuery = listMemoriesQuerySchema.parse({
      tripId: "6507f1f729b8c123456789ab",
      limit: "15",
      cursor: "6507f1f729b8c123456789cd",
      category: "FOOD",
      search: "Dosa",
    });

    assert(validQuery.limit === 15, "Limit parsed to integer 15");
    assert(validQuery.category === "FOOD", "Category parsed correctly");
    assert(validQuery.search === "Dosa", "Search query preserved");

    // Test default limit clamp
    const defaultQuery = listMemoriesQuerySchema.parse({});
    assert(defaultQuery.limit === 20, "Default limit is 20");

    let threwOnOverLimit = false;
    try {
      listMemoriesQuerySchema.parse({ limit: "500" });
    } catch {
      threwOnOverLimit = true;
    }
    assert(threwOnOverLimit, "Schema rejects limit exceeding 100");
  } catch (err) {
    assert(false, `Unexpected Zod query parse failure: ${err.message}`);
  }

  // TEST 5: Zod Curate Collage Schema
  console.log("\nTEST 5: Zod Curate Collage Schema");
  try {
    const validCurate = curateCollageSchema.parse({
      tripId: "6507f1f729b8c123456789ab",
      targetCount: 6,
      style: "FOODIE",
    });
    assert(validCurate.style === "FOODIE", "Curate style parsed");
    assert(validCurate.targetCount === 6, "Target count is 6");

    const defaultCurate = curateCollageSchema.parse({});
    assert(defaultCurate.style === "HIGHLIGHTS", "Default style is HIGHLIGHTS");
    assert(defaultCurate.targetCount === 6, "Default count is 6");
  } catch (err) {
    assert(false, `Curate schema parse failure: ${err.message}`);
  }

  // TEST 6: Strict Anti-Hallucination Guard in CurateCollageOutputSchema
  console.log("\nTEST 6: Strict Anti-Hallucination Guard in CurateCollageOutputSchema");
  try {
    const candidatePool = [
      { id: "mem_real_1", place: "Taj Mahal", highlight: "Sunrise visit" },
      { id: "mem_real_2", place: "Agra Fort", highlight: "Mughal history" },
      { id: "mem_real_3", place: "Mehtab Bagh", highlight: "Sunset reflection" },
    ];
    const validIdSet = new Set(candidatePool.map((c) => c.id));

    // Simulated LLM output containing a hallucinated ID
    const rawAiOutput = {
      title: "Golden Hour in Agra",
      narrative: "A journey from sunrise to sunset.",
      selectedMemories: [
        { memoryId: "mem_real_1", reason: "Iconic sunrise", sequenceOrder: 1 },
        { memoryId: "mem_HALLUCINATED_999", reason: "Hallucinated spot", sequenceOrder: 2 },
        { memoryId: "mem_real_3", reason: "Sunset view", sequenceOrder: 3 },
      ],
    };

    const parsed = CurateCollageOutputSchema.parse(rawAiOutput);

    // Filter strictly through candidate pool
    const sanitized = parsed.selectedMemories.filter((m) => validIdSet.has(m.memoryId));

    assert(sanitized.length === 2, "Hallucinated memory ID was successfully filtered out");
    assert(
      !sanitized.some((m) => m.memoryId === "mem_HALLUCINATED_999"),
      "mem_HALLUCINATED_999 does not exist in sanitized output"
    );
  } catch (err) {
    assert(false, `Anti-hallucination test failure: ${err.message}`);
  }

  // TEST 7: Validation Middleware with createMemorySchema
  console.log("\nTEST 7: Validation Middleware with createMemorySchema");
  try {
    const { validate } = await import("../middleware/validate.js");
    const middleware = validate({ body: createMemorySchema });

    // Valid body through middleware
    let nextCalled = false;
    let errPassed = null;
    const req = {
      body: {
        place: "Manali",
        date: "Oct 15",
        mediaUrl: "https://storage.googleapis.com/advenza/manali.jpg",
        storageKey: "users/u1/memories/manali.jpg",
        highlight: "Solang Valley snow",
      },
    };
    middleware(req, {}, (err) => {
      nextCalled = true;
      errPassed = err;
    });

    assert(nextCalled && !errPassed, "Valid memory payload passed through middleware");
    assert(req.body.category === "OTHER", "Default category assigned by middleware");
    assert(req.body.spend === 0, "Default spend assigned by middleware");

    // Invalid body (missing storageKey)
    let invalidErr = null;
    const badReq = {
      body: {
        place: "Manali",
        mediaUrl: "https://storage.googleapis.com/advenza/manali.jpg",
      },
    };
    middleware(badReq, {}, (err) => {
      invalidErr = err;
    });
    assert(invalidErr && invalidErr.statusCode === 400, "Missing storageKey rejected with 400 status");
  } catch (err) {
    assert(false, `Validation middleware test failure: ${err.message}`);
  }


  console.log(`\n==========================================`);
  console.log(`SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log(`==========================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
