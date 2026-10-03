import Trip from "../models/Trip.js";
import Expense from "../models/Expense.js";
import Memory from "../models/Memory.js";
import { budgetService } from "../services/budget/budget.service.js";
import { normalizeTime } from "../services/itinerary/itinerary-sanitizer.js";
import { fetchDestinationImage } from "../services/media/destination-image.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { NotFoundError, ForbiddenError, ValidationError } from "../utils/errors.js";

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

const userHasTripAccess = (trip, uid, userEmail = "") => {
  if (!trip || !uid) return false;
  if (String(trip.createdBy) === String(uid)) return true;
  const normEmail = userEmail ? userEmail.trim().toLowerCase() : "";
  if (
    Array.isArray(trip.members) &&
    trip.members.some(
      (m) =>
        (m.userId && String(m.userId) === String(uid)) ||
        (m.email && m.email.trim().toLowerCase() === String(uid).toLowerCase()) ||
        (normEmail && m.email && m.email.trim().toLowerCase() === normEmail)
    )
  ) {
    return true;
  }
  return false;
};

export const listTrips = asyncHandler(async (req, res) => {
  const normEmail = req.userEmail ? req.userEmail.trim().toLowerCase() : null;
  const orConditions = [{ createdBy: req.uid }, { "members.userId": req.uid }];
  if (normEmail) {
    orConditions.push({ "members.email": normEmail });
  }

  const trips = await Trip.find({
    $or: orConditions,
  })
    .sort({ createdAt: -1 })
    .lean();

  const result = await Promise.all(
    trips.map(async (trip) => {
      // Backfill missing hero image if trip has destination
      if (trip.destination && (!trip.heroImage?.url || !trip.heroImage?.destination)) {
        try {
          const img = await fetchDestinationImage(trip.destination);
          trip.heroImage = img;
          Trip.findByIdAndUpdate(trip._id, { $set: { heroImage: img } }).catch(() => {});
        } catch {
          // ignore
        }
      }

      if (!trip.voteOptions || trip.voteOptions.length === 0) {
        trip.voteOptions = DEFAULT_VOTE_OPTIONS.map((o) => ({ ...o, voters: [] }));
      }

      const isOrganizer = String(trip.createdBy) === String(req.uid);
      trip.isOrganizer = isOrganizer;
      trip.userRole = isOrganizer ? "organizer" : "member";

      // If user is not the organizer, sanitize members so pending invites are not leaked
      if (!isOrganizer && Array.isArray(trip.members)) {
        trip.members = trip.members.filter((m) => m.role !== "Pending");
      }

      return trip;
    })
  );

  res.json(result);
});

export const getTripById = asyncHandler(async (req, res) => {
  const trip = await Trip.findById(req.params.id).lean();
  if (!trip) throw new NotFoundError("Trip not found");

  if (!userHasTripAccess(trip, req.uid, req.userEmail)) {
    throw new ForbiddenError("Forbidden: You do not have access to this trip");
  }

  // Backfill heroImage if missing or empty
  if (trip.destination && (!trip.heroImage?.url || !trip.heroImage?.destination)) {
    try {
      const img = await fetchDestinationImage(trip.destination);
      await Trip.findByIdAndUpdate(trip._id, { $set: { heroImage: img } });
      trip.heroImage = img;
    } catch {
      // ignore
    }
  }

  if (!trip.voteOptions || trip.voteOptions.length === 0) {
    trip.voteOptions = DEFAULT_VOTE_OPTIONS.map((o) => ({ ...o, voters: [] }));
  }

  const isOrganizer = String(trip.createdBy) === String(req.uid);
  trip.isOrganizer = isOrganizer;
  trip.userRole = isOrganizer ? "organizer" : "member";

  // If user is not the organizer, sanitize members so pending invites are not leaked
  if (!isOrganizer && Array.isArray(trip.members)) {
    trip.members = trip.members.filter((m) => m.role !== "Pending");
  }

  res.json(trip);
});

export const createTrip = asyncHandler(async (req, res) => {
  let heroImage = req.body.heroImage;
  if (!heroImage?.url && req.body.destination) {
    heroImage = await fetchDestinationImage(req.body.destination);
  }

  const tripData = {
    ...req.body,
    heroImage: heroImage || undefined,
    createdBy: req.uid || req.body.createdBy || "guest",
    voteOptions:
      req.body.voteOptions && req.body.voteOptions.length > 0
        ? req.body.voteOptions
        : DEFAULT_VOTE_OPTIONS.map((o) => ({ ...o, voters: [] })),
  };
  const newTrip = new Trip(tripData);
  const savedTrip = await newTrip.save();
  res.status(201).json(savedTrip);
});

export const updateTrip = asyncHandler(async (req, res) => {
  const trip = await Trip.findOne({ _id: req.params.id, createdBy: req.uid });
  if (!trip) throw new NotFoundError("Trip not found or unauthorized");

  const prevDest = trip.destination;
  const newDest = req.body.destination;

  const allowedFields = [
    "title",
    "origin",
    "destination",
    "startDate",
    "endDate",
    "style",
    "interests",
    "travelers",
    "summary",
    "budgetTotal",
    "travelMode",
    "departureHub",
    "arrivalHub",
    "transitRef",
    "departureTime",
    "arrivalTime",
    "outboundJourney",
    "returnJourney",
    "tripTiming",
    "hotelName",
    "hotelLocation",
    "checkInTime",
    "checkOutTime",
  ];
  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      trip[field] = req.body[field];
    }
  });

  // If destination changed or heroImage missing: re-resolve image
  if (
    newDest &&
    newDest.trim() &&
    (!prevDest ||
      newDest.toLowerCase().trim() !== prevDest.toLowerCase().trim() ||
      !trip.heroImage?.url ||
      trip.heroImage.destination?.toLowerCase() !== newDest.toLowerCase().trim())
  ) {
    trip.heroImage = await fetchDestinationImage(newDest);
    trip.markModified("heroImage");
  }

  trip.updatedAt = new Date();
  const saved = await trip.save();
  res.json(saved);
});

