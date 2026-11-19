import { BaseTransportProvider } from "./base.provider.js";
import { weatherProvider } from "./weather.provider.js";
import { osrmRoutingService } from "../osrm-routing.service.js";
import { apiClient } from "../../../utils/apiClient.js";
import { logger } from "../../../utils/logger.js";
import { env } from "../../../config/env.js";

// Haversine distance formula in KM
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
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
  return Math.round(R * c);
}

export class TransportProvider extends BaseTransportProvider {
  constructor() {
    super("AdvenzaTransitProvider");
    this.mapsApiKey = env.GOOGLE_MAPS_API_KEY || env.MAPS_API_KEY || null;
  }

  isConfigured() {
    return Boolean(this.mapsApiKey);
  }

  async checkAvailability() {
    if (!this.isConfigured()) {
      return {
        provider: "Google Maps Platform",
        status: "NOT_CONFIGURED",
        isLive: false,
        message: "Google Maps API key not configured. Geodesic estimates active as fallback.",
      };
    }

    return {
      provider: "Google Maps Platform",
      status: "HEALTHY",
      isLive: true,
      message: "Google Maps Directions API configured.",
    };
  }

  /**
   * Alias for getRouteStatus to calculate intercity transit distance and times.
   */
  async calculateIntercityTransit(params) {
    return this.getRouteStatus(params);
  }

