import { flightProvider } from "../services/travel/providers/flight.provider.js";
import { hotelProvider } from "../services/travel/providers/hotel.provider.js";
import { weatherProvider } from "../services/travel/providers/weather.provider.js";
import { transportProvider } from "../services/travel/providers/transport.provider.js";
import { travelCacheService, CACHE_TTLS } from "../services/travel/travel-cache.service.js";
import { airportLookupService } from "../services/travel/airport-lookup.service.js";
import PriceWatch from "../models/PriceWatch.js";
import PriceHistory from "../models/PriceHistory.js";
import Trip from "../models/Trip.js";
import { processSingleWatch } from "../services/price-watch/price-watch.worker.js";
import { logger } from "../utils/logger.js";

const MAX_ACTIVE_WATCHES_PER_USER = 10;

/**
 * GET /api/travel/flights/search
 */
export async function searchFlights(req, res, next) {
  try {
    const params = req.query;
    const cacheKey = travelCacheService.flightSearchKey(params);
    const cached = await travelCacheService.get(cacheKey);

    if (cached) {
      return res.status(200).json({
        success: true,
        ...cached.data,
        isCached: true,
        cachedAt: cached.lastUpdated,
      });
    }

    const data = await flightProvider.searchFlights(params);
    await travelCacheService.set(cacheKey, data, CACHE_TTLS.FLIGHT_SEARCH, data.provider);

    return res.status(200).json({
      success: true,
      ...data,
      isCached: false,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/travel/flights/status
 */
export async function getFlightStatus(req, res, next) {
  try {
    const { flightNumber, date } = req.query;
    const cacheKey = travelCacheService.flightStatusKey(flightNumber, date);
    const cached = await travelCacheService.get(cacheKey);

    if (cached) {
      return res.status(200).json({
        success: true,
        status: cached.data,
        isCached: true,
      });
    }

    const status = await flightProvider.getFlightStatus({ flightNumber, date });
    await travelCacheService.set(cacheKey, status, CACHE_TTLS.FLIGHT_STATUS, status.provider);

    return res.status(200).json({
      success: true,
      status,
      isCached: false,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/travel/hotels/search
 */
export async function searchHotels(req, res, next) {
  try {
    const params = req.query;
    const cacheKey = travelCacheService.hotelSearchKey(params);
    const cached = await travelCacheService.get(cacheKey);

    if (cached) {
      return res.status(200).json({
        success: true,
        ...cached.data,
        isCached: true,
        cachedAt: cached.lastUpdated,
      });
    }

    const data = await hotelProvider.searchHotels(params);
    await travelCacheService.set(cacheKey, data, CACHE_TTLS.HOTEL_SEARCH, data.provider);

    return res.status(200).json({
      success: true,
      ...data,
      isCached: false,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/travel/weather
 */
export async function getWeatherForecast(req, res, next) {
  try {
    const { destination, days = 5 } = req.query;
    const cacheKey = travelCacheService.weatherKey(destination);
    const cached = await travelCacheService.get(cacheKey);

    if (cached) {
      return res.status(200).json({
        success: true,
        ...cached.data,
        isCached: true,
        cachedAt: cached.lastUpdated,
      });
    }

    const data = await weatherProvider.getFullForecast(destination, parseInt(days, 10));
    await travelCacheService.set(cacheKey, data, CACHE_TTLS.WEATHER, data.source);

    return res.status(200).json({
      success: true,
      ...data,
      isCached: false,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/travel/watches
 * Create a new PriceWatch with baseline price retrieval.
 */
export async function createPriceWatch(req, res, next) {
  try {
    const userId = req.uid || req.user?.id || req.user?._id;
    const {
      tripId,
      type,
      origin,
      destination,
      departureDate,
      returnDate,
      passengers,
      cabin,
      checkIn,
      checkOut,
      guests,
      rooms,
      hotelName,
      targetPrice,
      alertCondition,
      alertThresholdPercent,
    } = req.body;

    // Check user limit
    const activeCount = await PriceWatch.countDocuments({ userId, status: "active" });
    if (activeCount >= MAX_ACTIVE_WATCHES_PER_USER) {
      return res.status(400).json({
        success: false,
        message: `Maximum active watches limit (${MAX_ACTIVE_WATCHES_PER_USER}) reached. Pause or delete old watches to create new ones.`,
      });
    }

    // Verify trip access if provided
    if (tripId) {
      const trip = await Trip.findOne({
        _id: tripId,
        $or: [{ createdBy: userId }, { userId }, { "members.userId": userId }],
      });
      if (!trip) {
        return res.status(404).json({ success: false, message: "Trip not found or unauthorized" });
      }
    }

    const watch = await PriceWatch.create({
      userId,
      tripId: tripId || null,
      type,
      origin,
      destination,
      departureDate,
      returnDate,
      passengers,
      cabin,
      checkIn,
      checkOut,
      guests,
      rooms,
      hotelName,
      targetPrice,
      alertCondition,
      alertThresholdPercent,
      status: "active",
      nextCheckAt: new Date(),
    });

    // Run immediate baseline observation
    processSingleWatch(watch).catch((err) => {
      logger.warn(`[PriceWatch] Immediate baseline check error: ${err.message}`);
    });

    return res.status(201).json({
      success: true,
      message: "Price watch activated. Advenza will monitor fares in the background.",
      watch,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/travel/watches
 */
export async function listPriceWatches(req, res, next) {
  try {
    const userId = req.uid || req.user?.id || req.user?._id;
    const { tripId } = req.query;

    const query = { userId, status: { $ne: "deleted" } };
    if (tripId) query.tripId = tripId;

    const watches = await PriceWatch.find(query)
      .sort({ createdAt: -1 })
      .populate("tripId", "title destination")
      .lean();

    return res.status(200).json({
      success: true,
      watches,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/travel/watches/:id
 */
export async function getPriceWatchDetails(req, res, next) {
  try {
    const userId = req.uid || req.user?.id || req.user?._id;
    const { id } = req.params;

    const watch = await PriceWatch.findOne({ _id: id, userId }).lean();
    if (!watch) {
      return res.status(404).json({ success: false, message: "Price watch not found" });
    }

    const history = await PriceHistory.find({ watchId: id })
      .sort({ observedAt: -1 })
      .limit(30)
      .lean();

    return res.status(200).json({
      success: true,
      watch,
      history: history.reverse(), // Ascending for charting
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/travel/watches/:id
 */
export async function updatePriceWatch(req, res, next) {
  try {
    const userId = req.uid || req.user?.id || req.user?._id;
    const { id } = req.params;
    const updates = req.body;

    const watch = await PriceWatch.findOneAndUpdate(
      { _id: id, userId },
      { $set: updates },
      { new: true }
    );

    if (!watch) {
      return res.status(404).json({ success: false, message: "Price watch not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Price watch updated",
      watch,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/travel/watches/:id
 */
export async function deletePriceWatch(req, res, next) {
  try {
    const userId = req.uid || req.user?.id || req.user?._id;
    const { id } = req.params;

    const watch = await PriceWatch.findOneAndUpdate(
      { _id: id, userId },
      { status: "deleted" },
      { new: true }
    );

    if (!watch) {
      return res.status(404).json({ success: false, message: "Price watch not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Price watch cancelled",
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/travel/airports
 * Operational airport lookup, search, and nearby geographic discovery
 */
export async function lookupAirports(req, res, next) {
  try {
    const { q, city, code, lat, lng, radiusKm, onlyScheduled } = req.query;
    const isOnlyScheduled = onlyScheduled === "true" || onlyScheduled === true;

    if (lat && lng) {
      const nearby = airportLookupService.findNearbyAirports({
        latitude: parseFloat(lat),
        longitude: parseFloat(lng),
        maxRadiusKm: radiusKm ? parseFloat(radiusKm) : 250,
        onlyScheduled: isOnlyScheduled,
      });
      return res.status(200).json({ success: true, count: nearby.length, data: nearby });
    }

    if (code) {
      const match = airportLookupService.findAirportByCode(code);
      return res.status(200).json({ success: true, count: match ? 1 : 0, data: match ? [match] : [] });
    }

    if (city) {
      const matches = airportLookupService.findAirportsByCity(city);
      return res.status(200).json({ success: true, count: matches.length, data: matches });
    }

    if (q) {
      const results = airportLookupService.searchAirports(q, {
        onlyScheduled: isOnlyScheduled,
      });
      return res.status(200).json({ success: true, count: results.length, data: results });
    }

    const all = airportLookupService.getAllAirports({ onlyScheduled: isOnlyScheduled });
    return res.status(200).json({
      success: true,
      count: all.length,
      metadata: airportLookupService.getMetadata(),
      data: all,
    });
  } catch (err) {
    next(err);
  }
}
