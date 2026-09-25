import mongoose from "mongoose";

export const PRICE_WATCH_TYPES = ["flight", "hotel"];
export const PRICE_WATCH_STATUSES = ["active", "paused", "triggered", "expired", "deleted"];
export const PRICE_ALERT_CONDITIONS = ["below_target", "percentage_drop", "any_drop"];

const PriceWatchSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: [true, "userId is required"],
      index: true,
    },
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Trip",
      index: true,
      default: null,
    },
    type: {
      type: String,
      enum: PRICE_WATCH_TYPES,
      required: [true, "watch type is required"],
      index: true,
    },

    // Flight Criteria
    origin: { type: String, trim: true },
    destination: { type: String, trim: true, required: true },
    departureDate: { type: String },
    returnDate: { type: String, default: null },
    passengers: { type: Number, default: 1, min: 1, max: 9 },
    cabin: { type: String, default: "ECONOMY" },

    // Hotel Criteria
    checkIn: { type: String },
    checkOut: { type: String },
    guests: { type: Number, default: 2, min: 1, max: 10 },
    rooms: { type: Number, default: 1, min: 1, max: 5 },
    hotelName: { type: String, trim: true, default: "" },

    // Price Targets & Observed Numbers (in INR)
    targetPrice: {
      type: Number,
      required: [true, "targetPrice is required"],
      min: [100, "targetPrice must be at least ₹100"],
    },
    currency: {
      type: String,
      default: "INR",
    },
    provider: {
      type: String,
      default: "Travel Data API",
    },
    lastPrice: {
      type: Number,
      default: null,
    },
    lowestPrice: {
      type: Number,
      default: null,
    },
    previousPrice: {
      type: Number,
      default: null,
    },

    // Status & Scheduler
    status: {
      type: String,
      enum: PRICE_WATCH_STATUSES,
      default: "active",
      index: true,
    },
    lastCheckedAt: {
      type: Date,
      default: null,
    },
    nextCheckAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    checkIntervalHours: {
      type: Number,
      default: 12,
      min: 1,
      max: 48,
    },

    // Cooldown & Alert Triggers
    alertCondition: {
      type: String,
      enum: PRICE_ALERT_CONDITIONS,
      default: "below_target",
    },
    alertThresholdPercent: {
      type: Number,
      default: 10,
    },
    lastAlertedPrice: {
      type: Number,
      default: null,
    },
    lastAlertedAt: {
      type: Date,
      default: null,
    },
    lastAlertedEvent: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

PriceWatchSchema.index({ userId: 1, status: 1, createdAt: -1 });
PriceWatchSchema.index({ status: 1, nextCheckAt: 1 });

export const PriceWatch = mongoose.models.PriceWatch || mongoose.model("PriceWatch", PriceWatchSchema);
export default PriceWatch;
