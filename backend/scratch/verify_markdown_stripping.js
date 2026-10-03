/**
 * Verification Test Suite — Markdown Stripping & Plain-Text Sanitization
 *
 * Verifies that accidental Markdown formatting (**bold**, *italic*, backticks, headings, bullets)
 * is cleanly stripped from user-facing activity descriptions and titles while preserving
 * legitimate characters (₹, ≈, –, —, quotes, parentheses).
 */

import assert from "assert";
import { stripMarkdownFormatting, validateAndSanitizeItinerary } from "../services/itinerary/itinerary-sanitizer.js";

function runTests() {
  console.log("==================================================");
  console.log("ADVENZA — MARKDOWN STRIPPING VERIFICATION");
  console.log("==================================================");

  let passed = 0;
  let failed = 0;

  function test(description, fn) {
    try {
      fn();
      console.log(`  ✓ ${description}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${description}`);
      console.error(`    Error: ${err.message}`);
      failed++;
    }
  }

  // ── [TEST 1] Primary Bug Case: Osman Sagar (Gandipet Lake) ─────────────────
  console.log("\n[TEST 1] Primary Bug Case — Bold in Activity Description");
  test("Strips **bold** from 'Morning drive to **Osman Sagar (Gandipet Lake)** – tranquil waters...'", () => {
    const input = "Morning drive to **Osman Sagar (Gandipet Lake)** – tranquil waters and ₹500 entry (approx. 2 hours)";
    const expected = "Morning drive to Osman Sagar (Gandipet Lake) – tranquil waters and ₹500 entry (approx. 2 hours)";
    const actual = stripMarkdownFormatting(input);
    assert.strictEqual(actual, expected);
  });

  // ── [TEST 2] Multiple Bold Segments ────────────────────────────────────────
  console.log("\n[TEST 2] Multiple Bold Segments");
  test("Strips multiple **bold** segments in a single sentence", () => {
    const input = "Visit **Charminar** in the morning and **Golconda Fort** during sunset.";
    const expected = "Visit Charminar in the morning and Golconda Fort during sunset.";
    assert.strictEqual(stripMarkdownFormatting(input), expected);
  });

  // ── [TEST 3] Italic Formatting ─────────────────────────────────────────────
  console.log("\n[TEST 3] Italic Formatting");
  test("Strips *italic* and _italic_ formatting", () => {
    const input = "Enjoy a *peaceful stroll* along the _coastal promenade_ with local snacks.";
    const expected = "Enjoy a peaceful stroll along the coastal promenade with local snacks.";
    assert.strictEqual(stripMarkdownFormatting(input), expected);
  });

  // ── [TEST 4] Triple Bold & Italic ──────────────────────────────────────────
  console.log("\n[TEST 4] Bold + Italic Formatting");
  test("Strips ***bold-italic*** formatting", () => {
    const input = "Experience the ***Grand Royal Palace Tour*** with a certified local guide.";
    const expected = "Experience the Grand Royal Palace Tour with a certified local guide.";
    assert.strictEqual(stripMarkdownFormatting(input), expected);
  });

  // ── [TEST 5] Backticks & Code Syntax ───────────────────────────────────────
  console.log("\n[TEST 5] Backticks & Inline Code");
  test("Strips inline backticks `around text`", () => {
    const input = "Dine at `Shadab Restaurant` for authentic `Hyderabadi Biryani` (₹350).";
    const expected = "Dine at Shadab Restaurant for authentic Hyderabadi Biryani (₹350).";
    assert.strictEqual(stripMarkdownFormatting(input), expected);
  });

  // ── [TEST 6] Headings and List Markers ─────────────────────────────────────
  console.log("\n[TEST 6] Headings and List Markers");
  test("Strips leading Markdown '#' headings and '-' / '*' bullet markers", () => {
    assert.strictEqual(stripMarkdownFormatting("### Historic Quarter Walk"), "Historic Quarter Walk");
    assert.strictEqual(stripMarkdownFormatting("- Morning tea at Nimrah Cafe"), "Morning tea at Nimrah Cafe");
    assert.strictEqual(stripMarkdownFormatting("* Afternoon visit to Salar Jung Museum"), "Afternoon visit to Salar Jung Museum");
  });

  // ── [TEST 7] Legitimate Punctuation Preservation ───────────────────────────
  console.log("\n[TEST 7] Legitimate Punctuation Preservation");
  test("Preserves ₹, ≈, –, —, parentheses, quotes, colons, and hyphens without corruption", () => {
    const input = "Breakfast: Irani Chai (₹30) & Osmania Biscuits (≈ ₹50) – authentic 1950's recipe at \"Nimrah Cafe\" (approx. 45-min visit)";
    const output = stripMarkdownFormatting(input);
    assert.strictEqual(output, input);
  });

  // ── [TEST 8] Full validateAndSanitizeItinerary Integration ─────────────────
  console.log("\n[TEST 8] Full Sanitizer Integration with Leaked Markdown in AI Response");
  test("Sanitizer cleans leaked markdown across title, summary, day titles, and activities", () => {
    const aiOutputWithMarkdown = {
      title: "**Magical Heritage Tour** of `Hyderabad`",
      summary: "A curated 2-day plan featuring *historic palaces* and **iconic eateries**.",
      budgetBreakdown: {
        categories: [
          { category: "food", label: "**Food & Dining**", description: "*Local biryani & chai*", amount: 3000 },
        ],
      },
      days: [
        {
          dayNumber: 1,
          date: "2026-10-10",
          title: "### Day 1: **Royal Heritage & Old City**",
          activities: [
            {
              time: "09:00",
              description: "Morning drive to **Osman Sagar (Gandipet Lake)** – tranquil waters and scenic vistas.",
            },
            {
              time: "13:00",
              description: "Lunch at `Paradise Biryani` – *special mutton biryani* (₹450).",
            },
          ],
        },
      ],
    };

    const sanitized = validateAndSanitizeItinerary(
      aiOutputWithMarkdown,
      [{ dayNumber: 1, date: "2026-10-10", dayName: "Saturday" }],
      { destination: "Hyderabad" }
    );

    assert.strictEqual(sanitized.title, "Magical Heritage Tour of Hyderabad");
    assert.strictEqual(sanitized.summary, "A curated 2-day plan featuring historic palaces and iconic eateries.");
    assert.strictEqual(sanitized.budgetBreakdown.categories[0].label, "Food & Dining");
    assert.strictEqual(sanitized.budgetBreakdown.categories[0].description, "Local biryani & chai");
    assert.strictEqual(sanitized.days[0].title, "Day 1: Royal Heritage & Old City");
    assert.strictEqual(
      sanitized.days[0].activities[0].description,
      "Morning drive to Osman Sagar (Gandipet Lake) – tranquil waters and scenic vistas."
    );
    assert.strictEqual(
      sanitized.days[0].activities[1].description,
      "Lunch at Paradise Biryani – special mutton biryani (₹450)."
    );
  });

  console.log("\n==================================================");
  console.log(`MARKDOWN STRIPPING VERIFICATION: ${passed} passed, ${failed} failed`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
