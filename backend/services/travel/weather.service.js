import { logger } from "../../utils/logger.js";

/**
 * Known misspellings → canonical city names.
 * Keys are lowercase with no extra spaces.
 */
export const CITY_CORRECTIONS = {
  // Hyderabad
  hyderbad: "Hyderabad",
  hydrebad: "Hyderabad",
  hydrabad: "Hyderabad",
  hyadrabad: "Hyderabad",
  // Bangalore
  banglore: "Bangalore",
  bangalor: "Bangalore",
  bangalorr: "Bangalore",
  bengaluru: "Bangalore",
  bengalore: "Bangalore",
  bangaluru: "Bangalore",
  // Mumbai
  mumabi: "Mumbai",
  mumbaii: "Mumbai",
  bombay: "Mumbai",
  mumbi: "Mumbai",
  // Delhi
  deli: "Delhi",
  dehli: "Delhi",
  delhy: "Delhi",
  dilhi: "Delhi",
  "new deli": "New Delhi",
  "new dehli": "New Delhi",
  // Chennai
  chinnai: "Chennai",
  madras: "Chennai",
  chennaii: "Chennai",
  // Kolkata
  kolkatta: "Kolkata",
  calcutta: "Kolkata",
  kolcata: "Kolkata",
  // Pune
  poona: "Pune",
  punee: "Pune",
  // Varanasi
  benaras: "Varanasi",
  benares: "Varanasi",
  banarasi: "Varanasi",
  // Ahmedabad
  amhedabad: "Ahmedabad",
  ahemadabad: "Ahmedabad",
  ahmadabad: "Ahmedabad",
  // Shimla
  simla: "Shimla",
  // Dehradun
  "dehra dun": "Dehradun",
  dehardun: "Dehradun",
  // Haridwar
  hardwar: "Haridwar",
  haridwaar: "Haridwar",
  // Ladakh
  ladakh: "Leh",
  // Goa variations
  "north goa": "Panaji",
  "south goa": "Goa",
  // Kerala cities
  trivandrum: "Thiruvananthapuram",
  cochin: "Kochi",
  calicut: "Kozhikode",
  // Mysore
  mysuru: "Mysore",
  // Hubli
  hubballi: "Hubli",
  // Visakhapatnam
  vizag: "Visakhapatnam",
  // Tiruchirappalli
  trichy: "Tiruchirappalli",
  // Mangalore
  manglore: "Mangalore",
  mangaluru: "Mangalore",
  // Gauhati
  gauhati: "Guwahati",
  // Bhubaneswar
  bhuvneshwar: "Bhubaneswar",
  bhubneswar: "Bhubaneswar",
  // Panaji
  panjim: "Panaji",
  // Belgaum
  belagavi: "Belgaum",
  // International common typos
  londun: "London",
  londen: "London",
  paries: "Paris",
  parris: "Paris",
  singapur: "Singapore",
  singapoor: "Singapore",
  dubaii: "Dubai",
  duabi: "Dubai",
  bangkock: "Bangkok",
  bangkoc: "Bangkok",
  tokio: "Tokyo",
  tokoyo: "Tokyo",
  bejing: "Beijing",
  bijing: "Beijing",
  newyork: "New York",
  "new yok": "New York",
  syedney: "Sydney",
  sydny: "Sydney",
};

/**
 * Normalize a raw destination string.
 * @param {string} raw
 * @returns {string} Canonical name
 */
export function normalizeDestination(raw) {
  if (!raw || typeof raw !== "string") return "";
  const cleaned = raw.trim().replace(/\s+/g, " ");
  const lower = cleaned.toLowerCase();
  if (CITY_CORRECTIONS[lower]) {
    const corrected = CITY_CORRECTIONS[lower];
    logger.debug(`[Risk] Destination normalized: "${cleaned}" → "${corrected}"`);
    return corrected;
  }
  return cleaned;
}

// Module-level caches for weather data
const weatherCache = new Map();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Fetch live weather data supporting OpenWeatherMap and WeatherAPI providers with in-memory caching.
 * @param {string} query
 * @param {string} apiKey
 * @param {boolean} forceRefresh
 * @returns {Promise<{ weatherData: Object|null, weatherInfo: string, resolvedCity: string }>}
 */
