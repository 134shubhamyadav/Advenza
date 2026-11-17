/**
 * Journey Calculation Engine — Central source of truth for travel duration
 * and timing computations in Advenza.
 *
 * Responsibilities:
 *   1. Calculate outbound & return journey durations using available providers.
 *   2. Preserve user-provided timestamps (highest priority).
 *   3. Detect overnight / multi-day journeys from actual date boundaries.
 *   4. Produce structured JourneyLeg + TripTiming metadata.
 *   5. Handle provider unavailability gracefully — never crash the request.
 *   6. Never fabricate train/bus/ferry/flight schedules.
 *
 * Duration Sources (priority order):
 *   USER_SPECIFIED   — User explicitly provided departure + arrival timestamps.
 *   SCHEDULED        — Data from a verified schedule provider (Amadeus, etc.).
 *   CALCULATED_MAPS  — Google Maps Directions API result.
 *   ESTIMATED_HAVERSINE — Geodesic distance × road-winding / speed heuristic.
 *   UNAVAILABLE      — No data could be obtained.
 */

import { transportProvider } from "./providers/transport.provider.js";
import { flightProvider, resolveAirportCode } from "./providers/flight.provider.js";
import { railcoreProvider } from "../ai/providers/railcore.provider.js";
import { travelCacheService, CACHE_TTLS } from "./travel-cache.service.js";
import { calculateDestinationWindows } from "./destination-window.service.js";
import { logger } from "../../utils/logger.js";

// ─── Time / Date Helpers ──────────────────────────────────────────────────────

/**
 * Build a Date from separate YYYY-MM-DD and HH:mm strings.
 * Returns null when either part is missing or malformed.
 */
function buildDateTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  const datePart = String(dateStr).trim();
  const timePart = String(timeStr).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null;
  if (!/^\d{1,2}:\d{2}$/.test(timePart)) return null;
  const [h, m] = timePart.split(":").map(Number);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  const [y, mo, d] = datePart.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h, m, 0));
}

/**
 * Calculate duration in minutes between two Date objects.
 */
function durationBetween(dt1, dt2) {
  if (!dt1 || !dt2) return null;
  return Math.round(Math.abs(dt2.getTime() - dt1.getTime()) / 60000);
}

/**
 * Count distinct calendar days touched by a journey.
 * E.g. departure 2026-10-10, arrival 2026-10-12 → 3 calendar days.
 */
function calendarDaysBetween(depDate, arrDate) {
  if (!depDate || !arrDate) return 0;
  const dep = typeof depDate === "string" ? depDate : depDate.toISOString().split("T")[0];
  const arr = typeof arrDate === "string" ? arrDate : arrDate.toISOString().split("T")[0];
  const [dy, dm, dd] = dep.split("-").map(Number);
  const [ay, am, ad] = arr.split("-").map(Number);
  const depUtc = Date.UTC(dy, dm - 1, dd);
  const arrUtc = Date.UTC(ay, am - 1, ad);
  return Math.max(1, Math.round((arrUtc - depUtc) / 86400000) + 1);
}

/**
 * Determine whether a journey crosses a midnight boundary.
 */
function isOvernightJourney(departureDt, arrivalDt) {
  if (!departureDt || !arrivalDt) return false;
  const depDay = departureDt.toISOString().split("T")[0];
  const arrDay = arrivalDt.toISOString().split("T")[0];
  return depDay !== arrDay;
}

// ─── Journey Leg Calculator ──────────────────────────────────────────────────

/**
 * Calculate a single journey leg (outbound or return).
 *
 * @param {Object} leg - JourneyLeg data from Trip or request body.
 * @param {Object} options
 * @param {string} options.origin - Origin city name (fallback).
 * @param {string} options.destination - Destination city name (fallback).
 * @returns {Promise<Object>} Enriched JourneyLeg with calculated fields.
 */
