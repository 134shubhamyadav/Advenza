/**
 * Deterministic Risk Radar Engine.
 * Evaluates real-time telemetry (weather signals, itinerary pacing, activity conflicts, transit logistics).
 * Real hazards add to score; favorable conditions do NOT inflate risk score.
 */

function toMins(hhmm) {
  if (!hhmm || typeof hhmm !== "string") return null;
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Evaluate deterministic risks for a trip and destination based on real data.
 * @param {Object} params
 * @param {string} params.destination
 * @param {Object} [params.trip]
 * @param {Object} [params.weatherData]
 * @returns {{ risks: Array, score: number, overallLevel: string }}
 */
export function evaluateRiskEngine({ destination, trip, weatherData }) {
  const risks = [];
  let rawScore = 0;

  const addRisk = ({
    key,
    label,
    level,
    summary,
    tips,
    affectedDate,
    recommendation,
    source,
    isHazard = true,
  }) => {
    if (isHazard) {
      const scoreMap = { low: 5, med: 15, high: 28, critical: 45 };
      rawScore += scoreMap[level] || 10;
    }
    risks.push({
      key,
      label,
      level,
      summary,
      tips: tips || (recommendation ? [recommendation] : []),
      affectedDate: affectedDate || null,
      recommendation: recommendation || (tips && tips[0]) || "",
      source: source || "Risk Radar Engine",
    });
  };

  // 1. REAL WEATHER SIGNALS & HAZARDS
  const weatherSource = weatherData?.provider
    ? `${weatherData.provider} (Live Telemetry)`
    : "Weather Radar (Live Telemetry)";

  if (weatherData) {
    // If the trip date is beyond the supported forecast horizon
    if (weatherData.forecastStatus === "OUT_OF_HORIZON" || weatherData.isForecastAvailable === false) {
      addRisk({
        key: "weather_horizon_pending",
        label: "Weather Forecast Status",
        level: "low",
        summary: weatherData.summary || `Live 5-day meteorological forecast is not yet available for travel dates (${trip?.startDate || "in the future"}). Telemetry activates 5 days prior to departure.`,
        tips: [
          `5-day live precipitation & temperature radar currently covers through ${weatherData.maxSupportedHorizonDate || "5 days ahead"}`,
          "Review historical seasonal averages while awaiting active forecast window",
        ],
        recommendation: "Live radar activates 5 days prior to departure.",
        source: "OpenWeatherMap Horizon",
        isHazard: false, // Informational only, 0 penalty
      });
    } else {
      const { temp, rainChance, windSpeed, alerts, condition } = weatherData;
      const condLower = (condition || "").toLowerCase();

      // Weather Alerts / Severe Notices from official meteorological institutes
      if (alerts && alerts.length > 0) {
        addRisk({
          key: "weather_advisory",
          label: "Official Weather Advisory",
          level: "high",
          summary: `Active advisory: ${alerts[0].event || "Severe weather notice"}. ${alerts[0].headline || ""}`,
          tips: ["Monitor local safety updates", "Keep indoor backup options ready"],
          recommendation: "Avoid outdoor travel during active weather warnings.",
          source: "Meteorological Alert Service",
          isHazard: true,
        });
      }

      // Rain / Precipitation Hazard (using actual daily maximum precipitation probability)
      if (rainChance >= 60 || condLower.includes("rain") || condLower.includes("thunder") || condLower.includes("shower") || condLower.includes("storm")) {
        const dateNotice = weatherData.forecastDate ? ` (${weatherData.forecastDate})` : "";
        addRisk({
          key: "weather_rain",
          label: "Weather & Rain Hazard",
          level: rainChance >= 80 ? "high" : "med",
          summary: `High precipitation chance (${rainChance}% daily max) forecast for ${destination}${dateNotice}. ${condition} conditions expected.`,
          tips: ["Carry rain protection", "Schedule outdoor sightseeing during low-rain windows"],
          recommendation: "Move outdoor activities to clear weather windows or indoor alternatives.",
          source: weatherSource,
          isHazard: true,
        });
      }

      // Extreme Heat Hazard
      if (temp !== null && temp >= 36) {
        addRisk({
          key: "weather_heat",
          label: "Extreme Heat Advisory",
          level: temp >= 40 ? "high" : "med",
          summary: `High temperature (${temp}°C) forecast in ${destination}. Elevated heat index during afternoon hours.`,
          tips: ["Stay hydrated with ORS/water", "Avoid direct sun exposure between 12:00 and 15:30"],
          recommendation: "Plan outdoor heritage visits for early morning or sunset.",
          source: weatherSource,
          isHazard: true,
        });
      } else if (temp !== null && temp <= 4) {
        // Extreme Cold Hazard
        addRisk({
          key: "weather_cold",
          label: "Extreme Cold & Frost Risk",
          level: temp <= 0 ? "high" : "med",
          summary: `Low temperature (${temp}°C) forecast for ${destination}. Freezing morning and night conditions.`,
          tips: ["Pack thermal layers and windproof outerwear", "Confirm accommodation room heating/radiators"],
          recommendation: "Avoid late-night outdoor excursions in sub-zero weather.",
          source: weatherSource,
          isHazard: true,
        });
      }

      // High Wind Hazard
      if (windSpeed !== null && windSpeed >= 38) {
        addRisk({
          key: "weather_wind",
          label: "High Wind Warning",
          level: "med",
          summary: `Strong winds (${windSpeed} km/h) reported in ${destination}. May affect water transit, ferry crossings, or cable cars.`,
          tips: ["Reconfirm ferry/boat schedules", "Secure loose items during rooftop or scenic point visits"],
          recommendation: "Postpone open boat tours during peak wind gusts.",
          source: weatherSource,
          isHazard: true,
        });
      }

      // Favorable Weather (Zero penalty!)
      if (risks.filter((r) => r.key.startsWith("weather")).length === 0) {
        const dateNotice = weatherData.forecastDate ? ` (${weatherData.forecastDate})` : "";
        const metricsSummary = [
          temp !== null && temp !== undefined ? `${temp}°C` : null,
          rainChance !== null && rainChance !== undefined ? `${rainChance}% daily max precipitation probability` : null,
        ].filter(Boolean).join(" with ");
        const conditionText = condition || "clear conditions";
        const summaryText = metricsSummary
          ? `Favorable conditions in ${destination}: ${conditionText}, ${metricsSummary}${dateNotice}.`
          : `Current conditions in ${destination}: ${conditionText}${dateNotice}.`;

        addRisk({
          key: "weather_favorable",
          label: "Weather & Climate",
          level: "low",
          summary: summaryText,
          tips: ["Optimal weather for outdoor exploration", "Comfortable sightseeing conditions"],
          recommendation: "Weather conditions are clear.",
          source: weatherSource,
          isHazard: false, // Favorable condition does NOT add risk points!
        });
      }
    }
  } else {
    addRisk({
      key: "weather_unavailable",
      label: "Weather Telemetry Status",
      level: "low",
      summary: "Live weather telemetry is currently updating. Evaluating schedule, travel, and logistics risks.",
      tips: ["Check local forecast upon arrival"],
      recommendation: "Monitor weather directly from local sources.",
      source: "System Notice",
      isHazard: false,
    });
  }

  // 2. REAL ITINERARY & ACTIVITY CONFLICT RISKS
  if (trip && Array.isArray(trip.days) && trip.days.length > 0) {
    const isBadWeather = weatherData && weatherData.isForecastAvailable !== false && (
      (weatherData.rainChance !== null && weatherData.rainChance !== undefined && weatherData.rainChance >= 60) ||
      (weatherData.temp !== null && weatherData.temp !== undefined && weatherData.temp >= 38) ||
      (weatherData.alerts && weatherData.alerts.length > 0)
    );

    // Check if trip dates fall within live weather radar window (current or within 14 days)
    let isLiveWeatherHorizon = true;
    if (trip.startDate) {
      const startMs = new Date(trip.startDate).getTime();
      const nowMs = Date.now();
      if (!isNaN(startMs)) {
        const daysUntilStart = Math.ceil((startMs - nowMs) / (1000 * 60 * 60 * 24));
        if (daysUntilStart > 14) {
          isLiveWeatherHorizon = false;
        }
      }
    }

    const outdoorKeywords = [
      "beach", "boat", "waterfall", "trek", "hike", "fort", "garden", "lake", "walking", "outdoor", "sightseeing", "safari",
    ];

    let overpackedDaysCount = 0;

    trip.days.forEach((d) => {
      const dateStr = d.date || `Day ${d.dayNumber}`;

      // Check day-specific forecast if available
      const dayForecast = Array.isArray(weatherData?.dailyForecasts)
        ? weatherData.dailyForecasts.find((df) => df.date === d.date)
        : null;

      const dayRainChance = dayForecast ? dayForecast.maxRainChance : (weatherData?.rainChance ?? null);
      const dayTemp = dayForecast ? dayForecast.avgTemp : (weatherData?.temp ?? null);
      const dayCondition = dayForecast ? dayForecast.condition : (weatherData?.condition ?? "Clear");

      const dayHasSevereWeather = dayForecast
        ? ((dayRainChance !== null && dayRainChance !== undefined && dayRainChance >= 60) ||
           (dayTemp !== null && dayTemp !== undefined && (dayTemp >= 38 || dayTemp <= 0)))
        : isBadWeather && isLiveWeatherHorizon && weatherData?.isForecastAvailable !== false;

      // Consolidate outdoor activities on this day into a single clean advisory per day
      if (dayHasSevereWeather) {
        const outdoorActs = (d.activities || []).filter((act) => {
          const descLower = `${act.title || ""} ${act.description || ""}`.toLowerCase();
          return outdoorKeywords.some((kw) => descLower.includes(kw));
        });

        if (outdoorActs.length > 0) {
          const actNames = outdoorActs
            .map((a) => (a.title || a.description || "Outdoor spot").slice(0, 30).trim())
            .slice(0, 3)
            .join(", ");
          const suffix = outdoorActs.length > 3 ? ` (+${outdoorActs.length - 3} more)` : "";
          const condDetails = [
            dayCondition,
            dayTemp !== null && dayTemp !== undefined ? `${dayTemp}°C` : null,
            dayRainChance !== null && dayRainChance !== undefined ? `${dayRainChance}% rain probability` : null,
          ].filter(Boolean).join(", ");

          addRisk({
            key: `activity_conflict_day_${d.dayNumber}`,
            label: "Activity & Weather Conflict",
            level: (dayRainChance !== null && dayRainChance >= 80) ? "high" : "med",
            summary: `Outdoor activities (${actNames}${suffix}) on ${dateStr} conflict with forecast conditions (${condDetails}).`,
            tips: ["Swap outdoor spots with covered indoor museums, galleries, or cultural venues", "Reschedule to an earlier morning or clearer window"],
            affectedDate: dateStr,
            recommendation: `Move outdoor activities on ${dateStr} to indoor alternatives.`,
            source: "Itinerary Conflict Engine",
            isHazard: true,
          });
        }
      }

      // Schedule Overpacking Risk (max 2 entries to prevent runaway score inflation)
      if ((d.activities || []).length >= 6 && overpackedDaysCount < 2) {
        overpackedDaysCount++;
        addRisk({
          key: `schedule_overpacked_day_${d.dayNumber}`,
          label: "Schedule Overpacking Risk",
          level: "med",
          summary: `${dateStr} has ${d.activities.length} scheduled activities. High probability of fatigue and transit delays.`,
          tips: ["Add 30-45 minute rest buffers between afternoon spots", "Keep at least 1 optional/flex activity"],
          affectedDate: dateStr,
          recommendation: "Pace activities to prevent exhaustion and transit delays.",
          source: "Schedule Analysis",
          isHazard: true,
        });
      }
    });
  }

  // 3. REAL LOGISTICS & RETURN JOURNEY RISKS
  if (trip) {
    const arrivalTime = trip.arrivalTime || trip.outboundJourney?.arrivalTime || "";
    const depTime = trip.departureTime || trip.returnJourney?.departureTime || "";
    const checkOutTime = trip.checkOutTime || "";

    if (arrivalTime && (arrivalTime >= "21:30" || arrivalTime <= "05:00")) {
      addRisk({
        key: "logistics_late_arrival",
        label: "Late Arrival Logistics",
        level: "med",
        summary: `Arrival at ${arrivalTime} is late-night. Public transit options and hotel check-in desks may have reduced staffing.`,
        tips: ["Notify hotel of late-night check-in", "Pre-book airport/railway station transfer in advance"],
        recommendation: "Confirm pre-booked transfer prior to departure.",
        source: "Logistics Analysis",
        isHazard: true,
      });
    }

    if (depTime && checkOutTime) {
      const depM = toMins(depTime);
      const outM = toMins(checkOutTime);
      if (depM !== null && outM !== null) {
        if (depM > outM && depM - outM < 120) {
          // Less than 2 hours after checkout
          addRisk({
            key: "logistics_tight_buffer",
            label: "Tight Return Connection",
            level: "high",
            summary: `Return departure at ${depTime} leaves less than 2 hours after hotel check-out at ${checkOutTime}.`,
            tips: ["Request late check-out or store bags with hotel concierge", "Depart directly for airport/station"],
            recommendation: "Increase transfer buffer to avoid missing return transport.",
            source: "Logistics Analysis",
            isHazard: true,
          });
        } else if (depM < outM && depM >= 300) {
          // Early morning departure before hotel standard checkout
          addRisk({
            key: "logistics_early_checkout",
            label: "Early Morning Departure Logistics",
            level: "low",
            summary: `Return departure at ${depTime} is before hotel standard check-out at ${checkOutTime}. Requires early morning checkout settlement.`,
            tips: ["Settle hotel bill the night before departure", "Request packed breakfast if departing before restaurant hours"],
            recommendation: "Arrange express checkout the night before departure.",
            source: "Logistics Analysis",
            isHazard: true,
          });
        }
      }
    }
  }

  // Baseline calibration: 10 base score + real hazard weights
  const score = Math.max(10, Math.min(95, 10 + rawScore));
  const overallLevel = score >= 75 ? "CRITICAL" : score >= 50 ? "HIGH" : score >= 25 ? "MEDIUM" : "LOW";

  return { risks, score, overallLevel };
}
