/**
 * Destination Usable-Time & Arrival/Departure Window Engine — Part 4
 *
 * Responsibilities:
 *   1. Converts outbound journey arrival + return journey departure + accommodation into
 *      realistic, usable destination exploration windows.
 *   2. Prevents scheduling activities before arrival + entry buffer.
 *   3. Prevents scheduling activities after pre-departure cutoff.
 *   4. Accurately handles same-day, overnight, 36h, 48h, and multi-day journeys.
 *   5. Generates structured per-day destination windows and calculates totalUsableHours.
 *   6. Handles accommodation check-in/out and luggage buffers without inventing fake data.
 *   7. Safe against timezone shifts, invalid inputs, and missing providers.
 */

import { logger } from "../../utils/logger.js";

// ─── Configurable Centralized Buffers (Minutes) ──────────────────────────────

export const DEFAULT_BUFFERS = {
  // Post-arrival overhead (terminal/station exit + local transfer to stay/city)
  ARRIVAL: {
    flight: { exit: 45, transfer: 45, total: 90 },
    train: { exit: 20, transfer: 30, total: 50 },
    bus: { exit: 15, transfer: 25, total: 40 },
    car: { exit: 15, transfer: 0, total: 15 },
    ferry: { exit: 20, transfer: 25, total: 45 },
    default: 30,
  },
  // Pre-departure overhead (travel from attraction + hub check-in/security/boarding)
  DEPARTURE: {
    flight: { hubArrival: 120, transfer: 45, total: 165 }, // 2h 45m before flight
    train: { hubArrival: 45, transfer: 30, total: 75 },    // 1h 15m before train
    bus: { hubArrival: 30, transfer: 25, total: 55 },      // 55m before bus
    car: { hubArrival: 20, transfer: 0, total: 20 },       // 20m before car
    ferry: { hubArrival: 45, transfer: 25, total: 70 },    // 1h 10m before ferry
    default: 60,
  },
  // Hotel check-in / settling buffer (if accommodation is present and check-in occurs)
  HOTEL_SETTLE_MINUTES: 30,
  // Standard daily sightseeing operational window (24-hour HH:mm)
  DAY_START_TIME: "08:00",
  DAY_END_TIME: "21:00",
};

// ─── Time & Date Helper Functions ────────────────────────────────────────────

/**
 * Parses YYYY-MM-DD and HH:mm into a UTC Date object.
 * Returns null if invalid.
 */
export function buildDateTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  const dStr = String(dateStr).trim();
  const tStr = String(timeStr).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dStr)) return null;
  if (!/^\d{1,2}:\d{2}$/.test(tStr)) return null;
  const [h, m] = tStr.split(":").map(Number);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  const [y, mo, d] = dStr.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h, m, 0));
}

/**
 * Adds minutes to a Date object, returning a new Date object.
 */
export function addMinutes(dateObj, minutes) {
  if (!dateObj || isNaN(dateObj.getTime())) return null;
  return new Date(dateObj.getTime() + minutes * 60000);
}

/**
 * Format a Date object to ISO string "YYYY-MM-DDTHH:mm:ss.000Z"
 */
export function toISOStringSafe(dateObj) {
  if (!dateObj || isNaN(dateObj.getTime())) return "";
  return dateObj.toISOString();
}

/**
 * Extract HH:mm from a Date object in UTC.
 */
