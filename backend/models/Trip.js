import mongoose from 'mongoose';

const ActivitySchema = new mongoose.Schema({
  time: String,
  description: String
});

const DayPlanSchema = new mongoose.Schema({
  dayNumber: Number,
  date: String,
  title: String,
  activities: [ActivitySchema]
});

// Embedded Expense schema
const ExpenseSchema = new mongoose.Schema({
  name: { type: String, required: true },
  amount: { type: Number, required: true },
  category: { type: String, default: 'General' },
  date: { type: String },
  addedAt: { type: Date, default: Date.now }
});

// Embedded Group Member schema
const MemberSchema = new mongoose.Schema({
  name: String,
  email: String,
  role: { type: String, default: 'Pending' },
  initials: String,
  color: String
});

// Embedded Vote schema
const VoteOptionSchema = new mongoose.Schema({
  name: String,
  votes: { type: Number, default: 0 },
  voters: [String] // array of UIDs
});

const TripSchema = new mongoose.Schema({
  title: { type: String, required: true },
  destination: String,
  summary: String,
  budgetEstimate: String,
  startDate: String,
  endDate: String,
  style: String,
  interests: [String],
  days: [DayPlanSchema],
  
  // Budget tracking embedded in trip
  budgetTotal: { type: Number, default: 0 },
  expenses: [ExpenseSchema],
  
  // Group planning embedded in trip
  members: [MemberSchema],
  voteOptions: [VoteOptionSchema],
  
  // Metadata
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  createdBy: { type: String, required: true },
  healthScore: { type: Number, default: 87 }
});

// Auto-update updatedAt on save
TripSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('Trip', TripSchema);
