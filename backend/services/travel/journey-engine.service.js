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
import { railwayTimelineService } from "./railway-timeline.service.js";
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
  const pad = (n) => String(n).padStart(2, "0");
  // Timezone-aware Asia/Kolkata (+05:30) interpretation
  return new Date(`${pad(y)}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(m)}:00+05:30`);
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
    const mode = (result.transportType || "").toLowerCase().trim();
    const isTrainMode = mode === "train" || mode === "rail";
    const depLoc = result.departureLocation || options.origin || "";
    const arrLoc = result.arrivalLocation || options.destination || "";

    // ── STEP 1: User-provided full timestamps ──────────────────────────────
    // Note: For train journeys where arrivalDate equals departureDate, we verify
    // the railway schedule first rather than naively assuming same-day arrival.
    const departureDt = buildDateTime(result.departureDate, result.departureTime);
    const arrivalDt = buildDateTime(result.arrivalDate, result.arrivalTime);

    const isSuspiciousSameDayTrain =
      isTrainMode && result.departureDate && result.arrivalDate && result.departureDate === result.arrivalDate;

    if (!isSuspiciousSameDayTrain && departureDt && arrivalDt) {
      const userDuration = durationBetween(departureDt, arrivalDt);
      if (userDuration != null && userDuration >= 0) {
        result.durationMinutes = userDuration;
        result.durationSource = result.durationSource || "USER_SPECIFIED";
        // Status: if booked or has a transit reference, mark CONFIRMED
        if (result.booked || result.transitRef) {
          result.status = "CONFIRMED";
        }
        if (isTrainMode && depLoc && arrLoc) {
          // Enrich with stops and live tracking if train
          try {
            const tl = await railwayTimelineService.buildRailwayTimeline({
              trainNumber: result.transitRef,
              fromStation: depLoc,
              toStation: arrLoc,
              journeyDate: result.departureDate,
              arrivalDate: result.arrivalDate,
              departureTime: result.departureTime,
              arrivalTime: result.arrivalTime,
              fallbackDurationMinutes: result.durationMinutes,
            });
            if (tl) {
              result.railwayTimeline = tl;
              result.stops = tl.stops;
              result.liveTracking = tl.liveTracking;
              result.dataClassification = tl.dataClassification;
            }
          } catch {}
        }
        return result;
      }
    }

    // ── STEP 2: Partial user data — departure date+time only ────────────────
    if (!isTrainMode && departureDt && !arrivalDt && result.durationMinutes != null) {
      // User gave duration but not arrival — keep as-is
      result.durationSource = result.durationSource || "USER_SPECIFIED";
      return result;
    }

    // ── STEP 3: Provider-based calculation based on transport type ───────────
    if (!depLoc || !arrLoc) {
      result.durationSource = result.durationSource || "UNAVAILABLE";
      result.status = "ESTIMATED";
      return result;
    }

    // ── 3a: Car / Road ──────────────────────────────────────────────────────
    if (mode === "car" || mode === "driving" || mode === "road" || mode === "self-drive") {
      await _calculateRoadJourney(result, depLoc, arrLoc);
    } else if (mode === "flight" || mode === "air" || mode === "airplane") {
      await _calculateFlightJourney(result, depLoc, arrLoc);
    } else if (isTrainMode) {
      await _calculateScheduleBasedJourney(result, depLoc, arrLoc, "train");
    } else if (mode === "bus" || mode === "coach") {
      await _calculateScheduleBasedJourney(result, depLoc, arrLoc, "bus");
    } else if (mode === "ferry" || mode === "boat" || mode === "ship") {
      await _calculateScheduleBasedJourney(result, depLoc, arrLoc, "ferry");
    } else if (depLoc && arrLoc) {
      await _calculateRoadJourney(result, depLoc, arrLoc);
    }

    // ── STEP 4: Accurate Destination Arrival Date & Time Derivation ────────
    if (result.departureDate && result.durationMinutes != null && result.durationMinutes > 0) {
      if (!result.departureTime) {
        result.departureTime = mode.includes("flight") ? "08:00" : "07:00";
      }
      const depDtCalc = buildDateTime(result.departureDate, result.departureTime);
      if (depDtCalc) {
        const arrDtCalc = new Date(depDtCalc.getTime() + result.durationMinutes * 60000);
        const derivedDate = arrDtCalc.toISOString().split("T")[0];
        const derivedTime = `${String(arrDtCalc.getUTCHours()).padStart(2, "0")}:${String(arrDtCalc.getUTCMinutes()).padStart(2, "0")}`;
        // If arrival date was unset or was naively set to departure date for an overnight journey
        if (!result.arrivalDate || (result.arrivalDate === result.departureDate && derivedDate !== result.departureDate)) {
          result.arrivalDate = derivedDate;
        }
        if (!result.arrivalTime) {
          result.arrivalTime = derivedTime;
        }
      }
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
  // If Indian train mode, use centralized railwayTimelineService (RailKit + IRCTC cross-check)
  if (mode === "train" || mode === "rail") {
    try {
      const tl = await railwayTimelineService.buildRailwayTimeline({
        trainNumber: result.transitRef,
        fromStation: origin,
        toStation: destination,
        journeyDate: result.departureDate,
        arrivalDate: result.arrivalDate,
        departureTime: result.departureTime,
        arrivalTime: result.arrivalTime,
        fallbackDurationMinutes: result.durationMinutes,
      });

      if (tl && tl.totalDurationMinutes > 0) {
        result.durationMinutes = tl.totalDurationMinutes;
        result.durationSource = tl.dataClassification || "SCHEDULED_VERIFIED";
        result.status = result.booked ? "CONFIRMED" : "SCHEDULED";
        if (!result.transitRef) {
          result.transitRef = `${tl.trainNumber} - ${tl.trainName}`;
        }
        if (tl.fromStation?.departureTime) {
          result.departureTime = tl.fromStation.departureTime;
        }
        result.arrivalDate = tl.destinationArrivalDate;
        if (tl.toStation?.arrivalTime) {
          result.arrivalTime = tl.toStation.arrivalTime;
        }
        result.railwayTimeline = tl;
        result.stops = tl.stops;
        result.liveTracking = tl.liveTracking;
        result.dataClassification = tl.dataClassification;
        return result;
      }
    } catch (railErr) {
      logger.warn(`[JourneyEngine] railwayTimelineService calculation note: ${railErr.message}`);
    }

    // Secondary fallback: RailCore provider if configured
    if (railcoreProvider.isConfigured()) {
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
      } catch (rcErr) {
        logger.warn(`[JourneyEngine] RailCore train lookup failed: ${rcErr.message}`);
      }
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
    // Distinct journey milestones
    homeCityDepartureDateTime: "",
    destinationArrivalDateTime: "",
    sightseeingStartDate: "",
    sightseeingEndDate: "",
    returnDepartureDateTime: "",
    homeCityArrivalDateTime: "",
    timingConflict: {
      hasConflict: false,
      message: "",
      recommendedDays: 0,
      suggestedEndDate: "",
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

    if (outboundLeg.departureDate) {
      timing.homeCityDepartureDateTime = `${outboundLeg.departureDate}T${outboundLeg.departureTime || "07:00"}`;
    }
    if (outboundLeg.arrivalDate) {
      timing.destinationArrivalDateTime = `${outboundLeg.arrivalDate}T${outboundLeg.arrivalTime || "12:00"}`;
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

    if (returnLeg.departureDate) {
      timing.return.departureDateTime = `${returnLeg.departureDate}T${returnLeg.departureTime || "18:00"}`;
      timing.returnDepartureDateTime = timing.return.departureDateTime;
    }
    if (returnLeg.arrivalDate) {
      timing.homeCityArrivalDateTime = `${returnLeg.arrivalDate}T${returnLeg.arrivalTime || "23:00"}`;
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

    // Determine actual sightseeing dates
    const activeDays = (destWindows.days || []).filter((d) => d.availableHours > 0);
    if (activeDays.length > 0) {
      timing.sightseeingStartDate = activeDays[0].date;
      timing.sightseeingEndDate = activeDays[activeDays.length - 1].date;
    } else {
      timing.sightseeingStartDate = outboundLeg?.arrivalDate || options.startDate || "";
      timing.sightseeingEndDate = returnLeg?.departureDate || options.endDate || "";
    }
  } catch (destErr) {
    logger.warn(`[JourneyEngine] Destination window calculation failed (non-fatal): ${destErr.message}`);
    timing.sightseeingStartDate = outboundLeg?.arrivalDate || options.startDate || "";
    timing.sightseeingEndDate = returnLeg?.departureDate || options.endDate || "";
  }

  // ── Timing Conflict Detection (Goal 1) ──
  try {
    const startDate = options.startDate || outboundLeg?.departureDate || "";
    const endDate = options.endDate || returnLeg?.departureDate || "";
    const destination = options.destination || "your destination";

    const outboundHours = Math.round(((outboundLeg?.durationMinutes || 0) / 60) * 10) / 10;
    const returnHours = Math.round(((returnLeg?.durationMinutes || 0) / 60) * 10) / 10;
    const roundTripTransitHours = outboundHours + returnHours;
    const totalTripDays = calendarDaysBetween(startDate, endDate);
    const usableHours = timing.destination.totalUsableHours != null ? timing.destination.totalUsableHours : 0;

    // Conflict criteria:
    // 1. Usable destination exploration hours are < 6 hours despite significant travel (>= 6h transit)
    // 2. Round-trip transit is >= 14 hours and total calendar days <= 2
    // 3. Round-trip transit is >= 24 hours and total calendar days <= 3
    const hasConflict =
      (roundTripTransitHours >= 14 && totalTripDays <= 2) ||
      (roundTripTransitHours >= 24 && totalTripDays <= 3) ||
      (usableHours < 6 && roundTripTransitHours >= 6);

    if (hasConflict) {
      const recommendedDays = Math.max(
        totalTripDays + 1,
        Math.ceil((roundTripTransitHours + 16) / 10)
      );

      let suggestedEndDate = endDate;
      if (startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
        const [sy, sm, sd] = startDate.split("-").map(Number);
        const sDt = new Date(Date.UTC(sy, sm - 1, sd));
        sDt.setUTCDate(sDt.getUTCDate() + (recommendedDays - 1));
        suggestedEndDate = sDt.toISOString().split("T")[0];
      }

      timing.timingConflict = {
        hasConflict: true,
        message: `Outbound journey takes ~${outboundHours}h and return takes ~${returnHours}h (${Math.round(roundTripTransitHours)}h total in transit). A ${totalTripDays}-day trip leaves insufficient time for sightseeing and rest in ${destination}. We recommend at least ${recommendedDays} days.`,
        recommendedDays,
        suggestedEndDate,
      };
    }
  } catch (conflictErr) {
    logger.debug(`[JourneyEngine] Conflict evaluation note: ${conflictErr.message}`);
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
    arrivalDate: rawOutbound.arrivalDate || "",
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
    arrivalDate: rawReturn.arrivalDate || rawReturn.date || "",
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
