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
  trip,
  weatherData,
  activityWeatherRisks = [],
  flightData,
  budgetData,
  transitData,
  priceWatchAlerts = [],
}) {
  const events = [];
  const dest = trip.destination?.split(",")[0] || trip.title || "Destination";
  const tripId = String(trip._id);
  const nowIso = new Date().toISOString();

  // ── 1. Weather Evaluation (Activity-Specific & General) ───────────────────────
  if (Array.isArray(activityWeatherRisks) && activityWeatherRisks.length > 0) {
    // Specific itinerary activities impacted by verified weather
    activityWeatherRisks.forEach((risk, idx) => {
      const isBad = risk.rainProbabilityPercent >= 80;
      events.push({
        id: `evt_${tripId}_act_weather_${idx}`,
        when: risk.activityTime || "Scheduled Time",
        kind: "weather",
        alertType: "WEATHER_RISK",
        severity: isBad ? "bad" : "warn",
        dataType: "LIVE_VERIFIED",
        source: risk.source || "Open-Meteo Verified Meteorology API",
        title: `Weather alert for ${risk.activityTitle || "Activity"} (${risk.rainProbabilityPercent}% rain)`,
        reason: risk.riskReason || `Forecast indicates ${risk.condition.toLowerCase()} with ${risk.rainProbabilityPercent}% precipitation probability at ${risk.activityTime || "scheduled hour"}.`,
        action: `Consider moving "${risk.activityTitle || "this activity"}" to an indoor venue or shifting time.`,
        delta: "Schedule adjustment advised",
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
      updatedAt: nowIso,
    });
  } else {
    const { temperatureC, rainProbabilityPercent, condition, source, lastUpdated, fetchedAt } =
      weatherData.data || weatherData;

    if (rainProbabilityPercent >= 50) {
      events.push({
        id: `evt_${tripId}_weather_rain`,
        when: "Just now",
        kind: "weather",
        alertType: "WEATHER_RISK",
        severity: "warn",
        dataType: "LIVE_VERIFIED",
        source: source || "Meteorology API",
        title: `Rain risk in ${dest} (${rainProbabilityPercent}% chance)`,
        reason: `Live forecast confirms ${condition?.toLowerCase() || "precipitation"} with ${temperatureC}°C and high rain probability (${rainProbabilityPercent}%).`,
        action: "Prepare indoor alternatives for scheduled outdoor afternoon activities.",
        delta: "Plan B advised",
        updatedAt: lastUpdated || fetchedAt || nowIso,
        facts: { temperatureC, rainProbabilityPercent, condition },
      });
    } else if (temperatureC >= 38) {
      events.push({
        id: `evt_${tripId}_weather_heat`,
        when: "Just now",
        kind: "weather",
        alertType: "WEATHER_RISK",
        severity: "warn",
        dataType: "LIVE_VERIFIED",
        source: source || "Meteorology API",
        title: `High temperature advisory in ${dest} (${temperatureC}°C)`,
        reason: `Live station telemetry reports extreme heat (${temperatureC}°C) in ${dest}.`,
        action: "Reschedule high-exertion outdoor walking tours to morning or post-sunset hours.",
        delta: "Schedule pacing advised",
        updatedAt: lastUpdated || fetchedAt || nowIso,
        facts: { temperatureC, condition },
      });
    } else {
      events.push({
        id: `evt_${tripId}_weather_clear`,
        when: "Just now",
        kind: "weather",
        alertType: "WEATHER_RISK",
        severity: "info",
        dataType: "LIVE_VERIFIED",
        source: source || "Meteorology API",
        title: `Favorable weather in ${dest}`,
        reason: `Current forecast shows ${condition?.toLowerCase() || "clear conditions"} at ${temperatureC}°C with safe precipitation risk (${rainProbabilityPercent}%).`,
        action: "Optimal conditions for all scheduled outdoor activities.",
        delta: "Zero weather delay",
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
        updatedAt: flightData.lastUpdated || nowIso,
        facts: flightData,
      });
    }
  } else {
    events.push({
      id: `evt_${tripId}_transit_unavail`,
      when: "Just now",
      kind: "delay",
      alertType: "TRANSPORT_DISRUPTION",
      severity: "info",
      dataType: "UNAVAILABLE",
      source: "Aviation & Transit Radar",
      title: "Live flight gate tracking unavailable",
      reason: trip.transitRef
        ? `Live tracking stream unavailable for reference "${trip.transitRef}".`
        : "No flight number or booking reference associated with this trip to query live gate radar.",
      action: "Consult your airline or train ticket directly for gate, platform, and delay status.",
      delta: "Manual check required",
      updatedAt: nowIso,
    });
  }

  // ── 3. Price Watch Alerts ───────────────────────────────────────────────────
  if (Array.isArray(priceWatchAlerts) && priceWatchAlerts.length > 0) {
    priceWatchAlerts.forEach((alert, idx) => {
      events.push({
        id: `evt_${tripId}_price_drop_${idx}`,
        when: "Just now",
        kind: "budget",
        alertType: alert.type === "flight" ? "FLIGHT_PRICE_CHANGE" : "HOTEL_PRICE_CHANGE",
        severity: "info",
        dataType: "LIVE_VERIFIED",
        source: alert.provider || "Price Watch Engine",
        title: `Price drop: ${alert.title || "Tracked Deal"}`,
        reason: alert.reason || `Price dropped from ₹${alert.previousPrice?.toLocaleString("en-IN")} to ₹${alert.currentPrice?.toLocaleString("en-IN")}.`,
        action: "Review deal and book if ready.",
        delta: `-₹${((alert.previousPrice || 0) - (alert.currentPrice || 0)).toLocaleString("en-IN")}`,
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
          when: "Just now",
          kind: "budget",
          alertType: "ITINERARY_CONFLICT",
          severity: "bad",
          dataType: "ESTIMATED",
          source: source || "Trip Ledger",
          title: "Budget overrun detected",
          reason: `Total recorded expenses of ₹${totalSpent.toLocaleString("en-IN")} exceed the budget limit of ₹${budgetTotal.toLocaleString("en-IN")}.`,
          action: "Review discretionary expenses and pause non-essential bookings.",
          delta: `-₹${Math.abs(remaining).toLocaleString("en-IN")} overrun`,
          updatedAt: calculatedAt || nowIso,
          facts: { budgetTotal, totalSpent, remaining, pctUsed },
        });
      } else if (pctUsed >= 80) {
        events.push({
          id: `evt_${tripId}_budget_warn`,
          when: "Just now",
          kind: "budget",
          alertType: "ITINERARY_CONFLICT",
          severity: "warn",
          dataType: "ESTIMATED",
          source: source || "Trip Ledger",
          title: `Budget capacity warning (${pctUsed}% used)`,
          reason: `You have spent ₹${totalSpent.toLocaleString("en-IN")} of ₹${budgetTotal.toLocaleString("en-IN")} with ₹${remaining.toLocaleString("en-IN")} remaining across ${expenseCount} items.`,
          action: "Cap daily meal and transit allocations to preserve buffer for remaining days.",
          delta: `₹${remaining.toLocaleString("en-IN")} buffer remaining`,
          updatedAt: calculatedAt || nowIso,
          facts: { budgetTotal, totalSpent, remaining, pctUsed },
        });
      }
    }
  }

  return events;
}

export const rulesEngine = {
  evaluateTripEvents,
  evaluateRules: evaluateTripEvents,
};
