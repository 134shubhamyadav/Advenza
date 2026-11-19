import { aiRouter } from "../ai-router.service.js";
import { parseAIJson } from "../ai-parser.js";
import { apiClient } from "../../../utils/apiClient.js";
import { logger } from "../../../utils/logger.js";
import { z } from "zod";

const DestinationResearchSchema = z.object({
  destinationName: z.string(),
  country: z.string().default("Global"),
  region: z.string().optional().default(""),
  currency: z.string().default("INR"),
  language: z.string().default("English"),
  emergencyNumber: z.string().default("112"),
  overview: z.string().default("A destination offering rich cultural, culinary, and scenic exploration."),
  bestTimeToVisit: z.string().default("October to March"),
  regions: z.array(z.string()).default([]),
  popularAttractions: z.array(
    z.object({
      name: z.string(),
      category: z.string().default("Sightseeing"),
      description: z.string(),
      coordinates: z.object({
        lat: z.number().nullable(),
        lng: z.number().nullable(),
      }).nullable().optional().default(null),
      estimatedVisitingMins: z.number().default(90),
      openingHours: z.string().default("09:00 - 18:00"),
      entryFee: z.object({
        amount: z.number().default(0),
        currency: z.string().default("INR"),
        isFree: z.boolean().default(false),
      }).default({ amount: 0, currency: "INR", isFree: true }),
      whySpecial: z.string().default("Key landmark of destination"),
    })
  ).default([]),
  hiddenGems: z.array(
    z.object({
      name: z.string(),
      category: z.string().default("Local Experience"),
      description: z.string(),
      whySpecial: z.string(),
      estimatedVisitingMins: z.number().default(60),
      coordinates: z.object({
        lat: z.number().nullable(),
        lng: z.number().nullable(),
      }).nullable().optional().default(null),
    })
  ).default([]),
  localDining: z.array(
    z.object({
      name: z.string(),
      cuisine: z.string(),
      priceTier: z.string().default("Mid-Range"),
      specialtyDish: z.string().default("Local specialty"),
    })
  ).default([]),
  transportTips: z.string().default("Use registered taxis and local metro/bus network."),
});

// Cache destination research in-memory (TTL 2 hours)
const destinationResearchCache = new Map();
const CACHE_TTL = 2 * 60 * 60 * 1000;

async function fetchOpenStreetPOIs(destination) {
  try {
    const [restRes, attrRes, mktRes] = await Promise.allSettled([
      apiClient.request(
        `https://nominatim.openstreetmap.org/search?format=json&q=restaurant+in+${encodeURIComponent(destination)}&limit=4`,
        {
          provider: "NominatimRestaurants",
          timeoutMs: 4000,
          headers: { "User-Agent": "AdvenzaDestinationIntelligence/1.0", "Accept-Language": "en" },
        }
      ),
      apiClient.request(
        `https://nominatim.openstreetmap.org/search?format=json&q=attraction+in+${encodeURIComponent(destination)}&limit=4`,
        {
          provider: "NominatimAttractions",
          timeoutMs: 4000,
          headers: { "User-Agent": "AdvenzaDestinationIntelligence/1.0", "Accept-Language": "en" },
        }
      ),
      apiClient.request(
        `https://nominatim.openstreetmap.org/search?format=json&q=market+in+${encodeURIComponent(destination)}&limit=2`,
        {
          provider: "NominatimMarkets",
          timeoutMs: 4000,
          headers: { "User-Agent": "AdvenzaDestinationIntelligence/1.0", "Accept-Language": "en" },
        }
      ),
    ]);

    const extractItems = async (settled) => {
      if (settled.status !== "fulfilled") return [];
      const items = await settled.value.json().catch(() => []);
      return (items || [])
        .map((i) => ({
          name: i.name || i.display_name.split(",")[0],
          lat: parseFloat(i.lat),
          lon: parseFloat(i.lon),
        }))
        .filter((i) => i.name && !isNaN(i.lat));
    };

    const [restaurants, attractions, markets] = await Promise.all([
      extractItems(restRes),
      extractItems(attrRes),
      extractItems(mktRes),
    ]);

    return { restaurants, attractions, markets };
  } catch {
    return { restaurants: [], attractions: [], markets: [] };
  }
}

export class DestinationResearchAgent {
  constructor() {
    this.name = "Destination Research Agent";
  }