export async function calculateJourneyLeg(leg, options = {}) {
  const result = {
    transportType: leg.transportType || "",
    departureLocation: leg.departureLocation || options.origin || "",
    arrivalLocation: leg.arrivalLocation || options.destination || "",
    departureDate: leg.departureDate || "",
    departureTime: leg.departureTime || "",
    arrivalDate: leg.arrivalDate || "",
    arrivalTime: leg.arrivalTime || "",
    durationMinutes: leg.durationMinutes ?? null,
    durationSource: leg.durationSource || "",
    transitRef: leg.transitRef || "",
    status: leg.status || "ESTIMATED",
    booked: Boolean(leg.booked),
    ticketRef: leg.ticketRef || "",
  };

  try {
    // ── STEP 1: User-provided full timestamps take absolute priority ────────
    const departureDt = buildDateTime(result.departureDate, result.departureTime);
    const arrivalDt = buildDateTime(result.arrivalDate, result.arrivalTime);

    if (departureDt && arrivalDt) {
      const userDuration = durationBetween(departureDt, arrivalDt);
      if (userDuration != null && userDuration >= 0) {
        result.durationMinutes = userDuration;
        result.durationSource = result.durationSource || "USER_SPECIFIED";
        // Status: if booked or has a transit reference, mark CONFIRMED
        if (result.booked || result.transitRef) {
          result.status = "CONFIRMED";
        }
        return result;
      }
    }

    // ── STEP 2: Partial user data — departure date+time only ────────────────
    if (departureDt && !arrivalDt && result.durationMinutes != null) {
      // User gave duration but not arrival — keep as-is
      result.durationSource = result.durationSource || "USER_SPECIFIED";
      return result;
    }

    // ── STEP 3: Provider-based calculation based on transport type ───────────
    const mode = (result.transportType || "").toLowerCase().trim();
    const depLoc = result.departureLocation || options.origin || "";
    const arrLoc = result.arrivalLocation || options.destination || "";

    if (!depLoc || !arrLoc) {
      result.durationSource = result.durationSource || "UNAVAILABLE";
      result.status = "ESTIMATED";
      return result;
    }

    // ── 3a: Car / Road ──────────────────────────────────────────────────────
    if (mode === "car" || mode === "driving" || mode === "road" || mode === "self-drive") {
      return await _calculateRoadJourney(result, depLoc, arrLoc);
    }

    // ── 3b: Flight ──────────────────────────────────────────────────────────
    if (mode === "flight" || mode === "air" || mode === "airplane") {
      return await _calculateFlightJourney(result, depLoc, arrLoc);
    }

    // ── 3c: Train / Bus / Ferry — no schedule fabrication ───────────────────
    // These modes do NOT have reliable live providers in the current architecture.
    // We can still provide a road-distance based estimate for rough guidance,
    // but must clearly label it as such.
    if (mode === "train" || mode === "rail") {
      return await _calculateScheduleBasedJourney(result, depLoc, arrLoc, "train");
    }
    if (mode === "bus" || mode === "coach") {
      return await _calculateScheduleBasedJourney(result, depLoc, arrLoc, "bus");
    }
    if (mode === "ferry" || mode === "boat" || mode === "ship") {
      return await _calculateScheduleBasedJourney(result, depLoc, arrLoc, "ferry");
    }

    // ── 3d: Unknown / unspecified — try road estimate as baseline ────────────
    if (depLoc && arrLoc) {
      return await _calculateRoadJourney(result, depLoc, arrLoc);
    }
  } catch (err) {
    logger.warn(`[JourneyEngine] Error calculating leg: ${err.message}`);
    result.durationSource = result.durationSource || "UNAVAILABLE";
    result.status = "ESTIMATED";
  }

  return result;
}

// ─── Road / Car Journey ────────────────────────────────────────────────────────

