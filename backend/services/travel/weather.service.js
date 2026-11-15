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

/**
 * Translates WMO weather codes (used by Open-Meteo) into standard descriptive weather strings.
 */
export function getWmoWeatherDescription(code) {
  if (code === 0) return "Clear sky";
  if (code === 1) return "Mainly clear";
  if (code === 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code === 45 || code === 48) return "Foggy";
  if (code === 51 || code === 53 || code === 55) return "Drizzle";
  if (code === 56 || code === 57) return "Freezing drizzle";
  if (code === 61 || code === 63 || code === 65) return "Rain";
  if (code === 66 || code === 67) return "Freezing rain";
  if (code === 71 || code === 73 || code === 75 || code === 77) return "Snow fall";
  if (code === 80 || code === 81 || code === 82) return "Rain showers";
  if (code === 85 || code === 86) return "Snow showers";
  if (code === 95) return "Thunderstorm";
  if (code === 96 || code === 99) return "Thunderstorm with hail";
  return "Clear";
}

// Module-level caches for weather data
const weatherCache = new Map();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Fetch live weather data supporting OpenWeatherMap and WeatherAPI providers with in-memory caching.
 * @param {string} query
 * @param {string} apiKey
 * @param {boolean} forceRefresh
 * @param {Object} [options]
 * @param {string} [options.startDate]
 * @param {string} [options.endDate]
 * @returns {Promise<{ weatherData: Object|null, weatherInfo: string, resolvedCity: string }>}
 */