export async function fetchWeather(query, apiKey, forceRefresh = false) {
  const normalized = normalizeDestination(query);
  const cityQuery = normalized.split(",")[0].trim();
  const cacheKey = normalized.toLowerCase();

  const now = Date.now();
  if (!forceRefresh) {
    const cached = weatherCache.get(cacheKey);
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      logger.debug(`[Weather] Returning cached weather for ${normalized}`);
      return cached;
    }
  }

  const encodedQuery = encodeURIComponent(cityQuery || normalized);

  // 1. Try OpenWeatherMap API
  if (apiKey) {
    try {
      const owmUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodedQuery}&appid=${apiKey}&units=metric`;
      const resOWM = await fetch(owmUrl, { signal: AbortSignal.timeout(5000) });

      if (resOWM.ok) {
        const data = await resOWM.json();
        const weatherData = {
          temp: Math.round(data.main?.temp ?? 25),
          condition: data.weather?.[0]?.description || data.weather?.[0]?.main || "Clear",
          icon: data.weather?.[0]?.icon ? `//openweathermap.org/img/wn/${data.weather[0].icon}@2x.png` : "",
          humidity: data.main?.humidity ?? 60,
          windSpeed: Math.round((data.wind?.speed ?? 3) * 3.6),
          uv: 4,
          rainChance: data.clouds?.all ?? (data.rain ? 80 : 15),
          alerts: [],
        };

        const weatherInfo = `${weatherData.condition}, ${weatherData.temp}°C, humidity ${weatherData.humidity}%, wind ${weatherData.windSpeed} km/h, rain probability ${weatherData.rainChance}%.`;
        const result = { weatherData, weatherInfo, resolvedCity: data.name || cityQuery, timestamp: now };
        weatherCache.set(cacheKey, result);
        return result;
      }
    } catch (owmErr) {
      logger.warn(`[Weather] OpenWeatherMap fetch error: ${owmErr.message}`);
    }

    // 2. Try WeatherAPI.com as secondary provider
    try {
      const wapiUrl = `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${encodedQuery}&days=1&aqi=no&alerts=yes`;
      const resWAPI = await fetch(wapiUrl, { signal: AbortSignal.timeout(5000) });

      if (resWAPI.ok) {
        const w = await resWAPI.json();
        const alertsList = w.alerts?.alert || [];
        const alertsSummary = alertsList.map((a) => `${a.event}: ${a.headline}`).join("; ") || "No active alerts";

        const weatherData = {
          temp: Math.round(w.current?.temp_c ?? 25),
          condition: w.current?.condition?.text || "Clear",
          icon: w.current?.condition?.icon || "",
          humidity: w.current?.humidity ?? 60,
          windSpeed: Math.round(w.current?.wind_kph ?? 10),
          uv: w.current?.uv ?? 4,
          rainChance: w.forecast?.forecastday?.[0]?.day?.daily_chance_of_rain || 0,
          alerts: alertsList.map((a) => ({
            event: a.event,
            headline: a.headline,
            desc: a.desc || "",
            severity: a.severity || "Unknown",
          })),
        };

        const weatherInfo = `${w.current?.condition?.text}, ${w.current?.temp_c}°C, humidity ${w.current?.humidity}%, wind ${w.current?.wind_kph} km/h, UV index ${w.current?.uv}, rain probability ${weatherData.rainChance}%. Alerts: ${alertsSummary}`;
        const result = { weatherData, weatherInfo, resolvedCity: w.location?.name || cityQuery, timestamp: now };
        weatherCache.set(cacheKey, result);
        return result;
      }
    } catch (wapiErr) {
      logger.warn(`[Weather] WeatherAPI fetch error: ${wapiErr.message}`);
    }
  }

  // 3. Fallback: Open-Meteo free geocoding + weather (no key required)
  try {
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodedQuery}&count=1&language=en&format=json`;
    const geoRes = await fetch(geoUrl, { signal: AbortSignal.timeout(4000) });
    if (geoRes.ok) {
      const geoData = await geoRes.json();
      if (geoData.results && geoData.results.length > 0) {
        const place = geoData.results[0];
        const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&hourly=precipitation_probability&timezone=auto&forecast_days=1`;
        const fRes = await fetch(forecastUrl, { signal: AbortSignal.timeout(4000) });
        if (fRes.ok) {
          const fData = await fRes.json();
          const current = fData.current || {};
          const hourly = fData.hourly || {};
          const maxRainProb = hourly.precipitation_probability?.length
            ? Math.max(...hourly.precipitation_probability.slice(0, 24))
            : 0;

          const weatherData = {
            temp: Math.round(current.temperature_2m ?? 25),
            condition: "Clear",
            icon: "",
            humidity: current.relative_humidity_2m ?? 60,
            windSpeed: Math.round(current.wind_speed_10m ?? 10),
            uv: 4,
            rainChance: maxRainProb,
            alerts: [],
          };
          const weatherInfo = `${weatherData.temp}°C, humidity ${weatherData.humidity}%, wind ${weatherData.windSpeed} km/h, rain chance ${maxRainProb}%.`;
          const result = { weatherData, weatherInfo, resolvedCity: place.name || cityQuery, timestamp: now };
          weatherCache.set(cacheKey, result);
          return result;
        }
      }
    }
  } catch (omErr) {
    logger.warn(`[Weather] Open-Meteo fallback error: ${omErr.message}`);
  }

  return { weatherData: null, weatherInfo: "Weather data temporarily unavailable", resolvedCity: cityQuery };
}
