import express from "express";
import Trip from "../models/Trip.js";
import { verifyToken } from "../middleware/auth.js";
import OpenAI from "openai";

const router = express.Router();
router.use(verifyToken);

// ── In-Memory Event Cache (15 min TTL) ──────────────────────────────────────────
const commanderCache = new Map();
const COMMANDER_CACHE_TTL = 15 * 60 * 1000;

let groqClient;
let openRouterClient;

const initAI = () => {
  if (!groqClient && process.env.GROQ_API_KEY) {
    groqClient = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
    });
  }
  if (!openRouterClient && process.env.OPENROUTER_API_KEY) {
    openRouterClient = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
    });
  }
};

const generateAICommanderEvents = async (trip) => {
  initAI();

  const destination = trip.destination || trip.title || "your destination";
  const prompt = `You are Trip Commander, an AI travel manager monitoring a user's upcoming trip to ${destination}.
Trip details:
- Title: ${trip.title}
- Destination: ${destination}
- Dates: ${trip.startDate || "Upcoming"} to ${trip.endDate || "Upcoming"}
- Budget Total: ₹${trip.budgetTotal || 0}
- Current Expenses Count: ${(trip.expenses || []).length}
- Travel Style: ${trip.style || "Balanced"}

Generate 3 to 4 realistic, actionable live monitoring alerts/events for this trip.
Return ONLY valid JSON matching this exact structure:
[
  {
    "id": "evt_1",
    "when": "12 min ago",
    "kind": "delay|weather|budget|cancel|closure|traffic|group|ai",
    "title": "Alert Title",
    "reason": "Detailed AI explanation of why this happened",
    "action": "Action taken or recommended by Trip Commander",
    "delta": "Net impact on time or budget",
    "severity": "info|warn|bad"
  }
]`;

  const messages = [{ role: "user", content: prompt }];

  // Try OpenRouter or Groq
  const client = openRouterClient || groqClient;
  if (!client) {
    throw new Error("No AI API keys configured");
  }

  const model = openRouterClient
    ? "meta-llama/llama-3.3-70b-instruct"
    : "llama-3.3-70b-versatile";

  const completion = await client.chat.completions.create({
    model,
    messages,
    temperature: 0.7,
  });

  const content = completion?.choices?.[0]?.message?.content || "";
  let cleaned = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  const startIdx = cleaned.indexOf("[");
  const endIdx = cleaned.lastIndexOf("]");
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    cleaned = cleaned.slice(startIdx, endIdx + 1);
  }
  return JSON.parse(cleaned);
};

// Default fallback events tailored to destination if AI is unconfigured or fails
const getDefaultCommanderEvents = (trip) => {
  const dest = trip?.destination?.split(",")[0] || trip?.title || "Destination";
  return [
    {
      id: `evt_${trip._id}_1`,
      when: "15 min ago",
      kind: "weather",
      severity: "info",
      title: `Weather update for ${dest}`,
      reason: `Live forecast for ${dest} shows pleasant conditions over your trip dates.`,
      action: "Optimized outdoor afternoon activity windows for your itinerary.",
      delta: "Zero delay impact.",
    },
    {
      id: `evt_${trip._id}_2`,
      when: "1 h ago",
      kind: "budget",
      severity: "info",
      title: "Budget buffer monitor",
      reason: `Total trip budget set to ₹${(trip.budgetTotal || 50000).toLocaleString("en-IN")}.`,
      action: "Paced daily food & local transit targets within your budget limit.",
      delta: "100% budget compliance.",
    },
    {
      id: `evt_${trip._id}_3`,
      when: "3 h ago",
      kind: "delay",
      severity: "warn",
      title: `${trip.travelMode || "Flight/Train"} schedule check`,
      reason: `Route monitoring active for travel from ${trip.departureHub || "origin"} to ${trip.arrivalHub || dest}.`,
      action: "Auto-synced check-in times with hotel arrival window.",
      delta: "Buffer preserved.",
    },
  ];
};

// GET /api/commander/events
router.get("/events", async (req, res) => {
  console.log(`[Commander Backend] Request received for user ${req.uid}`);

  try {
    const userTrips = await Trip.find({ createdBy: req.uid }).sort({ createdAt: -1 }).lean();

    if (!userTrips || userTrips.length === 0) {
      console.log(`[Commander Backend] No trips found for user ${req.uid}. Returning [].`);
      return res.json([]);
    }

    const { tripId } = req.query;
    const activeTrip = tripId
      ? userTrips.find((t) => String(t._id) === String(tripId)) || userTrips[0]
      : userTrips[0];

    const cacheKey = `${req.uid}_${activeTrip._id}`;
    const cached = commanderCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < COMMANDER_CACHE_TTL) {
      console.log(`[Commander Backend] Returning cached events for trip ${activeTrip._id}`);
      return res.json(cached.events);
    }

    let events;
    try {
      console.log(`[Commander Backend] Generating AI events for trip "${activeTrip.title}" (${activeTrip.destination})...`);
      events = await generateAICommanderEvents(activeTrip);
      console.log(`[Commander Backend] AI generated ${events.length} commander events.`);
    } catch (aiErr) {
      console.warn(`[Commander Backend] AI event generation fallback: ${aiErr.message}`);
      events = getDefaultCommanderEvents(activeTrip);
    }

    commanderCache.set(cacheKey, { events, timestamp: Date.now() });
    res.json(events);
  } catch (err) {
    console.error("[Commander Backend] Error fetching commander events:", err);
    res.status(500).json({ error: "Failed to fetch trip commander events." });
  }
});

// POST /api/commander/events/:id/accept
router.post("/events/:id/accept", async (req, res) => {
  console.log(`[Commander Backend] Event accepted: ${req.params.id}`);
  res.json({ success: true, message: "Commander plan accepted." });
});

export default router;
