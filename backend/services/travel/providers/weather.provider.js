import { BaseWeatherProvider } from "./base.provider.js";
import { logger } from "../../../utils/logger.js";
import { normalizeDestination } from "../weather.service.js";

// WMO code interpreter
function interpretWmoCode(code) {
  if (code === 0) return "Clear sky";
  if (code === 1 || code === 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code === 45 || code === 48) return "Foggy";
  if (code >= 51 && code <= 55) return "Light drizzle";
  if (code >= 61 && code <= 65) return "Rain";
  if (code >= 71 && code <= 77) return "Snow fall";
  if (code >= 80 && code <= 82) return "Rain showers";
  if (code >= 95) return "Thunderstorm";
  return "Variable conditions";
}

const REGIONAL_HUBS = {
  goa: { latitude: 15.4909, longitude: 73.8278, name: "Goa, India" },
  ladakh: { latitude: 34.1526, longitude: 77.5771, name: "Ladakh, India" },
  andaman: { latitude: 11.6234, longitude: 92.7265, name: "Port Blair, Andaman, India" },
  kashmir: { latitude: 34.0837, longitude: 74.7973, name: "Srinagar, Kashmir, India" },
  coorg: { latitude: 12.3375, longitude: 75.8069, name: "Coorg, Karnataka, India" },
  wayanad: { latitude: 11.6854, longitude: 76.132, name: "Wayanad, Kerala, India" },
  manali: { latitude: 32.2432, longitude: 77.1892, name: "Manali, Himachal Pradesh, India" },
  shimla: { latitude: 31.1048, longitude: 77.1734, name: "Shimla, Himachal Pradesh, India" },
  rishikesh: { latitude: 30.0869, longitude: 78.2676, name: "Rishikesh, Uttarakhand, India" },
  udaipur: { latitude: 24.5854, longitude: 73.7125, name: "Udaipur, Rajasthan, India" },
  jaipur: { latitude: 26.9124, longitude: 75.7873, name: "Jaipur, Rajasthan, India" },
  mumbai: { latitude: 19.076, longitude: 72.8777, name: "Mumbai, Maharashtra, India" },
  delhi: { latitude: 28.6139, longitude: 77.209, name: "New Delhi, Delhi, India" },
  bangalore: { latitude: 12.9716, longitude: 77.5946, name: "Bengaluru, Karnataka, India" },
  paris: { latitude: 48.8566, longitude: 2.3522, name: "Paris, France" },
  tokyo: { latitude: 35.6762, longitude: 139.6503, name: "Tokyo, Japan" },
  dubai: { latitude: 25.2048, longitude: 55.2708, name: "Dubai, United Arab Emirates" },
  london: { latitude: 51.5074, longitude: -0.1278, name: "London, United Kingdom" },
  singapore: { latitude: 1.3521, longitude: 103.8198, name: "Singapore" },
  bali: { latitude: -8.3405, longitude: 115.092, name: "Bali, Indonesia" },
};

export class WeatherProvider extends BaseWeatherProvider {
  constructor() {
    super("OpenMeteoWeatherProvider");
  }

