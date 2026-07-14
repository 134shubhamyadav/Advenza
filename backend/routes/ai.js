import express from 'express';
import OpenAI from 'openai';
import google from 'googlethis';
import Trip from '../models/Trip.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();
router.use(verifyToken);

let groqClient;
let openRouterClient;

const initClients = () => {
  if (!groqClient) {
    groqClient = new OpenAI({ 
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1"
    });
  }
  if (!openRouterClient) {
    openRouterClient = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1"
    });
  }
};

const callAI = async (options) => {
  initClients();
  
  try {
    // Try Groq first with llama-3.1-8b-instant
    return await groqClient.chat.completions.create({
      ...options,
      model: 'llama-3.1-8b-instant'
    });
  } catch (err) {
    console.warn("Groq failed, falling back to OpenRouter:", err.message);
    try {
      // Fallback to OpenRouter with Gemma 2 free
      return await openRouterClient.chat.completions.create({
        ...options,
        model: 'google/gemma-2-9b-it:free'
      });
    } catch (fallbackErr) {
      console.error("OpenRouter fallback also failed:", fallbackErr.message);
      throw fallbackErr;
    }
  }
};

// POST /api/ai/generate — Generate a trip itinerary using OpenAI
router.post('/generate', async (req, res) => {
  try {
    const { destination, startDate, endDate, budget, style, interests, accommodation, transport, special, createdBy } = req.body;

    const prompt = `You are Aventra, an expert Indian travel planner AI.

Generate a detailed, day-by-day trip itinerary in valid JSON format for:
- Destination: ${destination}
- Dates: ${startDate} to ${endDate}
- Total Budget: ₹${budget} INR
- Travel Style: ${style}
- Interests: ${interests?.join(', ') || 'General sightseeing'}
- Accommodation: ${accommodation || 'Comfort hotel'}
- Transport: ${transport?.join(', ') || 'Mixed'}
- Special requests: ${special || 'None'}

Return ONLY a valid JSON object with this exact structure (no markdown, no extra text):
{
  "title": "Creative trip title",
  "destination": "${destination}",
  "summary": "2-3 sentence trip summary",
  "budgetEstimate": "Budget breakdown string",
  "days": [
    {
      "dayNumber": 1,
      "date": "YYYY-MM-DD",
      "title": "Day theme title",
      "activities": [
        {
          "time": "Morning",
          "description": "Activity description with specific place names, estimated cost, and tips"
        }
      ]
    }
  ]
}

Make it authentic, specific to ${destination} with real landmarks, restaurants, and cultural tips. Include 3 activities per day (Morning, Afternoon, Evening). Cover all days from ${startDate} to ${endDate}.`;

    const completion = await callAI({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      response_format: { type: 'json_object' },
    });

    const tripData = JSON.parse(completion.choices[0].message.content);

    // Add metadata — use the authenticated UID from the token
    tripData.createdBy = req.uid || 'guest';
    tripData.createdAt = new Date().toISOString();

    // Save to MongoDB
    const newTrip = new Trip(tripData);
    const savedTrip = await newTrip.save();

    res.status(201).json(savedTrip);
  } catch (err) {
    console.error('AI generate error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/chat — Chat with AI about travel
router.post('/chat', async (req, res) => {
  try {
    const { messages } = req.body; // Array of { role, content }

    // RAG: Perform a live search based on the user's latest query
    let liveContext = "";
    try {
      const lastUserMessage = messages.filter(m => m.role === 'user').pop();
      // Only search if the message has substance
      if (lastUserMessage && (lastUserMessage.content || lastUserMessage.text).length > 10) {
        const query = lastUserMessage.content || lastUserMessage.text;
        const searchRes = await google.search(query, {
          page: 0, 
          safe: false, 
          parse_ads: false
        });
        
        if (searchRes.results && searchRes.results.length > 0) {
          liveContext = "\n\n--- LIVE REAL-TIME SEARCH CONTEXT ---\n(Use this verified info to answer the user if relevant to their question. If there are news of cancellations, landslides, etc., strictly warn the user and adjust routes!):\n";
          searchRes.results.slice(0, 4).forEach((r, i) => {
            liveContext += `[Source ${i+1}] ${r.title} - ${r.description}\n`;
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
        { role: 'system', content: systemPrompt },
        ...messages.map(m => ({ role: m.role, content: m.text || m.content }))
      ],
      temperature: 0.9,
      max_tokens: 400,
    });

    res.json({ reply: completion.choices[0].message.content });
  } catch (err) {
    console.error('AI chat error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/packing — Generate AI packing list for a destination
router.post('/packing', async (req, res) => {
  try {
    const { destination, startDate, endDate, style } = req.body;

    const prompt = `Generate a smart packing list for a trip to ${destination} from ${startDate} to ${endDate} (${style || 'Balanced'} style).

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
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const packingData = JSON.parse(completion.choices[0].message.content);
    res.json(packingData);
  } catch (err) {
    console.error('AI packing error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/risk — Generate real risk analysis using OpenWeatherMap + AI
router.post('/risk', async (req, res) => {
  try {
    const { destination } = req.body;

    // Fetch weather from Google Weather API (or OpenWeatherMap free tier)
    let weatherInfo = 'Weather data unavailable';
    try {
      const weatherRes = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(destination)}&appid=${process.env.GOOGLE_MAPS_API_KEY}&units=metric`
      );
      if (weatherRes.ok) {
        const w = await weatherRes.json();
        weatherInfo = `${w.weather[0].description}, ${w.main.temp}°C, humidity ${w.main.humidity}%`;
      }
    } catch (e) {
      // Use AI to estimate weather based on destination and date
      weatherInfo = 'Estimated based on seasonal patterns';
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
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.6,
      response_format: { type: 'json_object' },
    });

    const riskData = JSON.parse(completion.choices[0].message.content);
    res.json(riskData);
  } catch (err) {
    console.error('AI risk error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
