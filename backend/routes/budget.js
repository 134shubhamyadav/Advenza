import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  createBudgetSchema,
  updateBudgetSchema,
  createExpenseSchema,
  updateExpenseSchema,
  listExpensesQuerySchema,
  ocrReceiptSchema,
  registerReceiptSchema,
} from "../schemas/budget.schemas.js";
import * as budgetController from "../controllers/budget.controller.js";
import { uploadLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

// Enforce auth token verification on all budget and expense operations
router.use(verifyToken);

// ── Budget Endpoints ─────────────────────────────────────────────────────────
// GET /api/trips/:tripId/budget — Get trip budget summary & metrics
router.get("/:tripId/budget", budgetController.getBudget);

// POST /api/trips/:tripId/budget — Initialize/Set trip budget & allocations
router.post(
  "/:tripId/budget",
  validate({ body: createBudgetSchema }),
  budgetController.updateBudget
);

// PATCH /api/trips/:tripId/budget — Update category allocations & alert settings
router.patch(
  "/:tripId/budget",
  validate({ body: updateBudgetSchema }),
  budgetController.updateBudget
);

// GET /api/trips/:tripId/budget/analytics — Detailed analytics & timelines
router.get("/:tripId/budget/analytics", budgetController.getAnalytics);

// GET /api/trips/:tripId/budget/settlement — Group debt settlement calculation
router.get("/:tripId/budget/settlement", budgetController.getSettlement);

// POST /api/trips/:tripId/budget/ai-insights — Bounded AI financial insights
router.post("/:tripId/budget/ai-insights", budgetController.getAiInsights);

// ── Expense Endpoints ────────────────────────────────────────────────────────
// GET /api/trips/:tripId/expenses — List trip expenses with filtering & pagination
router.get(
  "/:tripId/expenses",
  validate({ query: listExpensesQuerySchema }),
  budgetController.listExpenses
);

// POST /api/trips/:tripId/expenses — Create expense
router.post(
  "/:tripId/expenses",
  validate({ body: createExpenseSchema }),
  budgetController.createExpense
);

// PATCH /api/trips/:tripId/expenses/:expenseId — Update expense
router.patch(
  "/:tripId/expenses/:expenseId",
  validate({ body: updateExpenseSchema }),
  budgetController.updateExpense
);

// DELETE /api/trips/:tripId/expenses/:expenseId — Delete expense
router.delete("/:tripId/expenses/:expenseId", budgetController.deleteExpense);

// POST /api/trips/:tripId/expenses/receipt-register — Register direct cloud-uploaded receipt metadata
router.post(
  "/:tripId/expenses/receipt-register",
  uploadLimiter,
  validate({ body: registerReceiptSchema }),
  budgetController.registerReceipt
);

// POST /api/trips/:tripId/expenses/receipt-upload-binary — Stream binary receipt image/PDF without base64
router.post(
  "/:tripId/expenses/receipt-upload-binary",
  uploadLimiter,
  express.raw({ type: ["image/jpeg", "image/png", "image/webp", "image/*", "application/pdf"], limit: "10mb" }),
  budgetController.uploadReceiptBinary
);

// POST /api/trips/:tripId/expenses/receipt-upload — Legacy receipt upload attachment
router.post("/:tripId/expenses/receipt-upload", uploadLimiter, budgetController.uploadReceipt);

// POST /api/trips/:tripId/expenses/ocr — OCR extraction preview
router.post(
  "/:tripId/expenses/ocr",
  validate({ body: ocrReceiptSchema }),
  budgetController.parseReceiptOCR
);

export default router;