  /**
   * Geocode a destination name to coordinates.
   */
  async geocode(query) {
    const normalized = normalizeDestination(query);
    const cleanLower = normalized.toLowerCase().split(",")[0].trim();

    if (REGIONAL_HUBS[cleanLower]) {
      return REGIONAL_HUBS[cleanLower];
    }

    const queryName = normalized.includes(",") ? normalized.split(",")[0].trim() : normalized;
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      queryName
    )}&count=5&language=en&format=json`;

    const geoRes = await fetch(geoUrl, { signal: AbortSignal.timeout(4000) });
    if (!geoRes.ok) throw new Error(`Geocoding failed with status ${geoRes.status}`);

    const geoData = await geoRes.json();
    if (!geoData.results || geoData.results.length === 0) {
      throw new Error(`Could not geocode location: "${queryName}"`);
    }

    let match = geoData.results[0];
    if (normalized.toLowerCase().includes("india")) {
      const inMatch = geoData.results.find(
        (r) => r.country_code === "IN" || (r.country && r.country.toLowerCase().includes("india"))
      );
      if (inMatch) match = inMatch;
    }

    return {
      latitude: match.latitude,
      longitude: match.longitude,
      name: `${match.name}, ${match.country || ""}`.trim(),
    };
  }

  /**
   * Fetch full weather payload (current + hourly forecast).
   */
  async getFullForecast(location, days = 7) {
    const geo = await this.geocode(location);
    const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${geo.latitude}&longitude=${geo.longitude}&current=temperature_2m,relative_humidity_2m,weather_code,precipitation,wind_speed_10m&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m&timezone=auto&forecast_days=${Math.min(14, Math.max(1, days))}`;

    const res = await fetch(forecastUrl, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`Open-Meteo HTTP error: ${res.status}`);

    const data = await res.json();
    const current = data.current || {};
    const hourly = data.hourly || {};

    const nowIso = new Date().toISOString();

    // Normalized Current
    const normalizedCurrent = {
      locationName: geo.name,
      latitude: geo.latitude,
      longitude: geo.longitude,
      temperatureC: Math.round(current.temperature_2m ?? 24),
      feelsLikeC: Math.round(current.temperature_2m ?? 24),
      condition: interpretWmoCode(current.weather_code),
      precipitationMm: current.precipitation ?? 0,
      rainProbabilityPercent: hourly.precipitation_probability?.[0] ?? 0,
      windSpeedKmh: Math.round(current.wind_speed_10m ?? 8),
      humidity: current.relative_humidity_2m ?? 60,
      weatherAlerts: [],
      source: "Open-Meteo Verified Meteorology API",
      lastUpdated: nowIso,
    };

    // Normalized Hourly List
    const normalizedHourly = [];
    const times = hourly.time || [];
    for (let i = 0; i < times.length; i++) {
      normalizedHourly.push({
        time: times[i],
        temperatureC: Math.round(hourly.temperature_2m?.[i] ?? 24),
        precipitationProbability: hourly.precipitation_probability?.[i] ?? 0,
        precipitationMm: hourly.precipitation?.[i] ?? 0,
        windSpeedKmh: Math.round(hourly.wind_speed_10m?.[i] ?? 8),
        condition: interpretWmoCode(hourly.weather_code?.[i]),
      });
    }

    return {
      current: normalizedCurrent,
      hourly: normalizedHourly,
      source: "Open-Meteo Verified Meteorology API",
      lastUpdated: nowIso,
    };
  }

  /**
   * Get current weather.
   */
  async getCurrentWeather(location) {
    try {
      const forecast = await this.getFullForecast(location, 2);
      return {
        success: true,
        status: "LIVE_VERIFIED",
        data: forecast.current,
        source: forecast.source,
        lastUpdated: forecast.lastUpdated,
      };
    } catch (err) {
      logger.warn(`[WeatherProvider] Error for ${location}: ${err.message}`);
      return {
        success: false,
        status: "UNAVAILABLE",
        reason: `Live meteorological station feed unavailable for "${location}": ${err.message}`,
        source: "Open-Meteo Meteorology API",
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  /**
   * Get hourly weather forecast.
   */
  async getHourlyForecast(location, date) {
    try {
      const forecast = await this.getFullForecast(location, 7);
      let list = forecast.hourly;
      if (date) {
        list = list.filter((h) => h.time.startsWith(date));
      }
      return {
        success: true,
        status: "LIVE_VERIFIED",
        results: list,
        source: forecast.source,
        lastUpdated: forecast.lastUpdated,
      };
    } catch (err) {
      return {
        success: false,
        status: "UNAVAILABLE",
        reason: err.message,
        results: [],
        source: "Open-Meteo Meteorology API",
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  /**
   * Matches the exact scheduled activity date & time against hourly forecast.
   */
  async getActivityWeather({ location, date, time }) {
    try {
      const forecast = await this.getFullForecast(location, 14);

      if (!date) {
        // Fallback to current weather if no date specified
        return {
          matched: false,
          fallbackCurrent: true,
          weather: forecast.current,
          source: forecast.source,
          lastUpdated: forecast.lastUpdated,
        };
      }

      // Format date YYYY-MM-DD
      const targetDate = typeof date === "string" ? date.split("T")[0] : new Date(date).toISOString().split("T")[0];

      // Format hour string (e.g. "16:00" -> "16:00", "4 PM" -> "16:00")
      let hourStr = "12:00";
      if (time) {
        const timeMatch = time.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
        if (timeMatch) {
          let h = parseInt(timeMatch[1], 10);
          const isPm = timeMatch[3]?.toLowerCase() === "pm";
          const isAm = timeMatch[3]?.toLowerCase() === "am";
          if (isPm && h < 12) h += 12;
          if (isAm && h === 12) h = 0;
          hourStr = `${String(h).padStart(2, "0")}:00`;
        }
      }

      const targetIsoHour = `${targetDate}T${hourStr}`;
      const hourlySlot = forecast.hourly.find((h) => h.time.startsWith(targetIsoHour.slice(0, 13))) ||
        forecast.hourly.find((h) => h.time.startsWith(targetDate));

      if (!hourlySlot) {
        return {
          matched: false,
          reason: `Activity date (${targetDate}) is outside the 14-day live weather radar window.`,
          dataType: "UNAVAILABLE",
          source: forecast.source,
          lastUpdated: forecast.lastUpdated,
        };
      }

      const rainProb = hourlySlot.precipitationProbability;
      const tempC = hourlySlot.temperatureC;
      const isRainRisk = rainProb >= 60;
      const isHeatRisk = tempC >= 38;
      const isColdRisk = tempC <= 3;

      let riskReason = null;
      let severity = "info";
      if (isRainRisk) {
        severity = rainProb >= 80 ? "bad" : "warn";
        riskReason = `${rainProb}% rain probability forecasted during scheduled activity time (${hourStr}).`;
      } else if (isHeatRisk) {
        severity = "warn";
        riskReason = `Extreme heat (${tempC}°C) forecasted during scheduled activity time (${hourStr}).`;
      } else if (isColdRisk) {
        severity = "warn";
        riskReason = `Near-freezing cold (${tempC}°C) forecasted during scheduled activity time (${hourStr}).`;
      }

      return {
        matched: true,
        forecastTime: hourlySlot.time,
        temperatureC: tempC,
        rainProbabilityPercent: rainProb,
        condition: hourlySlot.condition,
        windSpeedKmh: hourlySlot.windSpeedKmh,
        isRisk: isRainRisk || isHeatRisk || isColdRisk,
        riskType: isRainRisk ? "RAIN_RISK" : isHeatRisk ? "HEAT_RISK" : isColdRisk ? "COLD_RISK" : "OPTIMAL",
        riskReason,
        severity,
        source: forecast.source,
        lastUpdated: forecast.lastUpdated,
      };
    } catch (err) {
      return {
        matched: false,
        reason: `Could not verify activity weather: ${err.message}`,
        dataType: "UNAVAILABLE",
        source: "Weather Service",
        lastUpdated: new Date().toISOString(),
      };
    }
  }
}

export const weatherProvider = new WeatherProvider();
export default weatherProvider;
