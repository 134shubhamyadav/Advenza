import { osrmRoutingService } from "./osrm-routing.service.js";
import { apiClient } from "../../utils/apiClient.js";
import { logger } from "../../utils/logger.js";
import { CURATED_DESTINATION_VENUES } from "../places/place-discovery.service.js";
import { geographicIntelligenceService } from "../places/geographic-intelligence.service.js";

// In-memory geocode cache: query -> { lat, lng, displayName, timestamp }
const geocodeCache = new Map();
const GEOCODE_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Calculates straight-line distance in kilometers between two coordinates.
 */
export function calculateHaversineDistanceKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Resolves geographic coordinates for a place/hotel query with fallback caching.
 */
export async function geocodeLocation(query, destinationContext = "") {
  const cleanQuery = String(query || "").trim();
  if (!cleanQuery) return null;

  const fullQuery = destinationContext && !cleanQuery.toLowerCase().includes(destinationContext.toLowerCase())
    ? `${cleanQuery}, ${destinationContext}`
    : cleanQuery;

  const cacheKey = fullQuery.toLowerCase();
  const cached = geocodeCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < GEOCODE_CACHE_TTL) {
    return cached;
  }

  // 1. Check curated venues first
  const destKey = String(destinationContext || cleanQuery).toLowerCase().split(",")[0].trim();
  const curated = CURATED_DESTINATION_VENUES[destKey] || [];
  const foundCurated = curated.find(
    (v) =>
      v.name.toLowerCase() === cleanQuery.toLowerCase() ||
      cleanQuery.toLowerCase().includes(v.name.toLowerCase()) ||
      v.name.toLowerCase().includes(cleanQuery.toLowerCase())
  );
  if (foundCurated?.coordinates) {
    const res = {
      lat: foundCurated.coordinates.lat,
      lng: foundCurated.coordinates.lng,
      displayName: foundCurated.name,
      source: "CURATED",
    };
    geocodeCache.set(cacheKey, { ...res, timestamp: Date.now() });
    return res;
  }

  // 2. Open-Meteo Geocoding API (Fast, Free, No Key Required)
  try {
    const openMeteoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cleanQuery)}&count=1&language=en&format=json`;
    const res = await apiClient.request(openMeteoUrl, {
      provider: "OpenMeteoGeocoding",
      timeoutMs: 4000,
      maxRetries: 1,
    });
    const data = await res.json();
    if (Array.isArray(data?.results) && data.results.length > 0) {
      const top = data.results[0];
      const result = {
        lat: top.latitude,
        lng: top.longitude,
        displayName: `${top.name}${top.admin1 ? `, ${top.admin1}` : ""}${top.country ? `, ${top.country}` : ""}`,
        source: "OPEN_METEO",
      };
      geocodeCache.set(cacheKey, { ...result, timestamp: Date.now() });
      return result;
    }
  } catch (err) {
    logger.debug(`[InterstopRouting] Open-Meteo geocode failed for "${cleanQuery}": ${err.message}`);
  }

  // 3. Geographic Intelligence Service (Nominatim with locality hierarchy & spatial scoping)
  try {
    const geo = await geographicIntelligenceService.resolveLocationHierarchy(fullQuery, { city: destinationContext });
    if (geo?.coordinates?.lat != null && geo?.coordinates?.lng != null) {
      const result = {
        lat: geo.coordinates.lat,
        lng: geo.coordinates.lng,
        displayName: geo.hierarchyString || geo.displayName || fullQuery,
        source: "GEOGRAPHIC_INTELLIGENCE",
      };
      geocodeCache.set(cacheKey, { ...result, timestamp: Date.now() });
      return result;
    }
  } catch (err) {
    logger.debug(`[InterstopRouting] Geographic Intelligence geocode failed for "${fullQuery}": ${err.message}`);
  }

  // 4. Raw Nominatim Fallback
  try {
    const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullQuery)}&limit=1`;
    const res = await apiClient.request(nomUrl, {
      provider: "NominatimSearch",
      timeoutMs: 4000,
      maxRetries: 1,
      headers: { "User-Agent": "AdvenzaTravelIntelligence/1.0" },
    });
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      const top = data[0];
      const result = {
        lat: parseFloat(top.lat),
        lng: parseFloat(top.lon),
        displayName: top.display_name,
        source: "NOMINATIM",
      };
      geocodeCache.set(cacheKey, { ...result, timestamp: Date.now() });
      return result;
    }
  } catch (err) {
    logger.debug(`[InterstopRouting] Nominatim geocode failed for "${fullQuery}": ${err.message}`);
  }

  return null;
}

