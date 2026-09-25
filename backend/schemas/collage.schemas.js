import { z } from "zod";
import {
  COLLAGE_LAYOUTS,
  COLLAGE_ASPECT_RATIOS,
  COLLAGE_THEMES,
  COLLAGE_FORMATS,
} from "../models/Collage.js";

export const createCollageSchema = z.object({
  tripId: z.string().trim().min(1, "tripId is required"),
  memoryIds: z
    .array(z.string().trim().min(1))
    .min(2, "Collage requires at least 2 memories")
    .max(20, "Maximum 20 memories allowed per collage"),
  layout: z.enum(COLLAGE_LAYOUTS).default("grid"),
  aspectRatio: z.enum(COLLAGE_ASPECT_RATIOS).default("1:1"),
  theme: z.enum(COLLAGE_THEMES).default("dark"),
  title: z.string().trim().max(100).default(""),
  subtitle: z.string().trim().max(120).default(""),
  format: z.enum(COLLAGE_FORMATS).default("webp"),
  quality: z.enum(["standard", "high"]).default("standard"),
});

export const listCollagesQuerySchema = z.object({
  tripId: z.string().trim().optional(),
  limit: z.coerce.number().min(1).max(50).default(20),
  cursor: z.string().trim().optional(),
});

export const updateCollageSchema = z.object({
  title: z.string().trim().max(100).optional(),
  subtitle: z.string().trim().max(120).optional(),
  shareAccess: z.enum(["private", "shared"]).optional(),
});
