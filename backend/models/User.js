import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    firebaseUid: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      index: true,
      trim: true,
      lowercase: true,
    },
    displayName: {
      type: String,
      trim: true,
    },
    photoURL: {
      type: String,
      trim: true,
    },
    homeCity: {
      type: String,
      trim: true,
    },
    currency: {
      type: String,
      trim: true,
      default: "INR",
    },
    phoneNumber: {
      type: String,
      trim: true,
    },
    bio: {
      type: String,
      trim: true,
    },
    travelStyles: {
      type: [String],
      default: [],
    },
    preferences: {
      type: [String],
      default: [],
    },
    savedTrips: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Trip",
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Compound index for user lookups by email and firebaseUid
UserSchema.index({ email: 1, firebaseUid: 1 });

export default mongoose.model("User", UserSchema);
