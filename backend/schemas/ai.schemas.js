import { z } from "zod";

// ── INPUT SCHEMAS ─────────────────────────────────────────────────────────────

export const JourneyLegInputSchema = z
  .object({
    transportType: z.string().trim().max(100).optional(),
    departureLocation: z.string().trim().max(150).optional(),
    arrivalLocation: z.string().trim().max(150).optional(),
    departureDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
    departureTime: z.string().trim().max(50).optional(),
    arrivalDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
    arrivalTime: z.string().trim().max(50).optional(),
    durationMinutes: z.coerce.number().nullable().optional(),
    durationSource: z.string().trim().max(100).optional(),
    transitRef: z.string().trim().max(100).optional(),
    status: z.string().trim().max(50).optional(),
    booked: z.boolean().optional(),
    ticketRef: z.string().trim().max(100).optional(),
    // Legacy support fields:
    date: z.string().trim().optional(),
    time: z.string().trim().optional(),
  })
  .passthrough();

export const generateTripInputSchema = z
  .object({
    destination: z.string().trim().min(1, "Destination is required").max(150, "Destination too long"),
    startDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be in YYYY-MM-DD format"),
    endDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "End date must be in YYYY-MM-DD format"),
    budget: z.coerce.number().min(0, "Budget cannot be negative").optional(),
    origin: z.string().trim().max(150).optional(),
    style: z.string().trim().max(100).optional(),
    interests: z.union([z.array(z.string().trim()), z.string().trim()]).optional(),
    accommodation: z.string().trim().max(150).optional(),
    hotelLocation: z.string().trim().max(150).optional(),
    transport: z.union([z.array(z.string().trim()), z.string().trim()]).optional(),
    travelers: z.coerce.number().min(1).max(50).optional(),
    special: z.string().trim().max(500).optional(),
    travelMode: z.string().trim().max(100).optional(),
    departureHub: z.string().trim().max(150).optional(),
    arrivalHub: z.string().trim().max(150).optional(),
    transitRef: z.string().trim().max(100).optional(),
    departureTime: z.string().trim().max(50).optional(),
    arrivalTime: z.string().trim().max(50).optional(),
    outboundJourney: JourneyLegInputSchema.optional(),
    returnJourney: JourneyLegInputSchema.optional(),
    tripTiming: z.any().optional(),
    hotelName: z.string().trim().max(150).optional(),
    checkInTime: z.string().trim().max(50).optional(),
    checkOutTime: z.string().trim().max(50).optional(),
  })
  .passthrough();

export const regenerateTripInputSchema = z
  .object({
    destination: z.string().trim().max(150).optional(),
    origin: z.string().trim().max(150).optional(),
    startDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    budget: z.coerce.number().min(0).optional(),
    style: z.string().trim().max(100).optional(),
    interests: z.union([z.array(z.string().trim()), z.string().trim()]).optional(),
    travelers: z.coerce.number().min(1).max(50).optional(),
    travelMode: z.string().trim().max(100).optional(),
    departureHub: z.string().trim().max(150).optional(),
    arrivalHub: z.string().trim().max(150).optional(),
    transitRef: z.string().trim().max(100).optional(),
    departureTime: z.string().trim().max(50).optional(),
    arrivalTime: z.string().trim().max(50).optional(),
    outboundJourney: JourneyLegInputSchema.optional(),
    returnJourney: JourneyLegInputSchema.optional(),
    tripTiming: z.any().optional(),
    hotelName: z.string().trim().max(150).optional(),
    hotelLocation: z.string().trim().max(150).optional(),
    checkInTime: z.string().trim().max(50).optional(),
    checkOutTime: z.string().trim().max(50).optional(),
    special: z.string().trim().max(500).optional(),
  })
  .passthrough();

export const planBInputSchema = z.object({
  tripId: z.string().trim().min(1, "tripId is required"),
  messages: z.array(z.object({
    role: z.string(),
    content: z.string().optional(),
    text: z.string().optional(),
  })).optional(),
  question: z.string().trim().optional(),
  text: z.string().trim().optional(),
  currentDay: z.coerce.number().optional(),
  simulatedDay: z.coerce.number().optional(),
}).refine(
  (data) => (data.messages && data.messages.length > 0) || Boolean(data.question) || Boolean(data.text),
  { message: "Either 'messages' array, 'question', or 'text' must be provided." }
);

export const chatInputSchema = z.object({
  messages: z.array(
    z.object({
      role: z.string().default("user"),
      content: z.string().optional(),
      text: z.string().optional(),
    })
  ).min(1, "At least one message is required"),
});

export const packingInputSchema = z.object({
  destination: z.string().trim().min(1, "destination is required"),
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
  style: z.string().trim().optional(),
});

export const riskInputSchema = z.object({
  destination: z.string().trim().min(1, "destination is required"),
  tripId: z.string().trim().optional(),
  refresh: z.boolean().optional(),
});

export const estimateBudgetInputSchema = z.object({
  destination: z.string().trim().min(1, "destination is required"),
  startDate: z.string().trim().min(1, "startDate is required"),
  endDate: z.string().trim().min(1, "endDate is required"),
  travelers: z.coerce.number().min(1).default(1),
});

// ── AI STRUCTURED OUTPUT SCHEMAS (Validation for Model Completions) ───────────

export const ActivityOutputSchema = z.object({
  time: z.string().default("09:00"),
  description: z.string().default("Sightseeing"),
  interestTags: z.array(z.string().trim()).optional().default([]),
});

export const DayOutputSchema = z.object({
  dayNumber: z.coerce.number().default(1),
  date: z.string().default(""),
  title: z.string().default("Explore"),
  activities: z.array(ActivityOutputSchema).default([]),
});

export const BudgetCategoryItemSchema = z.object({
  category: z.string().default("miscellaneous"),
  label: z.string().default("Expense"),
  description: z.string().optional().default(""),
  amount: z.number().default(0),
  type: z.string().default("ESTIMATED"),
});

export const BudgetBreakdownSchema = z.object({
  currency: z.string().default("INR"),
  travelers: z.number().default(1),
  nights: z.number().default(1),
  categories: z.array(BudgetCategoryItemSchema).default([]),
});

export const ItineraryOutputSchema = z.object({
  title: z.string().default("Curated Journey"),
  destination: z.string().default("Destination"),
  summary: z.string().default("Travel itinerary"),
  budgetEstimate: z.string().default("Budget estimate"),
  budgetBreakdown: BudgetBreakdownSchema.optional(),
  days: z.array(DayOutputSchema).min(1, "Itinerary must contain at least one day"),
});

export const PlanBOutputSchema = z.object({
  reply: z.string().min(1, "Reply is required"),
  proposedDays: z.array(DayOutputSchema).default([]),
});

export const PackingCategoryItemSchema = z.object({
  name: z.string(),
  why: z.string().default("Essential for travel"),
});

export const PackingOutputSchema = z.object({
  Essentials: z.array(PackingCategoryItemSchema).default([]),
  "Weather-specific": z.array(PackingCategoryItemSchema).default([]),
  Documents: z.array(PackingCategoryItemSchema).default([]),
  Electronics: z.array(PackingCategoryItemSchema).default([]),
  Medicines: z.array(PackingCategoryItemSchema).default([]),
  Optional: z.array(PackingCategoryItemSchema).default([]),
});
