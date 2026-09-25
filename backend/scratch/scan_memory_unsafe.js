import fs from "fs";

const content = fs.readFileSync("frontend/src/routes/memory.tsx", "utf8");
const lines = content.split("\n");

console.log("=== SCANNING FOR POTENTIALLY UNSAFE CALLS ===");
lines.forEach((line, idx) => {
  const l = line.trim();
  if (
    l.includes(".split(") ||
    l.includes(".toLowerCase(") ||
    l.includes(".trim(") ||
    l.includes(".map(") ||
    l.includes(".filter(") ||
    l.includes(".reduce(") ||
    l.includes(".includes(")
  ) {
    if (
      l.includes("m.") ||
      l.includes("item.") ||
      l.includes("memory.") ||
      l.includes("detailItem.") ||
      l.includes("editItem.") ||
      l.includes("place")
    ) {
      console.log(`Line ${idx + 1}: ${l}`);
    }
  }
});
