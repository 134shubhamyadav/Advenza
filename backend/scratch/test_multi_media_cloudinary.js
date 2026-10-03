import assert from "assert";
import Memory from "../models/Memory.js";
import { createMemorySchema, updateMemorySchema } from "../schemas/memory.schemas.js";

async function runMultiMediaTests() {
  console.log("=== MULTI-MEDIA MEMORY ARCHITECTURE & VALIDATION TESTS ===\n");

  // 1. Validate Max 10 Media items in Schema
  console.log("TEST 1: Schema enforces max 10 media files limit");
  const elevenMedia = Array.from({ length: 11 }, (_, i) => ({
    url: `https://res.cloudinary.com/kdlwkzol/image/upload/v1234/test_${i}.jpg`,
    publicId: `test_${i}`,
    resourceType: "image",
    format: "jpg",
  }));

  const parseResult11 = createMemorySchema.safeParse({
    place: "Paris",
    media: elevenMedia,
  });
  assert.strictEqual(parseResult11.success, false, "Schema must reject > 10 media files");
  console.log("  ✓ PASS: Successfully rejected 11 media items with validation error.");

  // 2. Validate 10 Media items accepted
  console.log("\nTEST 2: Schema accepts valid 1-10 media files");
  const tenMedia = elevenMedia.slice(0, 10);
  const parseResult10 = createMemorySchema.safeParse({
    place: "Paris",
    media: tenMedia,
  });
  assert.strictEqual(parseResult10.success, true, "Schema must accept 10 media files");
  console.log("  ✓ PASS: Successfully accepted exactly 10 media items.");

  // 3. Mixed image and video media support
  console.log("\nTEST 3: Multi-media schema handles mixed images and videos with metadata");
  const mixedMedia = [
    {
      url: "https://res.cloudinary.com/kdlwkzol/image/upload/v1234/photo1.jpg",
      publicId: "photo1",
      resourceType: "image",
      format: "jpg",
      width: 1920,
      height: 1080,
      originalName: "eiffel_tower.jpg",
    },
    {
      url: "https://res.cloudinary.com/kdlwkzol/video/upload/v1234/video1.mp4",
      publicId: "video1",
      resourceType: "video",
      format: "mp4",
      width: 1280,
      height: 720,
      duration: 15.5,
      originalName: "seine_cruise.mp4",
    },
  ];

  const mixedDoc = new Memory({
    userId: "user_test_123",
    place: "Paris Louvre & Seine",
    highlight: "Amazing day exploring museums and cruising",
    media: mixedMedia,
  });

  await mixedDoc.validate();
  assert.strictEqual(mixedDoc.media.length, 2, "Document contains 2 media items");
  assert.strictEqual(mixedDoc.media[0].resourceType, "image");
  assert.strictEqual(mixedDoc.media[1].resourceType, "video");
  assert.strictEqual(mixedDoc.mediaUrl, mixedMedia[0].url, "Legacy mediaUrl is automatically synced");
  assert.strictEqual(mixedDoc.storageKey, mixedMedia[0].publicId, "Legacy storageKey is automatically synced");
  console.log("  ✓ PASS: Mixed image/video document created and legacy fields auto-synced.");

  // 4. Mongoose validation rejects > 10 items
  console.log("\nTEST 4: Mongoose model rejects > 10 media items");
  const invalidMongooseDoc = new Memory({
    userId: "user_test_123",
    place: "Rome",
    media: elevenMedia,
  });
  const mongooseValErr = invalidMongooseDoc.validateSync();
  assert.ok(mongooseValErr, "Mongoose model must reject > 10 media items");
  assert.ok(mongooseValErr.errors["media"], "Error must be on media field");
  console.log("  ✓ PASS: Mongoose validator rejected > 10 media items.");

  console.log("\n==========================================");
  console.log("ALL MULTI-MEDIA BACKEND TESTS PASSED ✓");
  console.log("==========================================");
}

runMultiMediaTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
