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
    if (!origin?.lat || !origin?.lon || !destination?.lat || !destination?.lon) {
      return null;
    }

    const cacheKey = `${origin.lat.toFixed(4)},${origin.lon.toFixed(4)}->${destination.lat.toFixed(4)},${destination.lon.toFixed(4)}`;
    if (this.cache.has(cacheKey)) {
      const entry = this.cache.get(cacheKey);
      if (Date.now() - entry.timestamp < this.CACHE_TTL) {
        return entry.data;
      }
    }

    const url = `${this.baseUrl}/${origin.lon},${origin.lat};${destination.lon},${destination.lat}?overview=false`;

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

        // Realistic fuel cost calculation based on standard passenger car (14 km/L at ~₹102/L)
        const fuelCostINR = Math.round((distanceKm / 14) * 102);

        // Realistic highway tolls calculation (~₹2.1 per km on national expressways/toll roads)
        const estimatedTollsINR = distanceKm > 60 ? Math.round(distanceKm * 2.1) : 0;

        const result = {
          isLiveRoadRoute: true,
          provider: "Open Source Routing Machine (OSRM)",
          distanceKm,
          durationMins,
          durationHours,
          fuelCostINR,
          estimatedTollsINR,
          totalEstimatedDriveCostINR: fuelCostINR + estimatedTollsINR,
          priceType: "LIVE_VERIFIED",
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
