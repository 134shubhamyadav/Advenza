import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import groqProvider from "../services/ai/providers/groq.provider.js";
import { buildItineraryPrompt } from "../services/itinerary/prompt-builder.js";
import { generateTripDates } from "../services/itinerary/itinerary-sanitizer.js";
import { ItineraryOutputSchema } from "../schemas/ai.schemas.js";
import { parseAIJson } from "../services/ai/ai-parser.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

async function testFullItinerary() {
  const dates = generateTripDates("2026-11-15", "2026-11-17");
  const prompt = buildItineraryPrompt({
    destination: "Goa",
    origin: "Mumbai",
    startDate: "2026-11-15",
    endDate: "2026-11-17",
    budgetNum: 20000,
    perDayBudget: 6666,
    perPersonBudget: 10000,
    style: "Balanced",
    interests: ["Beaches", "Food"],
    travelersNum: 2,
    accommodationLine: "Beach Resort in Calangute",
    journeyLine: "Flight from Mumbai to Goa",
    transportList: "Flight",
  }, dates);

  console.log("Sending prompt to Groq...");
  const t0 = Date.now();
  const res = await groqProvider.createCompletion({
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
    maxTokens: 4096,
  });

  console.log(`Received completion from ${res.provider} (${res.model}) in ${Date.now() - t0}ms`);
  const content = res.completion.choices[0].message.content;
  console.log("Raw length:", content.length);
  const parsed = parseAIJson(content);
  console.log("JSON Parse OK! Title:", parsed.title, "Days:", parsed.days?.length);
  const validated = ItineraryOutputSchema.safeParse(parsed);
  console.log("Zod Validated:", validated.success);
  if (!validated.success) {
    console.log("Zod Errors:", JSON.stringify(validated.error.issues, null, 2));
  }
}

testFullItinerary().catch(console.error);

