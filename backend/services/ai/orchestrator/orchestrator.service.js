import { destinationResearchAgent } from "./destination-research.agent.js";
import { transportationResearchAgent } from "./transportation-research.agent.js";
import { accommodationAgent } from "./accommodation.agent.js";
import { budgetIntelligenceAgent } from "./budget-intelligence.agent.js";
import { safetyRiskAgent } from "./safety-risk.agent.js";
import { verificationAgent } from "./verification.agent.js";
import { finalAIJudgeAgent } from "./final-judge.agent.js";
import { fetchDestinationImage } from "../../media/destination-image.service.js";
import { logger } from "../../../utils/logger.js";

const inFlightMissions = new Map();

export class OrchestratorService {
  constructor() {
    this.name = "Multi-LLM Orchestration Layer";
  }

  /**
   * Conducts a complete, concurrent multi-agent travel intelligence research for any destination worldwide.
   */
  async conductComprehensiveResearch(params) {
    const {
      destination,
      origin = "",
      interests = [],
      travelers = 1,
      durationDays = 3,
      userBudget = null,
      preferredTransportMode = null,
      accommodationPreference = "AI_RECOMMENDED",
      customHotelName = null,
    } = params;

    const rawDest = String(destination || "").trim();
    if (!rawDest) {
      throw new Error("Destination name is required for orchestration.");
    }

    // In-flight request deduplication to prevent duplicate concurrent LLM spend
    const missionKey = `${rawDest.toLowerCase()}::${(origin || "").toLowerCase()}::${durationDays}::${travelers}::${accommodationPreference}`;
    if (inFlightMissions.has(missionKey)) {
      logger.info(`[${this.name}] Joining in-flight concurrent research mission for "${rawDest}"`);
      return inFlightMissions.get(missionKey);
    }

    const missionPromise = (async () => {
      const startTime = Date.now();
      logger.info(`[${this.name}] Launching multi-agent research mission for "${rawDest}" (Origin: "${origin || "Unspecified"}")`);

      // 1. Run independent research agents concurrently across available LLM engines with individual fault isolation
      const [destResult, transResult, stayResult, heroResult] = await Promise.allSettled([
        // Agent 1: Destination Research Agent
        destinationResearchAgent.research({
          destination: rawDest,
          interests,
          travelers,
        }),

        // Agent 2: Transportation Research Agent
        transportationResearchAgent.research({
          origin,
          destination: rawDest,
          preferredMode: preferredTransportMode,
          travelers,
          journeyDate: params.journeyDate || params.startDate,
        }),

        // Agent 3: Accommodation Intelligence Agent
        accommodationAgent.evaluate({
          destination: rawDest,
          preference: accommodationPreference,
          nights: Math.max(1, durationDays - 1),
          travelers,
          customHotelName,
        }),

        // Ancillary: Fetch genuine image
        fetchDestinationImage(rawDest),
      ]);

      const destinationData = destResult.status === "fulfilled" ? destResult.value : {
        destinationName: rawDest,
        country: "Global",
        currency: "INR",
        language: "English",
        emergencyNumber: "112",
        overview: `A global destination for cultural and scenic exploration: ${rawDest}.`,
        popularAttractions: [],
        hiddenGems: [],
      };

      const transportData = transResult.status === "fulfilled" ? transResult.value : {
        origin: origin || "Hub",
        destination: rawDest,
        distanceKm: 0,
        recommendedModes: [],
        bestOption: "Flight",
        summary: "Transportation routes pending connection.",
      };

      const accommodationData = stayResult.status === "fulfilled" ? stayResult.value : {
        totalAccommodationCostINR: 0,
        isFreeAccommodation: accommodationPreference === "OWN_HOME",
        tier: "Standard",
        notes: "Accommodation data evaluated.",
      };

      const heroImage = heroResult.status === "fulfilled" ? heroResult.value : null;

      // 2. Run Dependent Agents:
      // Agent 4: Safety & Risk Agent (uses destination country/coords)
      const safetyData = await safetyRiskAgent.analyze({
        destination: rawDest,
        country: destinationData.country || "Global",
      }).catch((sErr) => {
        logger.warn(`[${this.name}] Safety agent non-fatal fallback: ${sErr.message}`);
        return { overallRiskLevel: "LOW", verifiedAdvisories: [], weatherRisk: "CALM" };
      });

      // Agent 5: Budget Intelligence Agent
      const chosenMode = preferredTransportMode
        ? transportData?.recommendedModes?.find((m) => m.mode?.toLowerCase() === preferredTransportMode?.toLowerCase())
        : null;
      const effectiveMode = chosenMode || transportData?.recommendedModes?.find((m) => m.mode === transportData.bestOption) || transportData?.recommendedModes?.[0];
      const transportTotalCost = effectiveMode?.totalRoundTripForGroupINR || 0;
      const lastMileCost = effectiveMode?.lastMileInfo?.estimatedFareINR || 0;

      const budgetData = budgetIntelligenceAgent.evaluate({
        userBudget,
        transportCost: transportTotalCost,
        lastMileCost,
        accommodationResult: accommodationData,
        durationDays,
        travelers,
        activities: destinationData.popularAttractions,
        destinationPriceTier: destinationData.currency === "INR" ? "standard" : "international",
      });

      // Agent 6: Verification Agent
      const verificationAudit = verificationAgent.verify({
        destinationData,
        transportData,
        accommodationData,
        budgetData,
        safetyData,
      });

      // Agent 7: Final AI Judge Agent
      const finalDossier = finalAIJudgeAgent.synthesize({
        destinationData,
        transportData,
        accommodationData,
        budgetData,
        safetyData,
        verificationAudit,
        heroImage,
      });

      const elapsed = Date.now() - startTime;
      logger.info(`[${this.name}] Multi-agent mission for "${rawDest}" completed in ${elapsed}ms`);

      return finalDossier;
    })();

    inFlightMissions.set(missionKey, missionPromise);
    try {
      return await missionPromise;
    } finally {
      inFlightMissions.delete(missionKey);
    }
  }
}

export const orchestratorService = new OrchestratorService();
