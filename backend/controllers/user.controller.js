import User from "../models/User.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ValidationError } from "../utils/errors.js";

/**
 * Get current user profile from MongoDB
 * GET /api/users/profile
 */
export const getProfile = asyncHandler(async (req, res) => {
  const uid = req.uid;
  if (!uid) {
    throw new ValidationError("User identifier is required");
  }

  let user = await User.findOne({ firebaseUid: uid }).lean();

  if (!user) {
    // If not found, return empty profile structure
    return res.json({
      success: true,
      profile: {
        uid,
        email: null,
        displayName: null,
        photoURL: null,
        homeCity: "",
        currency: "INR",
        phoneNumber: "",
        bio: "",
        travelStyles: [],
        preferences: [],
      },
    });
  }

  res.json({
    success: true,
    profile: {
      uid: user.firebaseUid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      homeCity: user.homeCity || "",
      currency: user.currency || "INR",
      phoneNumber: user.phoneNumber || "",
      bio: user.bio || "",
      travelStyles: user.travelStyles || [],
      preferences: user.preferences || [],
    },
  });
});

/**
 * Upsert current user profile in MongoDB
 * PUT /api/users/profile
 */
export const updateProfile = asyncHandler(async (req, res) => {
  const uid = req.uid;
  if (!uid) {
    throw new ValidationError("User identifier is required");
  }

  const {
    displayName,
    homeCity,
    currency,
    phoneNumber,
    bio,
    photoURL,
    travelStyles,
    preferences,
    email,
  } = req.body;

  const updateFields = {};
  if (displayName !== undefined) updateFields.displayName = String(displayName).trim();
  if (homeCity !== undefined) updateFields.homeCity = String(homeCity).trim();
  if (currency !== undefined) updateFields.currency = String(currency).trim();
  if (phoneNumber !== undefined) updateFields.phoneNumber = String(phoneNumber).trim();
  if (bio !== undefined) updateFields.bio = String(bio).trim();
  if (photoURL !== undefined) updateFields.photoURL = String(photoURL).trim();
  if (Array.isArray(travelStyles)) updateFields.travelStyles = travelStyles;
  if (Array.isArray(preferences)) updateFields.preferences = preferences;
  if (email) updateFields.email = String(email).trim().toLowerCase();

  // Find or create
  let user = await User.findOne({ firebaseUid: uid });
  if (!user) {
    user = new User({
      firebaseUid: uid,
      email: email || `${uid}@advenza.user`,
      ...updateFields,
    });
    await user.save();
  } else {
    Object.assign(user, updateFields);
    await user.save();
  }

  res.json({
    success: true,
    message: "Profile updated successfully",
    profile: {
      uid: user.firebaseUid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      homeCity: user.homeCity || "",
      currency: user.currency || "INR",
      phoneNumber: user.phoneNumber || "",
      bio: user.bio || "",
      travelStyles: user.travelStyles || [],
      preferences: user.preferences || [],
    },
  });
});