async function _calculateRoadJourney(result, origin, destination) {
  try {
    // Check cache first
    const cacheKey = travelCacheService.transportKey(origin, destination, "driving");
    const cached = await travelCacheService.get(cacheKey);
    if (cached?.data) {
      result.durationMinutes = cached.data.estimatedDurationMins || cached.data.normalDurationMins || null;
      result.durationSource = cached.data.source === "LIVE_API" ? "CALCULATED_MAPS" : "ESTIMATED_HAVERSINE";
      result.status = "ESTIMATED";
      return result;
    }

    const routeData = await transportProvider.getRouteStatus({ origin, destination, mode: "driving" });

    if (routeData && routeData.estimatedDurationMins > 0) {
      result.durationMinutes = routeData.estimatedDurationMins;
      result.durationSource =
        routeData.source === "LIVE_API" || routeData.status === "LIVE"
          ? "CALCULATED_MAPS"
          : "ESTIMATED_HAVERSINE";
      result.status = "ESTIMATED";

      // Cache the result
      await travelCacheService.set(cacheKey, routeData, CACHE_TTLS.TRANSPORT, "Journey Engine").catch(() => {});
    } else {
      result.durationSource = "UNAVAILABLE";
      result.status = "ESTIMATED";
    }
  } catch (err) {
    logger.warn(`[JourneyEngine] Road calculation failed (${origin} → ${destination}): ${err.message}`);
    result.durationSource = "UNAVAILABLE";
    result.status = "ESTIMATED";
  }
  return result;
}

// ─── Flight Journey ───────────────────────────────────────────────────────────

async function _calculateFlightJourney(result, origin, destination) {
  try {
    if (!flightProvider.isConfigured()) {
      // Fall back to rough air-distance estimate: geodesic distance / ~800 km/h + 1h overhead
      return await _estimateFlightDuration(result, origin, destination);
    }

    // If we have a specific transit reference, try to look it up
    if (result.transitRef && result.departureDate) {
      const statusData = await flightProvider.getFlightStatus({
        flightNumber: result.transitRef,
        date: result.departureDate,
      });
      if (statusData?.status === "LIVE" && statusData.scheduledDeparture && statusData.scheduledArrival) {
        const depDt = new Date(statusData.scheduledDeparture);
        const arrDt = new Date(statusData.scheduledArrival);
        if (!isNaN(depDt.getTime()) && !isNaN(arrDt.getTime())) {
          result.durationMinutes = durationBetween(depDt, arrDt);
          result.durationSource = "SCHEDULED";
          result.status = "CONFIRMED";
          return result;
        }
      }
    }

    // Search for flights on the route
    if (result.departureDate) {
      const cacheKey = travelCacheService.flightSearchKey({
        origin: resolveAirportCode(origin),
        destination: resolveAirportCode(destination),
        date: result.departureDate,
      });
      const cached = await travelCacheService.get(cacheKey);
      if (cached?.data?.results?.length > 0) {
        const first = cached.data.results[0];
        result.durationMinutes = _parseFlightDuration(first.duration);
        result.durationSource = "SCHEDULED";
        result.status = "ESTIMATED";
        return result;
      }

      const searchResult = await flightProvider.searchFlights({
        origin,
        destination,
        departureDate: result.departureDate,
      });

      if (searchResult?.results?.length > 0) {
        const first = searchResult.results[0];
        result.durationMinutes = _parseFlightDuration(first.duration);
        result.durationSource = "SCHEDULED";
        result.status = "ESTIMATED";

        await travelCacheService.set(cacheKey, searchResult, CACHE_TTLS.FLIGHT_SEARCH, "Journey Engine").catch(() => {});
        return result;
      }
    }

    // Amadeus configured but no results — fall back to air estimate
    return await _estimateFlightDuration(result, origin, destination);
  } catch (err) {
    logger.warn(`[JourneyEngine] Flight calculation failed (${origin} → ${destination}): ${err.message}`);
    return await _estimateFlightDuration(result, origin, destination);
  }
}

/**
 * Parse Amadeus-style duration string like "2h15m", "PT2H15M" to minutes.
 */
