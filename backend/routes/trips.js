import express from "express";
import Trip from "../models/Trip.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

/**
 * Normalizes any time string to 24-hour HH:mm format.
 * Handles "2:30 PM" → "14:30", "14:30" → "14:30", "9:15 AM" → "09:15", etc.
 */
function normalizeTimeTo24h(timeStr) {
  if (!timeStr) return "";
  const cleaned = String(timeStr).trim().toUpperCase();

  // 12-hour AM/PM (e.g. "2:30 PM", "2 PM", "02:30PM")
  const ampmMatch = cleaned.match(/^(\d{1,2})(?:[:.]?(\d{2}))?\s*(AM|PM)$/);
  if (ampmMatch) {
    let h = parseInt(ampmMatch[1], 10);
    const m = ampmMatch[2] ? parseInt(ampmMatch[2], 10) : 0;
    const ampm = ampmMatch[3];
    if (ampm === "PM" && h < 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  // 24-hour (e.g. "14:30", "9:15")
  const h24Match = cleaned.match(/^(\d{1,2})[:.:](\d{2})$/);
  if (h24Match) {
    const h = parseInt(h24Match[1], 10);
    const m = parseInt(h24Match[2], 10);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59)
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  // 4-digit military (e.g. "1430")
  if (/^\d{4}$/.test(cleaned)) {
    const h = parseInt(cleaned.slice(0, 2), 10);
    const m = parseInt(cleaned.slice(2), 10);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59)
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  return timeStr; // return as-is if unrecognized
}



const DEFAULT_VOTE_OPTIONS = [
  { name: "Sightseeing & Cultural Landmarks", votes: 0, voters: [] },
  { name: "Relaxed Beach & Local Food Tour", votes: 0, voters: [] },
  { name: "Vibrant Nightlife & Evening Experiences", votes: 0, voters: [] },
  { name: "Nature, Hiking & Outdoor Adventure", votes: 0, voters: [] },
];

const ensureVoteOptions = (trip) => {
  if (!trip.voteOptions || trip.voteOptions.length === 0) {
    trip.voteOptions = DEFAULT_VOTE_OPTIONS.map((o) => ({ ...o, voters: [] }));
  }
};

// Apply auth to all routes
router.use(verifyToken);

// GET /api/trips — all trips for the authenticated user
router.get("/", async (req, res) => {
  try {
    const trips = await Trip.find({ createdBy: req.uid }).sort({ createdAt: -1 }).lean();
    const result = trips.map((trip) => {
      if (!trip.voteOptions || trip.voteOptions.length === 0) {
        return {
          ...trip,
          voteOptions: DEFAULT_VOTE_OPTIONS.map((o) => ({ ...o, voters: [] })),
        };
      }
      return trip;
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/trips/:id — specific trip
router.get("/:id", async (req, res) => {
  try {
    const trip = await Trip.findById(req.params.id).lean();
    if (!trip) return res.status(404).json({ error: "Trip not found" });
    if (!trip.voteOptions || trip.voteOptions.length === 0) {
      trip.voteOptions = DEFAULT_VOTE_OPTIONS.map((o) => ({ ...o, voters: [] }));
    }
    res.json(trip);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/trips — create trip (used internally by /api/ai/generate)
router.post("/", async (req, res) => {
  try {
    const tripData = {
      ...req.body,
      createdBy: req.uid || req.body.createdBy || "guest",
      voteOptions:
        req.body.voteOptions && req.body.voteOptions.length > 0
          ? req.body.voteOptions
          : DEFAULT_VOTE_OPTIONS.map((o) => ({ ...o, voters: [] })),
    };
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
    if (!optionName) return res.status(400).json({ error: "optionName is required" });

    const voterId = uid || req.uid;
    if (!voterId) return res.status(401).json({ error: "User ID is required to vote" });

    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ error: "Trip not found" });

    ensureVoteOptions(trip);

    // Remove user's existing vote from all options
    trip.voteOptions.forEach((o) => {
      o.voters = (o.voters || []).filter((v) => String(v) !== String(voterId));
      o.votes = o.voters.length;
    });

    // Add vote to specified option (or create if missing)
    let option = trip.voteOptions.find((o) => o.name === optionName);
    if (!option) {
      trip.voteOptions.push({ name: optionName, votes: 0, voters: [] });
      option = trip.voteOptions[trip.voteOptions.length - 1];
    }

    if (!option.voters.map(String).includes(String(voterId))) {
      option.voters.push(String(voterId));
    }

    // Recalculate votes counts
    trip.voteOptions.forEach((o) => {
      o.votes = o.voters.length;
    });

<<<<<<< HEAD
    await trip.save();
    res.json(trip);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/trips/:id/options — add a custom vote option / proposal
router.post("/:id/options", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: "Option name is required" });

    const trip = await Trip.findById(req.params.id);
    if (!trip) return res.status(404).json({ error: "Trip not found" });

    ensureVoteOptions(trip);

    const trimmed = name.trim();
    if (trip.voteOptions.some((o) => o.name.toLowerCase() === trimmed.toLowerCase())) {
      return res.status(400).json({ error: "Option already exists" });
    }

    trip.voteOptions.push({ name: trimmed, votes: 0, voters: [] });
=======
>>>>>>> 6cf8129f1b59a8dafea26d19fadc7d6e6c81c6f4
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
          time:        normalizeTimeTo24h(a.time || ""),
          description: a.description || "",
        })),
      }));

    // Build the merged days array: proposed days overwrite matching dayNumbers,
    // all other original days are preserved exactly.
    const proposedMap = new Map(
      sanitiseDays(days).map((d) => [Number(d.dayNumber), d])
    );

    const mergedDays = trip.days.map((origDay) => {
      const patch = proposedMap.get(Number(origDay.dayNumber));
      if (patch) {
        console.log(`[PUT /itinerary] patching Day ${origDay.dayNumber}`);
        return patch;
      }
      return {
        dayNumber:  Number(origDay.dayNumber),
        date:       origDay.date || "",
        title:      origDay.title || "",
        activities: (origDay.activities || []).map((a) => ({
          time:        a.time        || "",
          description: a.description || "",
        })),
      };
    });

    console.log(`[PUT /itinerary] merged days count: ${mergedDays.length}`);

    // Replace the days array and save — explicitly marking modified so Mongoose
    // always detects the nested-array mutation even if Versionless keys are reused.
    trip.days = mergedDays;
    trip.markModified("days");
    const savedTrip = await trip.save();

    console.log(`[PUT /itinerary] ✅ Saved. days count: ${savedTrip.days.length}`);
    res.json(savedTrip);
  } catch (err) {
    console.error("[PUT /itinerary] ❌ Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});


export default router;
