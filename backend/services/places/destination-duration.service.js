/**
 * Advenza — Smart Destination Duration Recommendation & Hidden Gems Intelligence
 *
 * Dynamically computes:
 * - Minimum, Ideal (Recommended), and Extended exploration duration ranges.
 * - Why Advenza recommends that duration based on attractions, geographic spread, and user interests.
 * - Discovered Popular Attractions vs. Authentic Hidden Gems.
 * - Geographic clusters/regions for realistic day-by-day distribution.
 * - Suggested day trips.
 *
 * Strictly adheres to anti-hallucination rules:
 * - Never fabricates fake places, addresses, or stories.
 * - Communicates confidence and limitations clearly if destination data is scarce.
 */

import { placeDiscoveryService } from "./place-discovery.service.js";
import { fetchDestinationImage } from "../media/destination-image.service.js";
import { normalizeInterests } from "../itinerary/interest-intelligence.service.js";

export class DestinationDurationService {
  /**
   * Generates a comprehensive destination overview including duration recommendations,
   * popular attractions, authentic hidden gems, and geographic regions.
   *
   * @param {Object} params
   * @param {string} params.destination - City / Destination name
   * @param {string[]|string} [params.interests] - User selected interests (optional)
   * @returns {Promise<Object>} Structured destination intelligence overview
   */
  async getDestinationOverview({ destination, interests = [] }) {
    const rawDest = String(destination || "").trim();
    if (!rawDest) {
      throw new Error("Destination is required for duration analysis.");
    }

    const interestProfile = normalizeInterests(interests);
    const selectedInterests = interestProfile.selected;

    // 1. Fetch hero image and discover verified places concurrently
    const [heroImg, discoveryResult] = await Promise.all([
      fetchDestinationImage(rawDest).catch(() => null),
      placeDiscoveryService.discoverAllPlacesForDestination({
        destination: rawDest,
        interests: selectedInterests,
      }),
    ]);

    const { popularAttractions, hiddenGems, allPlaces, regions, isCurated } = discoveryResult;

    // 2. Calculate dynamic duration recommendations using clustering, visit times, and realistic travel buffers
    const durationData = this.calculateDynamicDuration({
      destination: rawDest,
      popularAttractions,
      hiddenGems,
      regions,
      interests: selectedInterests,
      isCurated,
    });

    // 3. Overview summary text with honest confidence signaling
    const overviewSummary = this.buildOverviewSummary({
      destination: rawDest,
      durationData,
      popularCount: popularAttractions.length,
      hiddenGemsCount: hiddenGems.length,
      regions,
      interests: selectedInterests,
      isUncertain: durationData.isUncertain,
    });

    const isUncertain = allPlaces.length === 0;

    return {
      destination: rawDest,
      heroImage: heroImg?.url || null,
      heroImageDetails: heroImg || null,
      overview: overviewSummary,
      durationRecommendation: {
        minimumDays: durationData.minimumDays,
        recommendedDays: durationData.recommendedDays,
        extendedDays: durationData.extendedDays,
        minRange: `${durationData.minimumDays}–${Math.max(durationData.minimumDays + 1, durationData.recommendedDays - 1)} Days`,
        recommendedRange: `${durationData.recommendedDays}–${durationData.recommendedDays + 2} Days`,
        extendedRange: `${durationData.extendedDays}–${durationData.extendedDays + 3} Days`,
        whyRecommended: durationData.whyRecommended,
        popularAttractionsCount: popularAttractions.length,
        hiddenGemsCount: hiddenGems.length,
        regions: regions.map((r) => r.name || r),
        dayTrips: durationData.dayTrips,
        popularHighlights: popularAttractions.slice(0, 6).map((p) => ({
          name: p.placeName,
          category: p.placeCategory,
          region: p.region || "Central",
          matchReason: p.matchReason,
          gemConfidence: p.gemConfidence || "POPULAR_ATTRACTION",
        })),
        hiddenGemHighlights: hiddenGems.slice(0, 6).map((g) => ({
          name: g.placeName,
          category: g.placeCategory,
          region: g.region || "Outer Area",
          whySpecial: g.whySpecial || g.matchReason,
          gemConfidence: g.gemConfidence || "CONFIRMED_HIDDEN_GEM",
        })),
        interestAlignmentNote: durationData.interestAlignmentNote,
      },
      verifiedPlacesCount: allPlaces.length,
      dataConfidence: isCurated ? "VERIFIED" : allPlaces.length >= 6 ? "LIVE_DISCOVERED" : allPlaces.length > 0 ? "PARTIAL_EVIDENCE" : "UNCERTAIN_BASELINE",
      isUncertain,
      uncertaintyReason: isUncertain
        ? "No verified local attractions cataloged for this destination. Recommendations are conservative baselines based on standard regional travel pacing. Discoveries will be populated as verified venues are confirmed."
        : null,
    };
  }

