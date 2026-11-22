import { z } from "zod";

export const getCommanderEventsSchema = z.object({
  tripId: z.string().trim().optional(),
  format: z.enum(["full", "array"]).optional(),
});

export const acceptCommanderPlanSchema = z.object({
  id: z.string().trim().min(1, "Event ID is required"),
});

export const updateTransitSchema = z.object({
  tripId: z.string().trim().min(1, "Trip ID is required"),
  transitRef: z.string().trim().min(1, "Transit reference is required"),
  travelMode: z.string().trim().optional(),
});

export const commanderCommandSchema = z.object({
  tripId: z.string().trim().min(1, "Trip ID is required"),
  instruction: z.string().trim().min(2, "Instruction is required"),
});
