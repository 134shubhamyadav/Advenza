/**
 * Real Travel Data Service.
 * Fetches verified external data from live travel and meteorology APIs.
 * Never invents, fakes, or mocks real-time events.
 */

// WMO Weather interpretation codes
function interpretWmoCode(code) {
  if (code === 0) return "Clear sky";
  if (code === 1 || code === 2) return "Mainly clear or partly cloudy";
  if (code === 3) return "Overcast";
  if (code === 45 || code === 48) return "Foggy";
  if (code >= 51 && code <= 55) return "Light drizzle";
  if (code >= 61 && code <= 65) return "Rain";
  if (code >= 71 && code <= 77) return "Snow fall";
  if (code >= 80 && code <= 82) return "Rain showers";
  if (code >= 95) return "Thunderstorm";
  return "Variable conditions";
}

/**
 * Fetch verified real-time weather using Open-Meteo (Free, reliable, global, no key required).
 */
// Well-known regional tourist hubs that are states/regions rather than single municipalities
const REGIONAL_HUBS = {
  goa: { latitude: 15.4909, longitude: 73.8278, name: "Goa, India" },
  ladakh: { latitude: 34.1526, longitude: 77.5771, name: "Ladakh, India" },
  andaman: { latitude: 11.6234, longitude: 92.7265, name: "Port Blair, Andaman, India" },
  kashmir: { latitude: 34.0837, longitude: 74.7973, name: "Srinagar, Kashmir, India" },
  coorg: { latitude: 12.3375, longitude: 75.8069, name: "Coorg, Karnataka, India" },
  wayanad: { latitude: 11.6854, longitude: 76.132, name: "Wayanad, Kerala, India" },
};

export async function fetchRealWeather(destination) {
  const rawDest = (destination || "").trim();
  if (!rawDest) {
    return {
      success: false,
      status: "UNAVAILABLE",
      reason: "No destination specified for weather check",
      source: "Weather Service",
      fetchedAt: new Date().toISOString(),
    };
  }

  try {
    let latitude, longitude, locationName;

    // Check regional dictionary first (e.g. "Goa", "Goa, India")
    const cleanLower = rawDest.toLowerCase().split(",")[0].trim();
    if (REGIONAL_HUBS[cleanLower]) {
      const hub = REGIONAL_HUBS[cleanLower];
      latitude = hub.latitude;
      longitude = hub.longitude;
      locationName = hub.name;
    } else {
      // 1. Geocoding via Open-Meteo
      const queryName = rawDest.includes(",") ? rawDest.split(",")[0].trim() : rawDest;
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        queryName
      )}&count=5&language=en&format=json`;
      const geoRes = await fetch(geoUrl, { signal: AbortSignal.timeout(4000) });
      if (!geoRes.ok) {
        throw new Error(`Geocoding HTTP error ${geoRes.status}`);
      }
      const geoData = await geoRes.json();
      if (!geoData.results || geoData.results.length === 0) {
        return {
          success: false,
          status: "UNAVAILABLE",
          reason: `Could not geocode destination: "${queryName}"`,
          source: "Open-Meteo Geocoding",
          fetchedAt: new Date().toISOString(),
        };
      }

      let matched = geoData.results[0];
      if (rawDest.toLowerCase().includes("india")) {
        const inMatch = geoData.results.find((r) => r.country_code === "IN" || (r.country && r.country.toLowerCase().includes("india")));
        if (inMatch) matched = inMatch;
      }

      latitude = matched.latitude;
      longitude = matched.longitude;
      locationName = `${matched.name}, ${matched.country || ""}`.trim();
    }

    // 2. Real-time forecast & precipitation
    const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,precipitation,wind_speed_10m&hourly=temperature_2m,precipitation_probability,weather_code&timezone=auto&forecast_days=2`;
    const forecastRes = await fetch(forecastUrl, { signal: AbortSignal.timeout(4000) });
    if (!forecastRes.ok) {
      throw new Error(`Forecast HTTP error ${forecastRes.status}`);
    }

    const forecast = await forecastRes.json();
    const current = forecast.current || {};
    const hourly = forecast.hourly || {};

    // Get max rain probability over the next 24 hours
    const rainProbabilities = hourly.precipitation_probability || [];
    const maxRainProb = rainProbabilities.length > 0
      ? Math.max(...rainProbabilities.slice(0, 24))
      : 0;

    const condition = interpretWmoCode(current.weather_code);

    return {
      success: true,
      status: "LIVE_VERIFIED",
      locationName: locationName || rawDest,
      temperatureC: current.temperature_2m,
      humidity: current.relative_humidity_2m,
      windSpeedKmh: current.wind_speed_10m,
      precipitationMm: current.precipitation,
      rainProbabilityPercent: maxRainProb,
      condition,
      source: "Open-Meteo Weather API",
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.warn(`[TravelData] Weather fetch failed for "${rawDest}":`, err.message);
    return {
      success: false,
      status: "UNAVAILABLE",
      reason: "Live weather service is temporarily unreachable or timed out.",
      source: "Open-Meteo Weather API",
      fetchedAt: new Date().toISOString(),
    };
  }
}

/**
 * Analyze real financial ledger metrics from MongoDB trip data.
 */
export function analyzeTripBudget(trip) {
  const expenses = Array.isArray(trip.expenses) ? trip.expenses : [];
  const budgetTotal = Number(trip.budgetTotal) || 0;
  const totalSpent = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const remaining = budgetTotal - totalSpent;
  const pctUsed = budgetTotal > 0 ? Math.round((totalSpent / budgetTotal) * 100) : 0;

  return {
    success: true,
    status: "LIVE_VERIFIED",
    budgetTotal,
    totalSpent,
    remaining,
    pctUsed,
    expenseCount: expenses.length,
    isOverBudget: totalSpent > budgetTotal,
    source: "Trip Ledger (MongoDB)",
    calculatedAt: new Date().toISOString(),
  };
}

/**
 * Async version that retrieves comprehensive category allocations and projected metrics.
 */
export async function analyzeTripBudgetAsync(tripId) {
  try {
    const { budgetService } = await import("./budget/budget.service.js");
    return await budgetService.getBudgetSummary(tripId);
  } catch (err) {
    return null;
  }
}
