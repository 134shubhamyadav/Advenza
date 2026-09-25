import path from "path";
import sharp from "sharp";
import Trip from "../models/Trip.js";
import Expense from "../models/Expense.js";
import { budgetService } from "../services/budget/budget.service.js";
import { settlementService } from "../services/budget/settlement.service.js";
import { budgetAiService } from "../services/ai/budget-ai.service.js";
import { receiptStorageService } from "../services/storage/receipt-storage.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { NotFoundError, ForbiddenError, ValidationError } from "../utils/errors.js";

/**
 * Validates trip existence and user authorization.
 */
async function verifyTripAccess(tripId, uid) {
  if (!tripId) throw new ValidationError("tripId parameter is required");
  const trip = await Trip.findById(tripId).lean();
  if (!trip) throw new NotFoundError("Trip not found");

  const isOwner = String(trip.createdBy) === String(uid);
  const isMember = Array.isArray(trip.members) && trip.members.some((m) => m.userId === uid || m.email === uid);

  if (!isOwner && !isMember) {
    throw new ForbiddenError("Forbidden: You do not have access to this trip");
  }

  return trip;
}

export const getBudget = asyncHandler(async (req, res) => {
  const { tripId } = req.params;
  await verifyTripAccess(tripId, req.uid);

  const summary = await budgetService.getBudgetSummary(tripId);
  res.json(summary);
});

export const updateBudget = asyncHandler(async (req, res) => {
  const { tripId } = req.params;
  await verifyTripAccess(tripId, req.uid);

  const updated = await budgetService.updateTripBudget(tripId, req.body);
  res.json(updated);
});

export const listExpenses = asyncHandler(async (req, res) => {
  const { tripId } = req.params;
  await verifyTripAccess(tripId, req.uid);

  const { category, type, paymentMethod, search, startDate, endDate, limit = 50, skip = 0 } = req.query;

  const filter = { tripId, isDeleted: false };
  if (category) filter.category = category.toLowerCase().trim();
  if (type) filter.type = type;
  if (paymentMethod) filter.paymentMethod = paymentMethod;

  if (startDate || endDate) {
    filter.date = {};
    if (startDate) filter.date.$gte = startDate;
    if (endDate) filter.date.$lte = endDate;
  }

  if (search && typeof search === "string" && search.trim()) {
    const term = search.trim();
    filter.$or = [
      { name: new RegExp(term, "i") },
      { description: new RegExp(term, "i") },
      { "paidBy.name": new RegExp(term, "i") },
    ];
  }

  const [expenses, totalCount] = await Promise.all([
    Expense.find(filter)
      .sort({ date: -1, createdAt: -1 })
      .skip(Number(skip))
      .limit(Number(limit))
      .lean(),
    Expense.countDocuments(filter),
  ]);

  res.json({
    tripId,
    total: totalCount,
    limit: Number(limit),
    skip: Number(skip),
    expenses,
  });
});

export const createExpense = asyncHandler(async (req, res) => {
  const { tripId } = req.params;
  await verifyTripAccess(tripId, req.uid);

  const newExpense = await budgetService.addExpense(tripId, req.uid, req.body);
  res.status(201).json(newExpense);
});

export const updateExpense = asyncHandler(async (req, res) => {
  const { tripId, expenseId } = req.params;
  await verifyTripAccess(tripId, req.uid);

  const updated = await budgetService.updateExpense(expenseId, tripId, req.body);
  res.json(updated);
});

export const deleteExpense = asyncHandler(async (req, res) => {
  const { tripId, expenseId } = req.params;
  await verifyTripAccess(tripId, req.uid);

  const result = await budgetService.deleteExpense(expenseId, tripId);
  res.json(result);
});

export const getAnalytics = asyncHandler(async (req, res) => {
  const { tripId } = req.params;
  await verifyTripAccess(tripId, req.uid);

  const summary = await budgetService.getBudgetSummary(tripId);
  res.json({
    tripId,
    currency: summary.currency,
    totalBudget: summary.totalBudget,
    actualTotal: summary.actualTotal,
    plannedTotal: summary.plannedTotal,
    remainingBuffer: summary.remainingBuffer,
    percentageUsed: summary.percentageUsed,
    isOverBudget: summary.isOverBudget,
    projectedTotal: summary.projectedTotal,
    projectedOverage: summary.projectedOverage,
    daily: summary.daily,
    categories: summary.categories,
    timeline: summary.timeline,
    alerts: summary.alerts,
  });
});

export const getSettlement = asyncHandler(async (req, res) => {
  const { tripId } = req.params;
  const trip = await verifyTripAccess(tripId, req.uid);

  const expenses = await Expense.find({ tripId, isDeleted: false }).lean();
  const members = trip.members || [];
  const currency = trip.currency || "INR";

  const settlement = settlementService.calculateSettlements(expenses, members, currency);
  res.json(settlement);
});

