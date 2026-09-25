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
  if (weatherData) {
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

    // Rain / Precipitation Hazard
    if (rainChance >= 60 || condLower.includes("rain") || condLower.includes("thunder") || condLower.includes("shower") || condLower.includes("storm")) {
      addRisk({
        key: "weather_rain",
        label: "Weather & Rain Hazard",
        level: rainChance >= 80 ? "high" : "med",
        summary: `High precipitation chance (${rainChance}%) forecast for ${destination}. ${condition} conditions expected.`,
        tips: ["Carry rain protection", "Schedule outdoor sightseeing during low-rain windows"],
        recommendation: "Move outdoor activities to clear weather windows or indoor alternatives.",
        source: "Weather Radar",
        isHazard: true,
      });
    }

    // Extreme Heat Hazard
    if (temp >= 36) {
      addRisk({
        key: "weather_heat",
        label: "Extreme Heat Advisory",
        level: temp >= 40 ? "high" : "med",
        summary: `High temperature (${temp}°C) forecast in ${destination}. Elevated heat index during afternoon hours.`,
        tips: ["Stay hydrated with ORS/water", "Avoid direct sun exposure between 12:00 and 15:30"],
        recommendation: "Plan outdoor heritage visits for early morning or sunset.",
        source: "Weather Radar",
        isHazard: true,
      });
    } else if (temp <= 4) {
      // Extreme Cold Hazard
      addRisk({
        key: "weather_cold",
        label: "Extreme Cold & Frost Risk",
        level: temp <= 0 ? "high" : "med",
        summary: `Low temperature (${temp}°C) forecast for ${destination}. Freezing morning and night conditions.`,
        tips: ["Pack thermal layers and windproof outerwear", "Confirm accommodation room heating/radiators"],
        recommendation: "Avoid late-night outdoor excursions in sub-zero weather.",
        source: "Weather Radar",
        isHazard: true,
      });
    }

    // High Wind Hazard
    if (windSpeed >= 38) {
      addRisk({
        key: "weather_wind",
        label: "High Wind Warning",
        level: "med",
        summary: `Strong winds (${windSpeed} km/h) reported in ${destination}. May affect water transit, ferry crossings, or cable cars.`,
        tips: ["Reconfirm ferry/boat schedules", "Secure loose items during rooftop or scenic point visits"],
        recommendation: "Postpone open boat tours during peak wind gusts.",
        source: "Weather Radar",
        isHazard: true,
      });
    }

    // Favorable Weather (Zero penalty!)
    if (risks.filter((r) => r.key.startsWith("weather")).length === 0) {
      addRisk({
        key: "weather_favorable",
        label: "Weather & Climate",
        level: "low",
        summary: `Favorable conditions in ${destination}: ${condition}, ${temp}°C with ${rainChance}% rain probability.`,
        tips: ["Optimal weather for outdoor exploration", "Comfortable sightseeing conditions"],
        recommendation: "Weather conditions are clear.",
        source: "Weather Radar",
        isHazard: false, // Favorable condition does NOT add risk points!
      });
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
    const isBadWeather = weatherData && (weatherData.rainChance >= 60 || weatherData.temp >= 38 || (weatherData.alerts && weatherData.alerts.length > 0));

    trip.days.forEach((d) => {
      const dateStr = d.date || `Day ${d.dayNumber}`;
      const outdoorKeywords = [
        "beach", "boat", "waterfall", "trek", "hike", "fort", "garden", "lake", "walking", "outdoor", "sightseeing", "safari",
      ];

      (d.activities || []).forEach((act) => {
        const descLower = (act.description || "").toLowerCase();
        const isOutdoor = outdoorKeywords.some((kw) => descLower.includes(kw));

        if (isOutdoor && isBadWeather) {
          addRisk({
            key: `activity_conflict_${d.dayNumber}`,
            label: "Activity & Weather Conflict",
            level: "high",
            summary: `Outdoor activity "${(act.description || "").slice(0, 45)}..." on ${dateStr} conflicts with forecast conditions (${weatherData.condition}, ${weatherData.temp}°C, ${weatherData.rainChance}% rain).`,
            tips: ["Swap outdoor activity with indoor museum, gallery, or cultural center", "Reschedule to a clearer date window"],
            affectedDate: dateStr,
            recommendation: `Move outdoor activity on ${dateStr} to an indoor alternative.`,
            source: "Itinerary Conflict Engine",
            isHazard: true,
          });
        }
      });

      if ((d.activities || []).length >= 6) {
        addRisk({
          key: `schedule_overpacked_${d.dayNumber}`,
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
    if (trip.arrivalTime && (trip.arrivalTime >= "21:30" || trip.arrivalTime <= "05:00")) {
      addRisk({
        key: "logistics_late_arrival",
        label: "Late Arrival Logistics",
        level: "med",
        summary: `Arrival at ${trip.arrivalTime} is late-night. Public transit options and hotel check-in desks may have reduced staffing.`,
        tips: ["Notify hotel of late-night check-in", "Pre-book airport/railway station transfer in advance"],
        recommendation: "Confirm pre-booked transfer prior to departure.",
        source: "Logistics Analysis",
        isHazard: true,
      });
    }

    if (trip.departureTime && trip.checkOutTime) {
      const depM = toMins(trip.departureTime);
      const outM = toMins(trip.checkOutTime);
      if (depM && outM && depM - outM < 120 && depM > outM) {
        addRisk({
          key: "logistics_tight_buffer",
          label: "Tight Return Connection",
          level: "high",
          summary: `Return departure at ${trip.departureTime} leaves less than 2 hours after hotel check-out at ${trip.checkOutTime}.`,
          tips: ["Request late check-out or store bags with hotel concierge", "Depart directly for airport/station"],
          recommendation: "Increase transfer buffer to avoid missing return transport.",
          source: "Logistics Analysis",
          isHazard: true,
        });
      }
    }
  }

  // Baseline calibration: 10 base score + real hazard weights
  const score = Math.max(10, Math.min(95, 10 + rawScore));
  const overallLevel = score >= 75 ? "CRITICAL" : score >= 50 ? "HIGH" : score >= 25 ? "MEDIUM" : "LOW";

  return { risks, score, overallLevel };
}
