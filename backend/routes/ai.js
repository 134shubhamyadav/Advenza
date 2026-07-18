import express from "express";
import OpenAI from "openai";
import google from "googlethis";
import Trip from "../models/Trip.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

// ── Helpers ────────────────────────────────────────────────────────────────────
/**
 * Robustly parse JSON from an AI response.
 * Some models wrap the JSON in markdown fences (```json ... ```) even when
 * told not to — this strips those before parsing.
 */
const parseAIJson = (raw) => {
  if (!raw || typeof raw !== "string") throw new Error("AI returned empty content");
  // Strip optional leading/trailing markdown code fences
  const stripped = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  return JSON.parse(stripped);
};
router.use(verifyToken);

let groqClient;
let openRouterClient;

const initClients = () => {
  if (!groqClient) {
    groqClient = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
    });
  }
  if (!openRouterClient) {
    openRouterClient = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
    });
  }
};

const callAI = async (options) => {
  initClients();

  try {
    // Try Groq first with llama-3.1-8b-instant
    return await groqClient.chat.completions.create({
      ...options,
      model: "llama-3.1-8b-instant",
    });
  } catch (err) {
    console.warn("Groq failed, falling back to OpenRouter:", err.message);
    try {
      // Fallback to OpenRouter with Gemma 4 free
      return await openRouterClient.chat.completions.create({
        ...options,
        model: "google/gemma-4-26b-a4b-it:free",
      });
    } catch (fallbackErr) {
      console.error("OpenRouter fallback also failed:", fallbackErr.message);
      throw new Error(
        "Aventra's AI engine is temporarily unavailable due to upstream provider limits. Please try again in a few seconds."
      );
    }
  }
};

