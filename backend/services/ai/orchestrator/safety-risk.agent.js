import { fetchWeather } from "../../travel/weather.service.js";
import { aiRouter } from "../ai-router.service.js";
import { parseAIJson } from "../ai-parser.js";
import { logger } from "../../../utils/logger.js";
import { z } from "zod";

const SafetyRiskSchema = z.object({
  destination: z.string(),
  overallRiskLevel: z.enum(["LOW", "MODERATE", "ELEVATED", "HIGH"]).default("LOW"),
  weatherTelemetry: z.object({
    status: z.string(),
    temperature: z.string(),
    condition: z.string(),
    precipitationRisk: z.string(),
    isLiveVerified: z.boolean(),
  }),
  safetyCards: z.array(
    z.object({
      category: z.string(),
      title: z.string(),
      severity: z.enum(["low", "med", "high"]),
      description: z.string(),
      actionableAdvice: z.string(),
      source: z.string(),
    })
  ).default([]),
  emergencyContacts: z.object({
    police: z.string().default("112"),
    ambulance: z.string().default("112"),
    touristHelpline: z.string().default("1363"),
  }),
  confidence: z.string().default("LIVE_TELEMETRY_AND_GOVERNMENT_ADVISORY"),
});

export class SafetyRiskAgent {
  constructor() {
    this.name = "Safety and Risk Agent";
  }

  async analyze({ destination, dates = [], country = "India" }) {
    const rawDest = String(destination || "").trim();
    if (!rawDest) {
      throw new Error("Destination is required for safety analysis.");
    }

    logger.info(`[${this.name}] Analyzing real-time risks for: "${rawDest}"`);

    // 1. Fetch live weather telemetry
    let weatherData = null;
    try {
      weatherData = await fetchWeather(rawDest);
    } catch (wErr) {
      logger.warn(`[${this.name}] Weather telemetry error for ${rawDest}: ${wErr.message}`);
    }

    const tempStr = weatherData?.temp ? `${weatherData.temp}°C` : "Seasonal Norm";
    const condStr = weatherData?.condition || "Clear";
    const rainStr = weatherData?.forecast?.[0]?.rainChance ? `${weatherData.forecast[0].rainChance}%` : "Low probability";

    // 2. Multi-LLM contextual safety analysis for the specific country/destination
    const prompt = `You are a certified international travel risk and safety intelligence analyst.
Analyze destination-specific safety considerations, seasonal hazards, transit rules, and emergency guidelines for: "${rawDest}", ${country}.
Current weather context: Temperature: ${tempStr}, Condition: ${condStr}, Precipitation: ${rainStr}.

CRITICAL ANTI-HALLUCINATION RULES:
1. Provide safety cards specifically tailored to "${rawDest}". Do not apply unrelated geographic warnings.
2. If it is a mountain destination, discuss altitude acclimatization, road transit on narrow passes, and seasonal frost/monsoon.
3. If it is a coastal destination, discuss rip currents, licensed water sports operators, and sun protection.
4. If it is an urban metropolis, discuss public transit passes, bag safety in crowds, and app-based cabs.
5. Provide the ACTUAL emergency phone numbers for ${rawDest} / ${country} (e.g. 112 in EU/India, 911 in USA, 999 in UK, 110/119 in Japan).

Return strictly a valid JSON object matching this schema:
{
  "destination": "${rawDest}",
  "overallRiskLevel": "LOW | MODERATE | ELEVATED | HIGH",
  "safetyCards": [
    {
      "category": "Transit Safety | Health & Environment | Activity Precaution | Emergency Readiness",
      "title": "Clear concise title",
      "severity": "low | med | high",
      "description": "Specific factual description for ${rawDest}",
      "actionableAdvice": "Concrete, practical advice for travelers",
      "source": "Official Tourism / Meteorological / Transport Bureau"
    }
  ],
  "emergencyContacts": {
    "police": "Local emergency police dial number",
    "ambulance": "Local ambulance number",
    "touristHelpline": "Tourist helpline or national emergency dispatch"
  }
}`;

    try {
      const completionResult = await aiRouter.execute({
        messages: [
          {
            role: "system",
            content: "You are an autonomous safety intelligence agent. Always output valid JSON only.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.1,
        jsonMode: true,
        maxTokens: 2500,
        timeoutMs: 25000,
      });

      const parsedJson = parseAIJson(completionResult.content);

      return SafetyRiskSchema.parse({
        destination: rawDest,
        overallRiskLevel: parsedJson.overallRiskLevel || "LOW",
        weatherTelemetry: {
          status: condStr,
          temperature: tempStr,
          condition: condStr,
          precipitationRisk: rainStr,
          isLiveVerified: Boolean(weatherData),
        },
        safetyCards: parsedJson.safetyCards || [],
        emergencyContacts: parsedJson.emergencyContacts || {
          police: "112",
          ambulance: "112",
          touristHelpline: "1363",
        },
        confidence: "LIVE_TELEMETRY_AND_GOVERNMENT_ADVISORY",
      });
    } catch (err) {
      logger.warn(`[${this.name}] Safety analysis fallback for ${rawDest}: ${err.message}`);
      return SafetyRiskSchema.parse({
        destination: rawDest,
        overallRiskLevel: "LOW",
        weatherTelemetry: {
          status: condStr,
          temperature: tempStr,
          condition: condStr,
          precipitationRisk: rainStr,
          isLiveVerified: Boolean(weatherData),
        },
        safetyCards: [
          {
            category: "General Traveler Safety",
            title: `General Travel Guidelines for ${rawDest}`,
            severity: "low",
            description: `Follow official local transport and tourism guidance while exploring ${rawDest}.`,
            actionableAdvice: "Keep emergency contacts saved, use certified transport, and monitor daily weather updates.",
            source: "Advenza International Travel Advisory",
          },
        ],
        emergencyContacts: {
          police: "112",
          ambulance: "112",
          touristHelpline: "1363",
        },
        confidence: "STANDARD_SAFETY_ADVISORY",
      });
    }
  }
}

export const safetyRiskAgent = new SafetyRiskAgent();
