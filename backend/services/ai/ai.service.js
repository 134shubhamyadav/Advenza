import Trip from "../../models/Trip.js";
import { aiRouter } from "./ai-router.service.js";
import { parseAIJson } from "./ai-parser.js";
import { executeWithSchema } from "./ai-retry.service.js";
import { ItineraryOutputSchema, PlanBOutputSchema, PackingOutputSchema } from "../../schemas/ai.schemas.js";
import { buildItineraryPrompt } from "../itinerary/prompt-builder.js";
import { generateTripDates, validateAndSanitizeItinerary } from "../itinerary/itinerary-sanitizer.js";
import { normalizeDestination, fetchWeather } from "../travel/weather.service.js";
import { evaluateRiskEngine } from "../travel/risk-engine.service.js";
import { hotelProvider } from "../travel/providers/hotel.provider.js";
import { flightProvider } from "../travel/providers/flight.provider.js";
import { computeJourneys } from "../travel/journey-engine.service.js";
import { enrichTripWithInterstopRouting } from "../travel/interstop-routing.service.js";
import { fetchDestinationImage } from "../media/destination-image.service.js";
import { placeDiscoveryService } from "../places/place-discovery.service.js";
import { destinationDurationService } from "../places/destination-duration.service.js";
import { orchestratorService } from "./orchestrator/orchestrator.service.js";
import { finalAIJudgeAgent } from "./orchestrator/final-judge.agent.js";
import { conversationalAIService } from "./conversational-ai.service.js";
import { NotFoundError, ValidationError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";
import { config } from "../../config/env.js";

// Cache for packing lists: key -> { data, timestamp }
const packingCache = new Map();
const PACKING_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// Cache for risk results: key -> { data, timestamp }
const riskResultCache = new Map();
const RISK_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

export function getRegionalSafetyFallback(city) {
  const c = (city || "").toLowerCase();

  // Himalayan & Hill Stations
  if (
    c.includes("manali") || c.includes("shimla") || c.includes("leh") ||
    c.includes("ladakh") || c.includes("kashmir") || c.includes("rishikesh") ||
    c.includes("dharamshala") || c.includes("mussoorie") || c.includes("nainital") ||
    c.includes("gangtok") || c.includes("darjeeling")
  ) {
    return [
      {
        key: "transport_local",
        label: "Mountain Transit & Route Safety",
        level: "med",
        summary: `Hilly terrain and narrow mountain corridors in ${city}. Winter frost, monsoon landslides, and road closures can occur during severe weather.`,
        tips: ["Hire experienced local hill drivers or authorized taxi union cabs", "Avoid driving after sunset on high mountain passes"],
        recommendation: "Travel during daylight hours and check pass opening status.",
        source: "Mountain Transit Advisory",
      },
      {
        key: "scams_local",
        label: "Adventure Sports & Gear Cautions",
        level: "low",
        summary: `Overpriced snow gear rentals and unauthorized adventure sports touts operate near popular scenic valleys around ${city}.`,
        tips: ["Rent thermal gear only from authorized tourism counters", "Verify paragliding and river rafting safety licenses beforehand"],
        recommendation: "Book adventure sports only through certified government-registered operators.",
        source: "Tourism Safety Registry",
      },
      {
        key: "health_local",
        label: "Altitude & Cold Precautions",
        level: "med",
        summary: `High elevation in ${city} can trigger mild altitude sickness (AMS). Nights bring sharp temperature drops.`,
        tips: ["Stay hydrated, avoid alcohol during initial acclimatization", "Carry layered thermal clothing and basic AMS medication"],
        recommendation: "Allow 24 hours of rest for acclimatization on arrival.",
        source: "Regional Health Bureau",
      },
    ];
  }

  // Coastal & Beach Destinations
  if (
    c.includes("goa") || c.includes("pondicherry") || c.includes("gokarna") ||
    c.includes("kerala") || c.includes("kochi") || c.includes("phuket") ||
    c.includes("bali") || c.includes("maldives")
  ) {
    return [
      {
        key: "transport_local",
        label: "Coastal Transit & Scooter Rentals",
        level: "low",
        summary: `Two-wheelers are popular in ${city}. Traffic police strictly enforce helmet compliance and driving licenses; avoid unpaved sandy tracks.`,
        tips: ["Always photograph rental scooter condition before payment", "Never drive after consuming alcohol on beach corridors"],
        recommendation: "Wear certified helmets and use authorized prepaid airport taxis.",
        source: "Coastal Traffic Advisory",
      },
      {
        key: "scams_local",
        label: "Water Sports & Beachfront Cautions",
        level: "low",
        summary: `Unregistered beach touts occasionally push water sports without proper life jackets or inflate prices for equipment.`,
        tips: ["Check for certified life vests before boarding jet skis or boats", "Confirm all equipment inclusions before handing over cash deposits"],
        recommendation: "Engage water sports strictly through licensed beach shack kiosks.",
        source: "Beach Safety Registry",
      },
      {
        key: "health_local",
        label: "Ocean Current & Sun Protection",
        level: "med",
        summary: `Strong rip currents occur on open beaches in ${city}. UV index is high between 11:00 AM and 3:30 PM.`,
        tips: ["Swim only within designated safety zones between red-and-yellow lifeguard flags", "Use broad-spectrum sunscreen and drink coconut water/electrolytes"],
        recommendation: "Heed lifeguard warning flags and avoid swimming after dusk.",
        source: "Maritime Life Safety",
      },
    ];
  }

  // European & Western Cities
  if (
    c.includes("london") || c.includes("paris") || c.includes("rome") ||
    c.includes("barcelona") || c.includes("amsterdam") || c.includes("berlin") ||
    c.includes("new york") || c.includes("chicago") || c.includes("san francisco")
  ) {
    return [
      {
        key: "transport_local",
        label: "Transit Cards & Metro Safety",
        level: "low",
        summary: `Extensive public transit in ${city}. Use contactless payment or official transit cards. Watch personal items on busy transit lines.`,
        tips: ["Tap in and out with contactless cards or official transit app", "Beware of pickpocket distractions around crowded station turnstiles"],
        recommendation: "Use official metro networks and licensed city taxis.",
        source: "Transit Police Advisory",
      },
      {
        key: "scams_local",
        label: "Landmark Scams & Distractions",
        level: "med",
        summary: `Crowded tourist hotspots in ${city} attract distraction scams (petition clipboards, friendship bracelets, photo touts).`,
        tips: ["Politely ignore strangers approaching with petitions, bracelets, or found rings", "Keep backpacks zipped and wear them in front in crowded areas"],
        recommendation: "Secure wallets in front pockets and book monument tickets directly online.",
        source: "Tourist Security Bureau",
      },
      {
        key: "health_local",
        label: "Urban Walkability & Health Standards",
        level: "low",
        summary: `Tap water is safe and potable. High daily walking mileage requires comfortable footwear. Emergency services dial 112 / 999 / 911.`,
        tips: ["Carry a refillable water bottle", "Save local emergency numbers and emergency pharmacy locations"],
        recommendation: "High safety standards; general urban precautions apply.",
        source: "Public Health Authority",
      },
    ];
  }

  // International & Universal Urban Fallback
  return [
    {
      key: "transport_local",
      label: "City Transit & Navigation Guidelines",
      level: "low",
      summary: `Public transit networks and official licensed transport offer reliable transit across ${city}. For road travel, use app-based rides or authorized prepaid terminal desks.`,
      tips: [
        `Use official transit passes or contactless payment cards to navigate ${city}`,
        "Take authorized airport transfers or metered taxis rather than unverified private rides",
      ],
      recommendation: "Use official metro/bus transit or pre-booked rides for intercity and airport transfers.",
      source: "International Transit Advisory",
    },
    {
      key: "scams_local",
      label: "Tourist District Cautions",
      level: "low",
      summary: `High-footfall tourist areas in ${city} can attract unofficial ticket sellers, overpriced private tours, or currency exchange touts.`,
      tips: [
        "Purchase monument, museum, and experience tickets strictly through official venue websites or certified counters",
        "Keep personal belongings secure in front pockets or zipped bags in crowded transit stations",
      ],
      recommendation: "Book admissions directly through verified official platforms.",
      source: "Tourist Safety Registry",
    },
    {
      key: "health_local",
      label: "Hydration & Health Preparedness",
      level: "low",
      summary: `Stay prepared for weather shifts in ${city}. Carry a refillable water bottle or drink sealed water, and save local emergency contact numbers.`,
      tips: [
        "Stay hydrated during walking tours and keep basic travel first aid handy",
        "Check daily weather forecasts before outdoor explorations",
      ],
      recommendation: "Follow local public health advisories and carry personal travel insurance information.",
      source: "Public Health Advisory",
    },
  ];
}

export class AIService {
  /**
   * Generate a trip itinerary using AI and persist it to MongoDB.
   */
  async generateItinerary(body, userId = "guest") {
    const {
      destination,
      origin,
      startDate,
      endDate,
      duration,
      durationMode = "RECOMMENDED",
      budget,
      style,
      interests,
      accommodation,
      hotelLocation,
      transport,
      travelers,
      special,
      travelMode,
      departureHub,
      arrivalHub,
      transitRef,
      departureTime,
      arrivalTime,
      returnJourney,
      hotelName,
      checkInTime,
      checkOutTime,
    } = body;

    const expectedDates = generateTripDates(startDate, endDate);
    const numDays = expectedDates.length;

    const budgetNum = Number(budget) || 0;
    const perDayBudget = budgetNum > 0 ? Math.round(budgetNum / numDays) : null;
    const transportList =
      Array.isArray(transport) && transport.length > 0 ? transport.join(", ") : travelMode || "any available";
    const travelersNum = Number(travelers) || 1;
    const perPersonBudget = budgetNum > 0 ? Math.round(budgetNum / travelersNum) : null;

    const structuredOutbound = body.outboundJourney || {
      transportType: travelMode || (Array.isArray(transport) ? transport[0] : "") || "",
      departureLocation: departureHub || origin || "",
      arrivalLocation: arrivalHub || destination || "",
      departureDate: startDate || "",
      departureTime: departureTime || "",
      arrivalDate: body.arrivalDate || body.outboundJourney?.arrivalDate || "",
      arrivalTime: arrivalTime || "",
      durationMinutes: null,
      durationSource: "USER_SPECIFIED",
      transitRef: transitRef || "",
      status: "ESTIMATED",
      booked: false,
    };

    const rawReturn = returnJourney || body.returnJourney || {};
    const structuredReturn = {
      booked: Boolean(rawReturn.booked),
      transportType: rawReturn.transportType || rawReturn.transport || travelMode || "",
      departureLocation: rawReturn.departureLocation || arrivalHub || destination || "",
      arrivalLocation: rawReturn.arrivalLocation || departureHub || origin || "",
      departureDate: rawReturn.departureDate || rawReturn.date || endDate || "",
      departureTime: rawReturn.departureTime || rawReturn.time || "",
      arrivalDate: rawReturn.arrivalDate || rawReturn.date || "",
      arrivalTime: rawReturn.arrivalTime || "",
      durationMinutes: rawReturn.durationMinutes ?? null,
      durationSource: rawReturn.durationSource || "USER_SPECIFIED",
      transitRef: rawReturn.transitRef || rawReturn.ticketRef || "",
      ticketRef: rawReturn.ticketRef || "",
      status: rawReturn.status || (rawReturn.booked ? "CONFIRMED" : "ESTIMATED"),
    };

    // ── Concurrently compute journeys, fetch weather, hero image & verified places ──
    let computedJourneys = { outboundJourney: structuredOutbound, returnJourney: structuredReturn, tripTiming: body.tripTiming || {} };
    let weatherResult = { weatherData: null, weatherInfo: "" };
    let heroImage = null;
    let verifiedPlaces = [];
    let durationRecommendation = null;

    let researchDossier = null;
    try {
      const [journeys, weather, img, places, destOverview, multiAgentDossier] = await Promise.all([
        computeJourneys({
          origin,
          destination,
          startDate,
          endDate,
          travelMode,
          departureHub,
          arrivalHub,
          transitRef,
          departureTime,
          arrivalTime,
          accommodation: accommodation || "",
          hotelName: hotelName || "",
          hotelLocation: hotelLocation || "",
          checkInTime: checkInTime || "",
          checkOutTime: checkOutTime || "",
          outboundJourney: structuredOutbound,
          returnJourney: structuredReturn,
        }).catch((err) => {
          logger.warn(`[AIService] Journey engine failed (non-fatal): ${err.message}`);
          return { outboundJourney: structuredOutbound, returnJourney: structuredReturn, tripTiming: body.tripTiming || {} };
        }),
        fetchWeather(destination, config.WEATHER_API_KEY || config.OPENWEATHER_API_KEY || config.VITE_WEATHER_API_KEY, false, {
          startDate,
          endDate,
        }).catch((err) => {
          logger.warn(`[AIService] Weather fetch failed (non-fatal): ${err.message}`);
          return { weatherData: null, weatherInfo: "" };
        }),
        fetchDestinationImage(destination).catch((err) => {
          logger.warn(`[AIService] Image fetch failed (non-fatal): ${err.message}`);
          return null;
        }),
        placeDiscoveryService
          .discoverPlacesForInterests({
            destination,
            interests: interests || [],
            dates: expectedDates,
          })
          .catch((err) => {
            logger.warn(`[AIService] Place discovery failed (non-fatal): ${err.message}`);
            return [];
          }),
        destinationDurationService
          .getDestinationOverview({
            destination,
            interests: interests || [],
          })
          .catch((err) => {
            logger.warn(`[AIService] Destination duration overview failed (non-fatal): ${err.message}`);
            return null;
          }),
        orchestratorService
          .conductComprehensiveResearch({
            destination,
            origin,
            interests: interests || [],
            travelers: travelersNum,
            durationDays: numDays,
            userBudget: budgetNum,
            preferredTransportMode: travelMode,
            accommodationPreference: accommodation || "AI_RECOMMENDED",
            customHotelName: hotelName,
            startDate,
            journeyDate: startDate,
          })
          .catch((orchErr) => {
            logger.warn(`[AIService] Multi-agent orchestration research failed (non-fatal): ${orchErr.message}`);
            return null;
          }),
      ]);

      computedJourneys = journeys;
      weatherResult = weather;
      researchDossier = multiAgentDossier;
      heroImage = img || multiAgentDossier?.heroImage || destOverview?.heroImage || null;
      verifiedPlaces = places || [];
      durationRecommendation = multiAgentDossier?.durationRecommendation || destOverview?.durationRecommendation || null;

      // Integrate research output: enrich verifiedPlaces with verified attractions & gems
      if (multiAgentDossier?.durationRecommendation?.popularHighlights) {
        for (const h of multiAgentDossier.durationRecommendation.popularHighlights) {
          if (!verifiedPlaces.some((p) => p.name?.toLowerCase() === h.name?.toLowerCase())) {
            verifiedPlaces.push({
              name: h.name,
              category: h.category,
              region: h.region,
              coordinates: h.coordinates,
              openingHours: h.openingHours,
              timeRequiredMins: h.estimatedVisitingMins,
              whySpecial: h.matchReason,
              placeType: "POPULAR_ATTRACTION",
            });
          }
        }
      }
      if (multiAgentDossier?.durationRecommendation?.hiddenGemHighlights) {
        for (const g of multiAgentDossier.durationRecommendation.hiddenGemHighlights) {
          if (!verifiedPlaces.some((p) => p.name?.toLowerCase() === g.name?.toLowerCase())) {
            verifiedPlaces.push({
              name: g.name,
              category: g.category,
              region: g.region,
              coordinates: g.coordinates,
              timeRequiredMins: g.estimatedVisitingMins,
              whySpecial: g.whySpecial,
              placeType: "HIDDEN_GEM",
              isPlaceHiddenGem: true,
            });
          }
        }
      }
    } catch (preErr) {
      logger.warn(`[AIService] Pre-generation fetch error: ${preErr.message}`);
    }

    const journeyLine = (() => {
      const parts = [];
      if (travelMode) parts.push(`Mode: ${travelMode}`);
      if (departureHub) parts.push(`from ${departureHub}`);
      if (arrivalHub) parts.push(`to ${arrivalHub}`);
      if (transitRef) parts.push(`(${transitRef})`);
      if (departureTime) parts.push(`departs ${departureTime}`);
      if (arrivalTime) parts.push(`arrives ${arrivalTime}`);
      return parts.length ? parts.join(" ") : "not yet specified";
    })();

    const accommodationLine = (() => {
      const parts = [];
      if (accommodation) {
        if (
          accommodation === "OWN_HOME" ||
          accommodation === "RELATIVE" ||
          /own home|relative/i.test(accommodation)
        ) {
          parts.push("Staying at Own Home / Relative's Home (₹0 lodging expense - family accommodation)");
        } else {
          parts.push(`Tier/Preference: ${accommodation}`);
        }
      }
      if (hotelName) parts.push(hotelName);
      if (hotelLocation) parts.push(`in ${hotelLocation}`);
      if (checkInTime) parts.push(`check-in at ${checkInTime}`);
      if (checkOutTime) parts.push(`check-out at ${checkOutTime}`);
      return parts.length ? parts.join(", ") : "not specified";
    })();

    const promptParams = {
      destination,
      origin,
      startDate,
      endDate,
      budgetNum,
      perDayBudget,
      perPersonBudget,
      style: style || "Balanced",
      interests: interests || [],
      accommodationLine,
      journeyLine,
      transportList,
      travelersNum,
      special: special || "",
      travelMode: travelMode || "",
      departureTime: departureTime || "",
      arrivalTime: arrivalTime || "",
      outboundJourney: computedJourneys.outboundJourney,
      returnJourney: computedJourneys.returnJourney,
      tripTiming: computedJourneys.tripTiming,
      hotelName: hotelName || "",
      hotelLocation: hotelLocation || "",
      checkInTime: checkInTime || "",
      checkOutTime: checkOutTime || "",
      weatherInfo: weatherResult.weatherInfo || "",
      weatherData: weatherResult.weatherData || null,
      verifiedPlaces,
      durationMode: body.durationMode === "CUSTOM" ? "CUSTOM" : "RECOMMENDED",
      durationRecommendation,
      safetyAdvisories: researchDossier?.safetyAndRisk?.verifiedAdvisories || [],
    };

    const prompt = buildItineraryPrompt(promptParams, expectedDates);

    const parsed = await executeWithSchema(
      ItineraryOutputSchema,
      {
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        maxTokens: 6000,
      },
      { maxAttempts: 2 }
    );

    const sanitized = validateAndSanitizeItinerary(parsed, expectedDates, {
      destination,
      origin,
      budgetNum,
      travelersNum,
      hotelLocation,
      departureTime,
      arrivalTime,
      tripTiming: computedJourneys.tripTiming,
      style: style || "Balanced",
      interests: interests || [],
      verifiedPlaces,
    });

    try {
      sanitized.days = await enrichTripWithInterstopRouting(sanitized.days, {
        destination,
        hotelName,
        hotelLocation,
        accommodation,
      });
    } catch (routeErr) {
      logger.warn(`[AIService] Interstop routing enrichment note: ${routeErr.message}`);
    }

    // Final Judge validation of railway & itinerary timeline
    let railwayValidation = null;
    try {
      railwayValidation = finalAIJudgeAgent.validateItineraryAgainstRailwayTimeline({
        itinerary: sanitized,
        outboundJourney: computedJourneys.outboundJourney,
        returnJourney: computedJourneys.returnJourney,
        tripTiming: computedJourneys.tripTiming,
      });
    } catch (judgeErr) {
      logger.warn(`[AIService] Final Judge railway validation note: ${judgeErr.message}`);
    }

    const tripData = {
      ...sanitized,
      destination: destination || sanitized?.destination || "",
      origin: origin || "",
      heroImage,
      createdBy: userId || "guest",
      createdAt: new Date().toISOString(),
      budgetTotal: budgetNum,
      transport: Array.isArray(transport) ? transport : travelMode ? [travelMode] : [],
      accommodation: accommodation || "",
      hotelLocation: hotelLocation || "",
      travelers: travelersNum,
      style: style || "Balanced",
      railwayValidation,
      agentAudit: researchDossier?.audit || null,
      providerEvaluation: researchDossier?.providerEvaluation || null,
      startDate,
      endDate,
      duration: body.duration ? Number(body.duration) : numDays,
      durationMode: body.durationMode === "CUSTOM" ? "CUSTOM" : "RECOMMENDED",
      interests: Array.isArray(interests) ? interests : interests ? [String(interests)] : [],
      travelMode: travelMode || "",
      departureHub: departureHub || "",
      arrivalHub: arrivalHub || "",
      transitRef: transitRef || "",
      departureTime: departureTime || "",
      arrivalTime: arrivalTime || "",
      outboundJourney: computedJourneys.outboundJourney,
      returnJourney: computedJourneys.returnJourney,
      tripTiming: computedJourneys.tripTiming,
      hotelName: hotelName || "",
      checkInTime: checkInTime || "",
      checkOutTime: checkOutTime || "",
    };

    const newTrip = new Trip(tripData);
    return await newTrip.save();
  }

  /**
   * Regenerate an existing trip itinerary with fresh AI generation.
   */
  async regenerateItinerary(tripId, body = {}, userId) {
    const trip = await Trip.findOne({ _id: tripId, createdBy: userId });
    if (!trip) {
      throw new NotFoundError("Trip not found or unauthorized");
    }

    const destination = body.destination || trip.destination;
    const origin = body.origin || trip.origin || "";
    const startDate = body.startDate || trip.startDate;
    const endDate = body.endDate || trip.endDate;
    const budgetNum = body.budget !== undefined ? Number(body.budget) : trip.budgetTotal || 0;
    const style = body.style || trip.style || "Balanced";
    const interests = body.interests || trip.interests || [];
    const travelersNum = body.travelers ? Number(body.travelers) : trip.travelers || 1;
    const travelMode = body.travelMode || trip.travelMode || "";
    const departureHub = body.departureHub || trip.departureHub || "";
    const arrivalHub = body.arrivalHub || trip.arrivalHub || "";
    const transitRef = body.transitRef || trip.transitRef || "";
    const departureTime = body.departureTime || trip.departureTime || "";
    const arrivalTime = body.arrivalTime || trip.arrivalTime || "";
    const returnJourney = body.returnJourney || trip.returnJourney || { booked: false };
    const hotelName = body.hotelName || trip.hotelName || "";
    const hotelLocation = body.hotelLocation || trip.hotelLocation || "";
    const accommodation = body.accommodation || trip.accommodation || "";
    const checkInTime = body.checkInTime || trip.checkInTime || "";
    const checkOutTime = body.checkOutTime || trip.checkOutTime || "";
    const special = body.special || trip.special || "";

    const expectedDates = generateTripDates(startDate, endDate);
    const numDays = expectedDates.length;
    const perDayBudget = budgetNum > 0 ? Math.round(budgetNum / numDays) : null;
    const perPersonBudget = budgetNum > 0 ? Math.round(budgetNum / travelersNum) : null;

    const journeyLine = (() => {
      const parts = [];
      if (travelMode) parts.push(`Mode: ${travelMode}`);
      if (departureHub) parts.push(`from ${departureHub}`);
      if (arrivalHub) parts.push(`to ${arrivalHub}`);
      if (transitRef) parts.push(`(${transitRef})`);
      if (departureTime) parts.push(`departs ${departureTime}`);
      if (arrivalTime) parts.push(`arrives ${arrivalTime}`);
      return parts.length ? parts.join(" ") : "not yet specified";
    })();

    const accommodationLine = (() => {
      const parts = [];
      if (accommodation) {
        if (
          accommodation === "OWN_HOME" ||
          accommodation === "RELATIVE" ||
          /own home|relative/i.test(accommodation)
        ) {
          parts.push("Staying at Own Home / Relative's Home (₹0 lodging expense - family accommodation)");
        } else {
          parts.push(`Tier/Preference: ${accommodation}`);
        }
      }
      if (hotelName) parts.push(hotelName);
      if (hotelLocation) parts.push(`in ${hotelLocation}`);
      if (checkInTime) parts.push(`check-in at ${checkInTime}`);
      if (checkOutTime) parts.push(`check-out at ${checkOutTime}`);
      return parts.length ? parts.join(", ") : "not specified";
    })();

    // ── Pre-regeneration: compute journeys, fetch weather & verified places ──
    let regenJourneys = {
      outboundJourney: body.outboundJourney || trip.outboundJourney || {},
      returnJourney: body.returnJourney || returnJourney || trip.returnJourney || {},
      tripTiming: body.tripTiming || trip.tripTiming || {},
    };
    let weatherResult = { weatherData: null, weatherInfo: "" };
    let verifiedPlaces = [];
    let durationRecommendation = null;
    let researchDossier = trip.agentAudit || null;

    try {
      const [journeys, weather, places, destOverview, multiAgentDossier] = await Promise.all([
        computeJourneys({
          origin,
          destination,
          startDate,
          endDate,
          travelMode,
          departureHub,
          arrivalHub,
          transitRef,
          departureTime,
          arrivalTime,
          accommodation: accommodation || trip.accommodation || "",
          hotelName: hotelName || trip.hotelName || "",
          hotelLocation: hotelLocation || trip.hotelLocation || "",
          checkInTime: checkInTime || trip.checkInTime || "",
          checkOutTime: checkOutTime || trip.checkOutTime || "",
          outboundJourney: body.outboundJourney || trip.outboundJourney || {},
          returnJourney: body.returnJourney || returnJourney || trip.returnJourney || {},
        }).catch((err) => {
          logger.warn(`[AIService] Journey engine failed on regen (non-fatal): ${err.message}`);
          return regenJourneys;
        }),
        fetchWeather(destination, config.WEATHER_API_KEY || config.OPENWEATHER_API_KEY || config.VITE_WEATHER_API_KEY, false, {
          startDate,
          endDate,
        }).catch((err) => {
          logger.warn(`[AIService] Weather fetch failed on regen (non-fatal): ${err.message}`);
          return { weatherData: null, weatherInfo: "" };
        }),
        placeDiscoveryService
          .discoverPlacesForInterests({
            destination,
            interests: interests || [],
            dates: expectedDates,
          })
          .catch((err) => {
            logger.warn(`[AIService] Place discovery failed on regen (non-fatal): ${err.message}`);
            return [];
          }),
        destinationDurationService
          .getDestinationOverview({
            destination,
            interests: interests || [],
          })
          .catch((err) => {
            logger.warn(`[AIService] Destination duration overview failed on regen (non-fatal): ${err.message}`);
            return null;
          }),
        orchestratorService
          .conductComprehensiveResearch({
            destination,
            origin,
            interests: interests || [],
            travelers: travelersNum,
            durationDays: numDays,
            userBudget: budgetNum,
            preferredTransportMode: travelMode,
            accommodationPreference: accommodation || trip.accommodation || "AI_RECOMMENDED",
            customHotelName: hotelName,
            startDate,
            journeyDate: startDate,
          })
          .catch((orchErr) => {
            logger.warn(`[AIService] Multi-agent orchestration research failed on regen (non-fatal): ${orchErr.message}`);
            return null;
          }),
      ]);

      regenJourneys = journeys;
      weatherResult = weather;
      verifiedPlaces = places || [];
      durationRecommendation = multiAgentDossier?.durationRecommendation || destOverview?.durationRecommendation || null;
      if (multiAgentDossier) {
        researchDossier = multiAgentDossier;
      }
    } catch (preErr) {
      logger.warn(`[AIService] Pre-regeneration fetch error: ${preErr.message}`);
    }

    const promptParams = {
      destination,
      origin,
      startDate,
      endDate,
      budgetNum,
      perDayBudget,
      perPersonBudget,
      style,
      interests,
      accommodationLine,
      journeyLine,
      transportList: trip.transport?.length ? trip.transport.join(", ") : travelMode || "any available",
      travelersNum,
      special,
      travelMode,
      departureTime,
      arrivalTime,
      outboundJourney: regenJourneys.outboundJourney,
      returnJourney: regenJourneys.returnJourney,
      tripTiming: regenJourneys.tripTiming,
      hotelName,
      hotelLocation,
      checkInTime,
      checkOutTime,
      weatherInfo: weatherResult.weatherInfo || "",
      weatherData: weatherResult.weatherData || null,
      verifiedPlaces,
      durationMode: body.durationMode === "CUSTOM" ? "CUSTOM" : "RECOMMENDED",
      durationRecommendation,
      safetyAdvisories: researchDossier?.safetyAndRisk?.verifiedAdvisories || [],
    };

    const prompt = buildItineraryPrompt(promptParams, expectedDates);

    const parsed = await executeWithSchema(
      ItineraryOutputSchema,
      {
        messages: [{ role: "user", content: prompt }],
        temperature: 0.8,
        maxTokens: 6000,
      },
      { maxAttempts: 2 }
    );

    const sanitized = validateAndSanitizeItinerary(parsed, expectedDates, {
      destination,
      origin,
      budgetNum,
      travelersNum,
      hotelLocation,
      departureTime,
      arrivalTime,
      tripTiming: regenJourneys.tripTiming,
      style,
      interests,
      verifiedPlaces,
    });

    try {
      sanitized.days = await enrichTripWithInterstopRouting(sanitized.days, {
        destination,
        hotelName: hotelName || trip.hotelName || "",
        hotelLocation: hotelLocation || trip.hotelLocation || "",
        accommodation: accommodation || trip.accommodation || "",
      });
    } catch (routeErr) {
      logger.warn(`[AIService] Interstop routing enrichment note during regenerate: ${routeErr.message}`);
    }

    trip.title = sanitized.title || trip.title;
    trip.origin = origin || trip.origin || "";
    trip.summary = sanitized.summary || trip.summary;
    trip.budgetEstimate = sanitized.budgetEstimate || trip.budgetEstimate;
    trip.budgetBreakdown = sanitized.budgetBreakdown || trip.budgetBreakdown;
    trip.days = sanitized.days;
    trip.startDate = startDate;
    trip.endDate = endDate;
    trip.duration = body.duration ? Number(body.duration) : numDays;
    trip.durationMode = body.durationMode || trip.durationMode || "RECOMMENDED";
    trip.budgetTotal = budgetNum;
    trip.style = style;
    trip.interests = interests;
    trip.travelers = travelersNum;
    trip.travelMode = travelMode;
    trip.departureHub = departureHub || trip.departureHub || "";
    trip.arrivalHub = arrivalHub || trip.arrivalHub || "";
    trip.transitRef = transitRef || trip.transitRef || "";
    trip.departureTime = departureTime || trip.departureTime || "";
    trip.arrivalTime = arrivalTime || trip.arrivalTime || "";
    trip.outboundJourney = regenJourneys.outboundJourney;
    trip.returnJourney = regenJourneys.returnJourney;
    trip.tripTiming = regenJourneys.tripTiming;
    trip.hotelName = hotelName;
    trip.hotelLocation = hotelLocation;
    trip.accommodation = accommodation;
    if (researchDossier?.audit) {
      trip.agentAudit = researchDossier.audit;
      trip.markModified("agentAudit");
    }
    if (researchDossier?.providerEvaluation) {
      trip.providerEvaluation = researchDossier.providerEvaluation;
      trip.markModified("providerEvaluation");
    }
    trip.updatedAt = new Date();

    if (destination && (!trip.heroImage?.url || !trip.heroImage?.destination || trip.heroImage.destination.toLowerCase() !== destination.toLowerCase())) {
      trip.heroImage = await fetchDestinationImage(destination);
      trip.markModified("heroImage");
    }

    trip.markModified("days");
    trip.markModified("budgetBreakdown");
    const savedTrip = await trip.save();
    logger.info(`[AIService] Trip ${tripId} regenerated with ${savedTrip.days.length} days`);
    return savedTrip;
  }

  /**
   * Plan B Conversational contingency assistant.
   */
  async generatePlanB({ tripId, messages, question, currentDay }) {
    let chatMessages = [];
    if (messages && Array.isArray(messages)) {
      chatMessages = messages;
    } else if (question && typeof question === "string") {
      chatMessages = [{ role: "user", content: question }];
    } else {
      throw new ValidationError("Either 'messages' array or 'question' string is required");
    }

    const trip = await Trip.findById(tripId);
    if (!trip) {
      throw new NotFoundError("Trip not found");
    }

    let currentDayNumber = Number(currentDay);
    if (!currentDayNumber || isNaN(currentDayNumber)) {
      if (trip.startDate) {
        const start = new Date(trip.startDate);
        const today = new Date();
        start.setHours(0, 0, 0, 0);
        today.setHours(0, 0, 0, 0);
        const diffTime = today.getTime() - start.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
        if (diffDays >= 1 && diffDays <= (trip.days?.length ?? 1)) {
          currentDayNumber = diffDays;
        } else {
          currentDayNumber = 1;
        }
      } else {
        currentDayNumber = 1;
      }
    }

    const daySummaries = (trip.days || [])
      .map((d) => {
        const acts = (d.activities || []).map((a) => `${a.time}: ${a.description}`).join(" | ");
        return `Day ${d.dayNumber} (${d.date || "TBD"}) — ${d.title}: ${acts}`;
      })
      .join("\n");

    const todayISO = new Date().toISOString().split("T")[0];
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const todayName = dayNames[new Date().getDay()];

    const systemPrompt = `You are Advenza, a warm, knowledgeable, and practical AI travel assistant. You help travellers recover gracefully from unexpected disruptions — like a trusted local friend who knows the destination inside out.

SYSTEM DATE & TIMELINE CONTEXT:
- Today's date: ${todayISO} (${todayName})
- Current Simulated Day of the Trip: Day ${currentDayNumber}
- Chronological Rule: Days 1 to ${currentDayNumber - 1} are ALREADY COMPLETED. You MUST NOT modify, delete, or reschedule any activities on these completed days (Days 1 to ${currentDayNumber - 1}). All rescheduled activities must only be placed in remaining slots of Day ${currentDayNumber} (today, if time permits) or future days (Day ${currentDayNumber + 1}, Day ${currentDayNumber + 2}, etc.).

TRIP CONTEXT:
- Destination: ${trip.destination}
- Dates: ${trip.startDate} to ${trip.endDate}
- Total Budget: ₹${trip.budgetTotal > 0 ? trip.budgetTotal : "unspecified"}
- Transport Mode(s): ${(trip.transport || []).join(", ") || "any"}
- Accommodation: ${trip.accommodation || "unspecified"}
- Travel Pace: ${trip.style || "Balanced"}
- Interests: ${(trip.interests || []).join(", ") || "general sightseeing"}

CURRENT ITINERARY (each line = one day; dayNumber is the key used when updating the itinerary):
${daySummaries || "No days planned yet"}

──────────────────────────────────────────────────────────
STRICT RESCHEDULING & PRESERVATION RULES:
──────────────────────────────────────────────────────────
1. PRESERVE ALL ATTRACTIONS: If the user states they missed, skipped, arrived late to, or had an issue with an attraction, you MUST NOT delete or discard it from the itinerary. The attraction MUST remain part of the trip.
2. CHRONOLOGY AWARENESS: You are simulating being on Day ${currentDayNumber}.
   - Days 1 to ${currentDayNumber - 1} are ALREADY COMPLETED and MUST NOT be changed or modified under any circumstances.
   - You MUST only look for suitable slots on the remaining part of Day ${currentDayNumber} (later in the day) or on future days (Day ${currentDayNumber + 1}, Day ${currentDayNumber + 2}, etc.).
3. INTELLIGENT SLOT MATCHING: When finding the best available future slot, intelligently evaluate opening hours, weather, travel distances, and priority swapping.
4. EXACT RECOMMENDED VISIT TIMES: Any proposed/modified day in the "proposedDays" array MUST use the exact recommended visit time in 24-hour clock format (HH:mm format, e.g. "09:00", "14:30").
5. Return JSON ONLY with:
{
  "reply": "Conversational 4-part guidance without markdown tables",
  "proposedDays": [
    {
      "dayNumber": 2,
      "date": "YYYY-MM-DD",
      "title": "Day Theme",
      "activities": [{ "time": "09:00", "description": "..." }]
    }
  ]
}`;

    const resultData = await executeWithSchema(
      PlanBOutputSchema,
      {
        messages: [
          { role: "system", content: systemPrompt },
          ...chatMessages.map((m) => ({
            role: m.role === "user" ? "user" : "assistant",
            content: m.content || m.text,
          })),
        ],
        temperature: 0.7,
      },
      { maxAttempts: 2 }
    );

    resultData.proposedDays = (resultData.proposedDays || []).map((d) => ({
      ...d,
      dayNumber: Number(d.dayNumber),
    }));

    return resultData;
  }

  /**
   * Chat with AI about travel, powered by ConversationalAIService with full intent recognition,
   * multi-turn memory, real place discovery, and anti-hallucination verification.
   */
  async chatWithTravelAI(options = []) {
    let payload = {};
    if (Array.isArray(options)) {
      payload = { messages: options };
    } else if (typeof options === "object" && options !== null) {
      payload = options;
    }
    return await conversationalAIService.handleChat(payload);
  }

  /**
   * Generate packing checklist with in-memory caching.
   */
  async generatePackingList({ destination, startDate, endDate, style }) {
    const cacheKey = `${String(destination).toLowerCase().trim()}_${startDate || ""}_${endDate || ""}_${style || ""}`;
    const cached = packingCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < PACKING_CACHE_TTL) {
      logger.debug(`[Packing] Returning cached packing list for: ${cacheKey}`);
      return cached.data;
    }

    const prompt = `Generate a smart packing list for a trip to ${destination} from ${startDate} to ${endDate} (${style || "Balanced"} style).

Return ONLY valid JSON with this structure:
{
  "Essentials": [{"name": "item", "why": "reason specific to this trip"}],
  "Weather-specific": [{"name": "item", "why": "weather-based reason"}],
  "Documents": [{"name": "item", "why": "reason"}],
  "Electronics": [{"name": "item", "why": "reason"}],
  "Medicines": [{"name": "item", "why": "reason"}],
  "Optional": [{"name": "item", "why": "reason"}]
}

Make items specific to ${destination}'s climate, culture, and activities. 3-4 items per category.`;

    const packingData = await executeWithSchema(
      PackingOutputSchema,
      {
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      },
      { maxAttempts: 2 }
    );

    packingCache.set(cacheKey, { data: packingData, timestamp: Date.now() });
    return packingData;
  }

  /**
   * Real Risk Analysis combining weather, itinerary logistics, and AI narrative.
   */
  async evaluateRisk({ destination, tripId, refresh, userId }) {
    const normalizedDest = normalizeDestination(destination);

    let trip = null;
    if (tripId) {
      try {
        const foundTrip = await Trip.findById(tripId).lean();
        if (foundTrip) {
          const tripDestNorm = normalizeDestination(foundTrip.destination || "").toLowerCase();
          const targetNorm = normalizedDest.toLowerCase();
          // Verify trip matches target destination
          if (tripDestNorm.includes(targetNorm) || targetNorm.includes(tripDestNorm)) {
            trip = foundTrip;
          } else {
            logger.debug(`[Risk] tripId ${tripId} destination "${foundTrip.destination}" does not match requested "${destination}". Evaluating city-level.`);
          }
        }
      } catch (e) {
        logger.warn(`[Risk] Failed to load tripId ${tripId}: ${e.message}`);
      }
    }

    const effectiveTripId = trip ? String(trip._id) : "general";
    const cacheKey = `${normalizedDest.toLowerCase()}_${effectiveTripId}`;

    if (!refresh) {
      const cached = riskResultCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < RISK_CACHE_TTL) {
        // If trip was updated after cache timestamp, invalidate cache to reflect fresh itinerary/dates
        const tripModifiedAfterCache = trip?.updatedAt && new Date(trip.updatedAt).getTime() > cached.timestamp;
        if (!tripModifiedAfterCache) {
          logger.debug(`[Risk] Returning cached risk analysis for ${normalizedDest}`);
          return cached.data;
        }
      }
    }

    const apiKey = config.WEATHER_API_KEY || config.OPENWEATHER_API_KEY || config.VITE_WEATHER_API_KEY;
    const weatherResult = await fetchWeather(normalizedDest, apiKey, !!refresh, {
      startDate: trip?.startDate,
      endDate: trip?.endDate,
    });
    const weatherData = weatherResult.weatherData;
    const resolvedCity = weatherResult.resolvedCity || normalizedDest;

    const evaluated = evaluateRiskEngine({ destination: resolvedCity, trip, weatherData });

    let safetyAdvisory = "";
    let localRisks = [];

    try {
      const weatherLine = weatherData && weatherData.isForecastAvailable !== false
        ? `Forecast for travel window in ${resolvedCity}: ${weatherData.temp}°C, ${weatherData.condition}, ${weatherData.rainChance}% daily max precipitation probability.`
        : `Live 5-day meteorological forecast is not yet open for these future travel dates in ${resolvedCity}. Consider seasonal regional climate norms.`;

      const prompt = `You are Advenza's Travel Risk & Safety Intelligence Engine.
Analyze genuine, localized safety, transit navigation, and scam considerations for travelers in "${resolvedCity}".
${weatherLine}

Output STRICTLY a JSON object with this exact structure:
{
  "safetyAdvisory": "2 clear sentences summarizing the overall safety, local precautions, and seasonal health context for ${resolvedCity}.",
  "localRisks": [
    {
      "key": "transport_local",
      "label": "Transit & Local Navigation",
      "level": "low",
      "summary": "Specific facts about getting around ${resolvedCity} (e.g., metro/subway smart cards, licensed taxis vs unmarked touts, airport connectivity). Do NOT be generic.",
      "tips": ["Concrete tip 1 for ${resolvedCity}", "Concrete tip 2 for ${resolvedCity}"],
      "recommendation": "Main takeaway for navigating ${resolvedCity}",
      "source": "Local Travel Intelligence (AI Assessed)"
    },
    {
      "key": "scams_local",
      "label": "Tourist Scams & Area Cautions",
      "level": "low",
      "summary": "Real specific scams or tourist traps known in ${resolvedCity} (e.g. ticket touts, fake tour operators, photo fee demands, overcharging). Specific to ${resolvedCity}.",
      "tips": ["Concrete tip 1", "Concrete tip 2"],
      "recommendation": "Main takeaway to protect money and valuables",
      "source": "Tourist Safety Registry (AI Assessed)"
    },
    {
      "key": "health_local",
      "label": "Health, Environment & Neighborhoods",
      "level": "low",
      "summary": "Environmental, air quality, altitude, tap water, or late-night neighborhood notes specific to ${resolvedCity}.",
      "tips": ["Health/water tip", "Neighborhood safety tip"],
      "recommendation": "Precautionary action",
      "source": "Regional Health Advisory (AI Assessed)"
    }
  ]
}`;

      const completion = await aiRouter.callAI({
        messages: [{ role: "user", content: prompt }],
        jsonMode: true,
        temperature: 0.3,
        max_tokens: 800,
      });

      if (completion?.content) {
        const parsed = parseAIJson(completion.content);
        if (parsed?.safetyAdvisory) safetyAdvisory = parsed.safetyAdvisory;
        if (Array.isArray(parsed?.localRisks) && parsed.localRisks.length > 0) {
          localRisks = parsed.localRisks.map((item, idx) => ({
            key: item.key || `local_risk_${idx}`,
            label: item.label || "Local Safety Advisory",
            level: (item.level || "low").toLowerCase().startsWith("h") ? "high" : (item.level || "low").toLowerCase().startsWith("m") ? "med" : "low",
            summary: item.summary || `Safety context for ${resolvedCity}.`,
            tips: Array.isArray(item.tips) && item.tips.length > 0 ? item.tips : ["Follow local advisories"],
            recommendation: item.recommendation || (item.tips && item.tips[0]) || "Standard precautions apply.",
            source: item.source || "Local Travel Intelligence (AI Assessed)",
          }));
        }
      }
    } catch (aiErr) {
      logger.warn(`[Risk] Dynamic AI narrative generation fallback: ${aiErr.message}`);
    }

    // Contextual regional fallback if AI was unavailable
    if (localRisks.length === 0) {
      localRisks = getRegionalSafetyFallback(resolvedCity);
    }

    // Context-aware safety advisory fallback if AI did not provide one
    if (!safetyAdvisory) {
      if (weatherData && weatherData.isForecastAvailable === false) {
        safetyAdvisory = `Trip scheduled beyond current 5-day meteorological forecast horizon. Live precipitation radar activates 5 days prior to departure. Standard regional safety guidelines apply.`;
      } else if (weatherData && (weatherData.rainChance >= 60 || (weatherData.temp !== null && weatherData.temp >= 38) || (weatherData.temp !== null && weatherData.temp <= 0))) {
        safetyAdvisory = `Adverse weather conditions reported in ${resolvedCity} (${weatherData.condition}, ${weatherData.temp}°C, ${weatherData.rainChance}% rain). Review outdoor transit and timing advisories before departure.`;
      } else if (evaluated.risks.some((r) => r.level === "high" || r.level === "critical")) {
        safetyAdvisory = `Active travel logistics advisories detected for your trip to ${resolvedCity}. Review connection buffers and check-in schedules.`;
      } else {
        safetyAdvisory = `Favorable weather and travel conditions in ${resolvedCity}. Standard urban and regional travel guidelines apply.`;
      }
    }

    // Calibrated score: Telemetry score + weighted local risk levels (if medium/high)
    let additionalScore = 0;
    localRisks.forEach((r) => {
      if (r.level === "high") additionalScore += 16;
      else if (r.level === "med") additionalScore += 6;
    });

    const finalScore = Math.max(10, Math.min(95, evaluated.score + additionalScore));
    const finalOverallLevel = finalScore >= 75 ? "CRITICAL" : finalScore >= 50 ? "HIGH" : finalScore >= 25 ? "MEDIUM" : "LOW";

    // Deduplicate any overlapping keys between telemetry risks and local risks
    const seenKeys = new Set();
    const allRisks = [];
    [...evaluated.risks, ...localRisks].forEach((r) => {
      let uniqueKey = r.key;
      let counter = 1;
      while (seenKeys.has(uniqueKey)) {
        uniqueKey = `${r.key}_${counter++}`;
      }
      seenKeys.add(uniqueKey);
      allRisks.push({ ...r, key: uniqueKey });
    });

    const responsePayload = {
      score: finalScore,
      overallLevel: finalOverallLevel,
      resolvedCity,
      safetyAdvisory,
      weather: weatherData,
      risks: allRisks,
    };

    riskResultCache.set(cacheKey, { data: responsePayload, timestamp: Date.now() });
    return responsePayload;
  }

  /**
   * Estimate minimum reasonable budget using verified travel provider data + structured destination models.
   * Completely eliminates brittle Google Search scraping.
   */
  async estimateBudget({ destination, startDate, endDate, travelers }) {
    const days = Math.max(1, Math.ceil((new Date(endDate) - new Date(startDate)) / 86400000));
    const numTravelers = parseInt(travelers, 10) || 1;
    const destClean = (destination || "Goa").split(",")[0].trim();

    // 1. Fetch real hotel stay estimate from HotelProvider
    let hotelDailyRate = 3500;
    try {
      const hotelRes = await hotelProvider.searchHotels({
        destination: destClean,
        checkIn: startDate,
        checkOut: endDate,
        guests: numTravelers,
      });
      if (hotelRes?.results?.length > 0) {
        // Average affordable tier hotel
        const sortedRates = hotelRes.results
          .map((h) => Number(h.pricePerNight) || 0)
          .filter((p) => p > 0)
          .sort((a, b) => a - b);
        if (sortedRates.length > 0) {
          hotelDailyRate = sortedRates[0]; // Baseline affordable rate
        }
      }
    } catch (_) {}

    // 2. Fetch baseline flight/intercity transport from FlightProvider
    let transportPerPerson = 4500;
    try {
      const flightRes = await flightProvider.searchFlights({
        origin: "DEL",
        destination: destClean,
        date: startDate,
        passengers: 1,
      });
      if (flightRes?.results?.length > 0) {
        const sortedFlights = flightRes.results
          .map((f) => Number(f.price) || 0)
          .filter((p) => p > 0)
          .sort((a, b) => a - b);
        if (sortedFlights.length > 0) {
          transportPerPerson = sortedFlights[0];
        }
      }
    } catch (_) {}

    // 3. Destination Cost Index for daily living expenses (Food, Local Transit, Activities)
    const isInternational = ["paris", "tokyo", "london", "dubai", "singapore", "new york"].some((c) =>
      destClean.toLowerCase().includes(c)
    );
    const dailyFood = isInternational ? 3500 : 1200;
    const dailyLocalTransit = isInternational ? 1500 : 500;
    const dailyActivities = isInternational ? 2500 : 800;

    // Room sharing: 2 travelers per room typically
    const roomsNeeded = Math.ceil(numTravelers / 2);
    const totalHotels = hotelDailyRate * days * roomsNeeded;
    const totalFlights = transportPerPerson * numTravelers;
    const totalFood = dailyFood * days * numTravelers;
    const totalActivities = dailyActivities * days * numTravelers;
    const totalLocalTransport = dailyLocalTransit * days * numTravelers;
    const totalMisc = Math.round((totalFood + totalActivities) * 0.1);

    const totalMinimum = totalHotels + totalFlights + totalFood + totalActivities + totalLocalTransport + totalMisc;

    return {
      minimumBudget: Math.round(totalMinimum),
      type: "ESTIMATED",
      currency: "INR",
      perPersonPerDay: Math.round(totalMinimum / (days * numTravelers)),
      categoryEstimates: {
        hotels: totalHotels,
        flights: totalFlights,
        food: totalFood,
        activities: totalActivities,
        localTransport: totalLocalTransport,
        miscellaneous: totalMisc,
      },
      assumptions: `Calculated for ${numTravelers} traveler(s) across ${days} day(s) in ${destClean}.`,
      source: "Advenza Travel Data Engine & Normalized Stays",
      disclaimer: "This is an ESTIMATED budget. Actual prices may change before booking.",
    };
  }

  /**
   * Generates a smart destination overview with duration recommendations and hidden gems.
   */
  async getDestinationOverview({ destination, interests }) {
    return destinationDurationService.getDestinationOverview({ destination, interests });
  }
}

export const aiService = new AIService();
