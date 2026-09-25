/**
 * Itinerary Sanitizer and Date/Time Normalizer.
 * Guarantees 100% schema integrity and clean 24-hour time formatting for all itinerary days.
 */

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

/**
 * Parses legacy pipe-separated budget strings into structured budgetBreakdown.
 * Example legacy string:
 * "Train (2 Sleeper tickets): ₹3,000 | Accommodation (budget guesthouses, 15 nights): ₹7,500 | Food (average ₹400/day for 2): ₹6,000 | Local transport & entry fees: ₹2,000 | Miscellaneous/contingency: ₹1,500 = ₹20,000 total"
 * @param {string} budgetStr
 * @param {number} travelers
 * @param {number} nights
 * @returns {Object|null}
 */
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

  const destination = parsedData.destination || context.destination || "Trip Destination";
  const title = parsedData.title || `Curated Journey in ${destination}`;
  const summary = parsedData.summary || `A personalized ${expectedDates.length}-day travel plan for ${destination}.`;
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
          label: String(c.label || "Expense").trim(),
          description: c.description ? String(c.description).trim() : "",
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

  const sanitizedDays = expectedDates.map((dateObj, idx) => {
    const dayNum = dateObj.dayNumber;
    const existing = rawDaysMap.get(dayNum) || rawDays[idx];

    let dayTitle = existing?.title?.trim();
    if (!dayTitle) {
      if (dayNum === 1) dayTitle = `Arrival & Settling in ${destination}`;
      else if (dayNum === expectedDates.length) dayTitle = `Final Exploration & Departure`;
      else dayTitle = `Discovering ${destination} - Day ${dayNum}`;
    }

    let activities = [];
    if (existing && Array.isArray(existing.activities) && existing.activities.length > 0) {
      activities = existing.activities
        .filter((a) => a && typeof a === "object" && (a.description || a.title))
        .map((a, actIdx) => {
          const desc = String(a.description || a.title || "").trim();
          const defaultTimes = ["09:00", "12:00", "15:00", "18:00", "20:30", "22:30"];
          const time = normalizeTime(a.time, defaultTimes[actIdx % defaultTimes.length]);
          return {
            time,
            description: desc,
          };
        });
    }

    if (activities.length === 0) {
      if (dayNum === 1) {
        activities = [
          {
            time: context.departureTime ? normalizeTime(context.departureTime) : "08:00",
            description: `Journey from ${context.origin || "home"} to ${destination}.`,
          },
          {
            time: context.arrivalTime ? normalizeTime(context.arrivalTime) : "14:00",
            description: `Arrive at hotel in ${context.hotelLocation || destination}. Check in, unpack, and rest.`,
          },
          { time: "18:30", description: `Evening stroll and local dining near the hotel.` },
        ];
      } else if (dayNum === expectedDates.length) {
        activities = [
          { time: "09:00", description: `Breakfast and morning souvenir exploration in ${destination}.` },
          { time: "12:00", description: `Hotel check-out and visiting a final local viewpoint.` },
          { time: "16:30", description: `Return journey home to ${context.origin || "departure city"}.` },
        ];
      } else {
        activities = [
          { time: "09:00", description: `Morning sightseeing and key attractions in ${destination}.` },
          { time: "13:00", description: `Lunch at a local specialty restaurant.` },
          { time: "16:00", description: `Afternoon cultural, historical, or scenic experience.` },
          { time: "20:00", description: `Dinner and evening leisure.` },
        ];
      }
    }

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