  async research({ destination, interests = [], travelers = 1 }) {
    const rawDest = String(destination || "").trim();
    if (!rawDest) {
      throw new Error("Destination name is required for destination research.");
    }

    const cacheKey = `${rawDest.toLowerCase()}:${(Array.isArray(interests) ? interests : []).sort().join(",")}`;
    if (destinationResearchCache.has(cacheKey)) {
      const entry = destinationResearchCache.get(cacheKey);
      if (Date.now() - entry.timestamp < CACHE_TTL) {
        logger.info(`[${this.name}] Cache hit for ${rawDest}`);
        return entry.data;
      }
    }

    logger.info(`[${this.name}] Conducting dynamic research for destination: "${rawDest}"`);

    // Fetch verified OpenStreetMap POIs to ground research with real venues
    const osmData = await fetchOpenStreetPOIs(rawDest);
    let osmGroundTruth = "";
    if (osmData.restaurants.length > 0 || osmData.attractions.length > 0 || osmData.markets.length > 0) {
      osmGroundTruth = `\nVERIFIED REAL-WORLD OPENSTREETMAP GEO-INDEX FOR "${rawDest}":
${osmData.restaurants.length > 0 ? `- Real Local Restaurants/Cafes: ${osmData.restaurants.map((r) => `"${r.name}" (${r.lat}, ${r.lon})`).join(", ")}` : ""}
${osmData.attractions.length > 0 ? `- Real Verified Sights/Attractions: ${osmData.attractions.map((a) => `"${a.name}" (${a.lat}, ${a.lon})`).join(", ")}` : ""}
${osmData.markets.length > 0 ? `- Real Regional Markets/Bazaars: ${osmData.markets.map((m) => `"${m.name}" (${m.lat}, ${m.lon})`).join(", ")}` : ""}
Prioritize these verified real-world places and coordinates in your output. Attach accurate visiting times and regional specialties. Never fabricate fake businesses.`;
    }

    const interestStr = Array.isArray(interests) && interests.length > 0 ? interests.join(", ") : "general culture, food, landmarks, nature";

    const prompt = `You are an expert geographical and travel intelligence researcher.
Conduct thorough, factual, and verified travel research for the actual requested destination: "${rawDest}".
User interests: ${interestStr}. Number of travelers: ${travelers}.
${osmGroundTruth}

CRITICAL ANTI-HALLUCINATION RULES:
1. Research ONLY the actual destination "${rawDest}". Never substitute unrelated cities or default to another country/region.
2. Provide authentic, real-world attractions and locations that genuinely exist in "${rawDest}".
3. Provide realistic visiting durations, approximate GPS coordinates, and opening hours.
4. Distinguish famous Popular Attractions from authentic, verified Hidden Gems (lesser-known local spots with distinct character).
5. Highlight authentic local dining establishments and iconic regional dishes.

Return strictly a valid JSON object matching this schema:
{
  "destinationName": "${rawDest}",
  "country": "Country name where ${rawDest} is located",
  "region": "State, province, or district",
  "currency": "Local currency code (e.g. INR, JPY, EUR, USD, AED, GBP)",
  "language": "Primary local language",
  "emergencyNumber": "National emergency dialing number for this destination (e.g. 112, 911, 100)",
  "overview": "2-3 sentences concise factual overview of ${rawDest}",
  "bestTimeToVisit": "Best seasonal months to visit and why",
  "regions": ["Neighborhood/Zone 1", "Neighborhood/Zone 2", "Neighborhood/Zone 3"],
  "popularAttractions": [
    {
      "name": "Attraction Name",
      "category": "History | Nature | Landmark | Culture | Adventure",
      "description": "Factual description",
      "coordinates": { "lat": 0.0, "lng": 0.0 },
      "estimatedVisitingMins": 90,
      "openingHours": "e.g. 09:00 - 18:00",
      "entryFee": { "amount": 250, "currency": "INR", "isFree": false },
      "whySpecial": "Why this attraction is culturally or historically significant"
    }
  ],
  "hiddenGems": [
    {
      "name": "Hidden Gem Name",
      "category": "Nature | Culture | Art | Viewpoint",
      "description": "Factual description of this lesser-crowded spot",
      "whySpecial": "What makes this specific local experience authentic",
      "estimatedVisitingMins": 60,
      "coordinates": { "lat": 0.0, "lng": 0.0 }
    }
  ],
  "localDining": [
    {
      "name": "Restaurant / Cafe / Food Street Name",
      "cuisine": "Cuisine type",
      "priceTier": "Budget | Mid-Range | Fine Dining",
      "specialtyDish": "Must-try dish"
    }
  ],
  "transportTips": "Specific local commuting advice (metro pass, ride apps, airport transfer advice)"
}`;

    const completionResult = await aiRouter.execute({
      messages: [
        {
          role: "system",
          content: "You are an autonomous destination intelligence agent. Always output valid JSON only.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.2,
      jsonMode: true,
      maxTokens: 4096,
      timeoutMs: 35000,
    });

    const parsedJson = parseAIJson(completionResult.content);
    const validated = DestinationResearchSchema.parse(parsedJson);

    // Attach provider telemetry for Final AI Judge
    validated._telemetry = {
      provider: completionResult.provider,
      model: completionResult.model,
      durationMs: completionResult.durationMs,
      osmPoisDiscovered: osmData.restaurants.length + osmData.attractions.length + osmData.markets.length,
    };

    destinationResearchCache.set(cacheKey, { data: validated, timestamp: Date.now() });
    logger.info(`[${this.name}] Successfully completed research for ${rawDest} via ${completionResult.provider}`);
    return validated;
  }
}

export const destinationResearchAgent = new DestinationResearchAgent();
