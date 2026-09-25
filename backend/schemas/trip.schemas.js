import { z } from "zod";

export const createTripSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  destination: z.string().trim().min(1, "Destination is required").max(150),
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
  budgetTotal: z.coerce.number().min(0).default(0),
  style: z.string().trim().default("Balanced"),
  days: z.array(z.any()).default([]),
  voteOptions: z.array(z.any()).optional(),
  expenses: z.array(z.any()).default([]),
  members: z.array(z.any()).default([]),
});

export const addExpenseSchema = z.object({
  name: z.string().trim().min(1, "Expense name is required").max(150),
  amount: z.coerce.number().min(0.01, "Amount must be greater than zero"),
  category: z.string().trim().default("General"),
  date: z.string().trim().optional(),
});

export const inviteMemberSchema = z.object({
  email: z.string().trim().email("Valid email address is required"),
  name: z.string().trim().optional(),
});

export const voteSchema = z.object({
  optionName: z.string().trim().min(1, "optionName is required"),
});

export const addOptionSchema = z.object({
  name: z.string().trim().min(1, "Option name is required").max(150),
});

export const updateItinerarySchema = z.object({
  days: z.array(
    z.object({
      dayNumber: z.coerce.number(),
      date: z.string().optional(),
      title: z.string().optional(),
      activities: z.array(
        z.object({
          time: z.string().optional(),
          description: z.string().optional(),
        })
      ).default([]),
    })
  ).min(1, "At least one day is required"),
});
