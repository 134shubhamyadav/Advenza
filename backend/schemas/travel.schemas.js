import { z } from "zod";

export const flightSearchSchema = z.object({
  origin: z.string().trim().min(2, "Origin airport or city required").max(60),
  destination: z.string().trim().min(2, "Destination airport or city required").max(60),
  departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Departure date must be YYYY-MM-DD").optional(),
  returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Return date must be YYYY-MM-DD").optional(),
  passengers: z.coerce.number().min(1).max(9).default(1),
  cabin: z.enum(["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST"]).default("ECONOMY"),
});

export const flightStatusSchema = z.object({
  flightNumber: z.string().trim().min(2, "Flight number required").max(20),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD").optional(),
});

export const hotelSearchSchema = z.object({
  destination: z.string().trim().min(2, "Destination city required").max(60),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Check-in date must be YYYY-MM-DD").optional(),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Check-out date must be YYYY-MM-DD").optional(),
  guests: z.coerce.number().min(1).max(10).default(2),
  rooms: z.coerce.number().min(1).max(5).default(1),
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