export const getAiInsights = asyncHandler(async (req, res) => {
  const { tripId } = req.params;
  const trip = await verifyTripAccess(tripId, req.uid);

  const summary = await budgetService.getBudgetSummary(tripId);
  const insights = await budgetAiService.generateBudgetInsights(summary, trip);
  res.json(insights);
});

export const registerReceipt = asyncHandler(async (req, res) => {
  const { tripId } = req.params;
  await verifyTripAccess(tripId, req.uid);

  const { receiptUrl, receiptStorageKey, fileName, mimeType, fileSizeBytes } = req.body;

  // Strict ownership prefix validation: prevent linking media from other users
  const expectedPrefix = `users/${req.uid}/`;
  if (!receiptStorageKey.startsWith(expectedPrefix)) {
    throw new ForbiddenError("Forbidden: Storage key does not belong to authenticated user namespace.");
  }

  res.status(201).json({
    success: true,
    receiptUrl,
    receiptStorageKey,
    fileName: fileName || "receipt.jpg",
    mimeType: mimeType || "image/jpeg",
    fileSizeBytes: fileSizeBytes || null,
  });
});

export const uploadReceiptBinary = asyncHandler(async (req, res) => {
  const { tripId } = req.params;
  await verifyTripAccess(tripId, req.uid);

  const fileBuffer = req.body;
  if (!Buffer.isBuffer(fileBuffer) || fileBuffer.length === 0) {
    throw new ValidationError("Binary body payload is required for receipt upload");
  }

  if (fileBuffer.length > 10 * 1024 * 1024) {
    throw new ValidationError("Receipt file exceeds maximum 10MB limit");
  }

  const rawMime = (req.headers["content-type"] || "image/jpeg").toLowerCase().split(";")[0].trim();
  const rawFileName = req.headers["x-file-name"] ? decodeURIComponent(String(req.headers["x-file-name"])) : "receipt.jpg";
  const safeFileName = path.basename(rawFileName).replace(/[^a-zA-Z0-9._-]/g, "_");

  // Validate image magic bytes and integrity with Sharp (or PDF magic header)
  let verifiedMime = rawMime;
  if (rawMime.startsWith("image/")) {
    try {
      const meta = await sharp(fileBuffer).metadata();
      if (!meta.format || !meta.width || !meta.height) {
        throw new ValidationError("Corrupt or invalid image file buffer");
      }
      verifiedMime = `image/${meta.format === "jpg" ? "jpeg" : meta.format}`;
    } catch (sharpErr) {
      throw new ValidationError(`Invalid image data: ${sharpErr.message}`);
    }
  } else if (rawMime === "application/pdf") {
    const isPdf = fileBuffer.slice(0, 4).toString() === "%PDF";
    if (!isPdf) throw new ValidationError("Invalid PDF file header");
  } else {
    throw new ValidationError(`Unsupported receipt MIME type: ${rawMime}`);
  }

  const uploaded = await receiptStorageService.uploadReceipt({
    fileBuffer,
    fileName: safeFileName,
    mimeType: verifiedMime,
    userId: req.uid,
    tripId,
  });

  res.status(201).json(uploaded);
});

export const uploadReceipt = asyncHandler(async (req, res) => {
  const { tripId } = req.params;
  await verifyTripAccess(tripId, req.uid);

  const { fileName, base64Data, mimeType } = req.body;
  if (!base64Data) {
    throw new ValidationError("base64Data is required for legacy receipt upload, or use /receipt-upload-binary");
  }

  if (typeof base64Data === "string" && base64Data.length > 2 * 1024 * 1024) {
    throw new ValidationError("Base64 payload exceeds 2MB. Use streaming binary upload instead.");
  }

  const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, "");
  const fileBuffer = Buffer.from(cleanBase64, "base64");

  if (fileBuffer.length === 0) {
    throw new ValidationError("Invalid or empty base64 image data");
  }

  try {
    await sharp(fileBuffer).metadata();
  } catch (err) {
    throw new ValidationError(`Invalid image data in base64: ${err.message}`);
  }

  const uploaded = await receiptStorageService.uploadReceipt({
    fileBuffer,
    fileName: fileName || "receipt.jpg",
    mimeType: mimeType || "image/jpeg",
    userId: req.uid,
    tripId,
  });

  res.status(201).json(uploaded);
});

export const parseReceiptOCR = asyncHandler(async (req, res) => {
  const { tripId } = req.params;
  await verifyTripAccess(tripId, req.uid);

  const result = await budgetAiService.parseReceiptOCR(req.body);
  res.json(result);
});