// POST /api/ai/generate — Generate a trip itinerary using AI
router.post("/generate", async (req, res) => {
  try {
    const {
      destination,
      origin,
      startDate,
      endDate,
      budget,
      style,
      interests,
      accommodation,
      hotelLocation,
      transport,
      travelers,
      special,
      // New travel detail fields
      travelMode,
      departureHub,
      arrivalHub,
      transitRef,
      departureTime,
      arrivalTime,
      // Accommodation details
      hotelName,
      checkInTime,
      checkOutTime,
    } = req.body;

    // Validate required fields
    if (!destination || !startDate || !endDate) {
      return res.status(400).json({ error: "destination, startDate, and endDate are required" });
    }

    const numDays = Math.max(
      1,
      Math.ceil((new Date(endDate) - new Date(startDate)) / 86400000),
    );
    const budgetNum = Number(budget) || 0;
    const perDayBudget = budgetNum > 0 ? Math.round(budgetNum / numDays) : null;
    const transportList =
      Array.isArray(transport) && transport.length > 0 ? transport.join(", ") : (travelMode || "any available");
    const travelersNum = Number(travelers) || 1;
    const perPersonBudget =
      budgetNum > 0 ? Math.round(budgetNum / travelersNum) : null;

    // Build a human-readable journey summary for the prompt
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
      if (hotelName) parts.push(hotelName);
      if (hotelLocation) parts.push(`in ${hotelLocation}`);
      if (checkInTime) parts.push(`check-in at ${checkInTime}`);
      if (checkOutTime) parts.push(`check-out at ${checkOutTime}`);
      return parts.length ? parts.join(", ") : "not specified";
    })();

    // ── Day 1 precise timeline computation ────────────────────────────────────
    /**
     * Given an HH:MM string, return total minutes from midnight.
     */
    const toMinutes = (hhmm) => {
      if (!hhmm) return null;
      const [h, m] = hhmm.split(":").map(Number);
      return h * 60 + (m || 0);
    };

    /**
     * Format minutes-from-midnight back to a readable "HH:mm" 24-hour string.
     */
    const toClockTime = (mins) => {
      if (mins == null) return null;
      const clamped = Math.min(Math.max(mins, 0), 23 * 60 + 59);
      const h24 = Math.floor(clamped / 60) % 24;
      const mm = clamped % 60;
      return `${String(h24).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    };

    const arrivalMins = toMinutes(arrivalTime); // user-entered arrival at destination hub

    // How long does it take from the arrival hub to being settled at hotel?
    // Leg 3 transfer ≈ 45 min, check-in formalities ≈ 30 min, freshen up/rest ≈ 45 min → 2h total
    const HUB_TO_HOTEL_SETTLED_MINS = 120;
    const EFFECTIVE_DAY_END_MINS = 23 * 60; // 11:00 PM — practical end of a tourist day

    const hotelReadyMins = arrivalMins != null ? arrivalMins + HUB_TO_HOTEL_SETTLED_MINS : null;
    const usableMinsAfterSettling = hotelReadyMins != null
      ? Math.max(0, EFFECTIVE_DAY_END_MINS - hotelReadyMins)
      : null;
    const usableHoursAfterSettling = usableMinsAfterSettling != null
      ? Math.round((usableMinsAfterSettling / 60) * 10) / 10
      : null;

    const hotelReadyTime = hotelReadyMins != null ? toClockTime(hotelReadyMins) : null;

    // Classify Day 1 scenario
    const day1Scenario = (() => {
      if (arrivalMins == null) return "unknown";
      if (arrivalMins >= 21 * 60) return "late_night";     // 9 PM+
      if (arrivalMins >= 17 * 60) return "evening";         // 5 PM–9 PM
      if (arrivalMins >= 13 * 60) return "afternoon";       // 1 PM–5 PM
      if (arrivalMins >= 9 * 60) return "midmorning";       // 9 AM–1 PM
      return "early_morning";                               // before 9 AM
    })();

    // Build exact time labels for each Day 1 milestone
    const leg3ArrivalTime = arrivalMins != null ? toClockTime(arrivalMins + 45) : null;   // ~45 min transfer hub→hotel
    const checkInDisplayTime = leg3ArrivalTime ?? (checkInTime || null);
    const freshenUpEnd = hotelReadyMins != null ? toClockTime(hotelReadyMins) : null;
    // Earliest first activity start after settling
    const activityStartMins = hotelReadyMins != null ? hotelReadyMins : null;
    const activityStartTime = activityStartMins != null ? toClockTime(activityStartMins) : null;
    const dinnerTime = activityStartMins != null ? toClockTime(Math.max(activityStartMins, 18 * 60)) : "7:00 PM";
    const returnHotelTime = dinnerTime ? toClockTime(
      Math.min((activityStartMins ?? 18 * 60) + 150, 22 * 60)
    ) : "9:30 PM";

    // Build the strict Day 1 rules text for the prompt
    const day1Rules = (() => {
      const arrStr = arrivalTime ? `The user's flight/train arrives at ${arrivalTime} (${toClockTime(arrivalMins)}).` : "The user's arrival time is not specified — estimate it from journey details.";

      if (day1Scenario === "late_night") {
        return `LATE-NIGHT ARRIVAL SCENARIO:
${arrStr}
• Hotel reached by approximately ${hotelReadyTime}.
• Day 1 MUST contain ONLY three activities:
  1. { "time": "${departureTime || "09:00"}", "description": "3-leg outbound journey (Leg 1 + Leg 2 + Leg 3 as specified in rule 3 above)." }
  2. { "time": "${checkInDisplayTime || "23:00"}", "description": "Arrive at ${hotelName || "hotel"} in ${hotelLocation || "destination"}. Check in. Freshen up and sleep immediately — no activities tonight." }
• ABSOLUTELY NO sightseeing, dinner out, or walks on Day 1. Night arrival means straight to bed.`;
      }

      if (day1Scenario === "evening") {
        return `EVENING ARRIVAL SCENARIO:
${arrStr}
• Hotel reached / settled in by approximately ${hotelReadyTime}.
• Usable time after settling: ~${usableHoursAfterSettling}h (before 23:00).
• Day 1 MUST contain ONLY these activities — use EXACT 24-hour clock times (HH:mm format):
  1. { "time": "${departureTime || "16:00"}", "description": "3-leg outbound journey." }
  2. { "time": "${checkInDisplayTime || leg3ArrivalTime || "18:00"}", "description": "Arrive at hotel. Check in. Freshen up and rest." }
  3. { "time": "${dinnerTime}", "description": "Dinner at a recommended restaurant WITHIN 500m of the hotel. Walk back." }
  4. { "time": "${returnHotelTime}", "description": "Return to hotel. Sleep." }
• NO sightseeing, no monuments, no tours on Day 1.`;
      }

      if (day1Scenario === "afternoon") {
        return `AFTERNOON ARRIVAL SCENARIO:
${arrStr}
• Hotel reached / settled in by approximately ${hotelReadyTime}.
• Usable time after settling: ~${usableHoursAfterSettling}h.
• Day 1 MUST use EXACT 24-hour clock times (HH:mm format):
  1. { "time": "${departureTime || "09:00"}", "description": "3-leg outbound journey." }
  2. { "time": "${checkInDisplayTime || "16:00"}", "description": "Arrive at hotel in ${hotelLocation || "destination"}. Check in, unpack, and rest for 45 minutes." }
  3. { "time": "${activityStartTime || "17:30"}", "description": "Short walk — ONE nearby attraction, market, or café within 2 km of the hotel." }
  4. { "time": "${dinnerTime}", "description": "Dinner at a local restaurant near the hotel." }
  5. { "time": "${returnHotelTime}", "description": "Return to hotel. Sleep early to recover from travel." }
• MAXIMUM one attraction on Day 1. No packed sightseeing.`;
      }

      if (day1Scenario === "midmorning") {
        return `MID-MORNING ARRIVAL SCENARIO:
${arrStr}
• Hotel reached / settled in by approximately ${hotelReadyTime}.
• Usable time after settling: ~${usableHoursAfterSettling}h — good for light sightseeing.
• Day 1 MUST use EXACT 24-hour clock times (HH:mm format):
  1. { "time": "${departureTime || "08:00"}", "description": "3-leg outbound journey." }
  2. { "time": "${checkInDisplayTime || "12:30"}", "description": "Arrive at hotel. Check in. Freshen up and have lunch." }
  3. { "time": "${activityStartTime || "14:00"}", "description": "Visit 1–2 nearby attractions (under 3 km from hotel)." }
  4. { "time": "${dinnerTime}", "description": "Dinner at a local restaurant." }
  5. { "time": "${returnHotelTime}", "description": "Return to hotel. Sleep." }`;
      }

      if (day1Scenario === "early_morning") {
        return `EARLY MORNING ARRIVAL SCENARIO:
${arrStr}
• Hotel reached / settled in by approximately ${hotelReadyTime}.
• Usable time after settling: ~${usableHoursAfterSettling}h — most of the day available.
• Day 1 can include a full light day. Use EXACT 24-hour clock times (HH:mm format):
  1. { "time": "${departureTime || "05:00"}", "description": "3-leg outbound journey (overnight or dawn travel)." }
  2. { "time": "${checkInDisplayTime || "09:00"}", "description": "Arrive at hotel. Check in (or leave bags if early). Freshen up and have breakfast." }
  3. { "time": "${activityStartTime || "11:00"}", "description": "Visit 2–3 nearby attractions." }
  4. { "time": "${dinnerTime}", "description": "Dinner." }
  5. { "time": "${returnHotelTime}", "description": "Return to hotel." }`;
      }

      // unknown arrival time
      return `UNKNOWN ARRIVAL TIME — ESTIMATE FROM JOURNEY:
The user has not entered an arrival time. Estimate based on mode (${travelMode || "unknown"}) and distance. Apply the appropriate scenario above (late-night / evening / afternoon / morning) once you know the estimated arrival.
Use EXACT 24-hour clock times (HH:mm format) in the "time" field of every activity — never use generic labels like "Morning" or "Afternoon" for Day 1.`;
    })();

    const prompt = `You are Aventra, a highly precise, location-aware travel planner AI. You MUST follow the user's preferences exactly and create a practical, realistic itinerary.

USER'S TRIP DETAILS:
- Origin (Home City): ${origin || "not specified"}
- Destination: ${destination}
- Dates: ${startDate} to ${endDate} (${numDays} day${numDays !== 1 ? "s" : ""})
- Number of travelers: ${travelersNum}
- Total Budget: ₹${budgetNum} INR${perDayBudget ? ` (≈₹${perDayBudget}/day, ≈₹${perPersonBudget}/person)` : " (no budget limit specified)"}
- Travel Pace: ${style || "Balanced"}
- Interests: ${interests?.join(", ") || "General sightseeing"}
- Accommodation: ${accommodationLine}
- Primary Intercity Journey: ${journeyLine}
- Local transport at destination: ${transportList}
- Special requests: ${special || "None"}

STRICT TRANSPORT RULES:
1. USE REAL LOCATION-AWARE & NEAREST MAJOR HUBS:
   - For all transit, use actual, real-world airports, railway stations, or bus terminals that physically belong to the origin city (${origin || "departure city"}) and the destination city (${destination}). Never invent fictional hubs.
   - If the Home City (${origin || "departure city"}) or Destination (${destination}) is a smaller city, town, or suburb that does not have its own major airport or railway station (e.g. Kalyan, Noida, Thane, Gurgaon, Auroville), you MUST map it to the nearest real-world major transportation hub for the selected travel mode.
     - Flights: Map to the nearest major airport (e.g., Kalyan/Thane -> Chhatrapati Shivaji Maharaj International Airport (BOM) in Mumbai; Noida/Gurgaon -> Indira Gandhi International Airport (DEL) in Delhi). Never invent "Kalyan Airport" or "Noida Airport".
     - Trains: Map to the nearest suitable railway station (e.g. Kalyan Junction, Thane Station, Delhi Junction).
     - Buses: Map to the nearest major bus terminal (e.g. ISBT Kashmiri Gate in Delhi, Majestic Bus Stand in Bengaluru).

2. CHOOSE THE MOST APPROPRIATE TRAVEL MODE & DETAILS:
   - Flights: State actual departure/arrival airports, realistic flight duration (e.g. 2h 10m), realistic flight timing/schedule, and approximate fare per person in ₹.
   - Train: Specify actual railway stations, realistic travel duration, specific train name/number (e.g. Rajdhani Express, Shatabdi Express), and estimated fare per person in ₹.
   - Bus: Specify actual bus terminals (e.g. ISBT Kashmiri Gate, Majestic Bus Stand), duration, and fare in ₹.
   - Rental Car / Car: Estimate driving distance, travel duration, toll charges, and approximate fuel costs in ₹.

3. BREAKDOWN FIRST & LAST LEGS (3-LEG JOURNEY REPRESENTATION):
   - The very first activity on Day 1 MUST describe the outbound journey from the user's home to the destination hotel in three distinct steps:
     1. Leg 1: From home in ${origin || "departure city"} to the nearest departure station/airport/terminal (via cab, auto, local train, metro, etc. with distance, travel time, and cost).
     2. Leg 2: From the departure station/airport/terminal to the destination station/airport/terminal (via selected flight/train/bus details, duration, timing, and fare).
     3. Leg 3: From the destination station/airport/terminal to the hotel/stay area (${hotelLocation ? `in ${hotelLocation}` : "hotel"} via local transport with duration, distance, and cost).
   - The very last activity on Day ${numDays} Evening MUST describe the return journey back home in the reverse three steps (Hotel to destination hub -> transit hub to origin hub -> origin hub to home in ${origin || "departure city"}).

4. INTELLIGENT TRANSPORT DECISION-MAKING:
   - Distance Check: If the driving distance between ${origin || "departure city"} and ${destination} is short (under 300 km, e.g. Delhi to Jaipur, Mumbai to Pune, Bangalore to Mysore), do NOT recommend a flight, even if "Flights" is in the selected transport list.
   - Evaluate route practicality. If flights are unavailable, unnecessary, or impractical for the route, recommend a Train. If trains are also unavailable or impractical, recommend a Bus or Car (Road Trip) as the best option.

STRICT ITINERARY & GEOGRAPHY RULES:
5. HOTEL-AWARE, GEOGRAPHICALLY OPTIMIZED PLANNING:
   - Hotel as the Starting & Ending Point: The hotel/stay location "${hotelName ? `${hotelName} in ${hotelLocation}` : hotelLocation || "hotel"}" MUST be used as the anchor starting point and ending point of the itinerary every single day.
     - Every following day (except final departure day): The morning itinerary must always start from the hotel. The evening/night itinerary must always end with returning back to the hotel.
     - Final departure day: Starts from the hotel in the morning, does activities, and ends at the Airport/Station/Hub for the return journey home.
   - Daily Proximity: Group nearby attractions together in the same day to minimize travel time.
   - Geographic Continuity & Smart Route Optimization: Plan the day in a logical order based on geography. Never suggest zigzagging across the destination city in a single day.
   - Deferred Sightseeing: Postpone all packed sightseeing, monument visits, and intensive itineraries to Day 2 morning, when the traveler is well-rested.

6. LOCAL TRANSPORTATION, DISTANCES & TRAVEL TIMES:
   - Local Transit details: For every single attraction, activity, or meal in the itinerary (except the intercity transit day), explain exactly how to travel from the previous location (or the hotel) using the most suitable local option: Walking (🚶), Cab (🚕), Auto Rickshaw (🛺), Metro (🚇), Bus (🚌), or Bicycle (🚲). Include approximate distance (km) and travel time (mins).

7. CLEAN ITINERARY & BUDGET CONTROL:
   - Only display costs where actually useful: Intercity tickets, hotel cost, entry fees, total budget.
   - Do NOT show cost for every local taxi ride, auto, metro fare, or cafe visit.
   - Budget Constraint: Total ₹${budgetNum}. SUM of all estimated costs MUST NOT exceed ₹${budgetNum}.

8. ACCOMMODATION: Recommend only "${accommodation || "standard"}" type accommodation.
9. PACE: Match "${style || "Balanced"}" pace — ${style === "Slow" ? "max 1-2 activities per day, long meals, relaxed mornings" : style === "Packed" ? "fill every slot, maximize sightseeing" : "2-3 anchor activities per day with free exploration time"}.
10. INTERESTS: Focus on: ${interests?.join(", ") || "general sightseeing"}.
11. Generate exactly ${numDays} days.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL TIME RULE — READ BEFORE GENERATING THE ITINERARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The "time" field in EVERY activity MUST be an EXACT 24-hour clock time (e.g. "06:00", "14:30", "23:00").
NEVER use AM/PM labels or generic labels like "Morning", "Afternoon", or "Evening" in the "time" field.
The schedule must reflect actual times derived from the user's travel details below.

DAY 1 — MANDATORY RULES BASED ON USER'S ACTUAL ARRIVAL TIME:
${day1Rules}

LAST DAY (Day ${numDays}) — MANDATORY DEPARTURE RULES:
• The last activity MUST be the 3-leg reverse journey home.${checkOutTime ? `\n• Hotel check-out at ${checkOutTime}.` : ""}
• Use exact 24-hour clock times (HH:mm format) for all departure activities.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Return ONLY a valid JSON object (no markdown, no extra text):
{
  "title": "Creative trip title for ${destination}",
  "destination": "${destination}",
  "summary": "2-3 sentence trip summary mentioning exact transport mode, pace, and budget tier",
  "budgetEstimate": "Total: ₹${budgetNum} — Accommodation: ₹X (${numDays} nights), Food: ₹X, Transport: ₹X, Activities: ₹X, Misc: ₹X",
  "days": [
    {
      "dayNumber": 1,
      "date": "${startDate}",
      "title": "Arrival — [describe day theme based on arrival time]",
      "activities": [
        { "time": "[EXACT 24-hour clock time, e.g. 06:00]", "description": "3-leg outbound journey: Leg 1 … Leg 2 … Leg 3 …" },
        { "time": "[EXACT 24-hour clock time of hotel arrival, e.g. 18:30]", "description": "Check in at ${hotelName || "hotel"} in ${hotelLocation || "destination"}. Freshen up and rest." },
        { "time": "[EXACT 24-hour clock time, only if usable hours > 1]", "description": "Only include this if there is meaningful time left before 23:00 — e.g., nearby dinner or short walk." }
      ]
    }
  ]
}`



    const completion = await callAI({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0].message.content;
    console.log("[AI Generate] Raw response (first 200 chars):", raw?.slice(0, 200));
    const tripData = parseAIJson(raw);

    // Persist ALL user inputs
    tripData.createdBy = req.uid || "guest";
    tripData.createdAt = new Date().toISOString();
    tripData.budgetTotal = budgetNum;
    tripData.transport = transport || [];
    tripData.accommodation = accommodation || "";
    tripData.hotelLocation = hotelLocation || "";
    tripData.travelers = travelersNum;
    tripData.style = style || "Balanced";
    tripData.startDate = startDate;
    tripData.endDate = endDate;
    tripData.interests = interests || [];
    // New travel detail fields
    tripData.travelMode = travelMode || "";
    tripData.departureHub = departureHub || "";
    tripData.arrivalHub = arrivalHub || "";
    tripData.transitRef = transitRef || "";
    tripData.departureTime = departureTime || "";
    tripData.arrivalTime = arrivalTime || "";
    // Accommodation detail fields
    tripData.hotelName = hotelName || "";
    tripData.checkInTime = checkInTime || "";
    tripData.checkOutTime = checkOutTime || "";

    // Save to MongoDB
    const newTrip = new Trip(tripData);
    const savedTrip = await newTrip.save();

    res.status(201).json(savedTrip);
  } catch (err) {
    console.error("AI generate error:", err);
    res.status(500).json({ error: err.message });
  }
});


