import express from "express";
import OpenAI from "openai";
import google from "googlethis";
import Trip from "../models/Trip.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();
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
      startDate,
      endDate,
      budget,
      style,
      interests,
      accommodation,
      transport,
      travelers,
      special,
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
      Array.isArray(transport) && transport.length > 0 ? transport.join(", ") : "any available";
    const travelersNum = Number(travelers) || 1;
    const perPersonBudget =
      budgetNum > 0 ? Math.round(budgetNum / travelersNum) : null;

    const prompt = `You are Aventra, a strict Indian travel planner AI. You MUST follow the user's preferences exactly.

USER'S TRIP DETAILS:
- Destination: ${destination}
- Dates: ${startDate} to ${endDate} (${numDays} day${numDays !== 1 ? "s" : ""})
- Number of travelers: ${travelersNum}
- Total Budget: ₹${budgetNum} INR${perDayBudget ? ` (≈₹${perDayBudget}/day, ≈₹${perPersonBudget}/person)` : " (no budget limit specified)"}
- Travel Pace: ${style || "Balanced"}
- Interests: ${interests?.join(", ") || "General sightseeing"}
- Accommodation: ${accommodation || "Standard hotel"}
- Transport modes selected: ${transportList}
- Special requests: ${special || "None"}

STRICT RULES — NEVER VIOLATE THESE:
1. TRANSPORT: Only use the transport modes the user selected (${transportList}). If the user did NOT select Flights, do NOT mention airports, flights, or air travel anywhere. If the user selected Train, use train stations and rail routes exclusively for intercity travel.
2. BUDGET: The TOTAL budget is ₹${budgetNum}. Every activity, hotel, meal, and transport mentioned must have a realistic cost in ₹. The SUM of all estimated costs across the entire trip MUST NOT exceed ₹${budgetNum}. If budget is tight, suggest budget-friendly options explicitly.
3. ACCOMMODATION: Recommend only ${accommodation || "standard"} type accommodation. Do not contradict this choice.
4. PACE: Match "${style || "Balanced"}" pace — ${style === "Slow" ? "max 1-2 activities per day, long meals, relaxed mornings" : style === "Packed" ? "fill every slot, maximize sightseeing" : "2-3 anchor activities per day with free exploration time"}.
5. INTERESTS: Focus on: ${interests?.join(", ") || "general sightseeing"}. Do not pad with irrelevant activities.
6. Generate exactly ${numDays} days.

Return ONLY a valid JSON object (no markdown, no extra text):
{
  "title": "Creative trip title for ${destination}",
  "destination": "${destination}",
  "summary": "2-3 sentence trip summary mentioning transport mode, pace, and budget tier",
  "budgetEstimate": "Total: ₹${budgetNum} — Accommodation: ₹X (${numDays} nights), Food: ₹X, Transport: ₹X, Activities: ₹X, Misc: ₹X",
  "days": [
    {
      "dayNumber": 1,
      "date": "${startDate}",
      "title": "Day theme",
      "activities": [
        { "time": "Morning", "description": "Specific activity at real place, estimated cost ₹X, practical tip" },
        { "time": "Afternoon", "description": "Specific activity at real place, estimated cost ₹X, practical tip" },
        { "time": "Evening", "description": "Specific activity at real place, estimated cost ₹X, practical tip" }
      ]
    }
  ]
}`;

    const completion = await callAI({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      response_format: { type: "json_object" },
    });

    const tripData = JSON.parse(completion.choices[0].message.content);

    // Persist ALL user inputs so they can be reused (Plan B, budget display, etc.)
    tripData.createdBy = req.uid || "guest";
    tripData.createdAt = new Date().toISOString();
    tripData.budgetTotal = budgetNum;      // user's original budget
    tripData.transport = transport || [];  // user's chosen transport modes
    tripData.accommodation = accommodation || "";
    tripData.travelers = travelersNum;
    tripData.style = style || "Balanced";
    tripData.startDate = startDate;
    tripData.endDate = endDate;
    tripData.interests = interests || [];

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
    const { tripId, messages, question } = req.body;
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

    // Build a compact itinerary summary for the AI context
    const daySummaries = (trip.days || []).map((d) => {
      const acts = (d.activities || []).map((a) => `${a.time}: ${a.description}`).join(" | ");
      return `Day ${d.dayNumber} (${d.date || ""}) — ${d.title}: ${acts}`;
    }).join("\n");

    const systemPrompt = `You are Aventra, a warm, knowledgeable, and practical AI travel assistant. You help travellers recover gracefully from unexpected disruptions — like a trusted local friend who knows the destination inside out.

TRIP CONTEXT:
- Destination: ${trip.destination}
- Dates: ${trip.startDate} to ${trip.endDate}
- Total Budget: ₹${trip.budgetTotal > 0 ? trip.budgetTotal : "unspecified"}
- Transport Mode(s): ${(trip.transport || []).join(", ") || "any"}
- Accommodation: ${trip.accommodation || "unspecified"}
- Travel Pace: ${trip.style || "Balanced"}
- Interests: ${(trip.interests || []).join(", ") || "general sightseeing"}

CURRENT ITINERARY:
${daySummaries || "No days planned yet"}

──────────────────────────────────────────────────────────
STRICT RESCHEDULING & PRESERVATION RULES:
──────────────────────────────────────────────────────────
1. NO DELETING ATTRACTIONS: If the user states they missed, skipped, or arrived late to an attraction/activity, you MUST NOT discard or delete it. The attraction must NOT disappear from the itinerary.
2. AUTOMATIC RESCHEDULING: Check the remaining itinerary (succeeding time slots today or upcoming days) and find the best suitable time slot to fit the missed attraction back into the plan.
3. MINIMAL IMPACT / SWAPPING: Make the smallest necessary changes to the itinerary to accommodate the reschedule. If needed, you can swap the missed attraction with a less critical activity (like leisure time, shopping, or a secondary sightseeing spot) or shift subsequent activities down by one slot or to a later day.
4. EXPLAIN THE SHIFT: In the conversational reply, you must clearly explain:
   - Why the attraction was moved.
   - Where/when it has been rescheduled (e.g. Day 1 Evening, or Day 2 Morning).
   - Which activity (if any) was swapped or shifted to make room for it.
   - Any impact on travel time or budget.

────────────────────────────────────────
HOW TO WRITE YOUR REPLY (very important):
────────────────────────────────────────
Write the "reply" field in the style of a real, helpful travel companion texting their friend. Follow this exact 4-part flow:

PART 1 — ACKNOWLEDGE (1-2 sentences)
Show you understand what happened and briefly say whether it's a big deal or easily recoverable. Sound human and reassuring, not robotic.
Example: "Oh no — missing Charminar this morning is frustrating, but honestly don't worry, you can still make it work."

PART 2 — EXPLAIN THE IMPACT & RESCHEDULING (2-3 sentences)
Clearly explain where you are rescheduling the missed attraction to make sure it is not lost. Explain what activity was shifted or swapped to make room.
Example: "I've moved Charminar to 5:30 PM this evening since the sunset lighting there is gorgeous anyway. To make room for this, we'll swap your relaxed tea-tasting activity to Day 2 Afternoon."

PART 3 — RECOVERY PLAN & LOGISTICS (natural language, NO tables)
Walk the user through the logistics of the recovery plan. Explain travel times, cost, or local conditions.
Example: "Heading to Charminar at 5:30 PM is actually great because the midday heat will have passed. It's about a 20-minute auto ride from your current location. Once you're done, Laad Bazaar is right next door for dinner and a walk."
NEVER use markdown tables. Use short paragraphs or plain bullet points only if you need to list multiple options.

PART 4 — PROPOSED CHANGES SUMMARY
End with a clear, scannable summary block. Use exactly this format with emojis:

**Proposed Changes**
✅ [Short action — e.g. "Move Charminar visit to 5:30 PM today (Day X)"]
✅ [Short action — e.g. "Shift Salar Jung Museum to Day X morning at 10:00 AM"]
✅ [If nothing else changes: "No changes to remaining days"]
💰 Additional cost: ₹[amount or "₹0 — no extra cost"]
⏱️ Extra travel time: [e.g. "~15 minutes" or "none"]

KEY RULES:
- NO markdown tables anywhere in the reply
- Sound like a real person, not a formatted report
- Use real place names, realistic local timings, and local context for ${trip.destination}
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
        { "time": "Morning",   "description": "Specific activity with practical tip and estimated cost ₹X" },
        { "time": "Afternoon", "description": "Specific activity with practical tip and estimated cost ₹X" },
        { "time": "Evening",   "description": "Specific activity with practical tip and estimated cost ₹X" }
      ]
    }
  ]
}

CRITICAL: proposedDays must contain ONLY the day(s) that actually need changes. Do NOT include unaffected days. If no changes are needed to the itinerary, return proposedDays as an empty array [].`;

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

    const resultData = JSON.parse(completion.choices[0].message.content);
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

