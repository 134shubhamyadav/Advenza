import React from "react";
import ReactDOMServer from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";

const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    a: [...(defaultSchema.attributes?.a ?? []), "target", "rel"],
  },
};

const testCases = [
  {
    name: "1. Bold and italic text",
    md: "**Vinayak Family Restaurant** is *highly rated*.",
    assertContains: ["<strong>Vinayak Family Restaurant</strong>", "<em>highly rated</em>"],
    assertNotContains: ["**", "*"],
  },
  {
    name: "2. Multiple headings",
    md: "# Heading 1\n## Heading 2\n### Heading 3",
    assertContains: ["<h1>Heading 1</h1>", "<h2>Heading 2</h2>", "<h3>Heading 3</h3>"],
    assertNotContains: ["#"],
  },
  {
    name: "3. Bullet and numbered lists",
    md: "- Item 1\n- Item 2\n\n1. First\n2. Second",
    assertContains: ["<ul>", "<li>Item 1</li>", "<li>Item 2</li>", "<ol>", "<li>First</li>", "<li>Second</li>"],
    assertNotContains: ["- Item"],
  },
  {
    name: "4. Tables",
    md: "| Restaurant | Price |\n| :--- | :--- |\n| Vinayak | ₹400 |",
    assertContains: ["<table>", "<thead>", "Restaurant</th>", "Price</th>", "Vinayak</td>", "₹400</td>"],
  },
  {
    name: "5. Indian currency (₹)",
    md: "Price range: **₹250–₹450** per person.",
    assertContains: ["<strong>₹250–₹450</strong>"],
  },
  {
    name: "6. Emojis",
    md: "Enjoy fresh seafood! 🦀 🍛 🏖️ ✨",
    assertContains: ["🦀 🍛 🏖️ ✨"],
  },
  {
    name: "7. Links (Safe external)",
    md: "[View on Google Maps](https://maps.google.com/?q=Vinayak)",
    assertContains: ['<a href="https://maps.google.com/?q=Vinayak"'],
  },
  {
    name: "8. Mixed Hindi & English",
    md: "Namaste! नमस्ते! Vinayak restaurant बहुत प्रसिद्ध है।",
    assertContains: ["Namaste! नमस्ते! Vinayak restaurant बहुत प्रसिद्ध है।"],
  },
  {
    name: "9. Long restaurant recommendations",
    md: "### Why It is Special\n\n**Vinayak Family Restaurant**\n- Cuisine: Goan seafood.\n- Opening Hours: 12:30–15:30.\n- Price: ₹250–₹450.",
    assertContains: [
      "<h3>Why It is Special</h3>",
      "<strong>Vinayak Family Restaurant</strong>",
      "<li>Cuisine: Goan seafood.</li>",
      "<li>Opening Hours: 12:30–15:30.</li>",
      "<li>Price: ₹250–₹450.</li>",
    ],
    assertNotContains: ["**", "- Cuisine"],
  },
  {
    name: "10. Security: XSS Stripping & Malicious HTML / Protocols",
    md: 'Hello <script>alert("XSS")</script><img src="x" onerror="alert(1)" /><a href="javascript:alert(2)">click</a>',
    assertNotContains: ["<script>", "</script>", "onerror=", "href=\"javascript:"],
  },
];

console.log("==============================================================");
console.log("ADVENZA — CHAT MARKDOWN RENDERING TEST SUITE");
console.log("==============================================================\n");

let passed = 0;
for (const tc of testCases) {
  const el = React.createElement(
    ReactMarkdown,
    {
      remarkPlugins: [remarkGfm],
      rehypePlugins: [[rehypeSanitize, sanitizeSchema]],
    },
    tc.md
  );
  const html = ReactDOMServer.renderToStaticMarkup(el);

  let ok = true;
  if (tc.assertContains) {
    for (const sub of tc.assertContains) {
      if (!html.includes(sub)) {
        console.error(`❌ ${tc.name} Failed: Missing expected string "${sub}" in rendered HTML:`, html);
        ok = false;
        break;
      }
    }
  }

  if (ok && tc.assertNotContains) {
    for (const sub of tc.assertNotContains) {
      if (html.includes(sub)) {
        console.error(`❌ ${tc.name} Failed: Found forbidden raw token "${sub}" in rendered HTML:`, html);
        ok = false;
        break;
      }
    }
  }

  if (ok) {
    console.log(`✓ ${tc.name} passed`);
    passed++;
  }
}

console.log("\n==============================================================");
console.log(`RESULTS: ${passed}/${testCases.length} Passed`);
console.log("==============================================================");

if (passed === testCases.length) {
  console.log("🎉 ALL MARKDOWN RENDERING AND SECURITY TESTS PASSED!");
  process.exit(0);
} else {
  process.exit(1);
}