function _parseFlightDuration(durStr) {
  if (!durStr) return null;
  const clean = String(durStr).toUpperCase().replace("PT", "");
  const hMatch = clean.match(/(\d+)\s*H/);
  const mMatch = clean.match(/(\d+)\s*M/);
  const hours = hMatch ? parseInt(hMatch[1], 10) : 0;
  const mins = mMatch ? parseInt(mMatch[1], 10) : 0;
  return hours * 60 + mins || null;
}

/**
 * Rough flight duration estimate: geodesic distance / ~800 km/h + 60 min ground overhead.
 */
async function _estimateFlightDuration(result, origin, destination) {
  try {
    const routeData = await transportProvider.getRouteStatus({ origin, destination, mode: "driving" });
    if (routeData?.distanceKm > 0) {
      // Revert road-winding factor to get approx. direct distance
      const directKm = Math.round(routeData.distanceKm / 1.25);
      const airTimeMinutes = Math.round((directKm / 800) * 60);
      // Add ground overhead (check-in, boarding, taxi, deplaning)
      result.durationMinutes = airTimeMinutes + 60;
      result.durationSource = "ESTIMATED_HAVERSINE";
      result.status = "ESTIMATED";
    } else {
      result.durationSource = "UNAVAILABLE";
      result.status = "ESTIMATED";
    }
  } catch {
    result.durationSource = "UNAVAILABLE";
    result.status = "ESTIMATED";
  }
  return result;
}

// ─── Schedule-Based Modes (Train / Bus / Ferry) ──────────────────────────────

/**
 * For modes where no live schedule API exists in the current architecture.
 * If user provided timestamps, those were already handled in Step 1.
 * Otherwise, provide a road-distance-based rough estimate and clearly mark it.
 *
 * Speed assumptions (conservative, based on Indian intercity averages):
 *   Train: ~55 km/h average (includes stops)
 *   Bus:   ~45 km/h average (includes stops)
 *   Ferry: ~30 km/h average
 *
 * These are NOT presented as live data. They are clearly labelled ESTIMATED_HAVERSINE.
 */
async function _calculateScheduleBasedJourney(result, origin, destination, mode) {
  // If Indian train mode and RailCore is configured, use live IRCTC schedule data
  if (mode === "train" && railcoreProvider.isConfigured()) {
    try {
      const railData = await railcoreProvider.resolveRailwayRoute({
        origin,
        destination,
        journeyDate: result.departureDate,
      });
      if (railData?.status === "SUCCESS" && railData?.recommendedTrain) {
        const train = railData.recommendedTrain;
        result.durationMinutes = train.durationMinutes;
        result.durationSource = "SCHEDULED";
        result.status = result.booked ? "CONFIRMED" : "SCHEDULED";
        if (!result.transitRef) {
          result.transitRef = `${train.trainNumber} - ${train.trainName}`;
        }
        if (!result.departureTime && train.departureTime) {
          result.departureTime = train.departureTime;
        }
        if (!result.arrivalTime && train.arrivalTime) {
          result.arrivalTime = train.arrivalTime;
        }
        return result;
      }
    } catch (railErr) {
      logger.warn(`[JourneyEngine] RailCore train lookup failed: ${railErr.message}`);
    }
  }

  const speeds = { train: 55, bus: 45, ferry: 30 };
  const avgSpeed = speeds[mode] || 50;

  try {
    const routeData = await transportProvider.getRouteStatus({ origin, destination, mode: "driving" });
    if (routeData?.distanceKm > 0) {
      // For rail, distance is roughly similar to road distance (India)
      const estimatedKm = mode === "ferry" ? Math.round(routeData.distanceKm / 1.25) : routeData.distanceKm;
      result.durationMinutes = Math.round((estimatedKm / avgSpeed) * 60);
      result.durationSource = "ESTIMATED_HAVERSINE";
      result.status = "ESTIMATED";
    } else {
      result.durationSource = "UNAVAILABLE";
      result.status = "ESTIMATED";
    }
  } catch (err) {
    logger.warn(`[JourneyEngine] ${mode} estimate failed (${origin} → ${destination}): ${err.message}`);
    result.durationSource = "UNAVAILABLE";
    result.status = "ESTIMATED";
  }
  return result;
}

