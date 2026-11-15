import mongoose from "mongoose";

const InvitationSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Trip",
      required: true,
      index: true,
    },
    inviterId: {
      type: String,
      required: true,
      index: true,
    },
    inviterName: {
      type: String,
      default: "",
    },
    inviterEmail: {
      type: String,
      default: "",
    },
    invitedEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    tripTitle: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["PENDING", "ACCEPTED", "EXPIRED", "REVOKED"],
      default: "PENDING",
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    acceptedAt: {
      type: Date,
    },
    acceptedBy: {
      type: String,
    },
    emailDeliveryStatus: {
      type: String,
      enum: ["PENDING", "SENT", "FAILED"],
      default: "PENDING",
      index: true,
    },
    emailDeliveryError: {
      type: String,
      default: null,
    },
    brevoMessageId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for querying existing pending invitations for a specific trip and email
InvitationSchema.index({ tripId: 1, invitedEmail: 1, status: 1 });

export default mongoose.model("Invitation", InvitationSchema);
