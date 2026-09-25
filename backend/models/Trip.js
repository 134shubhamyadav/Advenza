import mongoose from "mongoose";

const ActivitySchema = new mongoose.Schema({
  time: String,
  description: String,
});

const DayPlanSchema = new mongoose.Schema({
  dayNumber: Number,
  date: String,
  title: String,
  activities: [ActivitySchema],
});

// Embedded Expense schema (preserved for backwards compatibility)
const ExpenseSchema = new mongoose.Schema({
  name: { type: String, required: true },
  amount: { type: Number, required: true },
  category: { type: String, default: "General" },
  date: { type: String },
  addedAt: { type: Date, default: Date.now },
});

// Embedded Group Member schema (strictly bounded to small groups 2-10)
const MemberSchema = new mongoose.Schema({
  name: String,
  email: String,
  role: { type: String, default: "Pending" },
  initials: String,
  color: String,
  userId: String,
});

// Embedded Vote schema (strictly bounded 4-10 options)
const VoteOptionSchema = new mongoose.Schema({
  name: String,
  votes: { type: Number, default: 0 },
  voters: [String], // array of UIDs
});

const TripSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  destination: { type: String, trim: true },
  summary: String,
  budgetEstimate: String,
  budgetBreakdown: {
    currency: { type: String, default: "INR" },
    travelers: { type: Number, default: 1 },
    nights: { type: Number, default: 1 },
    categories: [
      {
        category: String,
        label: String,
        description: String,
        amount: Number,
        type: { type: String, default: "ESTIMATED" },
      },
    ],
  },
  heroImage: {
    url: String,
    destination: String,
    source: { type: String, default: "wikimedia" },
    photographer: String,
    photographerUrl: String,
    attributionUrl: String,
    fetchedAt: { type: Date, default: Date.now },
  },
  startDate: String,
  endDate: String,
  style: String,
  interests: [String],
  transport: [String],          // user-selected transport modes
  accommodation: String,        // user-selected accommodation type
  hotelLocation: String,        // user's hotel location or area
  // Specific travel detail fields
  travelMode: String,           // primary intercity mode: Flight/Train/Bus/Car/Ferry
  departureHub: String,         // airport / station / terminal at origin
  arrivalHub: String,           // airport / station / terminal at destination
  transitRef: String,           // flight number, train name, etc.
  departureTime: String,        // user-provided departure time (HH:MM)
  arrivalTime: String,          // user-provided arrival time (HH:MM)
  // Accommodation detail fields
  hotelName: String,            // hotel / stay name
  checkInTime: String,          // expected check-in time (HH:MM)
  checkOutTime: String,         // expected check-out time (HH:MM)
  // Return journey details
  returnJourney: {
    booked: { type: Boolean, default: false },
    date: String,               // YYYY-MM-DD
    time: String,               // HH:MM departure time for return
    departureLocation: String,  // airport / station at destination
    transportType: String,      // Flight / Train / Bus / Car / Ferry / Other
    ticketRef: String,          // optional ticket / flight number
  },
  travelers: { type: Number, default: 1 },
  days: [DayPlanSchema],

  // Budget tracking embedded in trip
  budgetTotal: { type: Number, default: 0 },
  expenses: [ExpenseSchema],

  // Plan B suggestions (AI-generated backup scenarios)
  planB: { type: mongoose.Schema.Types.Mixed, default: null },

  // Group planning embedded in trip
  members: [MemberSchema],
  voteOptions: [VoteOptionSchema],

  // Commander event acceptance tracking
  acceptedCommanderEvents: [
    {
      eventId: { type: String, required: true },
      acceptedAt: { type: Date, default: Date.now },
      actionTaken: { type: String, default: "" },
    },
  ],

  // Metadata
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  createdBy: { type: String, required: true, index: true },
  healthScore: { type: Number, default: 87 },
});

// Compound indexes tailored for actual query patterns
TripSchema.index({ createdBy: 1, createdAt: -1 });
TripSchema.index({ "members.userId": 1, createdAt: -1 });
TripSchema.index({ "members.email": 1, createdAt: -1 });
TripSchema.index({ title: "text", destination: "text" });

// Auto-update updatedAt on save
TripSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model("Trip", TripSchema);
