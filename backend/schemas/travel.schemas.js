import { z } from "zod";

/**
 * Flexible date string normalizer accepting YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY, or ISO timestamps.
 * Normalizes to canonical YYYY-MM-DD.
 */
const flexibleDateSchema = z
  .string()
  .trim()
  .transform((val) => {
    if (!val) return undefined;
    // Match DD-MM-YYYY or DD/MM/YYYY
    const dmy = val.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (dmy) {
      const [, d, m, y] = dmy;
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    // Match YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      return val;
    }
    // Parse arbitrary ISO or locale date
    const parsed = new Date(val);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split("T")[0];
    }
    return val;
  })
  .refine((val) => !val || /^\d{4}-\d{2}-\d{2}$/.test(val), {
    message: "Date must be a valid date in YYYY-MM-DD or DD-MM-YYYY format",
  })
  .optional();

export const flightSearchSchema = z.object({
  origin: z.string().trim().min(2, "Origin airport or city required").max(60),
  destination: z.string().trim().min(2, "Destination airport or city required").max(60),
  departureDate: flexibleDateSchema,
  returnDate: flexibleDateSchema,
  passengers: z.coerce.number().min(1).max(9).default(1),
  cabin: z.enum(["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST"]).default("ECONOMY"),
});

export const flightStatusSchema = z.object({
  flightNumber: z.string().trim().min(2, "Flight number required").max(20),
  date: flexibleDateSchema,
});

export const hotelSearchSchema = z.object({
  destination: z.string().trim().min(2, "Destination city required").max(60),
  checkIn: flexibleDateSchema,
  checkOut: flexibleDateSchema,
  guests: z.coerce.number().min(1).max(10).default(2),
  rooms: z.coerce.number().min(1).max(5).default(1),
  allowSyntheticFallback: z.preprocess((val) => val === true || val === "true", z.boolean()).default(true),
});

export const weatherQuerySchema = z.object({
  destination: z.string().trim().min(2, "Destination is required").max(80),
  days: z.coerce.number().min(1).max(14).default(5),
});

export const createPriceWatchSchema = z.object({
  tripId: z.string().optional(),
  type: z.enum(["flight", "hotel"]),
  origin: z.string().trim().max(60).optional(),
  destination: z.string().trim().min(2, "Destination is required").max(60),
  departureDate: z.string().optional(),
  returnDate: z.string().optional(),
  passengers: z.coerce.number().min(1).max(9).optional(),
  cabin: z.string().optional(),
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  guests: z.coerce.number().min(1).max(10).optional(),
  rooms: z.coerce.number().min(1).max(5).optional(),
  hotelName: z.string().trim().max(100).optional(),
  targetPrice: z.coerce.number().min(100, "Target price must be at least ₹100"),
  alertCondition: z.enum(["below_target", "percentage_drop", "any_drop"]).default("below_target"),
  alertThresholdPercent: z.coerce.number().min(1).max(80).default(10),
});

export const updatePriceWatchSchema = z.object({
  targetPrice: z.coerce.number().min(100).optional(),
  status: z.enum(["active", "paused", "deleted"]).optional(),
  alertCondition: z.enum(["below_target", "percentage_drop", "any_drop"]).optional(),
});