// ─── Trip Timing Calculator ──────────────────────────────────────────────────

/**
 * Compute TripTiming metadata from calculated outbound and return journey legs,
 * including destination usable-time exploration windows.
 */
export function calculateTripTiming(outboundLeg, returnLeg, options = {}) {
  const timing = {
    outbound: {
      durationMinutes: null,
      isOvernight: false,
      travelDaysCount: 0,
      arrivalDateTime: "",
    },
    destination: {
      usableStartDateTime: "",
      usableEndDateTime: "",
      totalUsableHours: null,
      days: [],
    },
    return: {
      durationMinutes: null,
      isOvernight: false,
      travelDaysCount: 0,
      departureDateTime: "",
    },
  };

  // ── Outbound ──
  if (outboundLeg) {
    timing.outbound.durationMinutes = outboundLeg.durationMinutes ?? null;

    const depDt = buildDateTime(outboundLeg.departureDate, outboundLeg.departureTime);
    const arrDt = buildDateTime(outboundLeg.arrivalDate, outboundLeg.arrivalTime);

    if (depDt && arrDt) {
      timing.outbound.isOvernight = isOvernightJourney(depDt, arrDt);
      timing.outbound.travelDaysCount = calendarDaysBetween(outboundLeg.departureDate, outboundLeg.arrivalDate);
      timing.outbound.arrivalDateTime = `${outboundLeg.arrivalDate}T${outboundLeg.arrivalTime}`;
    } else if (outboundLeg.arrivalDate) {
      // Partial data — count from departure date if available
      if (outboundLeg.departureDate && outboundLeg.departureDate !== outboundLeg.arrivalDate) {
        timing.outbound.isOvernight = true;
        timing.outbound.travelDaysCount = calendarDaysBetween(outboundLeg.departureDate, outboundLeg.arrivalDate);
      } else {
        timing.outbound.travelDaysCount = 1;
      }
      if (outboundLeg.arrivalTime) {
        timing.outbound.arrivalDateTime = `${outboundLeg.arrivalDate}T${outboundLeg.arrivalTime}`;
      }
    }
  }

  // ── Return ──
  if (returnLeg) {
    timing.return.durationMinutes = returnLeg.durationMinutes ?? null;

    const depDt = buildDateTime(returnLeg.departureDate, returnLeg.departureTime);
    const arrDt = buildDateTime(returnLeg.arrivalDate, returnLeg.arrivalTime);

    if (depDt && arrDt) {
      timing.return.isOvernight = isOvernightJourney(depDt, arrDt);
      timing.return.travelDaysCount = calendarDaysBetween(returnLeg.departureDate, returnLeg.arrivalDate);
    } else if (returnLeg.departureDate && returnLeg.arrivalDate && returnLeg.departureDate !== returnLeg.arrivalDate) {
      timing.return.isOvernight = true;
      timing.return.travelDaysCount = calendarDaysBetween(returnLeg.departureDate, returnLeg.arrivalDate);
    } else if (returnLeg.departureDate) {
      timing.return.travelDaysCount = 1;
    }

    if (returnLeg.departureDate && returnLeg.departureTime) {
      timing.return.departureDateTime = `${returnLeg.departureDate}T${returnLeg.departureTime}`;
    }
  }

  // ── Destination Usable-Time Windows (Part 4) ──
  try {
    const destWindows = calculateDestinationWindows({
      startDate: options.startDate || outboundLeg?.departureDate || outboundLeg?.arrivalDate || "",
      endDate: options.endDate || returnLeg?.departureDate || returnLeg?.arrivalDate || "",
      outboundJourney: outboundLeg,
      returnJourney: returnLeg,
      tripTiming: timing,
      accommodation: options.accommodation || "",
      hotelName: options.hotelName || "",
      checkInTime: options.checkInTime || "",
      checkOutTime: options.checkOutTime || "",
    });

    timing.destination = destWindows;
  } catch (destErr) {
    logger.warn(`[JourneyEngine] Destination window calculation failed (non-fatal): ${destErr.message}`);
  }

  return timing;
}

