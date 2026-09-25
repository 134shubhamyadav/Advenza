import { z } from "zod";

export const getCommanderEventsSchema = z.object({
  tripId: z.string().trim().optional(),
});

export const acceptCommanderPlanSchema = z.object({
  id: z.string().trim().min(1, "Event ID is required"),
});
