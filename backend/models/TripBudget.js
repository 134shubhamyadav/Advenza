import mongoose from "mongoose";

const CategoryAllocationSchema = new mongoose.Schema(
  {
    flights: { type: Number, default: 0, min: 0 },
    hotels: { type: Number, default: 0, min: 0 },
    food: { type: Number, default: 0, min: 0 },
    activities: { type: Number, default: 0, min: 0 },
    transport: { type: Number, default: 0, min: 0 },
    localTransport: { type: Number, default: 0, min: 0 },
    shopping: { type: Number, default: 0, min: 0 },
    miscellaneous: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const AlertSettingsSchema = new mongoose.Schema(
  {
    thresholds: {
      type: [Number],
      default: [70, 85, 100],
    },
    notifyOnOverspend: {
      type: Boolean,
      default: true,
    },
    lastTriggeredThresholds: {
      type: [Number],
      default: [],
    },
    lastAlertedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const TripBudgetSchema = new mongoose.Schema(
  {
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Trip",
      required: [true, "tripId is required"],
      unique: true,
      index: true,
    },
    currency: {
      type: String,
      default: "INR",
      trim: true,
      uppercase: true,
    },
    totalBudget: {
      type: Number,
      required: [true, "totalBudget is required"],
      min: [0, "totalBudget cannot be negative"],
      default: 0,
    },
    allocatedCategories: {
      type: CategoryAllocationSchema,
      default: () => ({}),
    },
    alertSettings: {
      type: AlertSettingsSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for trip queries
TripBudgetSchema.index({ tripId: 1, updatedAt: -1 });

export default mongoose.model("TripBudget", TripBudgetSchema);
