import mongoose from "mongoose";

const PriceHistorySchema = new mongoose.Schema(
  {
    watchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PriceWatch",
      required: true,
      index: true,
    },
    price: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "INR",
    },
    provider: {
      type: String,
      default: "Travel Data API",
    },
    observedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
  }
);

PriceHistorySchema.index({ watchId: 1, observedAt: -1 });

export const PriceHistory = mongoose.models.PriceHistory || mongoose.model("PriceHistory", PriceHistorySchema);
export default PriceHistory;
