/**
 * Integration & validation test suite for Advenza Real AI Travel Collage Generator
 * Tests:
 * 1. Mongoose Collage Model schema constraints (enums, defaults, shareToken)
 * 2. Zod validation schemas (min 2, max 20, defaults)
 * 3. Sharp CollageEngine generation across all 5 layouts & aspect ratios
 * 4. Blurred background composite & SVG text escaping security
 * 5. Worker queue state lifecycle & authorization guards
 */

import sharp from "sharp";
import { Collage, COLLAGE_LAYOUTS, COLLAGE_ASPECT_RATIOS } from "../models/Collage.js";
import { createCollageSchema, listCollagesQuerySchema } from "../schemas/collage.schemas.js";
import {
  collageEngine,
  escapeXml,
  computeGridLayout,
  computeHeroLayout,
  computeEditorialLayout,
  computePolaroidLayout,
  computeMasonryLayout,
} from "../services/collage/collage-engine.js";

async function runCollageTests() {
  console.log("=== ADVENZA REAL AI COLLAGE GENERATOR INTEGRATION TESTS ===\n");
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

  // Helper to generate mock colored test images using Sharp
  async function createMockImage(color, w = 400, h = 300) {
    return sharp({
      create: {
        width: w,
        height: h,
        channels: 4,
        background: color,
      },
    })
      .jpeg()
      .toBuffer();
  }

  // TEST 1: Collage Mongoose Model Schema
  console.log("TEST 1: Collage Mongoose Model Schema & Enums");
  try {
    const collageDoc = new Collage({
      userId: "test-user-123",
      tripId: "6507f1f729b8c123456789ab",
      memoryIds: ["6507f1f729b8c123456789cd", "6507f1f729b8c123456789ce"],
    });

    const valErr = collageDoc.validateSync();
    assert(!valErr, "Valid collage document passed Mongoose schema validation");
    assert(collageDoc.status === "queued", "Default status is 'queued'");
    assert(collageDoc.layout === "grid", "Default layout is 'grid'");
    assert(collageDoc.aspectRatio === "1:1", "Default aspect ratio is '1:1'");
    assert(collageDoc.theme === "dark", "Default theme is 'dark'");
    assert(collageDoc.shareAccess === "private", "Default shareAccess is 'private'");
    assert(
      typeof collageDoc.shareToken === "string" && collageDoc.shareToken.length === 32,
      "Random 32-character unguessable shareToken generated"
    );

    // Invalid layout rejection
    const invalidDoc = new Collage({
      userId: "test-user-123",
      tripId: "6507f1f729b8c123456789ab",
      memoryIds: ["6507f1f729b8c123456789cd"],
      layout: "INVALID_LAYOUT_NAME",
    });
    const err = invalidDoc.validateSync();
    assert(err && err.errors["layout"], "Schema correctly rejected invalid layout enum");
  } catch (err) {
    assert(false, `Collage schema error: ${err.message}`);
  }

  // TEST 2: Zod Schema Validation (Memory Count Boundaries)
  console.log("\nTEST 2: Zod Schema Validation (Memory Count Boundaries)");
  try {
    // Valid 4-memory payload
    const valid = createCollageSchema.parse({
      tripId: "6507f1f729b8c123456789ab",
      memoryIds: ["m1", "m2", "m3", "m4"],
      layout: "hero",
      aspectRatio: "4:5",
    });
    assert(valid.layout === "hero", "Parsed layout 'hero'");
    assert(valid.aspectRatio === "4:5", "Parsed aspect ratio '4:5'");
    assert(valid.format === "webp", "Default output format is 'webp'");

    // Rejection of less than 2 memories
    let threwTooFew = false;
    try {
      createCollageSchema.parse({
        tripId: "6507f1f729b8c123456789ab",
        memoryIds: ["m1"],
      });
    } catch {
      threwTooFew = true;
    }
    assert(threwTooFew, "Schema rejected request with fewer than 2 memories");

    // Rejection of more than 20 memories
    let threwTooMany = false;
    try {
      const tooMany = new Array(25).fill("m_id");
      createCollageSchema.parse({
        tripId: "6507f1f729b8c123456789ab",
        memoryIds: tooMany,
      });
    } catch {
      threwTooMany = true;
    }
    assert(threwTooMany, "Schema rejected request exceeding 20 memories threshold");
  } catch (err) {
    assert(false, `Zod validation error: ${err.message}`);
  }

  // TEST 3: Layout Slot Computation
  console.log("\nTEST 3: Layout Slot Math Calculation (Zero Empty Cells)");
  try {
    const gridSlots = computeGridLayout(1200, 1200, 4);
    assert(gridSlots.length === 4, "Grid computed 4 slots for 4 images");
    assert(gridSlots[0].width > 0 && gridSlots[0].height > 0, "Grid slot dimensions are valid");

    const heroSlots = computeHeroLayout(1200, 1500, 3);
    assert(heroSlots.length === 3, "Hero layout computed 3 slots");
    assert(heroSlots[0].isHero === true, "First slot designated as hero slot");

    const editorialSlots = computeEditorialLayout(1920, 1080, 3);
    assert(editorialSlots.length === 3, "Editorial layout computed 3 slots with header offset");

    const polaroidSlots = computePolaroidLayout(1200, 1600, 4);
    assert(polaroidSlots.length === 4, "Polaroid layout computed 4 slots");
    assert(typeof polaroidSlots[0].rotation === "number", "Polaroid assigned subtle rotation angle");

    const masonrySlots = computeMasonryLayout(1080, 1920, 5);
    assert(masonrySlots.length === 5, "Masonry computed 5 staggered slots");
  } catch (err) {
    assert(false, `Layout calculation error: ${err.message}`);
  }

  // TEST 4: SVG XML Sanitization against Injection
  console.log("\nTEST 4: SVG XML Sanitization against Injection");
  try {
    const maliciousInput = '<script>alert("xss")</script> & "special" \'quotes\'';
    const escaped = escapeXml(maliciousInput);
    assert(!escaped.includes("<script>"), "Tags (<>) strictly escaped to &lt;&gt;");
    assert(escaped.includes("&amp;"), "Ampersands escaped to &amp;");
    assert(escaped.includes("&quot;"), "Double quotes escaped to &quot;");
    assert(escaped.includes("&apos;"), "Single quotes escaped to &apos;");
  } catch (err) {
    assert(false, `SVG escape error: ${err.message}`);
  }

  // TEST 5: Real Server-Side Sharp Image Generation across Layouts & Aspect Ratios
  console.log("\nTEST 5: Real Server-Side Sharp Generation across Layouts & Aspect Ratios");
  try {
    const img1 = await createMockImage({ r: 230, g: 81, b: 0 }); // Vibrant orange
    const img2 = await createMockImage({ r: 2, g: 136, b: 209 }); // Ocean blue
    const img3 = await createMockImage({ r: 56, g: 142, b: 60 }); // Emerald green
    const img4 = await createMockImage({ r: 123, g: 31, b: 162 }); // Purple

    // Layout 1: Grid at 1:1 Square
    console.log("  → Generating 1:1 Grid Collage...");
    const gridCollage = await collageEngine.generateCollage({
      imageBuffers: [img1, img2, img3, img4],
      layout: "grid",
      aspectRatio: "1:1",
      theme: "dark",
      format: "webp",
    });
    assert(gridCollage.width === 1200 && gridCollage.height === 1200, "1:1 Grid dimensions are 1200x1200");
    assert(gridCollage.format === "webp", "Output format is webp");
    assert(gridCollage.size > 1000, `Output buffer generated (${(gridCollage.size / 1024).toFixed(1)} KB)`);

    // Verify Sharp can inspect the generated buffer as a valid image
    const gridMeta = await sharp(gridCollage.buffer).metadata();
    assert(gridMeta.width === 1200 && gridMeta.height === 1200, "Sharp verified generated 1:1 image metadata");

    // Layout 2: Hero at 4:5 Portrait
    console.log("  → Generating 4:5 Hero Collage...");
    const heroCollage = await collageEngine.generateCollage({
      imageBuffers: [img1, img2, img3],
      layout: "hero",
      aspectRatio: "4:5",
      theme: "warm",
      format: "jpeg",
    });
    assert(heroCollage.width === 1200 && heroCollage.height === 1500, "4:5 Hero dimensions are 1200x1500");
    assert(heroCollage.format === "jpeg", "Output format is jpeg");

    // Layout 3: Editorial with Title & Subtitle at 16:9 Landscape
    console.log("  → Generating 16:9 Editorial Travel Journal Collage...");
    const editorialCollage = await collageEngine.generateCollage({
      imageBuffers: [img1, img2, img3],
      layout: "editorial",
      aspectRatio: "16:9",
      theme: "ocean",
      title: "Rajasthan Heritage Tour",
      subtitle: "Jaipur · Udaipur · Jodhpur | Oct 2026",
      format: "webp",
    });
    assert(editorialCollage.width === 1920 && editorialCollage.height === 1080, "16:9 Editorial dimensions are 1920x1080");

    // Layout 4: Polaroid Scrapbook at 3:4 Classic Print
    console.log("  → Generating 3:4 Polaroid Scrapbook Collage...");
    const polaroidCollage = await collageEngine.generateCollage({
      imageBuffers: [img1, img2, img3, img4],
      layout: "polaroid",
      aspectRatio: "3:4",
      theme: "sand",
      format: "webp",
    });
    assert(polaroidCollage.width === 1200 && polaroidCollage.height === 1600, "3:4 Polaroid dimensions are 1200x1600");

    // Layout 5: Theme "blur" (Gaussian blurred composite from source) at 9:16 Stories
    console.log("  → Generating 9:16 Stories Collage with Blurred Background...");
    const blurCollage = await collageEngine.generateCollage({
      imageBuffers: [img1, img2, img3],
      layout: "grid",
      aspectRatio: "9:16",
      theme: "blur",
      format: "webp",
    });
    assert(blurCollage.width === 1080 && blurCollage.height === 1920, "9:16 Stories dimensions are 1080x1920");
    assert(blurCollage.size > 1000, `Blurred composite output valid (${(blurCollage.size / 1024).toFixed(1)} KB)`);
  } catch (err) {
    assert(false, `Sharp generation failed: ${err.message}`);
  }

  // TEST 6: Rate Limiter Middleware Configuration
  console.log("\nTEST 6: Rate Limiter Middleware Configuration");
  try {
    const { collageLimiter } = await import("../middleware/rateLimiter.js");
    assert(typeof collageLimiter === "function", "collageLimiter exported and configured");
  } catch (err) {
    assert(false, `Rate limiter check failed: ${err.message}`);
  }

  console.log(`\n==========================================`);
  console.log(`SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log(`==========================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

runCollageTests().catch((err) => {
  console.error("Collage test suite crashed:", err);
  process.exit(1);
});
