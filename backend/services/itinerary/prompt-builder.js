/**
 * Itinerary Prompt Builder & Date Utilities — Part 5
 *
 * Builds rich, interest-aligned, travel-timing-aware AI prompts for Advenza.
 * Guarantees that:
 *   1. Travel timing & usable destination windows (Part 3 & 4) act as HARD scheduling constraints.
 *   2. User interests (Food, Culture, Photography, Beaches, Adventure, etc.) genuinely drive activity selection.
 *   3. Trip style/pace (Slow, Balanced, Packed) controls activity density.
 *   4. Weather forecast (if available) influences outdoor/indoor scheduling.
 *   5. Transport data is never hallucinated (explicit distinction between Confirmed vs Estimated).
 *   6. Geographic clustering and realistic local transit buffers are enforced.
 */

export const normalizeTime = (timeStr, fallback = "09:00") => {
  if (!timeStr) return fallback;
  const cleaned = String(timeStr).trim().toUpperCase();

  // 12-hour AM/PM (e.g. "2:30 PM", "2 PM", "02:30PM")
  const ampmMatch = cleaned.match(/^(\d{1,2})(?:[:.]?(\d{2}))?\s*(AM|PM)$/);
  if (ampmMatch) {
    let h = parseInt(ampmMatch[1], 10);
    const m = ampmMatch[2] ? parseInt(ampmMatch[2], 10) : 0;
    const ampm = ampmMatch[3];
    if (ampm === "PM" && h < 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  // 24-hour (e.g. "14:30", "9:15")
  const h24Match = cleaned.match(/^(\d{1,2})[:.:"](\d{2})$/);
  if (h24Match) {
    const h = parseInt(h24Match[1], 10);
    const m = parseInt(h24Match[2], 10);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
  }

  // 4-digit military (e.g. "1430")
  if (/^\d{4}$/.test(cleaned)) {
    const h = parseInt(cleaned.slice(0, 2), 10);
    const m = parseInt(cleaned.slice(2), 10);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
  }

  return fallback;
};

export const generateTripDates = (startDateStr, endDateStr) => {
  if (!startDateStr || !endDateStr) {
    const today = new Date().toISOString().split("T")[0];
    return [{ dayNumber: 1, date: today, dayName: "Day 1" }];
  }

  const [sYear, sMonth, sDay] = startDateStr.split("-").map(Number);
  const [eYear, eMonth, eDay] = endDateStr.split("-").map(Number);

  const start = new Date(Date.UTC(sYear, sMonth - 1, sDay));
  const end = new Date(Date.UTC(eYear, eMonth - 1, eDay));

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dates = [];

  let current = new Date(start.getTime());
  let dayNum = 1;

  while (current <= end && dayNum <= 30) {
    const isoDate = current.toISOString().split("T")[0];
    const dayName = dayNames[current.getUTCDay()];
    dates.push({
      dayNumber: dayNum,
      date: isoDate,
      dayName: dayName,
    });
    current.setUTCDate(current.getUTCDate() + 1);
    dayNum++;
  }

  if (dates.length === 0) {
    dates.push({ dayNumber: 1, date: startDateStr, dayName: "Day 1" });
  }

  return dates;
};

import {
  normalizeInterests,
  buildInterestPromptSection,
  DOMAIN_DIRECTIVES,
} from "./interest-intelligence.service.js";

// Preserve legacy export for test compatibility
export const INTEREST_GUIDANCE = DOMAIN_DIRECTIVES;

/**
 * Builds the comprehensive prompt for AI itinerary generation.
 *
 * @param {Object} params - Trip parameters and context
 * @param {Array} expectedDates - Calendar day objects [{ dayNumber, date, dayName }]
 * @returns {string} Fully structured prompt string
 */
export const buildItineraryPrompt = (params, expectedDates) => {
  const {
    destination,
    origin,
    startDate,
    endDate,
    budgetNum,
    perDayBudget,
    perPersonBudget,
    style = "Balanced",
    interests = [],
    accommodationLine,
    journeyLine,
    transportList,
    travelersNum = 1,
    special,
    travelMode,
    outboundJourney = {},
    returnJourney = {},
    tripTiming = {},
    hotelName,
    hotelLocation,
    checkInTime,
    checkOutTime,
    weatherInfo = "",
    weatherData = null,
    verifiedPlaces = [],
    durationMode = "RECOMMENDED",
    durationRecommendation = null,
  } = params;

  const numDays = expectedDates.length;
  const interestProfile = normalizeInterests(interests);
  const styleNormalized = String(style || "Balanced").trim();

  // ── 1. Format Interest Guidance via Part 7 Intelligence Engine ─────────────
  const interestsBlock = buildInterestPromptSection(interestProfile, verifiedPlaces);

  // ── 2. Format Trip Style / Pacing Guidance ─────────────────────────────────
  const pacingGuidance = (() => {
    const s = styleNormalized.toLowerCase();
    if (s.includes("slow") || s.includes("relaxed") || s.includes("leisure")) {
      return `SLOW / RELAXED PACE:
• Maximum 2 to 3 main activities per day.
• Schedule generous 1.5 to 2 hour meal breaks and unhurried rest periods.
• Focus on deep immersion in one area per day rather than rushing between distant sights.
• Zero jam-packed schedules; allow free time for wandering and relaxation.`;
    }
    if (s.includes("packed") || s.includes("fast") || s.includes("active") || s.includes("intense")) {
      return `PACKED / ACTIVE PACE:
• 5 to 6 distinct activities per day during available usable hours.
• Maximize daytime exploration while maintaining realistic transit buffers (30-45 mins between spots).
• Pack in early morning highlights, midday cultural/food stops, late afternoon activities, and evening experiences.
• STRICT REQUIREMENT: Even in Packed mode, activities MUST NEVER exceed the day's usable window or return cutoff!`;
    }
    return `BALANCED PACE:
• 3 to 4 well-curated activities per day.
• Thoughtful balance of key attractions, authentic local dining, scenic stops, and comfortable rest intervals.
• Group activities by geographic neighborhood to minimize transit fatigue.`;
  })();

  // ── 2b. Duration-Aware Adaptation Guidance ─────────────────────────────────
  const minRecDays = durationRecommendation?.minimumDays || 3;
  const recDays = durationRecommendation?.recommendedDays || 5;
  const maxRecDays = durationRecommendation?.extendedDays || 7;
  const recDayTrips = durationRecommendation?.dayTrips || [];
  const recRegions = durationRecommendation?.regions || [];

  const durationAdaptationBlock = (() => {
    if (numDays < minRecDays) {
      return `DURATION-AWARE ADAPTATION: SHORT-STAY FOCUS (${numDays} Days vs Recommended Minimum ${minRecDays} Days)
• The traveler chose a compact duration (${numDays} calendar days) which is shorter than the recommended minimum (${minRecDays} days) for ${destination}.
• STRICT SELECTION & PRIORITIZATION: Prioritize ONLY the top iconic anchor landmarks and highest-alignment experiences matching stated interests: [${interestProfile.selected.join(", ") || "Sightseeing"}].
• ZERO OVERCROWDING: Do NOT pack excessive activities to compensate for a shorter stay. Maintain a comfortable pace (maximum 3 to 4 high-value stops per full day).
• EXCLUDE PERIPHERAL ATTRACTIONS: Omit outlying excursions, long day trips, and secondary sights that cannot realistically fit without causing transit exhaustion.
• GEOGRAPHIC COMPACTNESS: Keep activities tightly clustered in the core central area to minimize travel time.`;
    }
    if (numDays >= maxRecDays) {
      const dayTripStr = recDayTrips.length > 0 ? recDayTrips.join(", ") : "scenic nearby valleys, historic towns, or nature reserves";
      const regionStr = recRegions.length > 0 ? recRegions.join(", ") : "distinct geographic sectors";
      return `DURATION-AWARE ADAPTATION: EXTENDED IMMERSIVE PACING (${numDays} Days vs Recommended ${recDays} Days)
• The traveler has generous exploration time (${numDays} calendar days) to discover ${destination} in depth.
• DEEP IMMERSION & AUTHENTIC HIDDEN GEMS: Go far beyond the standard tourist checklist. Feature authentic hidden gems, quiet artisan quarters, scenic local trails, and experiential dining.
• REGIONAL SPREAD: Dedicate different days to distinct geographic regions (${regionStr}) to give every day a unique character and scenery.
• SUGGESTED DAY TRIPS: Integrate 1 to 2 rewarding regional day trips (${dayTripStr}) on the middle full destination days.
• ZERO REPETITIVE FILLER: Do NOT repeat identical activities, generic café stops, or redundant market walks just to fill time. Every single day must have a distinct thematic identity.
• RELAXED TEMPO: Integrate sunset viewpoints, leisurely meals, and local cultural immersion.`;
    }
    return `DURATION-AWARE ADAPTATION: BALANCED DESTINATION PACING (${numDays} Days)
• The trip duration (${numDays} days) comfortably aligns with Advenza's recommended ${recDays}-day exploration window for ${destination}.
• Seamlessly balance iconic landmarks, authentic hidden gems, and regional dining across the key geographic clusters without rushing.`;
  })();

  // ── 3. Format Travel Timing & Anti-Hallucination Details ───────────────────
  const outLeg = outboundJourney || {};
  const retLeg = returnJourney || {};
  const outTiming = tripTiming.outbound || {};
  const retTiming = tripTiming.return || {};

  const travelTimingBlock = `
• Outbound Journey:
  - Transport Mode: ${outLeg.transportType || travelMode || "Specified by traveler"}
  - Route: ${outLeg.departureLocation || origin || "Origin"} → ${outLeg.arrivalLocation || destination}
  - Departure: ${outLeg.departureDate || startDate} ${outLeg.departureTime ? `at ${outLeg.departureTime}` : "(Time unconfirmed)"}
  - Arrival at Destination: ${outLeg.arrivalDate || startDate} ${outLeg.arrivalTime ? `at ${outLeg.arrivalTime}` : "(Time unconfirmed)"}
  - Duration: ${outLeg.durationMinutes != null ? `${Math.round(outLeg.durationMinutes / 60 * 10) / 10} hours (${outLeg.durationMinutes} min)` : "Estimated"}
  - Duration Source: ${outLeg.durationSource || "ESTIMATED"}
  - Timing Status: ${outLeg.status || "ESTIMATED"} ${outLeg.transitRef ? `[Reference: ${outLeg.transitRef}]` : ""}
  - Overnight Journey: ${outTiming.isOvernight ? "YES (spans midnight/multiple days)" : "NO (same-day)"}

• Return Journey:
  - Transport Mode: ${retLeg.transportType || travelMode || "Specified by traveler"}
  - Route: ${retLeg.departureLocation || destination} → ${retLeg.arrivalLocation || origin || "Home"}
  - Departure from Destination: ${retLeg.departureDate || endDate} ${retLeg.departureTime ? `at ${retLeg.departureTime}` : "(Time unconfirmed)"}
  - Duration Source: ${retLeg.durationSource || "ESTIMATED"}
  - Timing Status: ${retLeg.status || "ESTIMATED"} ${retLeg.transitRef ? `[Reference: ${retLeg.transitRef}]` : ""}
  - Overnight Journey: ${retTiming.isOvernight ? "YES" : "NO"}

ANTI-HALLUCINATION TRAVEL RULES:
1. NEVER convert an ESTIMATED transport duration into a confirmed live schedule.
2. NEVER invent fake train numbers, flight numbers, or fabricated PNR codes.
3. If departure or arrival times are unconfirmed, describe them as approximate or estimated.`;

  // ── 4. Format Destination Usable Windows Table ─────────────────────────────
  const destDays = tripTiming.destination?.days || [];
  const destDaysMap = new Map();
  destDays.forEach((d) => destDaysMap.set(d.date, d));

  const dayWindowRows = expectedDates.map((d, idx) => {
    const w = destDaysMap.get(d.date) || destDays[idx];
    const status = w?.status || (idx === 0 ? "ARRIVAL_DAY" : idx === numDays - 1 ? "RETURN_DAY" : "FULL_DESTINATION_DAY");
    const availHours = w?.availableHours != null ? `${w.availableHours} hrs` : "Full Day";

    let timeRange = "08:00 to 21:00";
    if (w?.usableStartDateTime && w?.usableEndDateTime) {
      const startTime = w.usableStartDateTime.split("T")[1]?.slice(0, 5) || "08:00";
      const endTime = w.usableEndDateTime.split("T")[1]?.slice(0, 5) || "21:00";
      timeRange = `${startTime} to ${endTime}`;
    }

    let constraintNote = "";
    if (status === "TRAVEL_OUTBOUND") {
      constraintNote = "🚨 IN-TRANSIT TO DESTINATION: 0 usable destination hours. ZERO sightseeing activities allowed.";
    } else if (status === "TRAVEL_RETURN") {
      constraintNote = "🚨 IN-TRANSIT RETURNING HOME: 0 usable destination hours. ZERO sightseeing activities allowed.";
    } else if (status === "ARRIVAL_DAY") {
      constraintNote = `🛬 ARRIVAL DAY: Destination exploration starts ONLY AFTER ${timeRange.split(" to ")[0]} (after transit + hotel settling). NO morning sightseeing before arrival!`;
    } else if (status === "RETURN_DAY") {
      constraintNote = `🛫 RETURN DEPARTURE DAY: Sightseeing MUST CEASE before ${timeRange.split(" to ")[1]} to allow travel to departure hub. NO activities after cutoff!`;
    } else {
      constraintNote = "✨ FULL DESTINATION DAY: Full daytime window available for exploration.";
    }

    return `  Day ${d.dayNumber} (${d.date}, ${d.dayName}): [Status: ${status}] | Usable Window: ${timeRange} (${availHours})\n    → Rule: ${constraintNote}`;
  }).join("\n\n");

  // ── 5. Format Weather Context ──────────────────────────────────────────────
  const weatherBlock = weatherInfo && weatherInfo !== "Weather data temporarily unavailable"
    ? `DESTINATION WEATHER CONTEXT:
• Live Forecast in ${destination}: ${weatherInfo}
• Weather-Adaptive Rule: Align activities with weather conditions (e.g. prioritize indoor museums/galleries/cafes during rain or peak midday heat; schedule outdoor viewpoints/beaches during clear morning/golden hours).`
    : "";

  // ── 6. Assemble Full Structured Prompt ─────────────────────────────────────
  return `You are Advenza, an expert global travel planner and intelligence engine.
You craft hyper-personalized, realistic, time-aware itineraries that deeply respect traveler interests and real-world travel logistics.

==================================================
1. TRIP CONTEXT
==================================================
- Destination: ${destination}
- Origin (Home City): ${origin || "Not specified"}
- Dates: ${startDate} to ${endDate} (EXACTLY ${numDays} calendar days, Mode: ${durationMode})
- Total Budget: ₹${budgetNum} INR (${perDayBudget ? `~₹${perDayBudget}/day` : "budget controlled"})
- Travelers: ${travelersNum} person(s) (${perPersonBudget ? `~₹${perPersonBudget}/person` : ""})
- Travel Pace / Density: ${styleNormalized}
- Selected Interests: ${interestProfile.hasInterests ? interestProfile.selected.join(", ") : "General Sightseeing & Local Dining"}
- Focus Domains: ${interestProfile.normalizedDomains.length > 0 ? interestProfile.domainLabels.join(", ") : "General Exploration"}
- Accommodation: ${accommodationLine}
- Special Requests: ${special || "None"}

==================================================
2. TRAVEL LOGISTICS & TIMING (PART 3)
==================================================
${travelTimingBlock}

==================================================
3. DESTINATION USABLE-TIME WINDOWS (HARD CONSTRAINTS — PART 4)
==================================================
You MUST strictly obey the usable exploration window for every single day:
${dayWindowRows}

CRITICAL SCHEDULING RULES:
1. TRAVEL DAYS (status = TRAVEL_OUTBOUND or TRAVEL_RETURN):
   - Destination sightseeing is STRICTLY PROHIBITED (0 usable hours).
   - Day activities must ONLY describe journey departure, in-transit travel, scenery along the route, and overnight rest.
2. ARRIVAL DAYS (status = ARRIVAL_DAY):
   - You MUST NOT schedule any destination sightseeing before the usable start time.
   - The first activity must be journey completion, station/airport exit, hotel check-in / luggage drop, followed by afternoon/evening exploration.
3. RETURN DAYS (status = RETURN_DAY):
   - All sightseeing MUST END before the usable cutoff time.
   - The final activity must be heading to the departure hub and boarding the return journey.
4. TIME FORMAT: Every activity "time" MUST be in 24-hour HH:mm format (e.g. "09:00", "14:30", "19:00").

==================================================
4. USER INTEREST ALIGNMENT (PART 5 & PART 7)
==================================================
DO NOT generate a generic "top 10 tourist landmarks" checklist. The itinerary MUST be actively driven by the traveler's stated interests:
${interestsBlock}

MULTI-INTEREST HARMONY:
If multiple interests are selected (e.g. Food + Culture + Photography), blend them cohesively throughout each day rather than dumping isolated items:
- Morning: Cultural landmark or nature trail during optimal light (Photography + Culture/Nature)
- Lunch: Authentic regional dining experience (Food)
- Afternoon: Heritage artisan quarter or coastal walk (Culture/Beaches)
- Golden Hour: Scenic photography viewpoint (Photography)
- Evening: Vibrant street food market or lively beach shack dinner (Food/Nightlife)

==================================================
5. TRIP PACING, DENSITY & DURATION ADAPTATION
==================================================
${pacingGuidance}

${durationAdaptationBlock}

GEOGRAPHIC CLUSTERING:
- Cluster geographically neighboring sights into the same day or half-day to prevent exhausting cross-city travel.
- Factor in realistic 30 to 45 minute local transit buffers between distinct locations.

==================================================
6. WEATHER & REAL-WORLD CONTEXT
==================================================
${weatherBlock || "• Adapt outdoor vs indoor visits sensibly to daytime sunlight and regional temperature."}

==================================================
7. OUTPUT SPECIFICATION
==================================================
Return ONLY a valid JSON object matching this exact structure:
{
  "title": "Evocative, interest-focused trip title (e.g. 'Culinary & Coastal Discovery of Goa')",
  "destination": "${destination}",
  "summary": "2-3 sentence overview highlighting how the itinerary fulfills the traveler's interests within the available travel windows.",
  "budgetEstimate": "Summary budget string in INR",
  "budgetBreakdown": {
    "currency": "INR",
    "travelers": ${travelersNum},
    "nights": ${numDays},
    "categories": [
      { "category": "transport", "label": "Intercity & Local Transport", "description": "Transit costs", "amount": 3000, "type": "ESTIMATED" },
      { "category": "accommodation", "label": "Accommodation", "description": "Stay for ${numDays} nights", "amount": 7500, "type": "ESTIMATED" },
      { "category": "food", "label": "Food & Dining", "description": "Meals and culinary experiences", "amount": 6000, "type": "ESTIMATED" },
      { "category": "activities", "label": "Activities & Entry Passes", "description": "Sightseeing and experiences", "amount": 2000, "type": "ESTIMATED" },
      { "category": "miscellaneous", "label": "Contingency Buffer", "description": "Incidental expenses", "amount": 1500, "type": "ESTIMATED" }
    ]
  },
  "days": [
    {
      "dayNumber": 1,
      "date": "${expectedDates[0]?.date}",
      "title": "Theme for Day 1",
      "activities": [
        {
          "time": "HH:mm",
          "description": "Specific activity description with landmark, local tip, and estimated cost in INR",
          "interestTags": ["Food", "Culture"],
          "placeName": "Name of the venue or landmark if applicable",
          "placeCategory": "Food",
          "placeSubcategory": "Local Cuisine & Regional Specialties",
          "placeType": "POPULAR_ATTRACTION or HIDDEN_GEM",
          "isPlaceHiddenGem": false,
          "whySpecial": "Explanation of why this place is unique and special (especially for hidden gems)",
          "region": "e.g. North Goa Coast"
        }
      ]
    }
  ]
}

CRITICAL REQUIREMENTS:
1. Provide EXACTLY ${numDays} day objects in the "days" array matching the calendar schedule above.
2. Every activity "time" MUST be in 24-hour HH:mm format (e.g. "08:30", "14:00").
3. Include specific, real local restaurant / street food recommendations that reflect regional specialties.
4. Strictly obey all Usable-Time Windows and Travel Day rules.
5. PLAIN TEXT ONLY: Do NOT use Markdown formatting in strings. No **bold**, no *italic*, no __underline__, no backticks, no markdown headers (#), and no bullet markers (- or *) inside text fields. All descriptions, titles, and summaries must be pure plain readable text.`;
};