// POST /api/ai/risk — Generate real risk analysis using OpenWeatherMap + AI
router.post("/risk", async (req, res) => {
  try {
    const { destination } = req.body;

    // Fetch weather from Google Weather API (or OpenWeatherMap free tier)
    let weatherInfo = "Weather data unavailable";
    try {
      const weatherRes = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(destination)}&appid=${process.env.GOOGLE_MAPS_API_KEY}&units=metric`,
      );
      if (weatherRes.ok) {
        const w = await weatherRes.json();
        weatherInfo = `${w.weather[0].description}, ${w.main.temp}°C, humidity ${w.main.humidity}%`;
      }
    } catch (e) {
      // Use AI to estimate weather based on destination and date
      weatherInfo = "Estimated based on seasonal patterns";
    }

    const prompt = `Generate a travel risk assessment for ${destination}.
Current conditions: ${weatherInfo}

Return ONLY valid JSON:
{
  "risks": [
    {
      "key": "weather",
      "label": "Weather",
      "level": "low|med|high",
      "summary": "Specific weather risk description for ${destination}",
      "tips": ["practical tip 1", "practical tip 2"]
    }
  ]
}

Include these risk categories: weather, scams, crowd, transport, health, safety. Be specific to ${destination}.`;

    const completion = await callAI({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.6,
      response_format: { type: "json_object" },
    });

    const riskData = JSON.parse(completion.choices[0].message.content);
    res.json(riskData);
  } catch (err) {
    console.error("AI risk error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
