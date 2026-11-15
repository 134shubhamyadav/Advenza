import mongoose from "mongoose";

const ActivitySchema = new mongoose.Schema({
  time: String,
  description: String,
  interestTags: { type: [String], default: [] },
  placeName: { type: String, default: "" },
  placeCategory: { type: String, default: "" },
  placeSubcategory: { type: String, default: "" },
  placeType: { type: String, default: "POPULAR_ATTRACTION" },
  gemConfidence: { type: String, default: "UNCLASSIFIED" },
  isPlaceHiddenGem: { type: Boolean, default: false },
  whySpecial: { type: String, default: "" },
  region: { type: String, default: "" },
  address: { type: String, default: "" },
  coordinates: {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
  },
  openingHours: { type: String, default: "" },
  verificationStatus: { type: String, default: "" },
  suggestedDuration: { type: String, default: "" },
  distanceFromPrevious: { type: String, default: "" },
  mapLink: { type: String, default: "" },
  matchReason: { type: String, default: "" },
  isFutureScheduleUnconfirmed: { type: Boolean, default: false },
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

// Structured Journey schema for multi-day, overnight, and same-day travel
const JourneyLegSchema = new mongoose.Schema(
  {
    transportType: { type: String, default: "" }, // Flight, Train, Bus, Car, Ferry, etc.
    departureLocation: { type: String, default: "" }, // e.g. "Mumbai", "CSMT", "BOM"
    arrivalLocation: { type: String, default: "" }, // e.g. "Goa", "Madgaon", "GOI"
    departureDate: { type: String, default: "" }, // YYYY-MM-DD
    departureTime: { type: String, default: "" }, // HH:mm
    arrivalDate: { type: String, default: "" }, // YYYY-MM-DD
    arrivalTime: { type: String, default: "" }, // HH:mm
    durationMinutes: { type: Number, default: null },
    durationSource: { type: String, default: "" }, // "USER_SPECIFIED", "CALCULATED_MAPS", "ESTIMATED_HAVERSINE", "SCHEDULED"
    transitRef: { type: String, default: "" }, // flight number, train name/number, bus operator
    status: { type: String, default: "ESTIMATED" }, // "ESTIMATED", "CONFIRMED", "NOT_CONFIGURED"
    booked: { type: Boolean, default: false },
    ticketRef: { type: String, default: "" },
  },
  { _id: false }
);

// Structured Day Timing Window schema for per-day exploration windows
const DayTimingWindowSchema = new mongoose.Schema(
  {
    date: { type: String, default: "" }, // YYYY-MM-DD
    status: { type: String, default: "FULL_DESTINATION_DAY" }, // "TRAVEL_OUTBOUND", "ARRIVAL_DAY", "FULL_DESTINATION_DAY", "RETURN_DAY", "TRAVEL_RETURN", "UNAVAILABLE"
    usableStartDateTime: { type: String, default: "" }, // ISO string
    usableEndDateTime: { type: String, default: "" },   // ISO string
    availableHours: { type: Number, default: 0 },
    reason: { type: String, default: "" },
    constraints: {
      arrivalDay: { type: Boolean, default: false },
      returnDay: { type: Boolean, default: false },
      requiresHotelCheckIn: { type: Boolean, default: false },
      travelDay: { type: Boolean, default: false },
    },
  },
  { _id: false }
);

// Structured Trip Timing Metadata for computed travel & destination exploration windows
const TripTimingSchema = new mongoose.Schema(
  {
    outbound: {
      durationMinutes: { type: Number, default: null },
      isOvernight: { type: Boolean, default: false },
      travelDaysCount: { type: Number, default: 0 },
      arrivalDateTime: { type: String, default: "" }, // ISO string or "YYYY-MM-DDTHH:mm"
    },
    destination: {
      usableStartDateTime: { type: String, default: "" },
      usableEndDateTime: { type: String, default: "" },
      totalUsableHours: { type: Number, default: null },
      days: { type: [DayTimingWindowSchema], default: [] },
    },
    return: {
      durationMinutes: { type: Number, default: null },
      isOvernight: { type: Boolean, default: false },
      travelDaysCount: { type: Number, default: 0 },
      departureDateTime: { type: String, default: "" },
    },
  },
  { _id: false }
);

const TripSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  origin: { type: String, trim: true, default: "" },
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
  duration: { type: Number },
  durationMode: { type: String, enum: ["RECOMMENDED", "CUSTOM"], default: "RECOMMENDED" },
  style: String,
  interests: [String],
  transport: [String],          // user-selected transport modes
  accommodation: String,        // user-selected accommodation type
  hotelLocation: String,        // user's hotel location or area
  // Specific travel detail fields (preserved for backwards compatibility)
  travelMode: String,           // primary intercity mode: Flight/Train/Bus/Car/Ferry
  departureHub: String,         // airport / station / terminal at origin
  arrivalHub: String,           // airport / station / terminal at destination
  transitRef: String,           // flight number, train name, etc.
  departureTime: String,        // user-provided departure time (HH:MM)
  arrivalTime: String,          // user-provided arrival time (HH:MM)
  // Structured Outbound & Return Journey details
  outboundJourney: { type: JourneyLegSchema, default: () => ({}) },
  returnJourney: { type: JourneyLegSchema, default: () => ({ booked: false }) },
  // Timing metadata for destination window calculations
  tripTiming: { type: TripTimingSchema, default: () => ({}) },
  // Accommodation detail fields
  hotelName: String,            // hotel / stay name
  checkInTime: String,          // expected check-in time (HH:MM)
  checkOutTime: String,         // expected check-out time (HH:MM)
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
