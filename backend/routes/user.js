import express from "express";
import { verifyToken } from "../middleware/auth.js";
import { getProfile, updateProfile } from "../controllers/user.controller.js";

const router = express.Router();

// Enforce authentication across all user profile routes
router.use(verifyToken);

// GET /api/users/profile - Get current user's profile
router.get("/profile", getProfile);

// PUT /api/users/profile - Update current user's profile
router.put("/profile", updateProfile);

export default router;
