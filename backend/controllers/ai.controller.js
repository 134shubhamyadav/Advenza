import { aiService } from "../services/ai/ai.service.js";
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
  const { messages, tripId, destination, hotelLocation, context } = req.body;
  const result = await aiService.chatWithTravelAI({
    messages,
    tripId,
    destination,
    hotelLocation,
    context,
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
