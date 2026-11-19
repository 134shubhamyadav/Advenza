import { apiClient } from "../../utils/apiClient.js";
import { logger } from "../../utils/logger.js";

/**
 * Open Source Routing Machine (OSRM) Service
 * Free, open-source, production-grade road routing engine based on OpenStreetMap road networks.
 * Calculates turn-by-turn road driving distance in meters and duration in seconds without requiring API keys.
 */
export class OSRMRoutingService {
  constructor() {
    this.baseUrl = "http://router.project-osrm.org/route/v1/driving";
    this.cache = new Map();
    this.CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours
  }

  /**
   * Calculates real road driving route between two (lat, lon) coordinates.
   * @param {Object} origin - { lat, lon }
   * @param {Object} destination - { lat, lon }
   * @returns {Promise<Object|null>}
   */
  async calculateDrivingRoute({ origin, destination }) {
    const oLat = origin?.lat != null ? Number(origin.lat) : null;
    const oLon = origin?.lon != null ? Number(origin.lon) : origin?.lng != null ? Number(origin.lng) : null;
    const dLat = destination?.lat != null ? Number(destination.lat) : null;
    const dLon = destination?.lon != null ? Number(destination.lon) : destination?.lng != null ? Number(destination.lng) : null;

    if (oLat == null || oLon == null || dLat == null || dLon == null) {
      return null;
    }

    // Explicitly reject (0,0) / Null Island coordinates
    if ((Math.abs(oLat) < 0.0001 && Math.abs(oLon) < 0.0001) || (Math.abs(dLat) < 0.0001 && Math.abs(dLon) < 0.0001)) {
      logger.warn(`[OSRMRoutingService] Rejected invalid (0,0) coordinates.`);
      return null;
    }

    const cacheKey = `${oLat.toFixed(4)},${oLon.toFixed(4)}->${dLat.toFixed(4)},${dLon.toFixed(4)}`;
    if (this.cache.has(cacheKey)) {
      const entry = this.cache.get(cacheKey);
      if (Date.now() - entry.timestamp < this.CACHE_TTL) {
        return entry.data;
      }
    }

    const url = `${this.baseUrl}/${oLon},${oLat};${dLon},${dLat}?overview=false`;

    try {
      logger.info(`[OSRMRoutingService] Querying real road routing: (${origin.lat}, ${origin.lon}) → (${destination.lat}, ${destination.lon})`);
      const res = await apiClient.request(url, {
        provider: "OSRM-Routing",
        timeoutMs: 7000,
        maxRetries: 1,
        headers: {
          "User-Agent": "AdvenzaTravelIntelligence/1.0",
        },
      });

      const data = await res.json();
      if (data.code === "Ok" && Array.isArray(data.routes) && data.routes.length > 0) {
        const primaryRoute = data.routes[0];
        const distanceKm = Math.round(primaryRoute.distance / 1000);
        const durationMins = Math.round(primaryRoute.duration / 60);
        const durationHours = Math.round((durationMins / 60) * 10) / 10;

        // Internal heuristic fuel cost calculation (standard passenger car: 14 km/L at ~₹102/L)
        // NOT sourced from OSRM — clearly attributed to internal vehicle heuristic
        const fuelCostINR = Math.round((distanceKm / 14) * 102);

        // Internal heuristic highway toll calculation (~₹2.1/km for national expressways/toll roads)
        // NOT sourced from OSRM — clearly attributed to internal highway heuristic
        const estimatedTollsINR = distanceKm > 60 ? Math.round(distanceKm * 2.1) : 0;

        const result = {
          isLiveRoadRoute: true,
          provider: "Open Source Routing Machine (OSRM)",
          distanceKm,
          roadDistanceKm: distanceKm,
          distanceType: "road_distance",
          distanceLabel: "road distance",
          durationMins,
          durationHours,
          estimatedDrivingMinutes: durationMins,
          trafficStatus: "FREE_FLOW_ESTIMATE",
          trafficNote: "Free-flow estimated travel time without real-time congestion telemetry",
          fuelCostINR,
          estimatedTollsINR,
          totalEstimatedDriveCostINR: fuelCostINR + estimatedTollsINR,
          fuelTollSource: "INTERNAL_HEURISTIC_ESTIMATE",
          priceType: "ESTIMATED",
        };

        this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
        return result;
      }

      logger.warn(`[OSRMRoutingService] OSRM responded with non-OK code: ${data.code}`);
      return null;
    } catch (err) {
      logger.warn(`[OSRMRoutingService] OSRM query failed (${err.message}). Falling back to geodesic calculation.`);
      return null;
    }
  }

