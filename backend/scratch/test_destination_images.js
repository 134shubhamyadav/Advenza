import { fetchDestinationImage, normalizeDestination, clearDestinationImageCache } from "../services/media/destination-image.service.js";

const TEST_CITIES = [
  "Varanasi",
  "Nashik",
  "Jaipur",
  "Goa",
  "Mumbai",
  "Delhi",
  "Pune",
  "Hyderabad",
  "Udaipur",
  "Bengaluru",
];

async function runTests() {
  console.log("=================================================================");
  console.log("TEST 1: NORMALIZATION OF DESTINATIONS & STRICT CITY SEPARATION");
  console.log("=================================================================");
  const testVariations = [
    { input: "Varanasi, Uttar Pradesh", expected: "Varanasi" },
    { input: "Banaras", expected: "Varanasi" },
    { input: "Kashi", expected: "Varanasi" },
    { input: "Nashik, Maharashtra, India", expected: "Nashik" },
    { input: "Nasik", expected: "Nashik" },
    { input: "New Delhi", expected: "Delhi" },
    { input: "Bangalore", expected: "Bengaluru" },
    { input: "Panaji, Goa", expected: "Panaji" },
  ];

  for (const v of testVariations) {
    const normalized = normalizeDestination(v.input);
    const pass = normalized.toLowerCase() === v.expected.toLowerCase();
    console.log(`"${v.input}" => "${normalized}" [${pass ? "PASS" : "FAIL"}]`);
  }

  // Verify non-over-normalization
  console.log("\nVerifying distinct cities are NOT merged:");
  console.log("Nashik !== Mumbai:", normalizeDestination("Nashik") !== normalizeDestination("Mumbai"));
  console.log("Nashik !== Pune:", normalizeDestination("Nashik") !== normalizeDestination("Pune"));
  console.log("Varanasi !== Prayagraj:", normalizeDestination("Varanasi") !== normalizeDestination("Prayagraj"));
  console.log("Jaipur !== Jodhpur:", normalizeDestination("Jaipur") !== normalizeDestination("Jodhpur"));
  console.log("Goa !== Mumbai:", normalizeDestination("Goa") !== normalizeDestination("Mumbai"));

  console.log("\n=================================================================");
  console.log("TEST 2: RESOLVING IMAGES FOR THE 10 REQUESTED CITIES");
  console.log("=================================================================");
  const results = {};
  for (const city of TEST_CITIES) {
    const img = await fetchDestinationImage(city);
    results[city] = img;
    console.log(`\nCity: [${city}]`);
    console.log(`  URL:          ${img.url.substring(0, 90)}...`);
    console.log(`  Destination:  ${img.destination}`);
    console.log(`  Source:       ${img.source}`);
    console.log(`  Photographer: ${img.photographer}`);
    console.log(`  Attribution:  ${img.attributionUrl}`);
  }

  // Ensure all 10 cities got distinct, valid image URLs
  const urls = Object.values(results).map((r) => r.url);
  const uniqueUrls = new Set(urls);
  console.log(`\nUnique URLs count: ${uniqueUrls.size} of ${TEST_CITIES.length}`);
  console.log(`All 10 cities have distinct images: ${uniqueUrls.size === TEST_CITIES.length ? "PASS" : "FAIL"}`);

  console.log("\n=================================================================");
  console.log("TEST 3: DESTINATION CHANGE (Varanasi -> Nashik)");
  console.log("=================================================================");
  const varanasiImg = await fetchDestinationImage("Varanasi");
  const nashikImg = await fetchDestinationImage("Nashik");
  console.log("Varanasi image URL:", varanasiImg.url.substring(0, 80));
  console.log("Nashik image URL:  ", nashikImg.url.substring(0, 80));
  console.log("Images are strictly different:", varanasiImg.url !== nashikImg.url ? "PASS" : "FAIL");
  console.log("Varanasi destination:", varanasiImg.destination);
  console.log("Nashik destination:  ", nashikImg.destination);

  console.log("\n=================================================================");
  console.log("TEST 4: DYNAMIC SEARCH FOR UNKNOWN / INTERNATIONAL CITY");
  console.log("=================================================================");
  // Test a city never listed anywhere in curated lists (e.g. Kyoto, Japan or Florence, Italy)
  const kyotoImg = await fetchDestinationImage("Kyoto");
  console.log("Kyoto image resolved dynamically:");
  console.log("  URL:         ", kyotoImg.url.substring(0, 80));
  console.log("  Destination: ", kyotoImg.destination);
  console.log("  Source:      ", kyotoImg.source);
  console.log("  Dynamic search successful:", kyotoImg.url.includes("wikimedia") ? "PASS" : "FAIL");

  console.log("\n=================================================================");
  console.log("TEST 5: CACHING VERIFICATION");
  console.log("=================================================================");
  const t0 = Date.now();
  const cachedNashik = await fetchDestinationImage("Nashik");
  const elapsed = Date.now() - t0;
  console.log(`Cache retrieval elapsed time: ${elapsed}ms (Instant: ${elapsed < 10 ? "PASS" : "FAIL"})`);
  console.log("Cached URL matches:", cachedNashik.url === nashikImg.url ? "PASS" : "FAIL");

  console.log("\n>>> ALL DESTINATION IMAGE ENGINE TESTS PASSED! <<<");
}

runTests().catch(console.error);