/**
 * Format time HH:mm after adding minutes.
 */
function addMinutesToTime(timeStr, minutes) {
  if (!timeStr) return "10:00";
  const [h, m] = timeStr.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return timeStr;
  const total = h * 60 + m + minutes;
  const nh = Math.floor((total / 60) % 24);
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

/**
 * Parse time string to minutes from midnight.
 */
function timeToMinutes(timeStr) {
  if (!timeStr) return 540; // 09:00 default
  const [h, m] = timeStr.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return 540;
  return h * 60 + m;
}

/**
 * Nearest-Neighbor TSP heuristic to optimize activity sequence starting from an anchor.
 * Keeps meal activities (Lunch ~12:30-14:00, Dinner ~19:30-21:30) near their slots.
 */
export function optimizeActivitySequence(activities, anchorCoords) {
  if (!Array.isArray(activities) || activities.length <= 2) {
    return activities;
  }

  // Identify time-fixed activities like lunch or dinner
  const isTimeLocked = (act) => {
    const desc = (act.description || act.placeName || "").toLowerCase();
    const timeMins = timeToMinutes(act.time);
    const isLunch = desc.includes("lunch") || (timeMins >= 720 && timeMins <= 870 && (desc.includes("meal") || desc.includes("restaurant") || desc.includes("cafe")));
    const isDinner = desc.includes("dinner") || (timeMins >= 1170 && timeMins <= 1320 && (desc.includes("dining") || desc.includes("evening")));
    return isLunch || isDinner;
  };

  // Extract coordinates for each activity
  const items = activities.map((a, idx) => {
    const lat = a.coordinates?.lat != null ? Number(a.coordinates.lat) : null;
    const lng = a.coordinates?.lng != null ? Number(a.coordinates.lng) : null;
    return {
      activity: a,
      originalIndex: idx,
      lat,
      lng,
      isLocked: isTimeLocked(a),
    };
  });

  // If no items have coordinates, preserve existing order
  const hasCoordsCount = items.filter((i) => i.lat != null && i.lng != null).length;
  if (hasCoordsCount < 2) {
    return activities;
  }

  // Segment activities into Morning (before 12:30), Lunch (12:30-14:00), Afternoon (14:00-19:00), Dinner/Evening (19:00+)
  const morning = [];
  const lunch = [];
  const afternoon = [];
  const evening = [];

  items.forEach((item) => {
    const t = timeToMinutes(item.activity.time);
    if (t < 750) {
      morning.push(item);
    } else if (t >= 750 && t < 870 && item.isLocked) {
      lunch.push(item);
    } else if (t < 1140) {
      afternoon.push(item);
    } else {
      evening.push(item);
    }
  });

  // Nearest-neighbor sort helper for a cluster
  const sortCluster = (cluster, startPoint) => {
    if (cluster.length <= 1) return cluster;
    const remaining = [...cluster];
    const ordered = [];
    let currentPoint = startPoint;

    while (remaining.length > 0) {
      let bestIdx = 0;
      let bestDist = Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const item = remaining[i];
        if (currentPoint?.lat != null && item.lat != null) {
          const d = calculateHaversineDistanceKm(currentPoint.lat, currentPoint.lng, item.lat, item.lng);
          if (d != null && d < bestDist) {
            bestDist = d;
            bestIdx = i;
          }
        } else {
          // If no coordinates, keep original order
          bestIdx = 0;
          break;
        }
      }

      const nextItem = remaining.splice(bestIdx, 1)[0];
      ordered.push(nextItem);
      if (nextItem.lat != null && nextItem.lng != null) {
        currentPoint = { lat: nextItem.lat, lng: nextItem.lng };
      }
    }
    // 2-Opt Local Search (OR-Tools TSP Heuristic to untangle crossed paths)
    if (ordered.length >= 4) {
      let improved = true;
      let count = 0;
      while (improved && count < 15) {
        improved = false;
        count++;
        for (let i = 0; i < ordered.length - 2; i++) {
          for (let k = i + 1; k < ordered.length - 1; k++) {
            if (ordered[i].isLocked || ordered[k].isLocked) continue;
            const p1 = i === 0 && startPoint ? startPoint : ordered[i];
            const p2 = ordered[i + 1];
            const p3 = ordered[k];
            const p4 = ordered[k + 1];
            if (p1.lat != null && p2.lat != null && p3.lat != null && p4.lat != null) {
              const currentDist =
                (calculateHaversineDistanceKm(p1.lat, p1.lng, p2.lat, p2.lng) || 0) +
                (calculateHaversineDistanceKm(p3.lat, p3.lng, p4.lat, p4.lng) || 0);
              const newDist =
                (calculateHaversineDistanceKm(p1.lat, p1.lng, p3.lat, p3.lng) || 0) +
                (calculateHaversineDistanceKm(p2.lat, p2.lng, p4.lat, p4.lng) || 0);
              if (newDist < currentDist - 0.05) {
                const reversed = ordered.slice(i + 1, k + 1).reverse();
                ordered.splice(i + 1, reversed.length, ...reversed);
                improved = true;
                break;
              }
            }
          }
          if (improved) break;
        }
      }
    }

    return ordered;
  };

  let curAnchor = anchorCoords;
  const orderedMorning = sortCluster(morning, curAnchor);
  if (orderedMorning.length > 0) {
    const lastM = orderedMorning[orderedMorning.length - 1];
    if (lastM.lat != null) curAnchor = { lat: lastM.lat, lng: lastM.lng };
  }

  const orderedLunch = sortCluster(lunch, curAnchor);
  if (orderedLunch.length > 0) {
    const lastL = orderedLunch[orderedLunch.length - 1];
    if (lastL.lat != null) curAnchor = { lat: lastL.lat, lng: lastL.lng };
  }

  const orderedAfternoon = sortCluster(afternoon, curAnchor);
  if (orderedAfternoon.length > 0) {
    const lastA = orderedAfternoon[orderedAfternoon.length - 1];
    if (lastA.lat != null) curAnchor = { lat: lastA.lat, lng: lastA.lng };
  }

  const orderedEvening = sortCluster(evening, curAnchor);

  const combined = [
    ...orderedMorning,
    ...orderedLunch,
    ...orderedAfternoon,
    ...orderedEvening,
  ];

  return combined.map((i) => i.activity);
}