export const deleteTrip = asyncHandler(async (req, res) => {
  const trip = await Trip.findOneAndDelete({ _id: req.params.id, createdBy: req.uid });
  if (!trip) throw new NotFoundError("Trip not found or unauthorized");

  // Cascade cleanup: delete expenses and soft-delete/archive associated memories
  await Promise.all([
    Expense.deleteMany({ tripId: req.params.id }),
    Memory.updateMany(
      { tripId: req.params.id },
      { $set: { isDeleted: true, status: "deleted", deletedAt: new Date() } }
    ),
  ]);

  res.json({ message: "Trip and associated resources deleted" });
});

export const addExpense = asyncHandler(async (req, res) => {
  const { name, amount, category, date } = req.body;
  const trip = await Trip.findById(req.params.id);
  if (!trip) throw new NotFoundError("Trip not found");

  if (!userHasTripAccess(trip, req.uid, req.userEmail)) {
    throw new ForbiddenError("Forbidden: You do not have access to this trip");
  }

  const parsedAmount = parseFloat(amount);
  const expenseDate = date || new Date().toISOString().slice(0, 10);

  // Delegate to budgetService for robust multi-currency, typing and synchronizing
  await budgetService.addExpense(trip._id, req.uid, {
    name,
    amount: parsedAmount,
    category: category || "General",
    date: expenseDate,
    source: "User",
  });

  const updatedTrip = await Trip.findById(req.params.id);
  res.json(updatedTrip);
});

export const deleteExpense = asyncHandler(async (req, res) => {
  const trip = await Trip.findById(req.params.id);
  if (!trip) throw new NotFoundError("Trip not found");

  if (!userHasTripAccess(trip, req.uid, req.userEmail)) {
    throw new ForbiddenError("Forbidden: You do not have access to this trip");
  }

  // Delegate to budgetService for soft-delete and cascade cleanup
  await budgetService.deleteExpense(req.params.expenseId, trip._id);

  const updatedTrip = await Trip.findById(req.params.id);
  res.json(updatedTrip);
});


export const castVote = asyncHandler(async (req, res) => {
  const { optionName } = req.body;
  const voterId = req.uid;

  const trip = await Trip.findById(req.params.id);
  if (!trip) throw new NotFoundError("Trip not found");

  if (!userHasTripAccess(trip, req.uid, req.userEmail)) {
    throw new ForbiddenError("Forbidden: You do not have access to this trip");
  }

  ensureVoteOptions(trip);

  trip.voteOptions.forEach((o) => {
    o.voters = (o.voters || []).filter((v) => String(v) !== String(voterId));
    o.votes = o.voters.length;
  });

  let option = trip.voteOptions.find((o) => o.name === optionName);
  if (!option) {
    trip.voteOptions.push({ name: optionName, votes: 0, voters: [] });
    option = trip.voteOptions[trip.voteOptions.length - 1];
  }

  if (!option.voters.map(String).includes(String(voterId))) {
    option.voters.push(String(voterId));
  }

  trip.voteOptions.forEach((o) => {
    o.votes = o.voters.length;
  });

  await trip.save();
  res.json(trip);
});

export const addVoteOption = asyncHandler(async (req, res) => {
  const { name } = req.body;
  const trip = await Trip.findById(req.params.id);
  if (!trip) throw new NotFoundError("Trip not found");

  if (!userHasTripAccess(trip, req.uid, req.userEmail)) {
    throw new ForbiddenError("Forbidden: You do not have access to this trip");
  }

  ensureVoteOptions(trip);

  const trimmed = name.trim();
  if (trip.voteOptions.some((o) => o.name.toLowerCase() === trimmed.toLowerCase())) {
    throw new ValidationError("Option already exists");
  }

  trip.voteOptions.push({ name: trimmed, votes: 0, voters: [] });
  await trip.save();
  res.json(trip);
});

export const patchItinerary = asyncHandler(async (req, res) => {
  const { days } = req.body;

  const trip = await Trip.findOne({ _id: req.params.id, createdBy: req.uid });
  if (!trip) {
    throw new NotFoundError("Trip not found or unauthorized");
  }

  const sanitiseDays = (rawDays) =>
    rawDays.map((d) => ({
      dayNumber: Number(d.dayNumber),
      date: d.date || "",
      title: d.title || "",
      activities: (d.activities || []).map((a) => ({
        time: normalizeTime(a.time || ""),
        description: a.description || "",
      })),
    }));

  const proposedMap = new Map(sanitiseDays(days).map((d) => [d.dayNumber, d]));

  const mergedDays = trip.days.map((origDay) => {
    const patch = proposedMap.get(Number(origDay.dayNumber));
    if (patch) {
      return patch;
    }
    return {
      dayNumber: Number(origDay.dayNumber),
      date: origDay.date || "",
      title: origDay.title || "",
      activities: (origDay.activities || []).map((a) => ({
        time: a.time || "",
        description: a.description || "",
      })),
    };
  });

  trip.days = mergedDays;
  trip.markModified("days");
  const savedTrip = await trip.save();
  res.json(savedTrip);
});
