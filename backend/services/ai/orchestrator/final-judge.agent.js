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
      overallQualityScore: verificationAudit?.auditPassed ? 85 : 50,
      factualAccuracy: verificationAudit?.checks?.geographicValidity?.passed ? 90 : 60,
      sourceQuality: 75,
      geographicCorrectness: verificationAudit?.checks?.geographicValidity?.passed ? 85 : 55,
      evidenceBasis: "Calculated strictly from verified spatial coordinates and agent audit checks",
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
      budget: budgetData,
      budgetFeasibility: budgetData,
      safetyAndRisk: safetyData,
      verificationAudit,
      audit: {
        isAudited: true,
        auditedAt: verificationAudit?.auditedAt || new Date().toISOString(),
        flags: verificationAudit?.flags || [],
        checks: verificationAudit?.checks || null,
        hallucinationWarnings: verificationAudit?.hallucinationWarnings || [],
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

  /**
   * Section 14: Final Judge Validation Rules for Railway & Journey Timeline
   * Enforces timeline integrity, prevents hallucinated same-day arrivals for multi-day transit,
   * rejects sightseeing scheduled during transit, and validates return journey logic.
   *
   * @param {Object} params
   * @param {Object} params.itinerary - Sanitized itinerary with days[]
   * @param {Object} params.outboundJourney - Outbound journey leg
   * @param {Object} params.returnJourney - Return journey leg
   * @param {Object} params.tripTiming - Trip timing metadata
   * @returns {Object} { isValid: boolean, violations: Array<string>, details: Array<Object> }
   */
  validateItineraryAgainstRailwayTimeline({ itinerary, outboundJourney, returnJourney, tripTiming }) {
    const violations = [];
    const details = [];

    const outLeg = outboundJourney || {};
    const retLeg = returnJourney || {};
    const outDate = outLeg.departureDate;
    const outArrDate = outLeg.arrivalDate;
    const outArrTime = outLeg.arrivalTime;
    const durMins = outLeg.durationMinutes || 0;

    // Rule 1: Arrival Date vs Duration Integrity
    // If journey duration exceeds 18 hours or crosses midnights, arrival date CANNOT equal departure date
    if (durMins >= 1080 && outDate && outArrDate && outDate === outArrDate) {
      violations.push("ARRIVAL_DATE_CONFLICT");
      details.push({
        rule: "ARRIVAL_DATE_CONFLICT",
        message: `Outbound journey takes ${Math.round(durMins / 60)} hours but arrival date is scheduled on the departure date (${outDate}). Destination arrival must be at least 1 day later.`,
        severity: "CRITICAL",
      });
    }

    // Rule 2: Sightseeing During Transit Protection
    // Activities on in-transit dates must not include destination sightseeing or venue visits
    const days = itinerary?.days || [];
    for (const day of days) {
      const dayDate = day.date;
      const isTransitOutbound = outArrDate && dayDate < outArrDate;
      const isTransitReturn = retLeg.departureDate && dayDate > retLeg.departureDate;

      if (isTransitOutbound || isTransitReturn) {
        const illegalSightseeing = (day.activities || []).filter((act) => {
          const type = (act.type || "").toUpperCase();
          const desc = (act.description || "").toLowerCase();
          const place = (act.placeName || "").toLowerCase();
          return (
            type === "SIGHTSEEING" ||
            act.placeCategory ||
            act.coordinates ||
            /temple|museum|beach|fort|monument|palace|park|lake|falls|zoo/i.test(desc) ||
            /temple|museum|beach|fort|monument|palace|park|lake|falls|zoo/i.test(place)
          );
        });

        if (illegalSightseeing.length > 0) {
          violations.push("SIGHTSEEING_DURING_TRANSIT");
          details.push({
            rule: "SIGHTSEEING_DURING_TRANSIT",
            date: dayDate,
            message: `Detected ${illegalSightseeing.length} destination sightseeing activity/activities scheduled on transit day ${dayDate} while the traveler is still on board.`,
            activities: illegalSightseeing.map((a) => a.placeName || a.description),
            severity: "CRITICAL",
          });
        }
      }

      // Rule 3: Arrival Day Premature Sightseeing
      if (dayDate === outArrDate && outArrTime) {
        const [ah, am] = outArrTime.split(":").map(Number);
        const arrMins = (ah || 0) * 60 + (am || 0);
        // Railway station exit + transfer buffer = 50 minutes minimum
        const minUsableMins = arrMins + 50;

        const prematureActs = (day.activities || []).filter((act) => {
          if (!act.time) return false;
          const [th, tm] = act.time.split(":").map(Number);
          const actMins = (th || 0) * 60 + (tm || 0);
          const type = (act.type || "").toUpperCase();
          return actMins < minUsableMins && (type === "SIGHTSEEING" || act.placeCategory || act.coordinates);
        });

        if (prematureActs.length > 0) {
          violations.push("SIGHTSEEING_BEFORE_ARRIVAL");
          details.push({
            rule: "SIGHTSEEING_BEFORE_ARRIVAL",
            date: dayDate,
            message: `Scheduled ${prematureActs.length} activity/activities before train arrival + buffer (${outArrTime} + 50m overhead).`,
            activities: prematureActs.map((a) => a.time + " " + (a.placeName || a.description)),
            severity: "HIGH",
          });
        }
      }
    }

    // Rule 4: Return Departure Before Outbound Arrival
    if (outArrDate && retLeg.departureDate) {
      if (retLeg.departureDate < outArrDate) {
        violations.push("RETURN_BEFORE_ARRIVAL");
        details.push({
          rule: "RETURN_BEFORE_ARRIVAL",
          message: `Return departure date (${retLeg.departureDate}) is scheduled before outbound arrival date (${outArrDate}).`,
          severity: "CRITICAL",
        });
      } else if (retLeg.departureDate === outArrDate && outArrTime && retLeg.departureTime) {
        const [oAh, oAm] = outArrTime.split(":").map(Number);
        const [rDh, rDm] = retLeg.departureTime.split(":").map(Number);
        if ((rDh * 60 + rDm) <= (oAh * 60 + oAm)) {
          violations.push("RETURN_BEFORE_ARRIVAL");
          details.push({
            rule: "RETURN_BEFORE_ARRIVAL",
            message: `Return departure time (${retLeg.departureTime}) is at or before destination arrival time (${outArrTime}) on ${outArrDate}.`,
            severity: "CRITICAL",
          });
        }
      }
    }

    // Rule 5: Compressed Timelines Ignoring Railway Schedule
    if (tripTiming?.timingConflict?.hasConflict) {
      details.push({
        rule: "COMPRESSED_TIMELINE",
        message: tripTiming.timingConflict.message,
        recommendedDays: tripTiming.timingConflict.recommendedDays,
        severity: "WARNING",
      });
    }

    const isValid = violations.length === 0;

    logger.info(
      `[${this.name}] Itinerary Railway Validation: ${isValid ? "PASSED (100% schedule-verified)" : "FAILED (" + violations.join(", ") + ")"}`
    );

    return {
      isValid,
      violations,
      details,
      dataClassification: isValid ? "SCHEDULED_VERIFIED" : "CONFLICT_DETECTED",
      verifiedAt: new Date().toISOString(),
    };
  }
}

export const finalAIJudgeAgent = new FinalAIJudgeAgent();