export function formatHHmm(dateObj) {
  if (!dateObj || isNaN(dateObj.getTime())) return "";
  const h = String(dateObj.getUTCHours()).padStart(2, "0");
  const m = String(dateObj.getUTCMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * Extract YYYY-MM-DD from a Date object in UTC.
 */
export function formatYYYYMMDD(dateObj) {
  if (!dateObj || isNaN(dateObj.getTime())) return "";
  return dateObj.toISOString().split("T")[0];
}

/**
 * Calculate difference in hours (floating point rounded to 2 decimals).
 */
export function hoursBetween(startDt, endDt) {
  if (!startDt || !endDt) return 0;
  const diffMs = endDt.getTime() - startDt.getTime();
  if (diffMs <= 0) return 0;
  return Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
}

/**
 * Generate all inclusive dates between startDate and endDate strings.
 */
export function listDatesBetween(startDateStr, endDateStr) {
  if (!startDateStr || !endDateStr) return [];
  const [sy, sm, sd] = startDateStr.split("-").map(Number);
  const [ey, em, ed] = endDateStr.split("-").map(Number);
  const start = new Date(Date.UTC(sy, sm - 1, sd));
  const end = new Date(Date.UTC(ey, em - 1, ed));

  const dates = [];
  let cur = new Date(start.getTime());
  let count = 0;
  while (cur <= end && count < 60) {
    dates.push(cur.toISOString().split("T")[0]);
    cur.setUTCDate(cur.getUTCDate() + 1);
    count++;
  }
  return dates;
}

// ─── Buffer Resolvers ────────────────────────────────────────────────────────

/**
 * Resolve arrival buffer in minutes based on transport mode.
 */
export function getArrivalBufferMinutes(transportType) {
  const mode = (transportType || "").toLowerCase().trim();
  if (mode.includes("flight") || mode.includes("air") || mode.includes("plane")) {
    return DEFAULT_BUFFERS.ARRIVAL.flight.total;
  }
  if (mode.includes("train") || mode.includes("rail")) {
    return DEFAULT_BUFFERS.ARRIVAL.train.total;
  }
  if (mode.includes("bus") || mode.includes("coach")) {
    return DEFAULT_BUFFERS.ARRIVAL.bus.total;
  }
  if (mode.includes("car") || mode.includes("drive") || mode.includes("road")) {
    return DEFAULT_BUFFERS.ARRIVAL.car.total;
  }
  if (mode.includes("ferry") || mode.includes("boat")) {
    return DEFAULT_BUFFERS.ARRIVAL.ferry.total;
  }
  return DEFAULT_BUFFERS.ARRIVAL.default;
}

/**
 * Resolve departure cutoff buffer in minutes based on transport mode.
 */
export function getDepartureBufferMinutes(transportType) {
  const mode = (transportType || "").toLowerCase().trim();
  if (mode.includes("flight") || mode.includes("air") || mode.includes("plane")) {
    return DEFAULT_BUFFERS.DEPARTURE.flight.total;
  }
  if (mode.includes("train") || mode.includes("rail")) {
    return DEFAULT_BUFFERS.DEPARTURE.train.total;
  }
  if (mode.includes("bus") || mode.includes("coach")) {
    return DEFAULT_BUFFERS.DEPARTURE.bus.total;
  }
  if (mode.includes("car") || mode.includes("drive") || mode.includes("road")) {
    return DEFAULT_BUFFERS.DEPARTURE.car.total;
  }
  if (mode.includes("ferry") || mode.includes("boat")) {
    return DEFAULT_BUFFERS.DEPARTURE.ferry.total;
  }
  return DEFAULT_BUFFERS.DEPARTURE.default;
}

// ─── Usable Destination Window Engine ────────────────────────────────────────

/**
 * Computes destination usable-time windows and per-day breakdown.
 *
 * @param {Object} params
 * @param {string} params.startDate - Trip start date (YYYY-MM-DD)
 * @param {string} params.endDate - Trip end date (YYYY-MM-DD)
 * @param {Object} [params.outboundJourney] - Outbound journey leg
 * @param {Object} [params.returnJourney] - Return journey leg
 * @param {Object} [params.tripTiming] - Pre-calculated trip timing (if available)
 * @param {string} [params.accommodation] - Accommodation type or name
 * @param {string} [params.hotelName] - Hotel name
 * @param {string} [params.checkInTime] - User-specified check-in time (HH:mm)
 * @param {string} [params.checkOutTime] - User-specified check-out time (HH:mm)
 * @returns {Object} Destination window object with usableStartDateTime, usableEndDateTime, totalUsableHours, and days[]
 */
export function calculateDestinationWindows(params = {}) {
  const {
    startDate = "",
    endDate = "",
    outboundJourney = {},
    returnJourney = {},
    tripTiming = {},
    accommodation = "",
    hotelName = "",
    checkInTime = "",
    checkOutTime = "",
  } = params;

  try {
    const outLeg = outboundJourney || {};
    const retLeg = returnJourney || {};

    // ── 1. Determine Outbound Arrival Moment ─────────────────────────────────
    const outMode = outLeg.transportType || "";
    const outArrDate = outLeg.arrivalDate || startDate || "";
    const outArrTime = outLeg.arrivalTime || "";

    const arrivalBufferMin = getArrivalBufferMinutes(outMode);
    const hasHotel = Boolean(hotelName || accommodation);
    const hotelSettleMin = hasHotel ? DEFAULT_BUFFERS.HOTEL_SETTLE_MINUTES : 0;
    const totalArrivalOverhead = arrivalBufferMin + hotelSettleMin;

    let arrivalDt = null;
    let usableStartDt = null;

    if (outArrDate && outArrTime) {
      arrivalDt = buildDateTime(outArrDate, outArrTime);
      if (arrivalDt) {
        usableStartDt = addMinutes(arrivalDt, totalArrivalOverhead);
      }
    }

    // Fallback if no arrival time was specified: default to start date morning
    if (!usableStartDt && outArrDate) {
      usableStartDt = buildDateTime(outArrDate, DEFAULT_BUFFERS.DAY_START_TIME);
    }

    // ── 2. Determine Return Departure & Cutoff Moment ────────────────────────
    const retMode = retLeg.transportType || outMode || "";
    const retDepDate = retLeg.departureDate || retLeg.date || endDate || "";
    const retDepTime = retLeg.departureTime || retLeg.time || "";

    const depBufferMin = getDepartureBufferMinutes(retMode);

    let returnDepDt = null;
    let usableEndDt = null;

    if (retDepDate && retDepTime) {
      returnDepDt = buildDateTime(retDepDate, retDepTime);
      if (returnDepDt) {
        usableEndDt = addMinutes(returnDepDt, -depBufferMin);
      }
    }

    // Fallback if no return departure time was specified: default to end date evening
    if (!usableEndDt && retDepDate) {
      usableEndDt = buildDateTime(retDepDate, DEFAULT_BUFFERS.DAY_END_TIME);
    }

    // ── 3. Build Full Calendar Range ────────────────────────────────────────
    // Span from the earliest of startDate / outDepDate / outArrDate to latest of endDate / retDepDate / retArrDate
    const rangeStart = [startDate, outLeg.departureDate, outArrDate].filter(Boolean).sort()[0] || startDate;
    const rangeEnd = [endDate, retDepDate, retLeg.arrivalDate].filter(Boolean).sort().reverse()[0] || endDate;

    const calendarDates = listDatesBetween(rangeStart, rangeEnd);
    if (calendarDates.length === 0 && startDate) {
      calendarDates.push(startDate);
    }

    // ── 4. Classify & Compute Window for Each Day ───────────────────────────
    const days = [];
    let totalUsableHours = 0;

    for (let i = 0; i < calendarDates.length; i++) {
      const dateStr = calendarDates[i];
      const dayStartDt = buildDateTime(dateStr, DEFAULT_BUFFERS.DAY_START_TIME);
      const dayEndDt = buildDateTime(dateStr, DEFAULT_BUFFERS.DAY_END_TIME);

      let dayStatus = "FULL_DESTINATION_DAY";
      let dayUsableStart = toISOStringSafe(dayStartDt);
      let dayUsableEnd = toISOStringSafe(dayEndDt);
      let availableHours = 0;
      let reason = "";
      const constraints = {
        arrivalDay: false,
        returnDay: false,
        requiresHotelCheckIn: false,
        travelDay: false,
      };

      // ── Condition A: Before Destination Arrival (Outbound In Transit) ──────
      if (outArrDate && dateStr < outArrDate) {
        dayStatus = "TRAVEL_OUTBOUND";
        dayUsableStart = "";
        dayUsableEnd = "";
        availableHours = 0;
        reason = "IN_TRANSIT_OUTBOUND";
        constraints.travelDay = true;
      }
      // ── Condition B: After Return Departure (Return In Transit) ────────────
      else if (retDepDate && dateStr > retDepDate) {
        dayStatus = "TRAVEL_RETURN";
        dayUsableStart = "";
        dayUsableEnd = "";
        availableHours = 0;
        reason = "IN_TRANSIT_RETURN";
        constraints.travelDay = true;
      }
      // ── Condition C: Outbound Arrival Day AND Return Departure Day (Same Day Trip) ──
      else if (dateStr === outArrDate && dateStr === retDepDate) {
        const effStart = usableStartDt && usableStartDt > dayStartDt ? usableStartDt : dayStartDt;
        const effEnd = usableEndDt && usableEndDt < dayEndDt ? usableEndDt : dayEndDt;

        if (effStart && effEnd && effEnd > effStart) {
          dayStatus = "ARRIVAL_DAY";
          dayUsableStart = toISOStringSafe(effStart);
          dayUsableEnd = toISOStringSafe(effEnd);
          availableHours = hoursBetween(effStart, effEnd);
          reason = "SAME_DAY_ARRIVAL_AND_RETURN";
        } else {
          dayStatus = "TRAVEL_OUTBOUND";
          dayUsableStart = "";
          dayUsableEnd = "";
          availableHours = 0;
          reason = "NO_USABLE_DESTINATION_WINDOW";
        }
        constraints.arrivalDay = true;
        constraints.returnDay = true;
        if (hasHotel) constraints.requiresHotelCheckIn = true;
      }
      // ── Condition D: Outbound Arrival Day ──────────────────────────────────
      else if (dateStr === outArrDate) {
        dayStatus = "ARRIVAL_DAY";
        constraints.arrivalDay = true;
        if (hasHotel) constraints.requiresHotelCheckIn = true;

        if (usableStartDt) {
          // If arrival + buffer is later than DAY_START_TIME, start at usableStartDt
          const effStart = usableStartDt > dayStartDt ? usableStartDt : dayStartDt;

          if (effStart < dayEndDt) {
            const diffHours = hoursBetween(effStart, dayEndDt);
            dayUsableStart = toISOStringSafe(effStart);
            dayUsableEnd = toISOStringSafe(dayEndDt);
            availableHours = diffHours;
            reason = "ARRIVAL_DAY";
          } else {
            // Arrived very late (e.g. after 21:00)
            dayUsableStart = toISOStringSafe(effStart);
            dayUsableEnd = toISOStringSafe(effStart);
            availableHours = 0;
            reason = "LATE_NIGHT_ARRIVAL";
          }
        } else {
          dayUsableStart = toISOStringSafe(dayStartDt);
          dayUsableEnd = toISOStringSafe(dayEndDt);
          availableHours = hoursBetween(dayStartDt, dayEndDt);
          reason = "ARRIVAL_DAY";
        }
      }
      // ── Condition E: Return Departure Day ──────────────────────────────────
      else if (dateStr === retDepDate) {
        dayStatus = "RETURN_DAY";
        constraints.returnDay = true;

        if (usableEndDt) {
          // If return cutoff is earlier than DAY_END_TIME, end at usableEndDt
          const effEnd = usableEndDt < dayEndDt ? usableEndDt : dayEndDt;

          if (effEnd > dayStartDt) {
            const diffHours = hoursBetween(dayStartDt, effEnd);
            dayUsableStart = toISOStringSafe(dayStartDt);
            dayUsableEnd = toISOStringSafe(effEnd);
            availableHours = diffHours;
            reason = "RETURN_DAY";
          } else {
            // Departure is extremely early (e.g. before 08:00 cutoff)
            dayUsableStart = toISOStringSafe(dayStartDt);
            dayUsableEnd = toISOStringSafe(dayStartDt);
            availableHours = 0;
            reason = "EARLY_MORNING_DEPARTURE";
          }
        } else {
          dayUsableStart = toISOStringSafe(dayStartDt);
          dayUsableEnd = toISOStringSafe(dayEndDt);
          availableHours = hoursBetween(dayStartDt, dayEndDt);
          reason = "RETURN_DAY";
        }
      }
      // ── Condition F: Full Destination Day (Between Arrival and Departure) ──
      else {
        dayStatus = "FULL_DESTINATION_DAY";
        dayUsableStart = toISOStringSafe(dayStartDt);
        dayUsableEnd = toISOStringSafe(dayEndDt);
        availableHours = hoursBetween(dayStartDt, dayEndDt);
        reason = "FULL_DAY";
      }

      totalUsableHours += availableHours;

      days.push({
        date: dateStr,
        status: dayStatus,
        usableStartDateTime: dayUsableStart,
        usableEndDateTime: dayUsableEnd,
        availableHours: Math.round(availableHours * 100) / 100,
        reason: reason || dayStatus,
        constraints,
      });
    }

    // Overall destination start & end bounds
    const overallStart = usableStartDt ? toISOStringSafe(usableStartDt) : (days[0]?.usableStartDateTime || "");
    const overallEnd = usableEndDt ? toISOStringSafe(usableEndDt) : (days[days.length - 1]?.usableEndDateTime || "");

    return {
      usableStartDateTime: overallStart,
      usableEndDateTime: overallEnd,
      totalUsableHours: Math.round(totalUsableHours * 100) / 100,
      days,
    };
  } catch (err) {
    logger.warn(`[DestinationWindowEngine] Calculation failed (non-fatal): ${err.message}`);
    // Safe graceful fallback
    return {
      usableStartDateTime: "",
      usableEndDateTime: "",
      totalUsableHours: null,
      days: [],
    };
  }
}
