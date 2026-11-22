import express from "express";
import {
  searchFlights,
  getFlightStatus,
  searchHotels,
  getWeatherForecast,
  createPriceWatch,
  listPriceWatches,
  getPriceWatchDetails,
  updatePriceWatch,
  deletePriceWatch,
  lookupAirports,
} from "../controllers/travel.controller.js";
import { verifyToken } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { travelSearchLimiter, priceWatchLimiter } from "../middleware/rateLimiter.js";
import {
  flightSearchSchema,
  flightStatusSchema,
  hotelSearchSchema,
  weatherQuerySchema,
  createPriceWatchSchema,
  updatePriceWatchSchema,
} from "../schemas/travel.schemas.js";

const router = express.Router();

// All travel intelligence endpoints require authentication
router.use(verifyToken);

// ─── Search & Status Endpoints ───────────────────────────────────────────────
router.get(
  "/flights/search",
  travelSearchLimiter,
  validate({ query: flightSearchSchema }),
  searchFlights
);

router.get(
  "/flights/status",
  travelSearchLimiter,
  validate({ query: flightStatusSchema }),
  getFlightStatus
);

router.get(
  "/hotels/search",
  travelSearchLimiter,
  validate({ query: hotelSearchSchema }),
  searchHotels
);

router.get(
  "/weather",
  travelSearchLimiter,
  validate({ query: weatherQuerySchema }),
  getWeatherForecast
);

router.get(
  "/airports",
  travelSearchLimiter,
  lookupAirports
);

// ─── Price Watch Endpoints ───────────────────────────────────────────────────
router.post(
  "/watches",
  priceWatchLimiter,
  validate({ body: createPriceWatchSchema }),
  createPriceWatch
);

router.get("/watches", listPriceWatches);

router.get("/watches/:id", getPriceWatchDetails);

router.patch(
  "/watches/:id",
  validate({ body: updatePriceWatchSchema }),
  updatePriceWatch
);

router.delete("/watches/:id", deletePriceWatch);

export default router;