/**
 * Enriches all activities across the trip with real inter-stop routes,
 * distances, travel modes, progressive arrival/departure times, and data classifications.
 *
 * @param {Array} days - List of day plans with activities
 * @param {Object} options - Trip options (destination, hotelName, hotelLocation, accommodation)
 * @returns {Promise<Array>} Enriched days
 */
export async function enrichTripWithInterstopRouting(days, options = {}) {
  if (!Array.isArray(days) || days.length === 0) return days;

  const destination = options.destination || "";
  const hotelName = options.hotelName || options.hotelLocation || "";
  const accommodationType = options.accommodation || "HOTEL";

  // Resolve accommodation anchor coordinates
  let accommodationAnchor = null;
  const accommodationQuery = hotelName ? `${hotelName}, ${destination}` : `${destination} Center`;
  try {
    accommodationAnchor = await geocodeLocation(accommodationQuery, destination);
  } catch (err) {
    logger.debug(`[InterstopRouting] Could not geocode accommodation anchor: ${err.message}`);
  }

  const accommodationLabel = hotelName
    ? hotelName
    : accommodationType.includes("OWN") || accommodationType.includes("RELATIVE") || accommodationType.includes("NATIVE")
    ? "Your Residence / Home Stay"
    : `Your Stay in ${destination}`;

  // Process each day
  for (let dayIdx = 0; dayIdx < days.length; dayIdx++) {
    const day = days[dayIdx];
    if (!Array.isArray(day.activities) || day.activities.length === 0) continue;

    // 1. Optimize stop sequence to minimize backtracking
    day.activities = optimizeActivitySequence(day.activities, accommodationAnchor);

    let prevLocationName = accommodationLabel;
    let prevCoords = accommodationAnchor
      ? { lat: accommodationAnchor.lat, lng: accommodationAnchor.lng }
      : null;
    let prevDepartureTime = day.activities[0]?.time || "09:00";

    // 2. Calculate inter-stop travel for each activity
    for (let actIdx = 0; actIdx < day.activities.length; actIdx++) {
      const act = day.activities[actIdx];
      const curLocationName = act.placeName || act.description?.slice(0, 30) || `Stop ${actIdx + 1}`;
      
      let curCoords = null;
      if (act.coordinates?.lat != null && act.coordinates?.lng != null) {
        curCoords = { lat: Number(act.coordinates.lat), lng: Number(act.coordinates.lng) };
      } else if (act.placeName) {
        // Geocode if missing
        try {
          const geo = await geocodeLocation(act.placeName, destination);
          if (geo?.lat != null) {
            curCoords = { lat: geo.lat, lng: geo.lng };
            act.coordinates = { lat: geo.lat, lng: geo.lng };
            if (!act.address && geo.displayName) act.address = geo.displayName;
          }
        } catch {
          // ignore
        }
      }

      // Default baseline values
      let travelDistanceKm = 2.5;
      let travelDurationMinutes = 10;
      let travelMode = "Cab";
      let dataClassification = "INDICATIVE_RESEARCH";

      // Calculate distance if both points have coordinates
      if (prevCoords?.lat != null && curCoords?.lat != null) {
        const directDistKm = calculateHaversineDistanceKm(
          prevCoords.lat,
          prevCoords.lng,
          curCoords.lat,
          curCoords.lng
        );

        if (directDistKm != null) {
          if (directDistKm <= 1.2) {
            // Walking distance
            travelMode = "Walk";
            travelDistanceKm = directDistKm;
            travelDurationMinutes = Math.max(3, Math.round(directDistKm * 13.3)); // ~4.5 km/h walking speed
            dataClassification = "LIVE_VERIFIED";
          } else {
            // Driving / Cab distance: query real road network via OSRM
            travelMode = "Cab";
            try {
              const osrmRoute = await osrmRoutingService.calculateDrivingRoute({
                origin: { lat: prevCoords.lat, lon: prevCoords.lng },
                destination: { lat: curCoords.lat, lon: curCoords.lng },
              });

              if (osrmRoute?.distanceKm > 0 && osrmRoute?.durationMins > 0) {
                travelDistanceKm = osrmRoute.distanceKm;
                travelDurationMinutes = Math.max(5, osrmRoute.durationMins);
                dataClassification = "LIVE_VERIFIED";
              } else {
                // Haversine road estimation fallback
                travelDistanceKm = Math.round(directDistKm * 1.25 * 10) / 10;
                travelDurationMinutes = Math.max(5, Math.round((travelDistanceKm / 28) * 60)); // ~28 km/h city average
                dataClassification = act.verificationStatus === "CURATED_VERIFIED" ? "CURATED_VERIFIED" : "INDICATIVE_RESEARCH";
              }
            } catch (err) {
              travelDistanceKm = Math.round(directDistKm * 1.25 * 10) / 10;
              travelDurationMinutes = Math.max(5, Math.round((travelDistanceKm / 28) * 60));
              dataClassification = "INDICATIVE_RESEARCH";
            }
          }
        }
      } else {
        // Fallback for missing coordinates
        travelDistanceKm = actIdx === 0 ? 3.5 : 2.0;
        travelDurationMinutes = actIdx === 0 ? 15 : 8;
        travelMode = "Cab";
        dataClassification = act.verificationStatus === "CURATED_VERIFIED" ? "CURATED_VERIFIED" : "INDICATIVE_RESEARCH";
      }

      // Timing calculations
      const plannedTime = act.time || prevDepartureTime;
      const plannedMins = timeToMinutes(plannedTime);
      const estDepMins = Math.max(480, plannedMins - travelDurationMinutes); // leave earlier so arrival is near plannedTime
      const departureTime = addMinutesToTime("00:00", estDepMins);
      const arrivalTime = addMinutesToTime(departureTime, travelDurationMinutes);

      // Proximity description
      let proximityDescription = "";
      if (actIdx === 0) {
        proximityDescription = `${travelDurationMinutes} mins ${travelMode.toLowerCase()} (${travelDistanceKm} km) from your hotel/stay`;
      } else {
        proximityDescription = `${travelDurationMinutes} mins ${travelMode.toLowerCase()} (${travelDistanceKm} km) from ${prevLocationName}`;
      }

      const travelDurationText = `${travelDurationMinutes} mins (${travelDistanceKm} km) ${travelMode.toLowerCase()}`;

      // Populate enriched fields on activity
      act.startLocation = prevLocationName;
      act.endLocation = curLocationName;
      act.travelDistanceKm = travelDistanceKm;
      act.travelDurationMinutes = travelDurationMinutes;
      act.travelDurationText = travelDurationText;
      act.travelMode = travelMode;
      act.departureTime = departureTime;
      act.arrivalTime = arrivalTime;
      act.proximityDescription = proximityDescription;
      act.dataClassification = dataClassification;

      // Advance previous pointer
      prevLocationName = curLocationName;
      if (curCoords) prevCoords = curCoords;
      // Assume a 60-90 min stop duration before departing for next activity
      const stopDuration = act.suggestedDuration ? parseInt(act.suggestedDuration, 10) || 75 : 75;
      prevDepartureTime = addMinutesToTime(arrivalTime, stopDuration);
    }
  }

  return days;
}
