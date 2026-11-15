/**
 * Advenza — Opening Hours & Overnight Schedule Engine
 *
 * Handles complex operating hours including:
 * - Overnight hours spanning midnight (e.g., 19:00 to 02:00 or 7:00 PM – 2:00 AM)
 * - 24-hour venues ("Open 24 hours")
 * - Day-of-week checks and specific closed days (e.g., Mondays for museums)
 * - Future schedule confidence thresholds (e.g., Google Places 7-day limit)
 * - Time window overlap and compatibility scoring
 */

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Converts HH:mm (24-hour) string to minutes from start of day (0 to 1439).
 */
export function timeStringToMinutes(timeStr) {
  if (!timeStr) return null;
  const parts = String(timeStr).trim().split(":");
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

/**
 * Converts minutes (0 to 1439) to HH:mm string.
 */
export function minutesToTimeString(minutes) {
  const norm = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Parses raw text or structured opening hours into daily periods.
 * Returns an object with periods: Array<{ open: string, close: string, overnight: boolean, days?: string[] }>
 */
export function parseOpeningHours(rawHours) {
  if (!rawHours) {
    return {
      status: "HOURS_UNCONFIRMED",
      is24Hours: false,
      periods: [],
      display: "Hours unconfirmed — check with venue",
    };
  }

  const str = String(rawHours).trim();

  // 1. Check for 24-hour venue
  if (/open 24 hours|24\/7|always open/i.test(str)) {
    return {
      status: "CONFIRMED",
      is24Hours: true,
      periods: [{ open: "00:00", close: "23:59", overnight: false }],
      display: "Open 24 hours",
    };
  }

  // 2. Check for closed
  if (/^closed$/i.test(str)) {
    return {
      status: "CLOSED",
      is24Hours: false,
      periods: [],
      display: "Closed",
    };
  }

  // 3. Match 12-hour or 24-hour time ranges
  // Matches e.g. "7:00 PM – 2:00 AM", "19:00 - 02:00", "09:00 to 17:30", "11 AM - 11 PM"
  const rangeRegex = /(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)\s*(?:–|-|to)\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)/gi;
  const periods = [];
  let match;

  while ((match = rangeRegex.exec(str)) !== null) {
    const startNorm = normalizeTo24hTime(match[1]);
    const endNorm = normalizeTo24hTime(match[2]);

    if (startNorm && endNorm) {
      const startMins = timeStringToMinutes(startNorm);
      const endMins = timeStringToMinutes(endNorm);

      // If end <= start (e.g. 19:00 to 02:00, or 21:00 to 00:00), it spans midnight!
      const isOvernight = endMins <= startMins;

      periods.push({
        open: startNorm,
        close: endNorm,
        startMins,
        endMins,
        overnight: isOvernight,
      });
    }
  }

  if (periods.length === 0) {
    return {
      status: "HOURS_UNCONFIRMED",
      is24Hours: false,
      periods: [],
      display: str,
    };
  }

  // Extract closed days if mentioned (e.g., "Closed on Mondays", "Tue closed")
  const closedDays = [];
  DAY_NAMES.forEach((day) => {
    const re = new RegExp(`(?:closed\\s+(?:on\\s+)?|no\\s+)${day}|${day}\\s*:\\s*closed`, "i");
    if (re.test(str)) {
      closedDays.push(day);
    }
  });

  return {
    status: "CONFIRMED",
    is24Hours: false,
    periods,
    closedDays,
    display: str,
  };
}

/**
 * Normalizes any time string (e.g. "7 PM", "07:00 PM", "19:00", "midnight") to 24-hour "HH:mm".
 */
export function normalizeTo24hTime(timeStr) {
  if (!timeStr) return null;
  const cleaned = String(timeStr).trim().toUpperCase();

  if (cleaned === "MIDNIGHT" || cleaned === "12:00 AM" || cleaned === "12 AM") {
    return "00:00";
  }
  if (cleaned === "NOON" || cleaned === "12:00 PM" || cleaned === "12 PM") {
    return "12:00";
  }

  // 12-hour format: e.g. "7:30 PM", "7 PM", "11:00AM"
  const ampmMatch = cleaned.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/);
  if (ampmMatch) {
    let h = parseInt(ampmMatch[1], 10);
    const m = ampmMatch[2] ? parseInt(ampmMatch[2], 10) : 0;
    const ampm = ampmMatch[3];
    if (ampm === "PM" && h < 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  // 24-hour format: e.g. "19:00", "09:30"
  const h24Match = cleaned.match(/^(\d{1,2}):(\d{2})$/);
  if (h24Match) {
    const h = parseInt(h24Match[1], 10);
    const m = parseInt(h24Match[2], 10);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
  }

  // Pure integer hour (e.g. "19", "7")
  if (/^\d{1,2}$/.test(cleaned)) {
    const h = parseInt(cleaned, 10);
    if (h >= 0 && h <= 23) {
      return `${String(h).padStart(2, "0")}:00`;
    }
  }

  return null;
}

/**
 * Checks whether a venue is open at a specific target time on a given date.
 *
 * @param {Object} parsedHours - Output of parseOpeningHours()
 * @param {string} targetTimeStr - "HH:mm" (24-hour format)
 * @param {string} [dateStr] - ISO Date "YYYY-MM-DD"
 * @returns {{ isOpen: boolean, reason: string, isOvernight: boolean, confidence: "CONFIRMED"|"INDICATIVE"|"UNKNOWN" }}
 */
export function isVenueOpenAt({ parsedHours, targetTimeStr, dateStr }) {
  if (!parsedHours || parsedHours.status === "HOURS_UNCONFIRMED" || !parsedHours.periods || parsedHours.periods.length === 0) {
    if (parsedHours?.is24Hours) {
      return { isOpen: true, reason: "Open 24 hours", isOvernight: false, confidence: "CONFIRMED" };
    }
    return {
      isOpen: true, // Default permissive when hours are unknown, but flag confidence
      reason: "Hours unconfirmed with provider",
      isOvernight: false,
      confidence: "UNKNOWN",
    };
  }

  // 1. Check day-of-week closure if dateStr is provided
  let dayName = null;
  if (dateStr) {
    const d = new Date(dateStr + "T00:00:00Z");
    if (!isNaN(d.getTime())) {
      dayName = DAY_NAMES[d.getUTCDay()];
      if (parsedHours.closedDays && parsedHours.closedDays.includes(dayName)) {
        return {
          isOpen: false,
          reason: `Venue is closed on ${dayName}s`,
          isOvernight: false,
          confidence: "CONFIRMED",
        };
      }
    }
  }

  // 2. Normalize target time
  const targetNorm = normalizeTo24hTime(targetTimeStr);
  const targetMins = timeStringToMinutes(targetNorm);

  if (targetMins == null) {
    return { isOpen: true, reason: "Invalid target time format", isOvernight: false, confidence: "UNKNOWN" };
  }

  // 3. Evaluate each operating period
  for (const period of parsedHours.periods) {
    const openMins = period.startMins ?? timeStringToMinutes(period.open);
    const closeMins = period.endMins ?? timeStringToMinutes(period.close);

    if (openMins == null || closeMins == null) continue;

    if (!period.overnight) {
      // Normal same-day operating window: [openMins, closeMins]
      if (targetMins >= openMins && targetMins <= closeMins) {
        return {
          isOpen: true,
          reason: `Open during standard hours (${period.open} – ${period.close})`,
          isOvernight: false,
          confidence: "CONFIRMED",
        };
      }
    } else {
      // OVERNIGHT OPERATING WINDOW (e.g. 19:00 to 02:00)
      // Open from 19:00 (1140 min) to 23:59 (1439 min) OR 00:00 (0 min) to 02:00 (120 min)
      if (targetMins >= openMins || targetMins <= closeMins) {
        return {
          isOpen: true,
          reason: `Open during overnight hours (${period.open} – ${period.close} spanning midnight)`,
          isOvernight: true,
          confidence: "CONFIRMED",
        };
      }
    }
  }

  return {
    isOpen: false,
    reason: `Target time ${targetNorm} falls outside operating hours (${parsedHours.display})`,
    isOvernight: parsedHours.periods.some((p) => p.overnight),
    confidence: "CONFIRMED",
  };
}

/**
 * Checks if a trip date is outside the 7-day live window of Google Places currentOpeningHours.
 *
 * @param {string} tripDateStr - "YYYY-MM-DD"
 * @returns {boolean} true if tripDate is > 7 days ahead of today
 */
export function isOutside7DayWindow(tripDateStr) {
  if (!tripDateStr) return false;
  const now = new Date();
  const tripDate = new Date(tripDateStr + "T00:00:00Z");
  if (isNaN(tripDate.getTime())) return false;

  const diffMs = tripDate.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  return diffDays > 7;
}

/**
 * Calculates overlap minutes between an activity window and venue operating hours.
 *
 * @param {Object} parsedHours - Output of parseOpeningHours()
 * @param {string} activityStart - "HH:mm"
 * @param {number} durationMins - Duration in minutes (e.g. 120)
 * @returns {{ overlapMins: number, fitRatio: number, isCompatible: boolean }}
 */
export function calculateWindowOverlap(parsedHours, activityStart, durationMins = 90) {
  if (!parsedHours || parsedHours.is24Hours) {
    return { overlapMins: durationMins, fitRatio: 1.0, isCompatible: true };
  }

  const startMins = timeStringToMinutes(normalizeTo24hTime(activityStart));
  if (startMins == null) {
    return { overlapMins: 0, fitRatio: 0, isCompatible: true };
  }

  let maxOverlap = 0;

  for (let offset = 0; offset < durationMins; offset += 15) {
    const checkMin = (startMins + offset) % 1440;
    const checkTime = minutesToTimeString(checkMin);
    const { isOpen } = isVenueOpenAt({ parsedHours, targetTimeStr: checkTime });
    if (isOpen) {
      maxOverlap += 15;
    }
  }

  const fitRatio = Math.min(1.0, maxOverlap / durationMins);
  return {
    overlapMins: maxOverlap,
    fitRatio,
    isCompatible: fitRatio >= 0.5, // At least 50% of the activity is within operating hours
  };
}

