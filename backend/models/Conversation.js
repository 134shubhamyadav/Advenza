import mongoose from "mongoose";

const ConversationMessageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["user", "assistant", "system"], required: true },
    content: { type: String, required: true },
    intent: { type: String, default: "" },
    entities: { type: mongoose.Schema.Types.Mixed, default: {} },
    data: { type: mongoose.Schema.Types.Mixed, default: null },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: true }
);

const ConversationSchema = new mongoose.Schema(
  {
    conversationId: { type: String, required: true, unique: true, index: true },
    userId: { type: String, index: true, default: "guest" },
    tripId: { type: mongoose.Schema.Types.ObjectId, ref: "Trip", index: true, default: null },
    messages: [ConversationMessageSchema],
    state: {
      activeDestination: {
        name: { type: String, default: "" },
        city: { type: String, default: "" },
        locality: { type: String, default: "" },
        region: { type: String, default: "" },
        coordinates: {
          lat: { type: Number, default: null },
          lng: { type: Number, default: null },
        },
        resolvedAddress: { type: String, default: "" },
      },
      previousDestinations: [
        {
          name: String,
          city: String,
          locality: String,
          region: String,
          swappedAt: { type: Date, default: Date.now },
        },
      ],
      accommodation: {
        name: { type: String, default: "" },
        location: { type: String, default: "" },
        address: { type: String, default: "" },
        coordinates: {
          lat: { type: Number, default: null },
          lng: { type: Number, default: null },
        },
        checkInTime: { type: String, default: "" },
        checkOutTime: { type: String, default: "" },
      },
      preferences: {
        cuisine: [String],
        foodRestrictions: [String],
        budgetPerPerson: { type: Number, default: null },
        preferredRadiusKm: { type: Number, default: null },
        transportMode: { type: String, default: "" },
        travelDates: {
          startDate: { type: String, default: "" },
          endDate: { type: String, default: "" },
        },
        pace: { type: String, default: "Balanced" },
        interests: [String],
      },
      currentJourney: {
        outbound: { type: mongoose.Schema.Types.Mixed, default: null },
        return: { type: mongoose.Schema.Types.Mixed, default: null },
        transitRef: { type: String, default: "" },
      },
      currentIntent: { type: String, default: "" },
      lastClarification: {
        question: { type: String, default: "" },
        answer: { type: String, default: "" },
        timestamp: { type: Date, default: null },
      },
      selectedOptions: [mongoose.Schema.Types.Mixed],
      recentlyDiscussedPlaces: [String],
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

ConversationSchema.index({ userId: 1, updatedAt: -1 });

export const Conversation = mongoose.model("Conversation", ConversationSchema);
export default Conversation;
