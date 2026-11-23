import { aiRouter } from "../ai-router.service.js";
import { parseAIJson } from "../ai-parser.js";
import { osrmRoutingService } from "../../travel/osrm-routing.service.js";
import { weatherProvider } from "../../travel/providers/weather.provider.js";
import { logger } from "../../../utils/logger.js";
import { z } from "zod";

const TransportResearchSchema = z.object({
  origin: z.string(),
  destination: z.string(),
  distanceKm: z.number().default(0),
  recommendedModes: z.array(
    z.object({
      mode: z.preprocess((val) => {
        const s = String(val || "").toLowerCase();
        if (s.includes("train") || s.includes("rail") || s.includes("shinkansen") || s.includes("metro")) return "Train";
        if (s.includes("flight") || s.includes("plane") || s.includes("air")) return "Flight";
        if (s.includes("bus") || s.includes("coach")) return "Bus";
        if (s.includes("car") || s.includes("drive") || s.includes("road") || s.includes("taxi")) return "Drive";
        if (s.includes("ferry") || s.includes("boat") || s.includes("ship")) return "Ferry";
        return "Train";
      }, z.enum(["Flight", "Train", "Bus", "Drive", "Ferry"])),
      isDirectAvailable: z.boolean().default(true),
      durationHours: z.number().default(2),
      outboundRoute: z.string(),
      returnRoute: z.string(),
      pricePerPersonINR: z.number().default(1500),
      totalRoundTripForGroupINR: z.number().default(3000),
      lastMileInfo: z.object({
        nearestTerminal: z.string().default("City Station / Airport"),
        distanceToCenterKm: z.number().default(15),
        recommendedLocalMode: z.string().default("Prepaid Taxi / Metro"),
        estimatedFareINR: z.number().default(500),
      }).default({
        nearestTerminal: "City Center Terminal",
        distanceToCenterKm: 15,
        recommendedLocalMode: "Prepaid Taxi",
        estimatedFareINR: 500,
      }),
      priceType: z.enum(["LIVE_VERIFIED", "INDICATIVE_RESEARCH", "HISTORICAL_ESTIMATE"]).default("INDICATIVE_RESEARCH"),
      bookingAdvice: z.string().default("Book in advance for best fares."),
      trainDetails: z.any().optional(),
    })
  ).default([]),
  bestOption: z.string().default("Flight"),
  summary: z.string().default("Transportation options evaluated between origin and destination."),
  railcoreData: z.any().optional(),
});

export class TransportationResearchAgent {
  constructor() {
    this.name = "Transportation Research Agent";
  }

