/**
 * Itinerary Prompt Builder & Date Utilities.
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

export const buildItineraryPrompt = (params, expectedDates) => {
  const {
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
    transportList,
    travelersNum,
    special,
    travelMode,
    departureTime,
    arrivalTime,
    returnJourney,
    hotelName,
    hotelLocation,
    checkInTime,
    checkOutTime,
  } = params;

  const numDays = expectedDates.length;
  const interestsArr = Array.isArray(interests) ? interests : interests ? [String(interests)] : [];
  const interestsStr = interestsArr.join(" ").toLowerCase();
  const specialStr = String(special || "").toLowerCase();
  const styleStr = String(style || "").toLowerCase();

  const isNightlifeRequested =
    interestsStr.includes("nightlife") ||
    interestsStr.includes("night life") ||
    interestsStr.includes("club") ||
    interestsStr.includes("pub") ||
    interestsStr.includes("bar") ||
    specialStr.includes("nightlife") ||
    specialStr.includes("night life") ||
    specialStr.includes("club") ||
    specialStr.includes("pub") ||
    specialStr.includes("bar") ||
    specialStr.includes("late night") ||
    specialStr.includes("party") ||
    styleStr.includes("nightlife") ||
    styleStr.includes("night life");

  const toMinutes = (hhmm) => {
    if (!hhmm) return null;
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + (m || 0);
  };

  const toClockTime = (mins) => {
    if (mins == null) return null;
    const clamped = Math.min(Math.max(mins, 0), 23 * 60 + 59);
    const h24 = Math.floor(clamped / 60) % 24;
    const mm = clamped % 60;
    return `${String(h24).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  };

  const arrivalMins = toMinutes(arrivalTime);
  const HUB_TO_HOTEL_SETTLED_MINS = 120;
  const hotelReadyMins = arrivalMins != null ? arrivalMins + HUB_TO_HOTEL_SETTLED_MINS : null;
  const hotelReadyTime = hotelReadyMins != null ? toClockTime(hotelReadyMins) : null;

  const day1Scenario = (() => {
    if (arrivalMins == null) return "unknown";
    if (arrivalMins >= 21 * 60) return "late_night";
    if (arrivalMins >= 17 * 60) return "evening";
    if (arrivalMins >= 13 * 60) return "afternoon";
    if (arrivalMins >= 9 * 60) return "midmorning";
    return "early_morning";
  })();

  const leg3ArrivalTime = arrivalMins != null ? toClockTime(arrivalMins + 45) : null;
  const checkInDisplayTime = leg3ArrivalTime ?? checkInTime ?? null;
  const activityStartMins = hotelReadyMins != null ? hotelReadyMins : null;
  const dinnerTime = activityStartMins != null ? toClockTime(Math.max(activityStartMins, 18 * 60)) : "19:00";
  const returnHotelTime = dinnerTime
    ? toClockTime(
        Math.min(
          (activityStartMins ?? 18 * 60) + (isNightlifeRequested ? 270 : 150),
          isNightlifeRequested ? 25 * 60 + 30 : 22 * 60
        )
      )
    : isNightlifeRequested
    ? "23:30"
    : "21:30";

  const day1Rules = (() => {
    const arrStr = arrivalTime
      ? `The user's transport arrives at ${arrivalTime} (${toClockTime(arrivalMins)}).`
      : "The user's arrival time is not specified — estimate it from journey details.";

    if (day1Scenario === "late_night") {
      return `LATE-NIGHT ARRIVAL SCENARIO:
${arrStr}
• Hotel reached by approximately ${hotelReadyTime || "23:00"}.
• Day 1 MUST contain ONLY travel and check-in:
  1. { "time": "${departureTime || "09:00"}", "description": "3-leg outbound journey: from home in ${origin || "departure city"} to ${destination}." }
  2. { "time": "${checkInDisplayTime || "23:00"}", "description": "Arrive at ${hotelName || "hotel"} in ${hotelLocation || destination}. Check in, freshen up and sleep immediately — no night activities." }
• ABSOLUTELY NO heavy sightseeing or late walks on Day 1. Night arrival means straight to bed.`;
    }

    if (day1Scenario === "evening") {
      return `EVENING ARRIVAL SCENARIO:
${arrStr}
• Hotel reached / settled in by approximately ${hotelReadyTime || "19:00"}.
• Day 1 activities (use EXACT 24-hour HH:mm times):
  1. { "time": "${departureTime || "14:00"}", "description": "3-leg outbound journey from ${origin || "home"} to ${destination}." }
  2. { "time": "${checkInDisplayTime || leg3ArrivalTime || "18:30"}", "description": "Arrive at hotel in ${hotelLocation || destination}. Check in. Freshen up and rest." }
  3. { "time": "${dinnerTime}", "description": "Dinner at a recommended restaurant near ${hotelLocation || "the hotel"}." }
  ${isNightlifeRequested ? `4. { "time": "21:30", "description": "Evening / Nightlife activity near the hotel." }\n  5. { "time": "${returnHotelTime}", "description": "Return to hotel. Sleep." }` : `4. { "time": "${returnHotelTime}", "description": "Return to hotel. Sleep." }`}
• NO crowded sightseeing or heavy monuments on Day 1.`;
    }

    return `GENERAL ARRIVAL SCENARIO:
${arrStr}
• Day 1 activities:
  1. Outbound travel from ${origin || "origin"} to ${destination}.
  2. Hotel check-in at ${checkInDisplayTime || "14:00"}.
  3. Afternoon light exploration and local dinner.`;
  })();

  const expectedDaysList = expectedDates
    .map((d) => `  Day ${d.dayNumber}: date "${d.date}" (${d.dayName})`)
    .join("\n");

  return `You are Advenza, an expert Indian travel planner AI.

Generate a comprehensive, realistic day-by-day travel itinerary in valid JSON format for:
- Destination: ${destination}
- Origin: ${origin || "Not specified"}
- Dates: ${startDate} to ${endDate} (EXACTLY ${numDays} days)
- Total Budget: ₹${budgetNum} INR (${perDayBudget ? `~₹${perDayBudget}/day` : "budget controlled"})
- Travelers: ${travelersNum} person(s) (${perPersonBudget ? `~₹${perPersonBudget}/person` : ""})
- Travel Pace/Style: ${style || "Balanced"}
- Specific Interests: ${interestsArr.length > 0 ? interestsArr.join(", ") : "General sightseeing and local food"}
- Inbound Transport: ${journeyLine}
- Accommodation: ${accommodationLine}
- Special Notes: ${special || "None"}

DAY 1 RULES:
${day1Rules}

CALENDAR SCHEDULE:
${expectedDaysList}

Return ONLY a valid JSON object matching this exact structure:
{
  "title": "Creative evocative trip title",
  "destination": "${destination}",
  "summary": "2-3 sentence overview of this trip",
  "budgetEstimate": "Summary budget string in INR",
  "budgetBreakdown": {
    "currency": "INR",
    "travelers": ${travelersNum},
    "nights": ${numDays},
    "categories": [
      {
        "category": "transport",
        "label": "Train Travel / Flights",
        "description": "Specific route assumption or tickets",
        "amount": 3000,
        "type": "ESTIMATED"
      },
      {
        "category": "accommodation",
        "label": "Accommodation",
        "description": "Hotel or stay assumption for ${numDays} nights",
        "amount": 7500,
        "type": "ESTIMATED"
      },
      {
        "category": "food",
        "label": "Food & Dining",
        "description": "Daily food allowance for ${travelersNum} travelers",
        "amount": 6000,
        "type": "ESTIMATED"
      },
      {
        "category": "activities",
        "label": "Local Transport & Entry Fees",
        "description": "Local travel and attraction entry passes",
        "amount": 2000,
        "type": "ESTIMATED"
      },
      {
        "category": "miscellaneous",
        "label": "Miscellaneous / Contingency",
        "description": "Unexpected or buffer expenses",
        "amount": 1500,
        "type": "ESTIMATED"
      }
    ]
  },
  "days": [
    {
      "dayNumber": 1,
      "date": "${expectedDates[0]?.date}",
      "title": "Day theme",
      "activities": [
        {
          "time": "09:00",
          "description": "Specific activity description with landmark, local tip, and estimated cost in INR"
        }
      ]
    }
  ]
}

CRITICAL RULES:
1. Provide EXACTLY ${numDays} day objects in the "days" array matching the calendar days above.
2. Every activity "time" MUST be in 24-hour HH:mm format (e.g. "09:00", "14:30"). Never use AM/PM.
3. Include specific local restaurant and street food recommendations for lunch and dinner.
4. Keep budget realistic to Indian market conditions and allocate amounts appropriately across categories.
5. In "budgetBreakdown", each category amount MUST be a realistic number in INR.`;
};
