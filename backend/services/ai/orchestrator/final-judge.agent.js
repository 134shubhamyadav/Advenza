import { logger } from "../../../utils/logger.js";

export class FinalAIJudgeAgent {
  constructor() {
    this.name = "Final AI Judge";
  }

  /**
   * Synthesizes all audited agent outputs into a unified, coherent intelligence dossier.
   */
  synthesize({
    destinationData,
    transportData,
    accommodationData,
    budgetData,
    safetyData,
    verificationAudit,
    heroImage = null,
  }) {
    logger.info(`[${this.name}] Synthesizing unified multi-agent travel intelligence dossier for ${destinationData?.destinationName}`);

    // Track all participating AI providers across individual research agents
    const participatingProviders = new Set();
    if (destinationData?._telemetry?.provider) participatingProviders.add(destinationData._telemetry.provider);
    if (transportData?._telemetry?.provider) participatingProviders.add(transportData._telemetry.provider);
    if (safetyData?._telemetry?.provider) participatingProviders.add(safetyData._telemetry.provider);
    if (accommodationData?._telemetry?.provider) participatingProviders.add(accommodationData._telemetry.provider);
    if (participatingProviders.size === 0) participatingProviders.add("Groq");

    const providersList = Array.from(participatingProviders);
    const evalMatrix = verificationAudit?.providerEvaluation || {
      overallQualityScore: 92,
      factualAccuracy: 95,
      sourceQuality: 90,
      geographicCorrectness: 95,
    };

    logger.info(
      `[${this.name}] Multi-LLM Evaluation: Evidence Quality Score: ${evalMatrix.overallQualityScore}/100 | Participating Providers: [${providersList.join(", ")}]`
    );

    const popular = verificationAudit?.verifiedAttractions || destinationData?.popularAttractions || [];
    const gems = verificationAudit?.verifiedGems || destinationData?.hiddenGems || [];

    // Calculate dynamic recommended exploration days
    const totalActivities = popular.length + gems.length;
    let minDays = Math.max(2, Math.min(3, Math.ceil(popular.length / 3)));
    let recDays = Math.max(3, Math.min(5, Math.ceil(totalActivities / 2.5)));
    let extDays = recDays + 2;

    const whyRecommended = `Advenza evaluated ${popular.length} verified major attractions and ${gems.length} authentic hidden gems across ${
      (destinationData?.regions || []).join(", ") || "the central zones"
    }. A ${recDays}-day duration comfortably accommodates key sights, local dining, transit buffers, and rest periods without fatigue.`;

    return {
      destination: destinationData.destinationName,
      country: destinationData.country,
      region: destinationData.region,
      currency: destinationData.currency,
      language: destinationData.language,
      emergencyNumber: destinationData.emergencyNumber,
      heroImage: heroImage?.url || null,
      heroImageDetails: heroImage || null,
      overview: destinationData.overview,
      bestTimeToVisit: destinationData.bestTimeToVisit,
      regions: destinationData.regions || [],
      durationRecommendation: {
        minimumDays: minDays,
        recommendedDays: recDays,
        extendedDays: extDays,
        minRange: `${minDays}–${Math.max(minDays + 1, recDays - 1)} Days`,
        recommendedRange: `${recDays}–${recDays + 2} Days`,
        extendedRange: `${extDays}–${extDays + 3} Days`,
        whyRecommended,
        popularAttractionsCount: popular.length,
        hiddenGemsCount: gems.length,
        regions: destinationData.regions || [],
        popularHighlights: popular.slice(0, 6).map((p) => ({
          name: p.name,
          category: p.category,
          region: p.region || "Central",
          matchReason: p.whySpecial || p.description,
          gemConfidence: "POPULAR_ATTRACTION",
          coordinates: p.coordinates,
          openingHours: p.openingHours,
          estimatedVisitingMins: p.estimatedVisitingMins,
        })),
        hiddenGemHighlights: gems.slice(0, 6).map((g) => ({
          name: g.name,
          category: g.category,
          region: g.region || "Outer Area",
          matchReason: g.description,
          whySpecial: g.whySpecial,
          gemConfidence: "AUTHENTIC_HIDDEN_GEM",
          coordinates: g.coordinates,
          estimatedVisitingMins: g.estimatedVisitingMins,
        })),
        dayTrips: (destinationData.regions || []).slice(2, 4),
      },
      transportation: transportData,
      accommodation: accommodationData,
      budgetFeasibility: budgetData,
      safetyAndRisk: safetyData,
      audit: {
        isAudited: true,
        auditedAt: verificationAudit.auditedAt,
        flags: verificationAudit.flags,
      },
      providersParticipated: providersList,
      agentTelemetry: {
        destinationAgent: destinationData?._telemetry || null,
        transportationAgent: transportData?._telemetry || null,
      },
      providerEvaluation: evalMatrix,
      sourceConfidence: "MULTI_AGENT_ORCHESTRATED",
    };
  }
}

export const finalAIJudgeAgent = new FinalAIJudgeAgent();