export async function fetchWeather(query, apiKey, forceRefresh = false, options = {}) {
  const normalized = normalizeDestination(query);
  const cityQuery = normalized.split(",")[0].trim();

  // Parse trip date range if provided (format: YYYY-MM-DD)
  const tripDates = [];
  if (options.startDate) {
    const sDate = new Date(options.startDate);
    const eDate = options.endDate ? new Date(options.endDate) : sDate;
    if (!isNaN(sDate.getTime())) {
      const startStr = sDate.toISOString().split("T")[0];
      const endStr = !isNaN(eDate.getTime()) ? eDate.toISOString().split("T")[0] : startStr;
      let curr = new Date(startStr + "T00:00:00Z");
      const stop = new Date(endStr + "T00:00:00Z");
      while (curr <= stop && tripDates.length < 15) {
        tripDates.push(curr.toISOString().split("T")[0]);
        curr = new Date(curr.getTime() + 86400000);
      }
    }
  }

  const cacheKey = `${normalized.toLowerCase()}_${tripDates.join("_") || "current"}`;

  const now = Date.now();
  if (!forceRefresh) {
    const cached = weatherCache.get(cacheKey);
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      logger.debug(`[Weather] Returning cached weather for ${normalized}`);
      return cached;
    }
  }

  const encodedQuery = encodeURIComponent(cityQuery || normalized);

  // 1. Try OpenWeatherMap API (5-day / 3-hour Forecast endpoint)
  if (apiKey) {
    try {
      const owmForecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${encodedQuery}&appid=${apiKey}&units=metric`;
      const resOWM = await fetch(owmForecastUrl, { signal: AbortSignal.timeout(6000) });

      if (resOWM.ok) {
        const data = await resOWM.json();
        const list = Array.isArray(data.list) ? data.list : [];

        if (list.length > 0) {
          const tzOffsetSec = data.city?.timezone ?? 0;
          const tzHours = tzOffsetSec / 3600;
          const tzFormatted = `UTC${tzHours >= 0 ? `+${tzHours}` : tzHours}`;

          // Map each point to destination local date and time
          const pointsWithLocal = list.map((p) => {
            const localMs = (p.dt + tzOffsetSec) * 1000;
            const localDate = new Date(localMs).toISOString().split("T")[0];
            const localTime = new Date(localMs).toISOString().slice(11, 16);
            return {
              ...p,
              localDate,
              localTime,
              localDateTime: `${localDate} ${localTime}`,
            };
          });

          // Unique dates covered by the 5-day / 3-hour forecast
          const availableDates = Array.from(new Set(pointsWithLocal.map((p) => p.localDate))).sort();
          const maxAvailableDate = availableDates[availableDates.length - 1];
          const minAvailableDate = availableDates[0];

          // SCENARIO 1: Trip dates are provided
          if (tripDates.length > 0) {
            const coveredDates = tripDates.filter((d) => availableDates.includes(d));
            const uncoveredDates = tripDates.filter((d) => !availableDates.includes(d));

            // Case 1A: Entire trip is BEYOND the supported 5-day forecast horizon
            if (coveredDates.length === 0) {
              const weatherData = {
                temp: null,
                condition: "Weather forecast not yet available",
                icon: "",
                humidity: null,
                windSpeed: null,
                uv: null,
                rainChance: null,
                pop: null,
                forecastDate: `${tripDates[0]}${tripDates.length > 1 ? ` to ${tripDates[tripDates.length - 1]}` : ""}`,
                forecastTimestamp: null,
                forecastType: "Out of Horizon",
                forecastStatus: "OUT_OF_HORIZON",
                isForecastAvailable: false,
                isTargetDateForecast: false,
                tripStartDate: tripDates[0],
                tripEndDate: tripDates[tripDates.length - 1],
                maxSupportedHorizonDate: maxAvailableDate,
                destinationTimezone: tzFormatted,
                provider: "OpenWeatherMap",
                alerts: [],
              };

              const weatherInfo = `Weather forecast not yet available for ${data.city?.name || cityQuery} for travel dates (${weatherData.forecastDate}). Live 5-day forecast horizon currently covers through ${maxAvailableDate} (${tzFormatted}).`;
              const result = { weatherData, weatherInfo, resolvedCity: data.city?.name || cityQuery, timestamp: now };
              weatherCache.set(cacheKey, result);
              return result;
            }

            // Case 1B: Trip has covered dates (within 5-day horizon)
            const matchedPoints = pointsWithLocal.filter((p) => coveredDates.includes(p.localDate));

            // Compute daily breakdown for each covered day
            const dailyForecasts = coveredDates.map((date) => {
              const dayPoints = matchedPoints.filter((p) => p.localDate === date);
              const maxPop = dayPoints.length > 0 ? Math.max(...dayPoints.map((p) => typeof p.pop === "number" ? p.pop : 0)) : 0;
              const avgTemp = dayPoints.length > 0
                ? Math.round(dayPoints.reduce((acc, p) => acc + (p.main?.temp ?? 25), 0) / dayPoints.length)
                : 25;
              const maxWind = dayPoints.length > 0
                ? Math.round(Math.max(...dayPoints.map((p) => (p.wind?.speed ?? 3) * 3.6)))
                : 10;
              const prominentCondition = dayPoints.find((p) => p.weather?.[0]?.main === "Rain" || p.weather?.[0]?.main === "Thunderstorm") ||
                dayPoints[Math.floor(dayPoints.length / 2)] ||
                dayPoints[0];

              return {
                date,
                maxPop,
                maxRainChance: Math.round(maxPop * 100),
                avgTemp,
                maxWind,
                condition: prominentCondition?.weather?.[0]?.description || "Clear",
                icon: prominentCondition?.weather?.[0]?.icon
                  ? `https://openweathermap.org/img/wn/${prominentCondition.weather[0].icon}@2x.png`
                  : "",
                humidity: prominentCondition?.main?.humidity ?? null,
              };
            });

            // Overall trip metrics across covered days
            const dailyMaxRainChance = Math.max(...dailyForecasts.map((d) => d.maxRainChance));
            const dailyMaxPop = Math.max(...dailyForecasts.map((d) => d.maxPop));
            const overallAvgTemp = Math.round(dailyForecasts.reduce((acc, d) => acc + d.avgTemp, 0) / dailyForecasts.length);
            const overallMaxWind = Math.max(...dailyForecasts.map((d) => d.maxWind));

            // Choose primary display condition
            const rainDay = dailyForecasts.find((d) => d.maxRainChance >= 50);
            const primaryDisplay = rainDay || dailyForecasts[0];

            const isPartiallyCovered = uncoveredDates.length > 0;

            // Build precise forecast type label
            const forecastType = isPartiallyCovered
              ? `Partial Forecast: ${coveredDates[0]}–${coveredDates[coveredDates.length - 1]} covered (${uncoveredDates.length} day${uncoveredDates.length > 1 ? "s" : ""} not yet available)`
              : tripDates.length > 1
              ? `Trip Forecast (${coveredDates[0]} to ${coveredDates[coveredDates.length - 1]})`
              : `Day Forecast (${coveredDates[0]})`;

            const forecastDateRange = coveredDates.length > 1
              ? `${coveredDates[0]} to ${coveredDates[coveredDates.length - 1]} (${tzFormatted})`
              : `${coveredDates[0]} (${tzFormatted})`;

            // Build partial coverage notice for uncovered dates
            const partialNote = isPartiallyCovered
              ? `Forecast available ${coveredDates[0]}–${coveredDates[coveredDates.length - 1]}. Dates ${uncoveredDates[0]}${uncoveredDates.length > 1 ? ` to ${uncoveredDates[uncoveredDates.length - 1]}` : ""} are outside the current 5-day horizon.`
              : null;

            const weatherData = {
              temp: overallAvgTemp,
              condition: primaryDisplay.condition,
              icon: primaryDisplay.icon,
              humidity: primaryDisplay.humidity,
              windSpeed: overallMaxWind,
              uv: null, // OWM free-tier /forecast endpoint does not provide UV index — do not substitute a placeholder
              rainChance: dailyMaxRainChance, // Daily maximum precipitation probability (highest pop slot across covered days)
              pop: dailyMaxPop,
              forecastDate: forecastDateRange,
              forecastTimestamp: now,
              forecastType,
              forecastStatus: isPartiallyCovered ? "PARTIALLY_COVERED" : "FULL_COVERAGE",
              isForecastAvailable: true,
              isTargetDateForecast: true,
              dailyForecasts,
              coveredDates,
              uncoveredDates,
              partialNote, // null when fully covered; descriptive text when partially covered
              destinationTimezone: tzFormatted,
              maxSupportedHorizonDate: maxAvailableDate,
              provider: "OpenWeatherMap",
              alerts: [],
            };

            const weatherInfo = isPartiallyCovered
              ? `${weatherData.condition}, ${weatherData.temp}°C, max rain probability ${weatherData.rainChance}% across covered dates ${forecastDateRange}. ${partialNote} Provider: OpenWeatherMap.`
              : `${weatherData.condition}, ${weatherData.temp}°C, max rain probability ${weatherData.rainChance}% across trip dates ${forecastDateRange}. Provider: OpenWeatherMap.`;
            const result = { weatherData, weatherInfo, resolvedCity: data.city?.name || cityQuery, timestamp: now };
            weatherCache.set(cacheKey, result);
            return result;
          }

          // SCENARIO 2: No specific trip dates provided (e.g. general destination search)
          // Uses immediate upcoming 24h observation/forecast
          const immediatePoints = pointsWithLocal.slice(0, 8);
          const firstPoint = immediatePoints[0];
          const maxPop = Math.max(...immediatePoints.map((p) => typeof p.pop === "number" ? p.pop : 0));
          const validTemps = immediatePoints.map((p) => p.main?.temp).filter((t) => t != null);
          const avgTemp = validTemps.length > 0 ? Math.round(validTemps.reduce((acc, t) => acc + t, 0) / validTemps.length) : null;
          const validWinds = immediatePoints.map((p) => p.wind?.speed).filter((s) => s != null);
          const maxWind = validWinds.length > 0 ? Math.round(Math.max(...validWinds) * 3.6) : null;

          const weatherData = {
            temp: avgTemp,
            condition: firstPoint.weather?.[0]?.description || firstPoint.weather?.[0]?.main || "Clear",
            icon: firstPoint.weather?.[0]?.icon ? `https://openweathermap.org/img/wn/${firstPoint.weather[0].icon}@2x.png` : "",
            humidity: firstPoint.main?.humidity ?? null,
            windSpeed: maxWind,
            uv: null, // OWM free-tier /forecast endpoint does not provide UV index
            rainChance: Math.round(maxPop * 100),
            pop: maxPop,
            forecastDate: `${firstPoint.localDateTime} (${tzFormatted})`,
            forecastTimestamp: firstPoint.dt * 1000,
            forecastType: "Current Observation & 24h Trend",
            forecastStatus: "CURRENT_OBSERVATION",
            isForecastAvailable: true,
            isTargetDateForecast: false,
            destinationTimezone: tzFormatted,
            provider: "OpenWeatherMap",
            alerts: [],
          };

          const weatherInfo = `Current Observation: ${weatherData.condition}, ${weatherData.temp}°C, humidity ${weatherData.humidity}%, wind ${weatherData.windSpeed} km/h, 24h max rain probability ${weatherData.rainChance}% (${weatherData.forecastDate}).`;
          const result = { weatherData, weatherInfo, resolvedCity: data.city?.name || cityQuery, timestamp: now };
          weatherCache.set(cacheKey, result);
          return result;
        }
      } else {
        logger.warn(`[Weather] OpenWeatherMap forecast returned status ${resOWM.status}: ${resOWM.statusText}`);
      }
    } catch (owmErr) {
      logger.warn(`[Weather] OpenWeatherMap forecast fetch error: ${owmErr.message}`);
    }

    // 1b. Fallback to OpenWeatherMap current weather endpoint if forecast endpoint is unreachable
    try {
      const owmCurrentUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodedQuery}&appid=${apiKey}&units=metric`;
      const resCurrent = await fetch(owmCurrentUrl, { signal: AbortSignal.timeout(5000) });
      if (resCurrent.ok) {
        const data = await resCurrent.json();
        const weatherId = data.weather?.[0]?.id || 800;
        let rainChance = 0;
        if (weatherId >= 200 && weatherId < 300) rainChance = 90;
        else if (weatherId >= 500 && weatherId < 600) rainChance = 80;
        else if (weatherId >= 300 && weatherId < 400) rainChance = 55;
        else if (data.rain) rainChance = 75;
        else if (weatherId >= 600 && weatherId < 700) rainChance = 70;
        else rainChance = 5;

        const tzOffsetSec = data.timezone ?? 0;
        const tzHours = tzOffsetSec / 3600;
        const tzFormatted = `UTC${tzHours >= 0 ? `+${tzHours}` : tzHours}`;
        const localTimeStr = new Date((data.dt + tzOffsetSec) * 1000).toISOString().replace("T", " ").slice(0, 19);

        const currentTemp = data.main?.temp != null ? Math.round(data.main.temp) : null;
        const currentHumidity = data.main?.humidity ?? null;
        const currentWind = data.wind?.speed != null ? Math.round(data.wind.speed * 3.6) : null;

        const weatherData = {
          temp: currentTemp,
          condition: data.weather?.[0]?.description || data.weather?.[0]?.main || "Clear",
          icon: data.weather?.[0]?.icon ? `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png` : "",
          humidity: currentHumidity,
          windSpeed: currentWind,
          uv: null, // OWM free-tier /weather (current) endpoint does not provide UV index
          rainChance,
          pop: rainChance / 100,
          forecastDate: `${localTimeStr} (${tzFormatted})`,
          forecastTimestamp: data.dt ? data.dt * 1000 : now,
          forecastType: "Current Weather Observation",
          forecastStatus: "CURRENT_OBSERVATION",
          isForecastAvailable: true,
          isTargetDateForecast: false,
          destinationTimezone: tzFormatted,
          provider: "OpenWeatherMap",
          alerts: [],
        };

        const weatherInfo = `${weatherData.condition}${weatherData.temp != null ? `, ${weatherData.temp}°C` : ""}${weatherData.humidity != null ? `, humidity ${weatherData.humidity}%` : ""}${weatherData.windSpeed != null ? `, wind ${weatherData.windSpeed} km/h` : ""}${weatherData.rainChance != null ? `, rain probability ${weatherData.rainChance}%` : ""}.`;
        const result = { weatherData, weatherInfo, resolvedCity: data.name || cityQuery, timestamp: now };
        weatherCache.set(cacheKey, result);
        return result;
      }
    } catch (currErr) {
      logger.warn(`[Weather] OpenWeatherMap current weather fetch error: ${currErr.message}`);
    }

    // 2. Try WeatherAPI.com as secondary provider
    try {
      const wapiUrl = `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${encodedQuery}&days=3&aqi=no&alerts=yes`;
      const resWAPI = await fetch(wapiUrl, { signal: AbortSignal.timeout(5000) });

      if (resWAPI.ok) {
        const w = await resWAPI.json();
        const alertsList = w.alerts?.alert || [];
        const alertsSummary = alertsList.map((a) => `${a.event}: ${a.headline}`).join("; ") || "No active alerts";

        const forecastDays = w.forecast?.forecastday || [];
        const targetDay = tripDates[0]
          ? forecastDays.find((fd) => fd.date === tripDates[0]) || null
          : forecastDays[0];

        if (tripDates.length > 0 && !targetDay) {
          // Out of horizon for WeatherAPI
          const weatherData = {
            temp: null,
            condition: "Weather forecast not yet available",
            icon: "",
            humidity: null,
            windSpeed: null,
            uv: null,
            rainChance: null,
            pop: null,
            forecastDate: tripDates[0],
            forecastTimestamp: null,
            forecastType: "Out of Horizon",
            forecastStatus: "OUT_OF_HORIZON",
            isForecastAvailable: false,
            isTargetDateForecast: false,
            provider: "WeatherAPI",
            alerts: [],
          };
          const weatherInfo = `Weather forecast not yet available for ${w.location?.name || cityQuery} for ${tripDates[0]}.`;
          const result = { weatherData, weatherInfo, resolvedCity: w.location?.name || cityQuery, timestamp: now };
          weatherCache.set(cacheKey, result);
          return result;
        }

        const rainChance = targetDay?.day?.daily_chance_of_rain || 0;
        const rawTemp = targetDay?.day?.avgtemp_c ?? w.current?.temp_c;
        const parsedTemp = rawTemp != null ? Math.round(rawTemp) : null;
        const parsedHumidity = targetDay?.day?.avghumidity ?? w.current?.humidity ?? null;
        const rawWind = targetDay?.day?.maxwind_kph ?? w.current?.wind_kph;
        const parsedWind = rawWind != null ? Math.round(rawWind) : null;
        const parsedUv = targetDay?.day?.uv ?? w.current?.uv ?? null;

        const weatherData = {
          temp: parsedTemp,
          condition: targetDay?.day?.condition?.text || w.current?.condition?.text || "Clear",
          icon: targetDay?.day?.condition?.icon || w.current?.condition?.icon || "",
          humidity: parsedHumidity,
          windSpeed: parsedWind,
          uv: parsedUv,
          rainChance,
          pop: rainChance / 100,
          forecastDate: targetDay?.date || new Date().toISOString(),
          forecastTimestamp: now,
          forecastType: targetDay ? "Trip Forecast" : "Current Weather",
          forecastStatus: targetDay ? "FULL_COVERAGE" : "CURRENT_OBSERVATION",
          isForecastAvailable: true,
          isTargetDateForecast: Boolean(targetDay),
          alerts: alertsList.map((a) => ({
            event: a.event,
            headline: a.headline,
            desc: a.desc || "",
            severity: a.severity || "Unknown",
          })),
          provider: "WeatherAPI",
        };

        const weatherInfo = `${weatherData.condition}${weatherData.temp != null ? `, ${weatherData.temp}°C` : ""}${weatherData.humidity != null ? `, humidity ${weatherData.humidity}%` : ""}${weatherData.windSpeed != null ? `, wind ${weatherData.windSpeed} km/h` : ""}${weatherData.uv != null ? `, UV index ${weatherData.uv}` : ""}${weatherData.rainChance != null ? `, daily max rain probability ${weatherData.rainChance}%` : ""}. Alerts: ${alertsSummary}`;
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

          const wCode = current.weather_code ?? 0;
          const conditionDesc = getWmoWeatherDescription(wCode);
          const isRainyCode = (wCode >= 51 && wCode <= 67) || (wCode >= 80 && wCode <= 82) || wCode >= 95;
          const effectiveRainChance = Math.max(maxRainProb, isRainyCode ? 75 : 0);

          const omTemp = current.temperature_2m != null ? Math.round(current.temperature_2m) : null;
          const omHumidity = current.relative_humidity_2m ?? null;
          const omWind = current.wind_speed_10m != null ? Math.round(current.wind_speed_10m) : null;

          const weatherData = {
            temp: omTemp,
            condition: conditionDesc,
            icon: "",
            humidity: omHumidity,
            windSpeed: omWind,
            uv: null, // Open-Meteo free tier standard forecast does not supply UV index without specific variables
            rainChance: effectiveRainChance,
            alerts: [],
            provider: "Open-Meteo Free Meteorological API",
          };
          const weatherInfo = `${weatherData.condition}${weatherData.temp != null ? `, ${weatherData.temp}°C` : ""}${weatherData.humidity != null ? `, humidity ${weatherData.humidity}%` : ""}${weatherData.windSpeed != null ? `, wind ${weatherData.windSpeed} km/h` : ""}${weatherData.rainChance != null ? `, rain chance ${effectiveRainChance}%` : ""}.`;
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