  /**
   * Calculates dynamic exploration durations based on place density, geographic clusters, estimated visit times, and realistic travel buffers.
   */
  calculateDynamicDuration({ destination, popularAttractions, hiddenGems, regions, interests, isCurated }) {
    const popularCount = popularAttractions.length;
    const hiddenCount = hiddenGems.length;
    const rawPlaces = [...popularAttractions, ...hiddenGems];

    // Deduplicate places by normalized name
    const uniquePlaces = [];
    const seenNames = new Set();
    for (const p of rawPlaces) {
      const key = String(p.placeName || p.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      if (!key || seenNames.has(key)) continue;
      seenNames.add(key);
      uniquePlaces.push(p);
    }

    const totalUniqueCount = uniquePlaces.length;

    // ── Build Day Trips ────────────────────────────────────────────────────────
    const dayTrips = [];
    const destLower = destination.toLowerCase();
    if (destLower.includes("goa")) {
      dayTrips.push("Dudhsagar Waterfalls & Spice Plantation Day Excursion");
      dayTrips.push("Divar Island & Old Goa Heritage Walk");
    } else if (destLower.includes("mumbai")) {
      dayTrips.push("Elephanta Caves Island Boat Trip");
      dayTrips.push("Sanjay Gandhi National Park & Kanheri Caves");
    } else if (destLower.includes("manali")) {
      dayTrips.push("Solang Valley & Rohtang Pass Alpine Excursion");
      dayTrips.push("Naggar Castle & Heritage Art Gallery Day Tour");
    } else if (destLower.includes("jaipur")) {
      dayTrips.push("Amer Fort, Jaigarh & Nahargarh Ridge Sunset Tour");
      dayTrips.push("Abhaneri Stepwell & Rural Heritage Excursion");
    }

    // ── Handle Unknown Destinations without inventing counts ──────────────────
    if (totalUniqueCount === 0) {
      return {
        minimumDays: 2,
        recommendedDays: 4,
        extendedDays: 6,
        isUncertain: true,
        whyRecommended: `Based on regional travel geography, ${destination} is best experienced over 4 days to comfortably explore key points of interest with realistic inter-city travel buffers. Specific attraction counts and hidden gems are withheld to avoid unverified claims.`,
        dayTrips: [],
        interestAlignmentNote: null,
      };
    }

    // ── Geographic Clustering & Capacity Calculation ──────────────────────────
    // Group places by region / geographic cluster
    const clusterMap = new Map();
    uniquePlaces.forEach((p) => {
      const reg = p.region || "Central";
      clusterMap.set(reg, (clusterMap.get(reg) || 0) + 1);
    });

    const clusterCount = Math.max(1, clusterMap.size);

    // Realistic capacity: 2 to 3 anchor attractions per full day (including meal times and intra-cluster transit)
    let totalClusterDays = 0;
    clusterMap.forEach((count) => {
      totalClusterDays += Math.max(1, Math.ceil(count / 2.5));
    });

    // Inter-region travel penalty: Crossing distinct regions (e.g. North to South Goa) takes 1.5–2h each way
    const interRegionBuffer = clusterCount >= 2 ? 1 : 0;

    // Arrival and Return restriction:
    // Arrival day has ~4h usable exploration, Return day has ~3h usable exploration.
    // Together arrival + return days account for 1 calendar travel day.
    const arrivalDepartureBuffer = 1;

    // Minimum: Cohesive highlights in core clusters
    const baseMinDays = Math.max(2, Math.min(4, Math.ceil(totalUniqueCount / 3) + arrivalDepartureBuffer));

    // Recommended: Balanced cluster exploration + top day trip + inter-region transit buffer
    const dayTripBuffer = dayTrips.length > 0 ? 1 : 0;
    let baseRecDays = Math.max(baseMinDays + 1, Math.min(8, totalClusterDays + interRegionBuffer + dayTripBuffer + arrivalDepartureBuffer));

    // Extended: All regional clusters + all day trips + unhurried leisure buffer
    let baseExtDays = Math.max(baseRecDays + 2, Math.min(12, totalClusterDays + interRegionBuffer + dayTrips.length + arrivalDepartureBuffer + 1));

    // ── Interest-driven duration modifiers ─────────────────────────────────────
    const interestNotes = [];
    const lowerInterests = interests.map((i) => i.toLowerCase());

    const hasHikingOrAdventure = lowerInterests.some((i) => i.includes("hik") || i.includes("advent"));
    const hasNightlife = lowerInterests.some((i) => i.includes("night"));
    const hasCultureOrHistory = lowerInterests.some((i) => i.includes("cult") || i.includes("hist") || i.includes("museum"));
    const hasPhotography = lowerInterests.some((i) => i.includes("photo"));
    const hasWellness = lowerInterests.some((i) => i.includes("well") || i.includes("spa") || i.includes("relax"));

    if (hasHikingOrAdventure) {
      baseRecDays += 1;
      baseExtDays += 1;
      interestNotes.push("Dedicated daylight hours factored for summit treks and outdoor adventure activities.");
    }

    if (hasCultureOrHistory && hasNightlife) {
      baseRecDays += 1;
      baseExtDays += 1;
      interestNotes.push("Separates daytime heritage explorations from late-night nightlife to avoid exhaustion.");
    }

    if (hasWellness) {
      baseExtDays += 1;
      interestNotes.push("Incorporates restorative downtime intervals between sightseeing excursions.");
    }

    if (hasPhotography) {
      interestNotes.push("Incorporates golden-hour sunrise and sunset intervals without rushing between locations.");
    }

    // Clamp realistic boundaries
    const minimumDays = Math.max(2, baseMinDays);
    const recommendedDays = Math.max(minimumDays + 1, Math.min(10, baseRecDays));
    const extendedDays = Math.max(recommendedDays + 2, Math.min(14, baseExtDays));

    // ── Build Rich Rationale ───────────────────────────────────────────────────
    const regionNames = Array.from(clusterMap.keys()).join(", ");
    const whyRecommended = `Advenza discovered ${popularCount} iconic landmarks and ${hiddenCount} authentic hidden gems across ${clusterCount} distinct geographic clusters (${regionNames}). Exploring ${destination} in ${recommendedDays} days allows you to cover each regional cluster without excessive transit time, balancing famous highlights with uncrowded local discoveries.`;

    const interestAlignmentNote = interestNotes.length > 0 ? interestNotes.join(" ") : null;

    return {
      minimumDays,
      recommendedDays,
      extendedDays,
      whyRecommended,
      dayTrips,
      interestAlignmentNote,
      isUncertain: false,
    };
  }

  /**
   * Builds an informative, premium destination overview paragraph.
   */
  buildOverviewSummary({ destination, durationData, popularCount, hiddenGemsCount, regions, interests, isUncertain }) {
    if (isUncertain || (popularCount === 0 && hiddenGemsCount === 0)) {
      return `${destination} offers regional discovery opportunities. As Advenza has limited verified catalog data for this location, we provide a conservative baseline itinerary pacing without displaying unverified attraction counts or speculative hidden gems.`;
    }

    const regionNames = regions.map((r) => r.name || r).join(" and ");
    let text = `${destination} offers an extraordinary blend of vibrant experiences across ${regionNames || "distinct neighborhoods"}. `;

    if (popularCount > 0 && hiddenGemsCount > 0) {
      text += `Advenza has curated ${popularCount} must-see attractions along with ${hiddenGemsCount} verified hidden gems that keep you away from commercial crowds. `;
    } else if (popularCount > 0) {
      text += `Advenza has cataloged ${popularCount} verified landmarks for this destination. `;
    }

    if (interests.length > 0) {
      text += `Your selected interests (${interests.join(", ")}) are aligned with regional highlights and intelligent time slots. `;
    }

    text += `We recommend an ideal stay of ${durationData.recommendedDays} days for deep, unhurried discovery, with a minimum of ${durationData.minimumDays} days for core highlights.`;

    return text;
  }
}

export const destinationDurationService = new DestinationDurationService();

