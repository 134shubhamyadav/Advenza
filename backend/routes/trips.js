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

// PUT /api/trips/:id/itinerary — smart-patch: replace only the supplied days, preserve the rest
router.put("/:id/itinerary", async (req, res) => {
  try {
    const { days } = req.body;

    console.log(`[PUT /itinerary] tripId=${req.params.id} uid=${req.uid}`);
    console.log(`[PUT /itinerary] received days count: ${Array.isArray(days) ? days.length : "MISSING"}`);

    if (!days || !Array.isArray(days) || days.length === 0) {
      console.error("[PUT /itinerary] Validation failed — days array is missing or empty");
      return res.status(400).json({ error: "days array is required and must not be empty" });
    }

    // Load the trip and verify ownership
    const trip = await Trip.findOne({ _id: req.params.id, createdBy: req.uid });
    if (!trip) {
      console.error("[PUT /itinerary] Trip not found or user does not own it");
      return res.status(404).json({ error: "Trip not found or unauthorized" });
    }

    console.log(`[PUT /itinerary] existing days count: ${trip.days.length}`);

    // Strip _id / __v from incoming subdocuments so Mongoose doesn't choke on
    // ObjectId mismatches when merging frontend-serialised day objects.
    const sanitiseDays = (rawDays) =>
      rawDays.map((d) => ({
        dayNumber: d.dayNumber,
        date:      d.date      || "",
        title:     d.title     || "",
        activities: (d.activities || []).map((a) => ({
          time:        a.time        || "",
          description: a.description || "",
        })),
      }));

    // Build the merged days array: proposed days overwrite matching dayNumbers,
    // all other original days are preserved exactly.
    const proposedMap = new Map(
      sanitiseDays(days).map((d) => [d.dayNumber, d])
    );

    const mergedDays = trip.days.map((origDay) => {
      const patch = proposedMap.get(origDay.dayNumber);
      if (patch) {
        console.log(`[PUT /itinerary] patching Day ${origDay.dayNumber}`);
        return patch;
      }
      return {
        dayNumber:  origDay.dayNumber,
        date:       origDay.date || "",
        title:      origDay.title || "",
        activities: (origDay.activities || []).map((a) => ({
          time:        a.time        || "",
          description: a.description || "",
        })),
      };
    });

    console.log(`[PUT /itinerary] merged days count: ${mergedDays.length}`);

    // Replace the days array and save — this fires the pre-save hook (updatedAt)
    trip.days = mergedDays;
    const savedTrip = await trip.save();

    console.log(`[PUT /itinerary] ✅ Saved. days count: ${savedTrip.days.length}`);
    res.json(savedTrip);
  } catch (err) {
    console.error("[PUT /itinerary] ❌ Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});


export default router;
