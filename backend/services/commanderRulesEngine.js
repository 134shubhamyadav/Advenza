/**
 * Commander Rules & Decision Engine.
 * Evaluates real-world telemetry with trip itinerary data to produce truthful,
 * actionable alerts. Never fabricates flight delays, fake prices, or fake weather.
 *
 * Data Types:
 * - LIVE_VERIFIED: Real-world data verified in real time from external APIs.
 * - CACHED_VERIFIED: Real-world data within validated cache TTL.
 * - ESTIMATED: Derived by deterministic calculations (e.g. ledger balance).
 * - UNAVAILABLE: External data feed is unreachable or unconfigured.
 */

export function evaluateTripEvents({
  trip = {},
  weatherData = null,
  activityWeatherRisks = [],
  flightData = null,
  budgetData = null,
  transitData = null,
  priceWatchAlerts = [],
}) {
  const events = [];
  const dest = trip.destination?.split(",")[0] || trip.title || "Destination";
  const tripId = String(trip._id || "trip");
  const nowIso = new Date().toISOString();

  // ── 1. Weather Evaluation (Activity-Specific & General) ───────────────────────
  if (Array.isArray(activityWeatherRisks) && activityWeatherRisks.length > 0) {
    // Specific itinerary activities impacted by verified weather
    activityWeatherRisks.forEach((risk, idx) => {
      const isBad = risk.rainProbabilityPercent >= 80;
      const actId = `evt_${tripId}_act_weather_${idx}`;
      events.push({
        id: actId,
        when: risk.activityTime || "Scheduled Time",
        kind: "weather",
        alertType: "WEATHER_RISK",
        severity: isBad ? "bad" : "warn",
        dataType: "LIVE_VERIFIED",
        source: risk.source || "Open-Meteo Verified Meteorology API",
        title: `Weather alert for ${risk.activityTitle || "Activity"} (${risk.rainProbabilityPercent}% rain)`,
        reason:
          risk.riskReason ||
          `Forecast indicates ${risk.condition?.toLowerCase() || "rain"} with ${risk.rainProbabilityPercent}% precipitation probability at ${risk.activityTime || "scheduled hour"}.`,
        action: `Consider moving "${risk.activityTitle || "this activity"}" to an indoor venue or shifting time.`,
        delta: "Schedule adjustment advised",
        actionable: true,
        actionLabel: "Swap with Indoor Alternative",
        actionPayload: {
          type: "SWAP_INDOOR",
          dayNumber: risk.dayNumber || 1,
          activityIndex: risk.activityIndex ?? idx,
          activityTitle: risk.activityTitle || "Outdoor Activity",
        },
        updatedAt: risk.lastUpdated || nowIso,
        facts: {
          activity: risk.activityTitle,
          time: risk.activityTime,
          rainChance: risk.rainProbabilityPercent,
          temperatureC: risk.temperatureC,
        },
      });
    });
  } else if (!weatherData || weatherData.status === "UNAVAILABLE") {
    events.push({
      id: `evt_${tripId}_weather_unavail`,
      when: "Just now",
      kind: "weather",
      alertType: "WEATHER_RISK",
      severity: "info",
      dataType: "UNAVAILABLE",
      source: weatherData?.source || "Weather API",
      title: `Live weather telemetry unavailable for ${dest}`,
      reason:
        weatherData?.reason ||
        "Live meteorological station feed is currently unavailable or timed out. No external weather feed responded in time.",
      action: "Check your local weather provider before starting outdoor excursions.",
      delta: "Unconfirmed",
      actionable: false,
      updatedAt: nowIso,
    });
  } else {
    const { temperatureC, rainProbabilityPercent, condition, source, lastUpdated, fetchedAt } =
      weatherData.data || weatherData;

    if (rainProbabilityPercent >= 50) {
      events.push({
        id: `evt_${tripId}_weather_rain`,
        when: "Today",
        kind: "weather",
        alertType: "WEATHER_RISK",
        severity: "warn",
        dataType: "LIVE_VERIFIED",
        source: source || "Meteorology API",
        title: `Rain risk in ${dest} (${rainProbabilityPercent}% chance)`,
        reason: `Live forecast confirms ${condition?.toLowerCase() || "precipitation"} with ${temperatureC}°C and high rain probability (${rainProbabilityPercent}%).`,
        action: "Prepare indoor alternatives for scheduled outdoor afternoon activities.",
        delta: "Plan B advised",
        actionable: true,
        actionLabel: "Add Afternoon Rain Buffer",
        actionPayload: {
          type: "ADD_RAIN_BUFFER",
          destination: dest,
        },
        updatedAt: lastUpdated || fetchedAt || nowIso,
        facts: { temperatureC, rainProbabilityPercent, condition },
      });
    } else if (temperatureC >= 38) {
      events.push({
        id: `evt_${tripId}_weather_heat`,
        when: "Today",
        kind: "weather",
        alertType: "WEATHER_RISK",
        severity: "warn",
        dataType: "LIVE_VERIFIED",
        source: source || "Meteorology API",
        title: `High temperature advisory in ${dest} (${temperatureC}°C)`,
        reason: `Live station telemetry reports extreme heat (${temperatureC}°C) in ${dest}.`,
        action: "Reschedule high-exertion outdoor walking tours to morning or post-sunset hours.",
        delta: "Schedule pacing advised",
        actionable: true,
        actionLabel: "Pace Outdoor Stops",
        actionPayload: {
          type: "PACE_HEAT",
          temperatureC,
        },
        updatedAt: lastUpdated || fetchedAt || nowIso,
        facts: { temperatureC, condition },
      });
    } else {
      events.push({
        id: `evt_${tripId}_weather_clear`,
        when: "Today",
        kind: "weather",
        alertType: "WEATHER_RISK",
        severity: "info",
        dataType: "LIVE_VERIFIED",
        source: source || "Meteorology API",
        title: `Favorable weather in ${dest}`,
        reason: `Current forecast shows ${condition?.toLowerCase() || "clear conditions"} at ${temperatureC}°C with safe precipitation risk (${rainProbabilityPercent}%).`,
        action: "Optimal conditions for all scheduled outdoor activities.",
        delta: "Zero weather delay",
        actionable: false,
        updatedAt: lastUpdated || fetchedAt || nowIso,
        facts: { temperatureC, rainProbabilityPercent, condition },
      });
    }
  }

  // ── 2. Transit & Live Flight Status Evaluation ────────────────────────────────
  if (flightData && flightData.flightNumber) {
    if (flightData.status === "DELAYED") {
      events.push({
        id: `evt_${tripId}_flight_delay`,
        when: flightData.scheduledDeparture || "Departure",
        kind: "delay",
        alertType: "FLIGHT_DELAY",
        severity: flightData.delayMinutes >= 60 ? "bad" : "warn",
        dataType: "LIVE_VERIFIED",
        source: flightData.provider || "Aviation Radar",
        title: `Flight ${flightData.flightNumber} delayed (${flightData.delayMinutes} min)`,
        reason: `Carrier radar reports ${flightData.flightNumber} (${flightData.origin} → ${flightData.destination}) is delayed by ${flightData.delayMinutes} minutes. Estimated departure: ${flightData.estimatedDeparture || "TBD"}.`,
        action: "Notify your hotel or transport pickup of your revised arrival time.",
        delta: `+${flightData.delayMinutes} min delay`,
        actionable: true,
        actionLabel: "Insert Arrival Transit Buffer",
        actionPayload: {
          type: "ADJUST_FLIGHT_DELAY",
          delayMinutes: flightData.delayMinutes,
        },
        updatedAt: flightData.lastUpdated || nowIso,
        facts: flightData,
      });
    } else if (flightData.status === "CANCELLED") {
      events.push({
        id: `evt_${tripId}_flight_cancel`,
        when: flightData.scheduledDeparture || "Departure",
        kind: "cancel",
        alertType: "FLIGHT_CANCELLATION",
        severity: "bad",
        dataType: "LIVE_VERIFIED",
        source: flightData.provider || "Aviation Radar",
        title: `Flight ${flightData.flightNumber} cancelled`,
        reason: `Carrier reports flight ${flightData.flightNumber} has been cancelled.`,
        action: "Contact airline desk immediately for rebooking or refund.",
        delta: "Immediate rebooking required",
        actionable: true,
        actionLabel: "Acknowledge Cancellation",
        actionPayload: {
          type: "ACK_CANCEL",
          flightNumber: flightData.flightNumber,
        },
        updatedAt: flightData.lastUpdated || nowIso,
        facts: flightData,
      });
    } else {
      events.push({
        id: `evt_${tripId}_flight_ontime`,
        when: flightData.scheduledDeparture || "On Schedule",
        kind: "delay",
        alertType: "FLIGHT_DELAY",
        severity: "info",
        dataType: "LIVE_VERIFIED",
        source: flightData.provider || "Aviation Radar",
        title: `Flight ${flightData.flightNumber} on schedule`,
        reason: `Scheduled departure at ${flightData.scheduledDeparture} from ${flightData.terminal || "Terminal"}${flightData.gate ? `, ${flightData.gate}` : ""}.`,
        action: "Proceed to airport as planned.",
        delta: "On time",
        actionable: false,
        updatedAt: flightData.lastUpdated || nowIso,
        facts: flightData,
      });
    }
  }

  // ── 3. Price Watch Alerts ───────────────────────────────────────────────────
  if (Array.isArray(priceWatchAlerts) && priceWatchAlerts.length > 0) {
    priceWatchAlerts.forEach((alert, idx) => {
      events.push({
        id: `evt_${tripId}_price_drop_${idx}`,
        when: "Price Drop Detected",
        kind: "budget",
        alertType: alert.type === "flight" ? "FLIGHT_PRICE_CHANGE" : "HOTEL_PRICE_CHANGE",
        severity: "info",
        dataType: "LIVE_VERIFIED",
        source: alert.provider || "Price Watch Engine",
        title: `Price drop: ${alert.title || "Tracked Deal"}`,
        reason:
          alert.reason ||
          `Price dropped from ₹${alert.previousPrice?.toLocaleString("en-IN")} to ₹${alert.currentPrice?.toLocaleString("en-IN")}.`,
        action: "Review deal and book if ready.",
        delta: `-₹${((alert.previousPrice || 0) - (alert.currentPrice || 0)).toLocaleString("en-IN")}`,
        actionable: true,
        actionLabel: "Acknowledge Price Drop",
        actionPayload: {
          type: "PRICE_DROP_ACK",
          alertId: alert._id || idx,
        },
        updatedAt: alert.observedAt || nowIso,
        facts: alert,
      });
    });
  }

  // ── 4. Budget & Financial Ledger ────────────────────────────────────────────
  if (budgetData && budgetData.success) {
    const { budgetTotal, totalSpent, remaining, pctUsed, expenseCount, isOverBudget, source, calculatedAt } =
      budgetData;

    if (budgetTotal > 0) {
      if (isOverBudget) {
        events.push({
          id: `evt_${tripId}_budget_over`,
          when: "Ledger Audit",
          kind: "budget",
          alertType: "ITINERARY_CONFLICT",
          severity: "bad",
          dataType: "ESTIMATED",
          source: source || "Trip Ledger",
          title: "Budget overrun detected",
          reason: `Total recorded expenses of ₹${totalSpent.toLocaleString("en-IN")} exceed the budget limit of ₹${budgetTotal.toLocaleString("en-IN")}.`,
          action: "Review discretionary expenses and allocate emergency contingency buffer.",
          delta: `-₹${Math.abs(remaining).toLocaleString("en-IN")} overrun`,
          actionable: true,
          actionLabel: "Allocate Emergency Buffer (₹5,000)",
          actionPayload: {
            type: "BUDGET_REBALANCE",
            amount: 5000,
          },
          updatedAt: calculatedAt || nowIso,
          facts: { budgetTotal, totalSpent, remaining, pctUsed },
        });
      } else if (pctUsed >= 80) {
        events.push({
          id: `evt_${tripId}_budget_warn`,
          when: "Ledger Audit",
          kind: "budget",
          alertType: "ITINERARY_CONFLICT",
          severity: "warn",
          dataType: "ESTIMATED",
          source: source || "Trip Ledger",
          title: `Budget capacity warning (${pctUsed}% used)`,
          reason: `You have spent ₹${totalSpent.toLocaleString("en-IN")} of ₹${budgetTotal.toLocaleString("en-IN")} with ₹${remaining.toLocaleString("en-IN")} remaining across ${expenseCount} items.`,
          action: "Allocate ₹3,000 contingency buffer to preserve safety margin for remaining days.",
          delta: `₹${remaining.toLocaleString("en-IN")} buffer remaining`,
          actionable: true,
          actionLabel: "Allocate ₹3,000 Safety Buffer",
          actionPayload: {
            type: "BUDGET_REBALANCE",
            amount: 3000,
          },
          updatedAt: calculatedAt || nowIso,
          facts: { budgetTotal, totalSpent, remaining, pctUsed },
        });
      }
    }
  }

  // ── 5. Itinerary Timing & Schedule Conflicts ──────────────────────────────
  if (trip.tripTiming?.timingConflict?.hasConflict) {
    events.push({
      id: `evt_${tripId}_timing_conflict`,
      when: "Day 1 Schedule",
      kind: "traffic",
      alertType: "ITINERARY_CONFLICT",
      severity: "warn",
      dataType: "ESTIMATED",
      source: "Trip Timing Engine",
      title: "Schedule conflict: Activities before arrival",
      reason:
        trip.tripTiming.timingConflict.message ||
        "Activities are scheduled on Day 1 before scheduled transit arrival time.",
      action: "Realign Day 1 schedule to begin after verified transit arrival and check-in window.",
      delta: "Schedule pacing adjusted",
      actionable: true,
      actionLabel: "Auto-realign Schedule",
      actionPayload: {
        type: "REALIGN_SCHEDULE",
      },
      updatedAt: nowIso,
    });
  }

  // ── 6. Pacing & Schedule Density ────────────────────────────────────────────
  const daysList = Array.isArray(trip.days) ? trip.days : [];
  daysList.forEach((day) => {
    if (Array.isArray(day.activities) && day.activities.length >= 6) {
      events.push({
        id: `evt_${tripId}_pace_day_${day.dayNumber || 1}`,
        when: `Day ${day.dayNumber || 1}`,
        kind: "closure",
        alertType: "ITINERARY_CONFLICT",
        severity: "info",
        dataType: "ESTIMATED",
        source: "Itinerary Analyzer",
        title: `High pacing on Day ${day.dayNumber || 1} (${day.activities.length} stops)`,
        reason: `Day ${day.dayNumber || 1} contains ${day.activities.length} scheduled stops, which may lead to traveler fatigue and rush during peak traffic hours.`,
        action: "Insert a 45-minute afternoon buffer window for rest and local refreshments.",
        delta: "+45 min rest buffer",
        actionable: true,
        actionLabel: "Insert Pacing Buffer",
        actionPayload: {
          type: "INSERT_PACING_BUFFER",
          dayNumber: day.dayNumber || 1,
        },
        updatedAt: nowIso,
      });
    }
  });

  return events;
}

export const rulesEngine = {
  evaluateTripEvents,
  evaluateRules: evaluateTripEvents,
};
