import mongoose from "mongoose";

export const EXPENSE_CATEGORIES = [
  "flights",
  "hotels",
  "food",
  "activities",
  "transport",
  "localTransport",
  "shopping",
  "miscellaneous",
];

export const COST_TYPES = ["ACTUAL", "ESTIMATED", "LIVE_PRICE"];
export const PAYMENT_METHODS = ["cash", "card", "upi", "netbanking", "other"];
export const SPLIT_TYPES = ["equal", "custom", "exact"];

const ParticipantSchema = new mongoose.Schema(
  {
    userId: { type: String, default: null },
    name: { type: String, required: true },
    email: { type: String, default: null },
    share: { type: Number, default: 1 },         // e.g. weight (1 for equal)
    shareAmount: { type: Number, default: 0 },    // computed or custom amount
    settled: { type: Boolean, default: false },
  },
  { _id: false }
);

const PaidBySchema = new mongoose.Schema(
  {
    userId: { type: String, default: null },
    name: { type: String, default: "User" },
    email: { type: String, default: null },
  },
  { _id: false }
);

const ExpenseSchema = new mongoose.Schema(
  {
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Trip",
      required: [true, "tripId is required"],
      index: true,
    },
    userId: {
      type: String,
      required: [true, "userId is required"],
      index: true,
    },
    name: {
      type: String,
      required: [true, "Expense name is required"],
      trim: true,
      maxlength: [150, "Expense name cannot exceed 150 characters"],
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    // Amount normalized in Trip Currency
    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [0, "Amount cannot be negative"],
    },
    currency: {
      type: String,
      default: "INR",
      trim: true,
      uppercase: true,
    },
    // Multi-currency tracking
    originalAmount: {
      type: Number,
      default: null,
    },
    originalCurrency: {
      type: String,
      default: "INR",
      trim: true,
      uppercase: true,
    },
    exchangeRate: {
      type: Number,
      default: 1,
    },
    rateTimestamp: {
      type: Date,
      default: Date.now,
    },
    // Category classification
    category: {
      type: String,
      default: "miscellaneous",
      trim: true,
      lowercase: true,
    },
    // Cost Type (ESTIMATED, LIVE_PRICE, ACTUAL)
    type: {
      type: String,
      enum: COST_TYPES,
      default: "ACTUAL",
    },
    // Payment Method
    paymentMethod: {
      type: String,
      enum: PAYMENT_METHODS,
      default: "card",
    },
    date: {
      type: String,
      default: () => new Date().toISOString().slice(0, 10),
    },
    // Group splitting
    paidBy: {
      type: PaidBySchema,
      default: () => ({ name: "User" }),
    },
    splitType: {
      type: String,
      enum: SPLIT_TYPES,
      default: "equal",
    },
    participants: {
      type: [ParticipantSchema],
      default: [],
    },
    // Receipt attachments
    receiptUrl: {
      type: String,
      default: null,
    },
    receiptStorageKey: {
      type: String,
      default: null,
    },
    source: {
      type: String,
      default: "User",
      trim: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Virtual alias 'title' for 'name'
ExpenseSchema.virtual("title").get(function () {
  return this.name;
}).set(function (val) {
  this.name = val;
});

// Compound Indexes for fast ledger queries, analytics, and group settlements
ExpenseSchema.index({ tripId: 1, isDeleted: 1, date: -1 });
ExpenseSchema.index({ tripId: 1, isDeleted: 1, category: 1 });
ExpenseSchema.index({ tripId: 1, isDeleted: 1, type: 1 });
ExpenseSchema.index({ userId: 1, tripId: 1 });
ExpenseSchema.index({ "participants.userId": 1, tripId: 1 });

export default mongoose.model("Expense", ExpenseSchema);