  /**
   * Calculates all-to-all driving distance and duration matrix for multiple points via OSRM Table API.
   * @param {Array<{ lat: number, lon?: number, lng?: number }>} points
   * @returns {Promise<{ durations: number[][], distances: number[][] }|null>}
   */
  async calculateDistanceMatrix(points) {
    if (!Array.isArray(points) || points.length < 2) return null;

    const coords = points
      .map((p) => {
        const lat = p.lat != null ? Number(p.lat) : null;
        const lon = p.lon != null ? Number(p.lon) : p.lng != null ? Number(p.lng) : null;
        return lat != null && lon != null ? `${lon.toFixed(5)},${lat.toFixed(5)}` : null;
      })
      .filter(Boolean);

    if (coords.length < 2) return null;

    const tableUrl = `http://router.project-osrm.org/table/v1/driving/${coords.join(";")}?annotations=duration,distance`;

    try {
      const res = await apiClient.request(tableUrl, {
        provider: "OSRM-TableMatrix",
        timeoutMs: 6000,
        maxRetries: 1,
        headers: { "User-Agent": "AdvenzaTravelIntelligence/1.0" },
      });

      const data = await res.json();
      if (data.code === "Ok" && Array.isArray(data.durations)) {
        return {
          durations: data.durations, // duration in seconds
          distances: data.distances || [], // distance in meters
        };
      }
    } catch (err) {
      logger.debug(`[OSRMRoutingService] Table matrix query failed: ${err.message}`);
    }
    return null;
  }

  /**
   * Discovers nearest railway station and commercial airport via Nominatim
   * @param {string} destination
   * @param {Object} centerCoords - { lat, lon }
   */
  async discoverNearbyTransitHubs(destination, centerCoords = null) {
    const rawDest = (destination || "").trim();
    if (!rawDest) return { station: null, airport: null };

    try {
      const [stationRes, airportRes] = await Promise.allSettled([
        apiClient.request(
          `https://nominatim.openstreetmap.org/search?format=json&q=railway+station+in+${encodeURIComponent(rawDest)}&limit=1`,
          {
            provider: "NominatimTransitStation",
            timeoutMs: 4000,
            headers: {
              "User-Agent": "AdvenzaTravelPlanner/1.0",
              "Accept-Language": "en",
            },
          }
        ),
        apiClient.request(
          `https://nominatim.openstreetmap.org/search?format=json&q=airport+in+${encodeURIComponent(rawDest)}&limit=1`,
          {
            provider: "NominatimTransitAirport",
            timeoutMs: 4000,
            headers: {
              "User-Agent": "AdvenzaTravelPlanner/1.0",
              "Accept-Language": "en",
            },
          }
        ),
      ]);

      let station = null;
      let airport = null;

      if (stationRes.status === "fulfilled") {
        const stations = await stationRes.value.json().catch(() => []);
        if (stations && stations.length > 0) {
          const s = stations[0];
          station = {
            name: s.name || s.display_name.split(",")[0],
            lat: parseFloat(s.lat),
            lon: parseFloat(s.lon),
            type: "Railway Station",
          };
        }
      }

      if (airportRes.status === "fulfilled") {
        const airports = await airportRes.value.json().catch(() => []);
        if (airports && airports.length > 0) {
          const a = airports[0];
          airport = {
            name: a.name || a.display_name.split(",")[0],
            lat: parseFloat(a.lat),
            lon: parseFloat(a.lon),
            type: "Airport",
          };
        }
      }

      return { station, airport };
    } catch (err) {
      logger.warn(`[OSRMRoutingService] Transit hub discovery error: ${err.message}`);
      return { station: null, airport: null };
    }
  }
}

export const osrmRoutingService = new OSRMRoutingService();
export default osrmRoutingService;
