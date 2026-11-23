import { aiService } from "../services/ai/ai.service.js";
import { destinationDisambiguationService } from "../services/places/destination-disambiguation.service.js";
import { orchestratorService } from "../services/ai/orchestrator/orchestrator.service.js";
import { budgetIntelligenceAgent } from "../services/ai/orchestrator/budget-intelligence.agent.js";
import { accommodationAgent } from "../services/ai/orchestrator/accommodation.agent.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const generate = asyncHandler(async (req, res) => {
  const savedTrip = await aiService.generateItinerary(req.body, req.uid);
  res.status(201).json(savedTrip);
});

export const regenerate = asyncHandler(async (req, res) => {
  const { tripId } = req.params;
  const savedTrip = await aiService.regenerateItinerary(tripId, req.body, req.uid);
  res.json(savedTrip);
});

export const planB = asyncHandler(async (req, res) => {
  const { tripId, messages, question, currentDay } = req.body;
  const result = await aiService.generatePlanB({ tripId, messages, question, currentDay });
  res.json(result);
});

export const chat = asyncHandler(async (req, res) => {
  const { messages, tripId, destination, hotelLocation, context, conversationId, conversationState } = req.body;
  const result = await aiService.chatWithTravelAI({
    messages,
    tripId,
    destination,
    hotelLocation,
    context,
    conversationId,
    conversationState,
    userId: req.uid,
  });
  res.json(result);
});

export const packing = asyncHandler(async (req, res) => {
  const { destination, startDate, endDate, style } = req.body;
  const result = await aiService.generatePackingList({ destination, startDate, endDate, style });
  res.json(result);
});

export const risk = asyncHandler(async (req, res) => {
  const { destination, tripId, refresh } = req.body;
  const result = await aiService.evaluateRisk({ destination, tripId, refresh, userId: req.uid });
  res.json(result);
});

export const estimateBudget = asyncHandler(async (req, res) => {
  const { destination, startDate, endDate, travelers } = req.query;
  const result = await aiService.estimateBudget({ destination, startDate, endDate, travelers });
  res.json(result);
});

export const getDestinationOverview = asyncHandler(async (req, res) => {
  const destination = req.query.destination || req.body?.destination;
  const rawInterests = req.query.interests || req.body?.interests || [];
  const interests = typeof rawInterests === "string" ? rawInterests.split(",") : rawInterests;

  const result = await aiService.getDestinationOverview({ destination, interests });
  res.json(result);
});

export const disambiguateDestination = asyncHandler(async (req, res) => {
  const query = req.query.query || req.body?.query || req.query.destination || req.body?.destination;
  const result = await destinationDisambiguationService.disambiguate(query);
  res.json(result);
});

export const calculateBudgetFeasibility = asyncHandler(async (req, res) => {
  const {
    destination,
    origin,
    userBudget,
    transportCost,
    lastMileCost,
    accommodationPreference,
    durationDays,
    travelers,
  } = req.body;

  const accommodationResult = await accommodationAgent.evaluate({
    destination,
    preference: accommodationPreference,
    nights: Math.max(1, (durationDays || 3) - 1),
    travelers: travelers || 1,
  });

  const feasibility = budgetIntelligenceAgent.evaluate({
    userBudget,
    transportCost,
    lastMileCost,
    accommodationResult,
    durationDays,
    travelers,
  });

  res.json(feasibility);
});

export const orchestratedResearch = asyncHandler(async (req, res) => {
  const result = await orchestratorService.conductComprehensiveResearch(req.body);
  res.json(result);
});


