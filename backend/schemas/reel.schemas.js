import { z } from "zod";
import {
  REEL_TEMPLATES,
  REEL_ASPECT_RATIOS,
  REEL_AUDIO_SOURCES,
} from "../models/Reel.js";

export const createReelSchema = z.object({
  tripId: z.string().trim().min(1, "tripId is required"),
  memoryIds: z
    .array(z.string().trim().min(1))
    .min(2, "Reel requires at least 2 memories")
    .max(20, "Maximum 20 memories allowed per reel"),
  template: z.enum(REEL_TEMPLATES).default("cinematic"),
  aspectRatio: z.enum(REEL_ASPECT_RATIOS).default("9:16"),
  duration: z.coerce
    .number()
    .refine((v) => [15, 30, 60].includes(v), {
      message: "Duration must be 15, 30, or 60 seconds",
    })
    .default(15),
  audioSource: z.enum(REEL_AUDIO_SOURCES).default("music"),
  trackId: z.string().trim().default("acoustic_journey"),
  title: z.string().trim().max(100).default(""),
  subtitle: z.string().trim().max(120).default(""),
  showCaptions: z.boolean().default(true),
});

export const listReelsQuerySchema = z.object({
  tripId: z.string().trim().optional(),
  limit: z.coerce.number().min(1).max(50).default(20),
  cursor: z.string().trim().optional(),
});

export const updateReelSchema = z.object({
  title: z.string().trim().max(100).optional(),
  subtitle: z.string().trim().max(120).optional(),
  shareAccess: z.enum(["private", "shared"]).optional(),
});
