import { commanderService } from "../services/commander/commander.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const getEvents = asyncHandler(async (req, res) => {
  const { tripId } = req.query;
  const events = await commanderService.getEvents(req.uid, tripId);
  res.json(events);
});

export const acceptEvent = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await commanderService.acceptEvent(req.uid, id, req.body);
  res.json(result);
});
