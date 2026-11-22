import { commanderService } from "../services/commander/commander.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const getEvents = asyncHandler(async (req, res) => {
  const { tripId, format } = req.query;
  const result = await commanderService.getEvents(req.uid, tripId, req.userEmail);
  if (format === "array") {
    return res.json(result.events || []);
  }
  res.json(result);
});

export const acceptEvent = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await commanderService.acceptEvent(req.uid, id, req.body);
  res.json(result);
});

export const revertEvent = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await commanderService.revertEvent(req.uid, id, req.body);
  res.json(result);
});

export const updateTransit = asyncHandler(async (req, res) => {
  const result = await commanderService.updateTransitRef(req.uid, req.body);
  res.json(result);
});

export const executeCommand = asyncHandler(async (req, res) => {
  const result = await commanderService.executeCommanderInstruction(req.uid, req.body);
  res.json(result);
});