  /**
   * Get Route Status between two locations.
   * Clearly distinguishes LIVE vs ESTIMATED vs UNAVAILABLE.
   */
  async getRouteStatus({ origin, destination, mode = "driving" }) {
    const origClean = (origin || "").trim();
    const destClean = (destination || "").trim();

    if (!origClean || !destClean) {
      return {
        provider: "Transit Service",
        status: "UNAVAILABLE",
        isLive: false,
        source: "UNAVAILABLE",
        origin: origClean || "Unspecified",
        destination: destClean || "Unspecified",
        mode,
        distanceKm: null,
        estimatedDurationMins: null,
        normalDurationMins: null,
        trafficLevel: "unknown",
        trafficStatus: "UNAVAILABLE",
        delayMinutes: 0,
        reason: "Both origin and destination are required to calculate route status.",
        lastUpdated: new Date().toISOString(),
      };
    }

    try {
      // 1. If Google Maps Platform Directions API key is configured
      if (this.mapsApiKey) {
        try {
          const directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(
            origClean
          )}&destination=${encodeURIComponent(destClean)}&mode=${mode}&departure_time=now&key=${this.mapsApiKey}`;

          const res = await apiClient.request(directionsUrl, {
            provider: "GoogleDirectionsAPI",
            timeoutMs: 6000,
            maxRetries: 1,
          });

          const data = await res.json();
          const route = data.routes?.[0];
          const leg = route?.legs?.[0];

          if (leg) {
            const distanceKm = Math.round((leg.distance?.value || 0) / 1000);
            const normalDurationMins = Math.round((leg.duration?.value || 0) / 60);
            const estimatedDurationMins = Math.round(
              (leg.duration_in_traffic?.value || leg.duration?.value || 0) / 60
            );
            const delayMinutes = Math.max(0, estimatedDurationMins - normalDurationMins);

            let trafficLevel = "low";
            if (delayMinutes >= 25) trafficLevel = "heavy";
            else if (delayMinutes >= 10) trafficLevel = "moderate";

            return {
              provider: "Google Maps Platform",
              status: "LIVE",
              isLive: true,
              source: "LIVE_API",
              origin: leg.start_address || origClean,
              destination: leg.end_address || destClean,
              mode,
              distanceKm,
              estimatedDurationMins,
              normalDurationMins,
              trafficLevel,
              trafficStatus: "LIVE",
              delayMinutes,
              lastUpdated: new Date().toISOString(),
            };
          }
        } catch (gErr) {
          logger.warn(`[TransportProvider] Google Directions API query error: ${gErr.message}`);
        }
      }

      // 2. Geodesic routing calculation (ESTIMATED - Never claims live traffic)
      let origGeo = null;
      let destGeo = null;
      try {
        [origGeo, destGeo] = await Promise.all([
          weatherProvider.geocode(origClean),
          weatherProvider.geocode(destClean),
        ]);
      } catch (geoErr) {
        logger.warn(`[TransportProvider] Geocoding failed for route "${origClean}" → "${destClean}": ${geoErr.message}`);
        return {
          provider: "Transit Service",
          status: "UNAVAILABLE",
          isLive: false,
          source: "UNAVAILABLE",
          origin: origClean,
          destination: destClean,
          mode,
          distanceKm: null,
          estimatedDurationMins: null,
          normalDurationMins: null,
          trafficLevel: "unknown",
          trafficStatus: "UNAVAILABLE",
          delayMinutes: 0,
          reason: `Could not geocode route endpoints: ${geoErr.message}`,
          lastUpdated: new Date().toISOString(),
        };
      }

      if (!origGeo?.latitude || !destGeo?.latitude) {
        return {
          provider: "Transit Service",
          status: "UNAVAILABLE",
          isLive: false,
          source: "UNAVAILABLE",
          origin: origClean,
          destination: destClean,
          mode,
          distanceKm: null,
          estimatedDurationMins: null,
          normalDurationMins: null,
          trafficLevel: "unknown",
          trafficStatus: "UNAVAILABLE",
          delayMinutes: 0,
          reason: `Could not resolve geographic coordinates for "${!origGeo?.latitude ? origClean : destClean}".`,
          lastUpdated: new Date().toISOString(),
        };
      }

      // Validate coordinates: Reject (0,0) / Null Island
      if (
        (Math.abs(origGeo.latitude) < 0.0001 && Math.abs(origGeo.longitude) < 0.0001) ||
        (Math.abs(destGeo.latitude) < 0.0001 && Math.abs(destGeo.longitude) < 0.0001)
      ) {
        logger.warn(`[TransportProvider] Rejected invalid (0,0) coordinates for ${origClean} or ${destClean}`);
        return {
          provider: "Transit Service",
          status: "UNAVAILABLE",
          isLive: false,
          source: "UNAVAILABLE",
          origin: origClean,
          destination: destClean,
          disclaimer: "Invalid geographical coordinates (0,0) detected. Location coordinates must be verified.",
        };
      }

      // 2. Try Open Source Routing Machine (OSRM) for turn-by-turn road distance
      try {
        const osrmRoute = await osrmRoutingService.calculateDrivingRoute({
          origin: { lat: origGeo.latitude, lon: origGeo.longitude },
          destination: { lat: destGeo.latitude, lon: destGeo.longitude },
        });

        if (osrmRoute) {
          return {
            provider: "Open Source Routing Machine (OSRM)",
            status: "ESTIMATED",
            statusClassification: "FREE_FLOW_ROUTING",
            isLive: false, // Public OSRM provides free-flow road distance, not real-time live traffic congestion
            source: "LIVE_OSRM_ROUTING",
            routingEngine: "OSRM_ROAD_ROUTING",
            origin: origGeo.name || origClean,
            destination: destGeo.name || destClean,
            mode,
            distanceKm: osrmRoute.roadDistanceKm || osrmRoute.distanceKm,
            roadDistanceKm: osrmRoute.roadDistanceKm || osrmRoute.distanceKm,
            distanceLabel: "road distance",
            estimatedDurationMins: osrmRoute.durationMins,
            normalDurationMins: osrmRoute.durationMins,
            trafficLevel: "free_flow",
            trafficStatus: "FREE_FLOW_ROUTING",
            delayMinutes: 0,
            fuelCostINR: osrmRoute.fuelCostINR,
            estimatedTollsINR: osrmRoute.estimatedTollsINR,
            fuelTollSource: "INTERNAL_HEURISTIC_ESTIMATE",
            priceType: "ESTIMATED",
            disclaimer: "OSRM distance represents turn-by-turn road distance. Fuel and tolls are internal estimates, not provided by OSRM.",
            lastUpdated: new Date().toISOString(),
          };
        }
      } catch (osrmErr) {
        logger.warn(`[TransportProvider] OSRM query failed: ${osrmErr.message}. Falling back to geodesic.`);
      }

      // 3. Geodesic routing calculation (ESTIMATED - Straight-line distance)
      const directDistance = calculateHaversineDistance(
        origGeo.latitude,
        origGeo.longitude,
        destGeo.latitude,
        destGeo.longitude
      );

      // Driving route road winding factor (approx 1.25x direct distance)
      const drivingDistance = Math.round(directDistance * 1.25);
      // Average intercity transit speed ~60 km/h
      const normalDurationMins = Math.round((drivingDistance / 60) * 60);

      return {
        provider: "Advenza Geodesic Router",
        status: "ESTIMATED",
        isLive: false,
        source: "HAVERSINE_STRAIGHT_LINE",
        origin: origGeo.name || origClean,
        destination: destGeo.name || destClean,
        mode,
        distanceKm: drivingDistance,
        straightLineDistanceKm: directDistance,
        distanceLabel: "straight-line distance",
        estimatedDurationMins: normalDurationMins,
        normalDurationMins: normalDurationMins,
        trafficLevel: "unknown",
        trafficStatus: "UNAVAILABLE",
        delayMinutes: 0,
        priceType: "ESTIMATED",
        disclaimer: "Live traffic telemetry not configured. Distance is calculated using straight-line geodesic distance with winding factor.",
        lastUpdated: new Date().toISOString(),
      };
    } catch (err) {
      return {
        provider: "Transit Service",
        status: "UNAVAILABLE",
        isLive: false,
        source: "UNAVAILABLE",
        origin: origClean,
        destination: destClean,
        mode,
        distanceKm: null,
        estimatedDurationMins: null,
        normalDurationMins: null,
        trafficLevel: "unknown",
        trafficStatus: "UNAVAILABLE",
        delayMinutes: 0,
        reason: `Could not verify route status: ${err.message}`,
        lastUpdated: new Date().toISOString(),
      };
    }
  }
}

export const transportProvider = new TransportProvider();
export default transportProvider;
