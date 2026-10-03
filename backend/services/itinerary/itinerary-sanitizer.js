/**
 * Strips accidental Markdown formatting (bold, italic, backticks, headings, list markers)
 * from user-facing text while preserving legitimate punctuation (e.g. ₹, ≈, –, —, ( ), etc.).
 *
 * @param {string|null|undefined} text
 * @returns {string} Clean plain text
 */
export const stripMarkdownFormatting = (text) => {
  if (text == null) return "";
  let s = String(text);

  // 1. Remove triple bold+italic: ***text*** or ___text___
  s = s.replace(/\*\*\*(.*?)\*\*\*/g, "$1");
  s = s.replace(/___(.*?)___/g, "$1");

  // 2. Remove double bold: **text** or __text__
  s = s.replace(/\*\*(.*?)\*\*/g, "$1");
  s = s.replace(/__(.*?)__/g, "$1");

  // 3. Remove single italic: *text* (bounded) or _text_
  s = s.replace(/(^|[^\w*])\*([^*\n]+)\*([^\w*]|$)/g, "$1$2$3");
  s = s.replace(/(^|[^\w_])_([^_\n]+)_([^\w_]|$)/g, "$1$2$3");

  // 4. Remove inline code / backticks: `code` or ```code```
  s = s.replace(/```([\s\S]*?)```/g, "$1");
  s = s.replace(/`([^`]+)`/g, "$1");

  // 5. Remove leading Markdown headings (e.g. "### Title" -> "Title")
  s = s.replace(/^#+\s*/gm, "");

  // 6. Remove leading list bullets (e.g. "- Activity" -> "Activity", "* Activity" -> "Activity")
  s = s.replace(/^[-*•]\s+/gm, "");

  // 7. Normalize multiple spaces / tabs within lines
  s = s.replace(/[ \t]+/g, " ");

  return s.trim();
};

/**
 * Normalizes any time string to 24-hour HH:mm format.
 * @param {string|null} timeStr
 * @param {string} fallback
 * @returns {string} HH:mm format
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

/**
 * Generate inclusive calendar dates between startDate and endDate.
 * E.g. '2026-09-25' to '2026-09-28' yields exactly 4 days:
 * 25 Sep (Day 1), 26 Sep (Day 2), 27 Sep (Day 3), 28 Sep (Day 4).
 * @param {string} startDateStr
 * @param {string} endDateStr
 * @returns {Array<{ dayNumber: number, date: string, dayName: string }>}
 */
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

  // Maximum safety clamp (up to 30 days)
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
  sanitizeActivityInterestTags,
  NORMALIZED_DOMAINS,
} from "./interest-intelligence.service.js";

// Parse legacy pipe string if present
export const parseLegacyBudgetEstimate = (budgetStr, travelers = 1, nights = 1) => {
  if (!budgetStr || typeof budgetStr !== "string") {
    return null;
  }

  // Strip trailing total like "= ₹20,000 total"
  const cleanedStr = budgetStr.replace(/=\s*(?:₹|INR|Rs\.?)?\s*[\d,]+(?:\s*total)?$/i, "").trim();
  const chunks = cleanedStr.split("|").map((s) => s.trim()).filter(Boolean);
  if (chunks.length === 0) return null;

  const categories = [];

  for (const chunk of chunks) {
    const match = chunk.match(/^(.*?)(?::|-)\s*(?:₹|INR|Rs\.?)?\s*([\d,]+)(?:\s*(?:INR|Rs\.?))?$/i);
    let rawLabelPart = "";
    let amount = 0;

    if (match) {
      rawLabelPart = match[1].trim();
      amount = parseInt(match[2].replace(/,/g, ""), 10);
    } else {
      const fallbackMatch = chunk.match(/^(.*?)\s*(?:₹|INR|Rs\.?)\s*([\d,]+)$/i);
      if (fallbackMatch) {
        rawLabelPart = fallbackMatch[1].trim();
        amount = parseInt(fallbackMatch[2].replace(/,/g, ""), 10);
      }
    }

    if (!rawLabelPart || isNaN(amount) || amount <= 0) continue;

    let label = rawLabelPart;
    let description = "";

    // Extract parenthesized note: "Train (2 Sleeper tickets)" -> label: "Train", description: "2 Sleeper tickets"
    const parenMatch = rawLabelPart.match(/^(.*?)\s*\((.*?)\)$/);
    if (parenMatch) {
      label = parenMatch[1].trim();
      description = parenMatch[2].trim();
    }

    const lower = label.toLowerCase();
    let category = "miscellaneous";
    if (
      lower.includes("activit") ||
      lower.includes("entry") ||
      lower.includes("ticket") ||
      lower.includes("sightsee") ||
      lower.includes("tour") ||
      lower.includes("monument") ||
      lower.includes("attraction") ||
      lower.includes("local transport")
    ) {
      category = "activities";
    } else if (
      lower.includes("train") ||
      lower.includes("flight") ||
      lower.includes("transport") ||
      lower.includes("travel") ||
      lower.includes("cab") ||
      lower.includes("transit") ||
      lower.includes("bus")
    ) {
      category = "transport";
    } else if (
      lower.includes("accommodat") ||
      lower.includes("hotel") ||
      lower.includes("stay") ||
      lower.includes("guesthouse") ||
      lower.includes("resort") ||
      lower.includes("hostel")
    ) {
      category = "accommodation";
    } else if (
      lower.includes("food") ||
      lower.includes("dining") ||
      lower.includes("meal") ||
      lower.includes("restaurant") ||
      lower.includes("cafe")
    ) {
      category = "food";
    } else if (lower.includes("shop")) {
      category = "shopping";
    }

    categories.push({
      category,
      label: label || "Expense",
      description,
      amount,
      type: "ESTIMATED",
    });
  }

  if (categories.length === 0) return null;

  return {
    currency: "INR",
    travelers: Number(travelers) || 1,
    nights: Number(nights) || 1,
    categories,
  };
};

/**
 * Validate and sanitize itinerary generated by the AI to guarantee 100% data integrity.
 * @param {Object} parsedData
 * @param {Array<{ dayNumber: number, date: string, dayName: string }>} expectedDates
 * @param {Object} context
 * @returns {Object} Sanitized itinerary
 */
export const validateAndSanitizeItinerary = (parsedData, expectedDates, context = {}) => {
  if (!parsedData || typeof parsedData !== "object") {
    throw new Error("AI returned invalid itinerary structure");
  }

  const destination = stripMarkdownFormatting(parsedData.destination || context.destination || "Trip Destination");
  const title = stripMarkdownFormatting(parsedData.title || `Curated Journey in ${destination}`);
  const summary = stripMarkdownFormatting(
    parsedData.summary || `A personalized ${expectedDates.length}-day travel plan for ${destination}.`
  );
  const budgetEstimate =
    parsedData.budgetEstimate ||
    (context.budgetNum ? `Total: ₹${context.budgetNum} (Budget controlled)` : "Estimated within budget");

  const travelersCount = Number(context.travelersNum || context.travelers) || 1;
  const nightsCount = expectedDates.length || 1;

  let budgetBreakdown = null;

  if (
    parsedData.budgetBreakdown &&
    typeof parsedData.budgetBreakdown === "object" &&
    Array.isArray(parsedData.budgetBreakdown.categories) &&
    parsedData.budgetBreakdown.categories.length > 0
  ) {
    const validCategories = parsedData.budgetBreakdown.categories
      .filter((c) => c && typeof c === "object" && (c.amount != null || c.label))
      .map((c) => {
        const rawAmount =
          typeof c.amount === "string" ? parseFloat(c.amount.replace(/,/g, "")) : Number(c.amount);
        return {
          category: String(c.category || "miscellaneous").toLowerCase().trim(),
          label: stripMarkdownFormatting(String(c.label || "Expense")),
          description: stripMarkdownFormatting(c.description ? String(c.description) : ""),
          amount: !isNaN(rawAmount) && rawAmount >= 0 ? Math.round(rawAmount) : 0,
          type: "ESTIMATED",
        };
      });

    if (validCategories.length > 0) {
      budgetBreakdown = {
        currency: parsedData.budgetBreakdown.currency || "INR",
        travelers: Number(parsedData.budgetBreakdown.travelers) || travelersCount,
        nights: Number(parsedData.budgetBreakdown.nights) || nightsCount,
        categories: validCategories,
      };
    }
  }

  // Fallback 1: Parse legacy pipe string if present
  if (!budgetBreakdown && budgetEstimate) {
    budgetBreakdown = parseLegacyBudgetEstimate(budgetEstimate, travelersCount, nightsCount);
  }

  // Fallback 2: Generate realistic structured categories if budgetNum is specified
  if (!budgetBreakdown && context.budgetNum && Number(context.budgetNum) > 0) {
    const total = Number(context.budgetNum);
    budgetBreakdown = {
      currency: "INR",
      travelers: travelersCount,
      nights: nightsCount,
      categories: [
        {
          category: "transport",
          label: "Inbound & Outbound Travel",
          description: `Transit to/from ${destination}`,
          amount: Math.round(total * 0.25),
          type: "ESTIMATED",
        },
        {
          category: "accommodation",
          label: "Accommodation",
          description: `Stay for ${nightsCount} night${nightsCount > 1 ? "s" : ""}`,
          amount: Math.round(total * 0.38),
          type: "ESTIMATED",
        },
        {
          category: "food",
          label: "Food & Dining",
          description: `Meals for ${travelersCount} traveler${travelersCount > 1 ? "s" : ""}`,
          amount: Math.round(total * 0.20),
          type: "ESTIMATED",
        },
        {
          category: "activities",
          label: "Local Transport & Entry Fees",
          description: "Sightseeing and attraction admission",
          amount: Math.round(total * 0.12),
          type: "ESTIMATED",
        },
        {
          category: "miscellaneous",
          label: "Miscellaneous / Contingency",
          description: "Buffer and unexpected expenses",
          amount: Math.round(total * 0.05),
          type: "ESTIMATED",
        },
      ],
    };
  }

  const rawDays = Array.isArray(parsedData.days) ? parsedData.days : [];
  const rawDaysMap = new Map();

  rawDays.forEach((d, idx) => {
    const num = Number(d.dayNumber) || idx + 1;
    rawDaysMap.set(num, d);
  });

  // Map destination day windows from tripTiming if provided
  const destDays = context?.tripTiming?.destination?.days || [];
  const destDaysMap = new Map();
  destDays.forEach((d) => {
    if (d.date) destDaysMap.set(d.date, d);
  });

  const interestProfile = normalizeInterests(context?.interests);
  const interestsList = interestProfile.selected.map((s) => s.toLowerCase());
  const normalizedDomainSet = new Set(interestProfile.normalizedDomains);

  const hasInterest = (keyword) => {
    const k = keyword.toLowerCase();
    if (interestsList.some((i) => i.includes(k))) return true;
    for (const d of normalizedDomainSet) {
      if (d.toLowerCase().includes(k)) return true;
    }
    return false;
  };

  const sanitizedDays = expectedDates.map((dateObj, idx) => {
    const dayNum = dateObj.dayNumber;
    const existing = rawDaysMap.get(dayNum) || rawDays[idx];
    const dayWindow = destDaysMap.get(dateObj.date) || destDays[idx];
    const dayStatus = dayWindow?.status || (idx === 0 ? "ARRIVAL_DAY" : idx === expectedDates.length - 1 ? "RETURN_DAY" : "FULL_DESTINATION_DAY");

    // Extract usable start/end HH:mm times if window exists
    const winStartStr = dayWindow?.usableStartDateTime?.split("T")[1]?.slice(0, 5) || null;
    const winEndStr = dayWindow?.usableEndDateTime?.split("T")[1]?.slice(0, 5) || null;

    let dayTitle = existing?.title?.trim() ? stripMarkdownFormatting(existing.title) : "";
    if (!dayTitle) {
      if (dayStatus === "TRAVEL_OUTBOUND") dayTitle = `Journey to ${destination}`;
      else if (dayStatus === "TRAVEL_RETURN") dayTitle = `Return Journey to ${context.origin || "Home"}`;
      else if (dayStatus === "ARRIVAL_DAY") dayTitle = `Arrival & Evening in ${destination}`;
      else if (dayStatus === "RETURN_DAY") dayTitle = `Final Exploration & Departure`;
      else if (hasInterest("food") || normalizedDomainSet.has(NORMALIZED_DOMAINS.FOOD_CULINARY)) dayTitle = `Culinary & Cultural Discovery of ${destination}`;
      else if (hasInterest("beach") || normalizedDomainSet.has(NORMALIZED_DOMAINS.BEACHES_COASTAL)) dayTitle = `Coastal Exploration & Beach Discovery`;
      else if (hasInterest("nature") || hasInterest("photo") || normalizedDomainSet.has(NORMALIZED_DOMAINS.PHOTOGRAPHY_VISUAL)) dayTitle = `Scenic Highlights & Panoramic Vistas`;
      else dayTitle = `Discovering ${destination} - Day ${dayNum}`;
    }

    let activities = [];
    if (existing && Array.isArray(existing.activities) && existing.activities.length > 0) {
      activities = existing.activities
        .filter((a) => a && typeof a === "object" && (a.description || a.title))
        .map((a, actIdx) => {
          const rawDesc = String(a.description || a.title || "");
          const desc = stripMarkdownFormatting(rawDesc);
          const defaultTimes = ["09:00", "12:00", "15:00", "18:00", "20:30", "22:30"];
          const time = normalizeTime(a.time, defaultTimes[actIdx % defaultTimes.length]);
          const rawTags = Array.isArray(a.interestTags) ? a.interestTags : [];
          const interestTags = sanitizeActivityInterestTags(rawTags, interestProfile);
          return {
            time,
            description: desc,
            interestTags,
          };
        });
    }

    // ── Deterministic Timing Validation (Part 5 Safety Net) ──────────────────
    if (dayStatus === "TRAVEL_OUTBOUND") {
      // 0 usable hours — no destination sightseeing allowed
      activities = [
        {
          time: context.departureTime ? normalizeTime(context.departureTime) : "08:00",
          description: `Outbound journey departure from ${context.origin || "home city"} towards ${destination}.`,
          interestTags: [],
        },
        {
          time: "13:00",
          description: `Midday travel progress, observing regional landscapes along the route.`,
          interestTags: [],
        },
        {
          time: "20:00",
          description: `Evening transit continuation / overnight rest on board towards destination.`,
          interestTags: [],
        },
      ];
    } else if (dayStatus === "TRAVEL_RETURN") {
      // 0 usable hours — return transit day
      activities = [
        {
          time: "08:00",
          description: `Morning return journey continuation towards ${context.origin || "home city"}.`,
          interestTags: [],
        },
        {
          time: "14:00",
          description: `Arrival back at ${context.origin || "home city"}. Unpack and conclude the journey.`,
          interestTags: [],
        },
      ];
    } else if (dayStatus === "ARRIVAL_DAY" && winStartStr) {
      // Prune or adjust activities that occur before usableStartDateTime
      const [sh, sm] = winStartStr.split(":").map(Number);
      const startMins = sh * 60 + sm;

      // Keep only activities that occur after arrival buffer
      const validActivities = activities.filter((a) => {
        const [ah, am] = (a.time || "00:00").split(":").map(Number);
        return ah * 60 + am >= startMins - 15; // 15m tolerance
      });

      if (validActivities.length > 0) {
        activities = validActivities;
      } else {
        // Fallback evening arrival activities
        activities = [
          {
            time: context.arrivalTime ? normalizeTime(context.arrivalTime) : "16:00",
            description: `Arrive in ${destination}. Transfer to ${context.hotelLocation || "hotel"}, check in, unpack, and freshen up.`,
            interestTags: [],
          },
          {
            time: normalizeTime(winStartStr, "18:30"),
            description: hasInterest("food")
              ? `Evening culinary stroll tasting regional delicacies at local food hubs.`
              : hasInterest("beach")
              ? `Relaxed evening stroll along the beach and coastal dinner.`
              : `Evening orientation walk and local dinner near ${context.hotelLocation || destination}.`,
            interestTags: hasInterest("food") ? ["Food"] : hasInterest("beach") ? ["Beaches"] : [],
          },
        ];
      }
    } else if (dayStatus === "RETURN_DAY" && winEndStr) {
      // Prune activities that occur after cutoff time
      const [eh, em] = winEndStr.split(":").map(Number);
      const endMins = eh * 60 + em;

      const validActivities = activities.filter((a) => {
        const [ah, am] = (a.time || "00:00").split(":").map(Number);
        return ah * 60 + am <= endMins + 15;
      });

      if (validActivities.length > 0) {
        activities = validActivities;
      }

      // Ensure departure entry is present at or right after cutoff
      const hasDepEntry = activities.some((a) =>
        a.description.toLowerCase().includes("departure") ||
        a.description.toLowerCase().includes("return journey") ||
        a.description.toLowerCase().includes("airport") ||
        a.description.toLowerCase().includes("station")
      );

      if (!hasDepEntry) {
        activities.push({
          time: normalizeTime(winEndStr, "16:30"),
          description: `Transfer to departure hub and board return transport to ${context.origin || "home city"}.`,
          interestTags: [],
        });
      }
    }

    // Default fallback if activities still empty
    if (activities.length === 0) {
      if (dayNum === 1) {
        activities = [
          {
            time: context.departureTime ? normalizeTime(context.departureTime) : "08:00",
            description: `Journey from ${context.origin || "home"} to ${destination}.`,
            interestTags: [],
          },
          {
            time: context.arrivalTime ? normalizeTime(context.arrivalTime) : "14:00",
            description: `Arrive in ${context.hotelLocation || destination}. Check in and rest.`,
            interestTags: [],
          },
          {
            time: "18:30",
            description: `Evening stroll and local dining.`,
            interestTags: hasInterest("food") ? ["Food"] : [],
          },
        ];
      } else if (dayNum === expectedDates.length) {
        activities = [
          {
            time: "09:00",
            description: `Morning exploration and breakfast in ${destination}.`,
            interestTags: hasInterest("food") ? ["Food"] : [],
          },
          {
            time: "12:00",
            description: `Hotel check-out and final local stops.`,
            interestTags: [],
          },
          {
            time: "16:30",
            description: `Return journey to ${context.origin || "departure city"}.`,
            interestTags: [],
          },
        ];
      } else {
        activities = [
          {
            time: "09:00",
            description: hasInterest("photo") || hasInterest("nature")
              ? `Morning scenic viewpoint and photography walk in ${destination}.`
              : hasInterest("culture")
              ? `Morning heritage and cultural landmark exploration in ${destination}.`
              : `Morning sightseeing and key attractions in ${destination}.`,
            interestTags: hasInterest("photo")
              ? ["Photography"]
              : hasInterest("nature")
              ? ["Nature"]
              : hasInterest("culture")
              ? ["Culture"]
              : [],
          },
          {
            time: "13:00",
            description: hasInterest("food")
              ? `Lunch enjoying authentic local specialties at a renowned eatery.`
              : `Lunch at a local specialty restaurant.`,
            interestTags: hasInterest("food") ? ["Food"] : [],
          },
          {
            time: "16:00",
            description: hasInterest("beach")
              ? `Afternoon beach exploration and coastal relaxation.`
              : `Afternoon cultural, scenic, or artisan market visit.`,
            interestTags: hasInterest("beach")
              ? ["Beaches"]
              : hasInterest("shopping")
              ? ["Shopping"]
              : hasInterest("culture")
              ? ["Culture"]
              : [],
          },
          {
            time: "20:00",
            description: hasInterest("nightlife")
              ? `Evening night market, live music venue, or dining experience.`
              : `Dinner and evening leisure.`,
            interestTags: hasInterest("nightlife")
              ? ["Nightlife"]
              : hasInterest("food")
              ? ["Food"]
              : [],
          },
        ];
      }
    }

    // Ensure activities are sorted chronologically
    activities.sort((a, b) => {
      const tA = (a.time || "00:00").replace(":", "");
      const tB = (b.time || "00:00").replace(":", "");
      return tA.localeCompare(tB);
    });

    return {
      dayNumber: dayNum,
      date: dateObj.date,
      title: dayTitle,
      activities: activities,
    };
  });

  return {
    title,
    destination,
    summary,
    budgetEstimate,
    budgetBreakdown,
    days: sanitizedDays,
  };
};