  async research({
    origin,
    destination,
    preferredMode = null,
    travelers = 1,
    journeyDate = null,
    preferredClass = "3A",
  }) {
    const rawDest = String(destination || "").trim();
    const rawOrigin = String(origin || "").trim();

    if (!rawDest) {
      throw new Error("Destination is required for transportation research.");
    }

    const effectiveOrigin = rawOrigin || "Nearest Major Metropolitan Hub";
    logger.info(`[${this.name}] Researching transportation routes: ${effectiveOrigin} → ${rawDest} for ${travelers} traveler(s)`);

    // 1. Concurrently check live OSRM road routing
    let osrmRoute = null;
    let nearbyHubs = { station: null, airport: null };

    try {
      const [origGeo, destGeo] = await Promise.all([
        weatherProvider.geocode(effectiveOrigin).catch(() => null),
        weatherProvider.geocode(rawDest).catch(() => null),
      ]);

      const tasks = [];

      if (origGeo?.latitude && destGeo?.latitude) {
        tasks.push(
          osrmRoutingService.calculateDrivingRoute({
            origin: { lat: origGeo.latitude, lon: origGeo.longitude },
            destination: { lat: destGeo.latitude, lon: destGeo.longitude },
          }).then((r) => { osrmRoute = r; }).catch(() => null),
          osrmRoutingService.discoverNearbyTransitHubs(rawDest, {
            lat: destGeo.latitude,
            lon: destGeo.longitude,
          }).then((h) => { nearbyHubs = h; }).catch(() => null)
        );
      }

      await Promise.allSettled(tasks);
    } catch (geoErr) {
      logger.warn(`[${this.name}] Live transit lookups skipped: ${geoErr.message}`);
    }

    let groundTruthNote = "";
    if (osrmRoute) {
      groundTruthNote += `\nVERIFIED OSRM ROAD NETWORK GROUND TRUTH:
- Real road driving distance: ${osrmRoute.distanceKm} km (turn-by-turn road curvature)
- Driving duration: ${osrmRoute.durationHours} hours (${osrmRoute.durationMins} mins)
- Real estimated fuel cost: ~₹${osrmRoute.fuelCostINR} (passenger car, 14 km/L at standard fuel rates)
- Real estimated highway tolls: ~₹${osrmRoute.estimatedTollsINR}
Integrate this exact road distance into your "Drive" option and set priceType to "LIVE_VERIFIED".`;
    }

    if (nearbyHubs.station || nearbyHubs.airport) {
      groundTruthNote += `\nVERIFIED DESTINATION TRANSIT TERMINALS:
${nearbyHubs.station ? `- Railway Station: "${nearbyHubs.station.name}" (Lat: ${nearbyHubs.station.lat}, Lon: ${nearbyHubs.station.lon})` : ""}
${nearbyHubs.airport ? `- Airport: "${nearbyHubs.airport.name}" (Lat: ${nearbyHubs.airport.lat}, Lon: ${nearbyHubs.airport.lon})` : ""}
Use these actual terminals for last-mile logistics calculations.`;
    }

    const prompt = `You are an expert transportation routing and fare intelligence agent.
Research realistic transportation options between origin: "${effectiveOrigin}" and destination: "${rawDest}" for ${travelers} traveler(s).
User preferred mode if any: "${preferredMode || "Any suitable mode"}".
${groundTruthNote}

CRITICAL ROUTING RULES:
1. Identify if the destination has its own commercial airport or railway junction, or if travelers must arrive at a nearby hub and take onward road transit (e.g. airport in Goa Dabolim/Mopa, train to Madgaon; or for hill stations arrive at Chandigarh/Kalka/Dehradun and drive).
2. Calculate realistic round-trip indicative costs per person and total group costs in INR.
3. Factor in last-mile transit duration and fare from the terminal/hub to the destination center.
4. Categorize available modes: Flight, Train, Bus, Drive (car rental/taxi/self-drive), or Ferry where applicable.
5. Set priceType to "LIVE_VERIFIED" if using the verified OSRM road calculations above, or "INDICATIVE_RESEARCH" for verified multi-LLM research estimates. Never fabricate live booking availability.

Return strictly a valid JSON object matching this schema:
{
  "origin": "${effectiveOrigin}",
  "destination": "${rawDest}",
  "distanceKm": ${osrmRoute?.distanceKm || 450},
  "recommendedModes": [
    {
      "mode": "Flight | Train | Bus | Drive | Ferry",
      "isDirectAvailable": true,
      "durationHours": 2.5,
      "outboundRoute": "Origin Hub → Destination Hub",
      "returnRoute": "Destination Hub → Origin Hub",
      "pricePerPersonINR": 4500,
      "totalRoundTripForGroupINR": 9000,
      "lastMileInfo": {
        "nearestTerminal": "Airport / Railway Station name",
        "distanceToCenterKm": 25,
        "recommendedLocalMode": "Prepaid Taxi / Airport Bus / Metro",
        "estimatedFareINR": 600
      },
      "priceType": "INDICATIVE_RESEARCH",
      "bookingAdvice": "Recommended advance booking window and airline/rail operators"
    }
  ],
  "bestOption": "Mode name",
  "summary": "Brief 1-2 sentence comparison of speed vs cost across modes"
}`;

    const completionResult = await aiRouter.execute({
      messages: [
        {
          role: "system",
          content: "You are an autonomous transportation intelligence agent. Always output valid JSON only.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.2,
      jsonMode: true,
      maxTokens: 3000,
      timeoutMs: 30000,
    });

    const parsedJson = parseAIJson(completionResult.content) || {};

    // If OSRM provided live drive route, ensure Drive mode has live verified details
    if (osrmRoute && Array.isArray(parsedJson.recommendedModes)) {
      const driveMode = parsedJson.recommendedModes.find(
        (m) => String(m.mode).toLowerCase() === "drive"
      );
      if (driveMode) {
        driveMode.durationHours = osrmRoute.durationHours;
        driveMode.priceType = "LIVE_VERIFIED";
        driveMode.bookingAdvice = `Live OSRM highway route: ${osrmRoute.distanceKm} km (${osrmRoute.durationHours} hrs). Est. fuel: ₹${osrmRoute.fuelCostINR}, tolls: ~₹${osrmRoute.estimatedTollsINR}.`;
      }
    }

    const validated = TransportResearchSchema.parse({
      ...parsedJson,
      origin: parsedJson.origin || effectiveOrigin,
      destination: parsedJson.destination || rawDest,
      distanceKm: osrmRoute?.distanceKm || parsedJson.distanceKm || 0,
      summary: parsedJson.summary || parsedJson.overview || `Travel options connecting ${effectiveOrigin} and ${rawDest}.`,
    });

    // Attach provider telemetry for Final AI Judge
    validated._telemetry = {
      provider: completionResult.provider,
      model: completionResult.model,
      durationMs: completionResult.durationMs,
      hasLiveRouting: Boolean(osrmRoute),
    };

    return validated;
  }
}

export const transportationResearchAgent = new TransportationResearchAgent();