// ─── Full Journey Computation ────────────────────────────────────────────────

/**
 * Compute both outbound and return journey legs and produce complete trip timing
 * including destination usable exploration windows.
 *
 * @param {Object} tripData - Trip creation/update body
 * @returns {Promise<{ outboundJourney: Object, returnJourney: Object, tripTiming: Object }>}
 */
export async function computeJourneys(tripData) {
  const origin = tripData.origin || "";
  const destination = tripData.destination || "";

  // Build raw legs from input, falling back to flat fields
  const rawOutbound = tripData.outboundJourney || {};
  const rawReturn = tripData.returnJourney || {};

  // Enrich raw outbound with flat fields if structured is empty
  const outboundInput = {
    transportType: rawOutbound.transportType || tripData.travelMode || "",
    departureLocation: rawOutbound.departureLocation || tripData.departureHub || origin,
    arrivalLocation: rawOutbound.arrivalLocation || tripData.arrivalHub || destination,
    departureDate: rawOutbound.departureDate || tripData.startDate || "",
    departureTime: rawOutbound.departureTime || tripData.departureTime || "",
    arrivalDate: rawOutbound.arrivalDate || tripData.startDate || "",
    arrivalTime: rawOutbound.arrivalTime || tripData.arrivalTime || "",
    durationMinutes: rawOutbound.durationMinutes ?? null,
    durationSource: rawOutbound.durationSource || "",
    transitRef: rawOutbound.transitRef || tripData.transitRef || "",
    status: rawOutbound.status || "ESTIMATED",
    booked: Boolean(rawOutbound.booked),
    ticketRef: rawOutbound.ticketRef || "",
  };

  const returnInput = {
    transportType: rawReturn.transportType || rawReturn.transport || tripData.travelMode || "",
    departureLocation: rawReturn.departureLocation || tripData.arrivalHub || destination,
    arrivalLocation: rawReturn.arrivalLocation || tripData.departureHub || origin,
    departureDate: rawReturn.departureDate || rawReturn.date || tripData.endDate || "",
    departureTime: rawReturn.departureTime || rawReturn.time || "",
    arrivalDate: rawReturn.arrivalDate || rawReturn.date || tripData.endDate || "",
    arrivalTime: rawReturn.arrivalTime || "",
    durationMinutes: rawReturn.durationMinutes ?? null,
    durationSource: rawReturn.durationSource || "",
    transitRef: rawReturn.transitRef || rawReturn.ticketRef || "",
    status: rawReturn.status || (rawReturn.booked ? "CONFIRMED" : "ESTIMATED"),
    booked: Boolean(rawReturn.booked),
    ticketRef: rawReturn.ticketRef || "",
  };

  // Calculate both legs concurrently
  const [outboundLeg, returnLeg] = await Promise.all([
    calculateJourneyLeg(outboundInput, { origin, destination }),
    calculateJourneyLeg(returnInput, { origin: destination, destination: origin }),
  ]);

  // Calculate timing metadata including destination windows
  const tripTiming = calculateTripTiming(outboundLeg, returnLeg, tripData);

  return { outboundJourney: outboundLeg, returnJourney: returnLeg, tripTiming };
}

// ─── Exported Utility Functions (for tests) ──────────────────────────────────

export const _testUtils = {
  buildDateTime,
  durationBetween,
  calendarDaysBetween,
  isOvernightJourney,
  _parseFlightDuration,
};
