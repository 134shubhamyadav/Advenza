import { z } from "zod";
import { EXPENSE_CATEGORIES, COST_TYPES, PAYMENT_METHODS, SPLIT_TYPES } from "../models/Expense.js";

const CategoryAllocationSchema = z.object({
  flights: z.coerce.number().min(0).optional(),
  hotels: z.coerce.number().min(0).optional(),
  food: z.coerce.number().min(0).optional(),
  activities: z.coerce.number().min(0).optional(),
  transport: z.coerce.number().min(0).optional(),
  localTransport: z.coerce.number().min(0).optional(),
  shopping: z.coerce.number().min(0).optional(),
  miscellaneous: z.coerce.number().min(0).optional(),
});

const AlertSettingsSchema = z.object({
  thresholds: z.array(z.number().min(1).max(200)).optional(),
  notifyOnOverspend: z.boolean().optional(),
});

export const createBudgetSchema = z.object({
  totalBudget: z.coerce.number().min(0, "Total budget cannot be negative"),
  currency: z.string().trim().min(2).max(5).default("INR"),
  allocatedCategories: CategoryAllocationSchema.optional(),
  alertSettings: AlertSettingsSchema.optional(),
});

export const updateBudgetSchema = z.object({
  totalBudget: z.coerce.number().min(0).optional(),
  currency: z.string().trim().min(2).max(5).optional(),
  allocatedCategories: CategoryAllocationSchema.optional(),
  alertSettings: AlertSettingsSchema.optional(),
});

const ParticipantSchema = z.object({
  userId: z.string().nullable().optional(),
  name: z.string().trim().min(1, "Participant name is required"),
  email: z.string().email().nullable().optional(),
  share: z.coerce.number().min(0).default(1),
  shareAmount: z.coerce.number().min(0).default(0),
  settled: z.boolean().default(false),
});

const PaidBySchema = z.object({
  userId: z.string().nullable().optional(),
  name: z.string().trim().min(1).default("User"),
  email: z.string().email().nullable().optional(),
});

export const createExpenseSchema = z.object({
  name: z.string().trim().min(1, "Expense title is required").max(150),
  description: z.string().trim().max(500).default(""),
  amount: z.coerce.number().min(0, "Amount must be a non-negative number"),
  currency: z.string().trim().min(2).max(5).default("INR"),
  originalAmount: z.coerce.number().min(0).optional(),
  originalCurrency: z.string().trim().min(2).max(5).optional(),
  category: z.string().trim().default("miscellaneous"),
  type: z.enum(COST_TYPES).default("ACTUAL"),
  paymentMethod: z.enum(PAYMNET_METHODS_OR_FALLBACK(PAYMENT_METHODS)).default("card"),
  date: z.string().trim().optional(),
  paidBy: PaidBySchema.optional(),
  splitType: z.enum(SPLIT_TYPES).default("equal"),
  participants: z.array(ParticipantSchema).optional(),
  receiptUrl: z.string().nullable().optional(),
  receiptStorageKey: z.string().nullable().optional(),
  source: z.string().trim().default("User"),
});

export const updateExpenseSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  description: z.string().trim().max(500).optional(),
  amount: z.coerce.number().min(0).optional(),
  currency: z.string().trim().min(2).max(5).optional(),
  originalAmount: z.coerce.number().min(0).optional(),
  originalCurrency: z.string().trim().min(2).max(5).optional(),
  category: z.string().trim().optional(),
  type: z.enum(COST_TYPES).optional(),
  paymentMethod: z.enum(PAYMNET_METHODS_OR_FALLBACK(PAYMENT_METHODS)).optional(),
  date: z.string().trim().optional(),
  paidBy: PaidBySchema.optional(),
  splitType: z.enum(SPLIT_TYPES).optional(),
  participants: z.array(ParticipantSchema).optional(),
  receiptUrl: z.string().nullable().optional(),
  receiptStorageKey: z.string().nullable().optional(),
  source: z.string().trim().optional(),
});

export const listExpensesQuerySchema = z.object({
  category: z.string().trim().optional(),
  type: z.enum(COST_TYPES).optional(),
  paymentMethod: z.string().trim().optional(),
  search: z.string().trim().optional(),
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  skip: z.coerce.number().min(0).default(0),
});

export const ocrReceiptSchema = z.object({
  textContent: z.string().trim().optional(),
  base64Image: z.string().optional(),
  mimeType: z.string().trim().default("image/jpeg"),
  receiptUrl: z.string().url().optional(),
});

export const registerReceiptSchema = z.object({
  receiptUrl: z.string().url("Valid receipt URL required"),
  receiptStorageKey: z.string().trim().min(5, "Valid storage key required"),
  fileName: z.string().trim().optional(),
  mimeType: z.string().trim().optional(),
  fileSizeBytes: z.number().optional(),
});

function PAYMNET_METHODS_OR_FALLBACK(arr) {
  return [arr[0], ...arr.slice(1)];
}
