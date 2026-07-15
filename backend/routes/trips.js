import express from "express";
import Trip from "../models/Trip.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

// Apply auth to all routes
router.use(verifyToken);

// GET /api/trips — all trips for the authenticated user
router.get("/", async (req, res) => {
  try {
    const trips = await Trip.find({ createdBy: req.uid }).sort({ createdAt: -1 });
    res.json(trips);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/trips/:id — specific trip
router.get("/:id", async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ error: "Trip not found" });
    res.json(trip);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/trips — create trip (used internally by /api/ai/generate)
router.post("/", async (req, res) => {
  try {
    const tripData = { ...req.body, createdBy: req.uid || req.body.createdBy || "guest" };
    const newTrip = new Trip(tripData);
    const savedTrip = await newTrip.save();
    res.status(201).json(savedTrip);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/trips/:id
router.delete("/:id", async (req, res) => {
  try {
    const trip = await Trip.findOneAndDelete({ _id: req.params.id, createdBy: req.uid });
    if (!trip) return res.status(404).json({ error: "Trip not found or unauthorized" });
    res.json({ message: "Trip deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── BUDGET ROUTES ─────────────────────────────────────────────────────────────

// POST /api/trips/:id/expenses — add an expense
router.post("/:id/expenses", async (req, res) => {
  try {
    const { name, amount, category, date } = req.body;
    if (!name || !amount) return res.status(400).json({ error: "name and amount are required" });

    const trip = await Trip.findByIdAndUpdate(
      req.params.id,
      { $push: { expenses: { name, amount: parseFloat(amount), category, date } } },
      { new: true },
    );
    if (!trip) return res.status(404).json({ error: "Trip not found" });
    res.json(trip);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/trips/:id/expenses/:expenseId — remove an expense
router.delete("/:id/expenses/:expenseId", async (req, res) => {
  try {
    const trip = await Trip.findByIdAndUpdate(
      req.params.id,
      { $pull: { expenses: { _id: req.params.expenseId } } },
      { new: true },
    );
    res.json(trip);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GROUP ROUTES ───────────────────────────────────────────────────────────────

// POST /api/trips/:id/members — invite a member
router.post("/:id/members", async (req, res) => {
  try {
    const { name, email } = req.body;
    if (!email) return res.status(400).json({ error: "email is required" });
    const initials = email.split("@")[0].slice(0, 2).toUpperCase();

    const trip = await Trip.findByIdAndUpdate(
      req.params.id,
      {
        $push: {
          members: {
            name: name || email,
            email,
            role: "Pending",
            initials,
            color: "bg-muted text-foreground",
          },
        },
      },
      { new: true },
    );
    res.json(trip);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/trips/:id/vote — cast a vote
router.post("/:id/vote", async (req, res) => {
  try {
    const { optionName, uid } = req.body;
    const voterId = uid || req.uid;
    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ error: "Trip not found" });

    // Remove user's existing vote from all options
    trip.voteOptions.forEach((o) => {
      o.voters = o.voters.filter((v) => v !== voterId);
      o.votes = o.voters.length;
    });

    // Add vote to specified option
    const option = trip.voteOptions.find((o) => o.name === optionName);
    if (option) {
      option.voters.push(voterId);
      option.votes = option.voters.length;
    }

    await trip.save();
    res.json(trip);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