// POST /api/ai/planb — Conversational travel contingency assistant
router.post("/planb", async (req, res) => {
  try {
    const { tripId, messages, question, currentDay } = req.body;
    if (!tripId) return res.status(400).json({ error: "tripId is required" });

    let chatMessages = [];
    if (messages && Array.isArray(messages)) {
      chatMessages = messages;
    } else if (question && typeof question === "string") {
      chatMessages = [{ role: "user", content: question }];
    } else {
      return res.status(400).json({ error: "Either 'messages' array or 'question' string is required" });
    }

    // Load the actual saved trip from MongoDB
    const trip = await Trip.findById(tripId);
    if (!trip) return res.status(404).json({ error: "Trip not found" });

    // Determine the current day of the trip
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

    // Build a compact itinerary summary for the AI context
    const daySummaries = (trip.days || []).map((d) => {
      const acts = (d.activities || []).map((a) => `${a.time}: ${a.description}`).join(" | ");
      return `Day ${d.dayNumber} (${d.date || "TBD"}) — ${d.title}: ${acts}`;
    }).join("\n");

    // Provide current date so the AI can reason correctly about "today" / "this morning"
    const todayISO = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const todayName = dayNames[new Date().getDay()];

    const systemPrompt = `You are Aventra, a warm, knowledgeable, and practical AI travel assistant. You help travellers recover gracefully from unexpected disruptions — like a trusted local friend who knows the destination inside out.

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
3. INTELLIGENT SLOT MATCHING: When finding the best available future slot, intelligently evaluate:
   - Attraction opening and closing hours.
   - The best time of day to visit (e.g. morning to avoid heat/crowds, sunset for viewpoints, night for markets).
   - Travel distance and route practicality from the user's current location or hotel.
   - Existing schedule and available free time (prefer swapping with or replacing lower-priority items like general resting, shopping, or leisure).
   - User preferences and budget.
4. MINIMAL IMPACT / SWAPPING / SHIFTING:
   - Make the smallest possible changes to the itinerary to fit the rescheduled attraction.
   - Prioritize swapping it with a lower-priority activity (e.g. leisure time, general shopping, secondary sightseeing, or resting).
   - Alternatively, shift succeeding activities down by one slot or to a later day.
5. EXACT RECOMMENDED VISIT TIMES:
   - Any proposed/modified day in the "proposedDays" array MUST use the exact recommended visit time in 24-hour clock format (HH:mm format, e.g., "09:00", "14:30", "18:00", "21:00") in the "time" field of the activity instead of general words like "Morning", "Afternoon", or "Evening" or 12-hour AM/PM labels.
   - Make sure all other activities on that proposed day are also updated to have exact 24-hour clock time strings (e.g. "10:30", "13:00", etc.) for consistency and precision.
6. EXPLAIN THE RESCHEDULING CHOICE:
   - For every rescheduled attraction, you MUST explain exactly why you chose that specific day and time (e.g. "Charminar has been moved to Day 4 at 17:30 because it's less crowded and fits naturally into your existing route", or "Golconda Fort has been rescheduled to Day 4 at 09:00 to avoid the afternoon heat and because it is close to your next attraction").
7. UPDATE ALL AFFECTED DAYS: If an activity is rescheduled from Day A to Day B, you MUST return BOTH Day A and Day B in the "proposedDays" array. Ensure Day A has the activity removed/shifted and Day B has it inserted, preserving all other details.

────────────────────────────────────────
HOW TO WRITE YOUR REPLY (very important):
────────────────────────────────────────
Write the "reply" field in the style of a real, helpful travel companion texting their friend. Follow this exact 4-part flow:

PART 1 — ACKNOWLEDGE (1-2 sentences)
Show you understand what happened and briefly say whether it's a big deal or easily recoverable. Sound human and reassuring, not robotic.
Example: "Oh no — missing Charminar this morning is frustrating, but honestly don't worry, you can still make it work."

PART 2 — EXPLAIN THE IMPACT & RESCHEDULING (2-3 sentences)
Clearly explain where you are rescheduling the missed attraction to make sure it is not lost. Explain what activity was shifted or swapped to make room. Give the specific reason for choosing that time (e.g., to avoid heat, crowds, or match sunset).
Example: "I've moved Charminar to Day 4 at 17:30 since the sunset lighting there is gorgeous anyway and it's less crowded. To make room for this, we'll swap your relaxed tea-tasting activity to Day 5 at 14:00."

PART 3 — RECOVERY PLAN & LOGISTICS (natural language, NO tables)
Walk the user through the logistics of the recovery plan. Explain travel times, distance, cost, or local conditions.
Example: "Heading to Charminar at 17:30 is actually great because the midday heat will have passed. It's about a 20-minute auto ride from your current location. Once you're done, Laad Bazaar is right next door for dinner and a walk."
NEVER use markdown tables. Use short paragraphs or plain bullet points only if you need to list multiple options.

PART 4 — PROPOSED CHANGES SUMMARY
End with a clear, scannable summary block. Use exactly this format with emojis:

**Proposed Changes**
✅ [Short action — e.g. "Move Charminar visit to Day 4 at 17:30"]
✅ [Short action — e.g. "Shift Salar Jung Museum to Day 5 at 10:00"]
✅ [If nothing else changes: "No changes to remaining days"]
💰 Additional cost: ₹[amount or "₹0 — no extra cost"]
⏱️ Extra travel time: [e.g. "~15 minutes" or "none"]

KEY RULES:
- NO markdown tables anywhere in the reply
- Sound like a real person, not a formatted report
- Use real place names, realistic local timings (in 24-hour format HH:mm), and local context for ${trip.destination}
- If no itinerary changes are needed, say so warmly and explain why
- Keep the entire reply concise — under 350 words

JSON STRUCTURE (return ONLY raw JSON, no markdown code fences):
{
  "reply": "[Your 4-part conversational response as described above]",
  "proposedDays": [
    {
      "dayNumber": 2,
      "date": "YYYY-MM-DD",
      "title": "Updated day theme",
      "activities": [
        { "time": "09:00",   "description": "Specific activity with practical tip and estimated cost ₹X" },
        { "time": "13:00",   "description": "Specific activity with practical tip and estimated cost ₹X" },
        { "time": "17:30",   "description": "Specific activity with practical tip and estimated cost ₹X" }
      ]
    }
  ]
}

CRITICAL: proposedDays must contain ONLY the day(s) that actually need changes. Do NOT include unaffected days. If no changes are needed to the itinerary, return proposedDays as an empty array []. Every time value in proposedDays.activities.time MUST use the 24-hour HH:mm format (never AM/PM).`;

    const completion = await callAI({
      messages: [
        { role: "system", content: systemPrompt },
        ...chatMessages.map((m) => ({
          role: m.role === "user" ? "user" : "assistant",
          content: m.content || m.text,
        })),
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0].message.content;
    console.log("[Plan B] Raw AI response (first 300 chars):", raw?.slice(0, 300));

    const resultData = parseAIJson(raw);

    // Ensure the response always has the expected shape
    if (!resultData.reply) {
      throw new Error("AI response is missing the 'reply' field");
    }
    if (!Array.isArray(resultData.proposedDays)) {
      resultData.proposedDays = [];
    }
    // Ensure dayNumber is always a number (not a string from some models)
    resultData.proposedDays = resultData.proposedDays.map((d) => ({
      ...d,
      dayNumber: Number(d.dayNumber),
    }));

    res.json(resultData);

  } catch (err) {
    console.error("Plan B generation error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/chat — Chat with AI about travel
router.post("/chat", async (req, res) => {
  try {
    const { messages } = req.body; // Array of { role, content }

    // RAG: Perform a live search based on the user's latest query
    let liveContext = "";
    try {
      const lastUserMessage = messages.filter((m) => m.role === "user").pop();
      // Only search if the message has substance
      if (lastUserMessage && (lastUserMessage.content || lastUserMessage.text).length > 10) {
        const query = lastUserMessage.content || lastUserMessage.text;
        const searchRes = await google.search(query, {
          page: 0,
          safe: false,
          parse_ads: false,
        });

        if (searchRes.results && searchRes.results.length > 0) {
          liveContext =
            "\n\n--- LIVE REAL-TIME SEARCH CONTEXT ---\n(Use this verified info to answer the user if relevant to their question. If there are news of cancellations, landslides, etc., strictly warn the user and adjust routes!):\n";
          searchRes.results.slice(0, 4).forEach((r, i) => {
            liveContext += `[Source ${i + 1}] ${r.title} - ${r.description}\n`;
          });
        }
      }
    } catch (searchErr) {
      console.error("Live search failed:", searchErr);
    }

    const systemPrompt = `You are Aventra, a premium AI travel assistant specialized in Indian travel.
    
You help users:
- Plan detailed trip itineraries across India
- Find the best local food, hotels, and experiences  
- Optimize budgets (always quote in ₹ INR)
- Give cultural tips, safety advice, and packing guidance
- Suggest alternatives when plans go wrong

CRITICAL RULES FOR LOCAL TRANSIT & DISTANCES IN INDIA:
1. NEVER invent or guess specific bus numbers, local train routes, or exact highway names for local commutes (e.g., Mumbai local trains, BEST buses) unless 100% certain.
2. NEVER hallucinate exact distances or drive times between local suburbs. 
3. If asked for directions between local suburbs (like Bhandup to Ghansoli), give a reliable high-level overview (e.g., "Take the Central Line to Thane, then Trans-Harbour to Ghansoli") and explicitly recommend checking local transit apps like M-Indicator, Chalo, or Google Maps for exact timings and routes.

Keep responses concise (under 150 words), specific, and actionable. Use Indian place names, landmark names, and cultural context naturally. When suggesting prices, use realistic 2024 Indian market rates.${liveContext}`;

    const completion = await callAI({
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.text || m.content })),
      ],
      temperature: 0.9,
      max_tokens: 400,
    });

    res.json({ reply: completion.choices[0].message.content });
  } catch (err) {
    console.error("AI chat error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/packing — Generate AI packing list for a destination
router.post("/packing", async (req, res) => {
  try {
    const { destination, startDate, endDate, style } = req.body;

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

    const completion = await callAI({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      response_format: { type: "json_object" },
    });

    const packingData = JSON.parse(completion.choices[0].message.content);
    res.json(packingData);
  } catch (err) {
    console.error("AI packing error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── Destination normalization ───────────────────────────────────────────────
/**
 * Known misspellings → canonical city names.
 * Keys are lowercase with no extra spaces.
 */
const CITY_CORRECTIONS = {
  // Hyderabad
  hyderbad: "Hyderabad", hydrebad: "Hyderabad", hydrabad: "Hyderabad",
  hydrabad: "Hyderabad", hyadrabad: "Hyderabad",
  // Bangalore
  banglore: "Bangalore", bangalor: "Bangalore", bangalorr: "Bangalore",
  bengaluru: "Bangalore", bengalore: "Bangalore", bangaluru: "Bangalore",
  // Mumbai
  mumabi: "Mumbai", mumbaii: "Mumbai", bombay: "Mumbai", mumbi: "Mumbai",
  // Delhi
  deli: "Delhi", dehli: "Delhi", delhy: "Delhi", dilhi: "Delhi",
  "new deli": "New Delhi", "new dehli": "New Delhi",
  // Chennai
  chinnai: "Chennai", madras: "Chennai", chennaii: "Chennai",
  // Kolkata
  kolkatta: "Kolkata", calcutta: "Kolkata", kolcata: "Kolkata",
  // Pune
  poona: "Pune", punee: "Pune",
  // Varanasi
  benaras: "Varanasi", benares: "Varanasi", banarasi: "Varanasi",
  // Ahmedabad
  amhedabad: "Ahmedabad", ahemadabad: "Ahmedabad", ahmadabad: "Ahmedabad",
  // Shimla / Simla
  simla: "Shimla",
  // Dehradun
  "dehra dun": "Dehradun", dehardun: "Dehradun",
  // Haridwar
  hardwar: "Haridwar", haridwaar: "Haridwar",
  // Ladakh → Leh (WeatherAPI resolves Leh better)
  ladakh: "Leh",
  // Goa variations
  "north goa": "Panaji", "south goa": "Goa",
  // Kerala cities
  trivandrum: "Thiruvananthapuram", cochin: "Kochi",
  calicut: "Kozhikode",
  // Mysore
  mysuru: "Mysore",
  // Hubli
  hubballi: "Hubli",
  // Visakhapatnam
  vizag: "Visakhapatnam",
  // Tiruchirappalli
  trichy: "Tiruchirappalli",
  // Mangalore
  manglore: "Mangalore", mangaluru: "Mangalore",
  // Gauhati
  gauhati: "Guwahati",
  // Bhubaneswar
  bhuvneshwar: "Bhubaneswar", bhubneswar: "Bhubaneswar",
  // Panaji
  panjim: "Panaji",
  // Belgaum
  belagavi: "Belgaum",
  // International common typos
  londun: "London", londen: "London",
  paries: "Paris", parris: "Paris",
  singapur: "Singapore", singapoor: "Singapore",
  dubaii: "Dubai", duabi: "Dubai",
  bangkock: "Bangkok", bangkoc: "Bangkok",
  tokio: "Tokyo", tokoyo: "Tokyo",
  bejing: "Beijing", bijing: "Beijing",
  newyork: "New York", "new yok": "New York",
  syedney: "Sydney", sydny: "Sydney",
};

/**
 * Normalize a raw destination string:
 * 1. Trim and collapse extra whitespace.
 * 2. Check the lookup map for known misspellings.
 * 3. Return the canonical name (or the cleaned original if not found).
 */
function normalizeDestination(raw) {
  if (!raw || typeof raw !== "string") return "";
  // Collapse multiple spaces, trim
  const cleaned = raw.trim().replace(/\s+/g, " ");
  const lower = cleaned.toLowerCase();
  if (CITY_CORRECTIONS[lower]) {
    const corrected = CITY_CORRECTIONS[lower];
    console.log(`[Risk] Destination normalized: "${cleaned}" → "${corrected}"`);
    return corrected;
  }
  return cleaned;
}

// Module-level caches for WeatherAPI to prevent duplicate/redundant fetches
const weatherCache = new Map(); // key: lowercase destination, value: { weatherData, weatherInfo, resolvedCity, timestamp }
const weatherPromises = new Map(); // key: lowercase destination, value: Promise<{ weatherData, weatherInfo, resolvedCity }>
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes cache expiration

/**
 * Try to fetch WeatherAPI forecast for `query`.
 * If the API returns "No matching location found" (400), automatically retry
 * using only the first token before the first comma (e.g. "Hyderabad, Telangana" → "Hyderabad").
 * Returns { weatherData, weatherInfo, resolvedCity } where resolvedCity is the
 * canonical name that actually worked (so callers can save it for future use).
 */
async function fetchWeather(query, apiKey) {
  const tryFetch = async (q) => {
    const encoded = encodeURIComponent(q);
    const res = await fetch(
      `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${encoded}&days=1&aqi=no&alerts=yes`
    );
    return res;
  };

  const parseOk = async (res, resolvedCity) => {
    const w = await res.json();
    const alertsList = w.alerts?.alert || [];
    const alertsSummary =
      alertsList.map((a) => `${a.event}: ${a.headline}`).join("; ") || "No active alerts";

    const weatherData = {
      temp: w.current.temp_c,
      condition: w.current.condition.text,
      icon: w.current.condition.icon,
      humidity: w.current.humidity,
      windSpeed: w.current.wind_kph,
      uv: w.current.uv,
      rainChance: w.forecast?.forecastday?.[0]?.day?.daily_chance_of_rain || 0,
      alerts: alertsList.map((a) => ({
        event: a.event,
        headline: a.headline,
        desc: a.desc || "",
        severity: a.severity || "Unknown",
      })),
    };

    const weatherInfo = `${w.current.condition.text}, ${w.current.temp_c}°C, humidity ${w.current.humidity}%, wind ${w.current.wind_kph} km/h, UV index ${w.current.uv}, rain probability ${weatherData.rainChance}%. Alerts: ${alertsSummary}`;
    return { weatherData, weatherInfo, resolvedCity };
  };

  const readError = async (res) => {
    try {
      const errJson = await res.json();
      return errJson?.error?.message || JSON.stringify(errJson);
    } catch {
      return await res.text().catch(() => "(unreadable body)");
    }
  };

  // ── First attempt: full (normalized) query ──────────────────────────────
  let res = await tryFetch(query);
  if (res.ok) return parseOk(res, query);

  const errBody = await readError(res);

  // ── Second attempt: city-only (strip state/country after first comma) ──
  const cityOnly = query.split(",")[0].trim();
  if (cityOnly && cityOnly !== query) {
    res = await tryFetch(cityOnly);
    if (res.ok) {
      return parseOk(res, cityOnly);
    }
  }

  return { weatherData: null, weatherInfo: "Weather data unavailable", resolvedCity: cityOnly || query };
}

// POST /api/ai/risk — Generate real risk analysis using WeatherAPI.com + AI
router.post("/risk", async (req, res) => {
  try {
    const { destination, refresh } = req.body;

    // Guard: reject immediately if destination is missing or empty
    if (!destination || typeof destination !== "string" || !destination.trim()) {
      console.warn("[Risk] Request received with missing/empty destination — aborting.");
      return res.status(400).json({ error: "destination is required and must be a non-empty string." });
    }

    // Step 1: normalize (fix typos, collapse spaces)
    const normalizedDest = normalizeDestination(destination);
    const cacheKey = normalizedDest.toLowerCase();

    let weatherData = null;
    let weatherInfo = "Weather data unavailable";
    let resolvedCity = normalizedDest;

    // Step 2: fetch live weather with caching and deduplication
    const apiKey = process.env.VITE_WEATHER_API_KEY;
    if (!apiKey) {
      console.warn("[Risk] VITE_WEATHER_API_KEY not defined in backend/.env — skipping weather fetch.");
    } else {
      try {
        const forceRefresh = !!refresh;
        const now = Date.now();
        const cached = weatherCache.get(cacheKey);

        if (!forceRefresh && cached && (now - cached.timestamp < CACHE_TTL_MS)) {
          console.log(`[Risk] Using cached weather data for ${normalizedDest}.`);
          weatherData = cached.weatherData;
          weatherInfo = cached.weatherInfo;
          resolvedCity = cached.resolvedCity;
        } else {
          // Look for or create an in-flight promise for this destination
          let promise = weatherPromises.get(cacheKey);
          if (!promise) {
            console.log(`[Risk] Fetching weather for ${normalizedDest}...`);
            promise = fetchWeather(normalizedDest, apiKey)
              .then((result) => {
                // Save to cache
                weatherCache.set(cacheKey, {
                  weatherData: result.weatherData,
                  weatherInfo: result.weatherInfo,
                  resolvedCity: result.resolvedCity,
                  timestamp: Date.now(),
                });
                console.log(`[Risk] Weather fetched successfully for ${normalizedDest}.`);
                return result;
              })
              .catch((err) => {
                // Propagate error, but clean up active promise so retries work
                throw err;
              })
              .finally(() => {
                // Clean up active promise from map
                weatherPromises.delete(cacheKey);
              });
            weatherPromises.set(cacheKey, promise);
          }

          const result = await promise;
          weatherData = result.weatherData;
          weatherInfo = result.weatherInfo;
          resolvedCity = result.resolvedCity;
        }
      } catch (e) {
        console.warn("[Risk] fetchWeather threw an exception:", e.message);
      }
    }

    const prompt = `Generate a travel risk assessment and safety guidelines for ${resolvedCity}.
Current weather and forecast conditions: ${weatherInfo}

Return ONLY valid JSON matching this exact structure:
{
  "safetyAdvisory": "A 1-2 sentence high-level dynamic AI safety summary for ${resolvedCity} based on current weather and conditions.",
  "risks": [
    {
      "key": "weather",
      "label": "Weather & Climate",
      "level": "low|med|high",
      "summary": "Specific weather risk description for ${resolvedCity} based on current conditions: ${weatherInfo}.",
      "tips": ["practical tip 1", "practical tip 2"]
    },
    {
      "key": "scams",
      "label": "Scams & Tourist Traps",
      "level": "low|med|high",
      "summary": "Specific, real tourist scams/traps currently common in ${resolvedCity}.",
      "tips": ["prevention tip 1", "prevention tip 2"]
    },
    {
      "key": "crowd",
      "label": "Crowds & Congestion",
      "level": "low|med|high",
      "summary": "Current crowd levels and traffic alerts for major sites in ${resolvedCity}.",
      "tips": ["tip 1", "tip 2"]
    },
    {
      "key": "transport",
      "label": "Transport & Navigation",
      "level": "low|med|high",
      "summary": "Transit safety, road conditions, or taxi scam alerts for ${resolvedCity}.",
      "tips": ["tip 1", "tip 2"]
    },
    {
      "key": "health",
      "label": "Health & Hygiene",
      "level": "low|med|high",
      "summary": "Water/food safety, seasonal disease warnings (malaria, dengue), or air quality warnings for ${resolvedCity}.",
      "tips": ["tip 1", "tip 2"]
    },
    {
      "key": "safety",
      "label": "Personal Safety",
      "level": "low|med|high",
      "summary": "General crime rates, safe/unsafe neighborhoods, or solo traveler safety tips for ${resolvedCity}.",
      "tips": ["tip 1", "tip 2"]
    }
  ]
}

Be specific to ${resolvedCity} and current weather. Remove all placeholders and generic advice.`;

    const completion = await callAI({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.6,
      response_format: { type: "json_object" },
    });

    const parsedData = parseAIJson(completion.choices[0].message.content);
    
    res.json({
      weather: weatherData,
      // resolvedCity lets the frontend update its stored destination to the canonical/corrected name
      resolvedCity,
      safetyAdvisory: parsedData.safetyAdvisory || `Safety assessment for ${resolvedCity}.`,
      risks: parsedData.risks || []
    });
  } catch (err) {
    console.error("AI risk error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
