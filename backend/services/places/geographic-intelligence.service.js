/**
 * Geographic Verification & Intelligence Engine — Advenza
 *
 * Provides authoritative forward/reverse geocoding, locality identification,
 * geographic hierarchy extraction, and context-aware spatial disambiguation using
 * OpenStreetMap Nominatim with strict proximity verification.
 *
 * Prevents localities from being incorrectly matched to distant places with similar names.
 * Distinguishes Suburb vs City vs District vs State vs Country.
 */

import { apiClient } from "../../utils/apiClient.js";
import { logger } from "../../utils/logger.js";
import { calculateHaversineDistanceKm } from "../travel/interstop-routing.service.js";

// Cache for geographic queries: query -> { data, timestamp }
const geoCache = new Map();
const GEO_CACHE_TTL = 12 * 60 * 60 * 1000; // 12 hours

// Known Indian & International Metropolitan City Centers (for spatial scoping)
export const METRO_CENTERS = {
  mumbai: { lat: 18.9220, lng: 72.8347, radiusKm: 65, name: "Mumbai" },
  delhi: { lat: 28.6139, lng: 77.2090, radiusKm: 55, name: "Delhi" },
  bengaluru: { lat: 12.9716, lng: 77.5946, radiusKm: 45, name: "Bengaluru" },
  bangalore: { lat: 12.9716, lng: 77.5946, radiusKm: 45, name: "Bengaluru" },
  goa: { lat: 15.4989, lng: 73.8278, radiusKm: 85, name: "Goa" },
  jaipur: { lat: 26.9124, lng: 75.7873, radiusKm: 40, name: "Jaipur" },
  kolkata: { lat: 22.5726, lng: 88.3639, radiusKm: 45, name: "Kolkata" },
  chennai: { lat: 13.0827, lng: 80.2707, radiusKm: 45, name: "Chennai" },
  hyderabad: { lat: 17.3850, lng: 78.4867, radiusKm: 50, name: "Hyderabad" },
  pune: { lat: 18.5204, lng: 73.8567, radiusKm: 40, name: "Pune" },
  ahmedabad: { lat: 23.0225, lng: 72.5714, radiusKm: 40, name: "Ahmedabad" },
  kochi: { lat: 9.9312, lng: 76.2673, radiusKm: 35, name: "Kochi" },
  varanasi: { lat: 25.3176, lng: 82.9739, radiusKm: 30, name: "Varanasi" },
};

export class GeographicIntelligenceService {
  constructor() {
    this.name = "GeographicIntelligenceService";
    this.baseUrl = "https://nominatim.openstreetmap.org";
  }

  /**
   * Resolves a query into a rich, verified geographic entity with full locality hierarchy.
   *
   * @param {string} query - Location or locality query (e.g. "Mulund", "Assagao", "Bandra", "Jaipur")
   * @param {Object} [activeContext] - Active destination context (city, coordinates) to prevent distant mismatch
   * @returns {Promise<Object|null>} Structured geographic entity
   */
  async resolveLocationHierarchy(query, activeContext = {}) {
    const raw = String(query || "").trim();
    if (!raw || raw.length < 2) return null;

    const contextCity = String(activeContext.city || activeContext.name || "").toLowerCase().trim();
    const contextCoords = activeContext.coordinates?.lat != null ? activeContext.coordinates : null;

    const cacheKey = `geo_${raw.toLowerCase()}_${contextCity || "none"}`;
    if (geoCache.has(cacheKey)) {
      const entry = geoCache.get(cacheKey);
      if (Date.now() - entry.timestamp < GEO_CACHE_TTL) {
        return entry.data;
      }
    }

    try {
      // 1. Prepare search query with context biasing if applicable
      let searchQuery = raw;
      if (contextCity && !raw.toLowerCase().includes(contextCity)) {
        searchQuery = `${raw}, ${contextCity}`;
      }

      const url = `${this.baseUrl}/search?q=${encodeURIComponent(searchQuery)}&format=json&addressdetails=1&extratags=1&limit=5`;
      const res = await apiClient.request(url, {
        provider: "NominatimGeographicIntelligence",
        timeoutMs: 5000,
        maxRetries: 1,
        headers: {
          "User-Agent": "AdvenzaTravelIntelligence/2.0 (team@advenza.travel)",
          "Accept-Language": "en",
        },
      });

      let candidates = [];
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          candidates = data.map((item) => this._parseNominatimItem(item, raw));
        }
      }

      // If scoped search returned nothing, retry bare query
      if (candidates.length === 0 && searchQuery !== raw) {
        const bareUrl = `${this.baseUrl}/search?q=${encodeURIComponent(raw)}&format=json&addressdetails=1&extratags=1&limit=5`;
        const bareRes = await apiClient.request(bareUrl, {
          provider: "NominatimGeographicIntelligence",
          timeoutMs: 5000,
          maxRetries: 1,
          headers: {
            "User-Agent": "AdvenzaTravelIntelligence/2.0 (team@advenza.travel)",
            "Accept-Language": "en",
          },
        });
        if (bareRes.ok) {
          const bareData = await bareRes.json();
          if (Array.isArray(bareData) && bareData.length > 0) {
            candidates = bareData.map((item) => this._parseNominatimItem(item, raw));
          }
        }
      }

      if (candidates.length === 0) {
        return null;
      }

      // 2. Disambiguate candidates using spatial proximity to activeContext
      let selected = candidates[0];
      if (candidates.length > 1 && (contextCoords || contextCity)) {
        // Find candidate closest to context
        let bestDistance = Infinity;
        let bestCandidate = candidates[0];

        for (const cand of candidates) {
          // If city string directly matches context
          if (contextCity && cand.city?.toLowerCase().includes(contextCity)) {
            bestCandidate = cand;
            break;
          }

          if (contextCoords?.lat != null && cand.coordinates?.lat != null) {
            const dist = calculateHaversineDistanceKm(
              contextCoords.lat,
              contextCoords.lng,
              cand.coordinates.lat,
              cand.coordinates.lng
            );
            if (dist != null && dist < bestDistance) {
              bestDistance = dist;
              bestCandidate = cand;
            }
          }
        }

        // If best distance is within 80km of active context, pick it
        if (bestDistance < 80 || (contextCity && bestCandidate.city?.toLowerCase().includes(contextCity))) {
          selected = bestCandidate;
        }
      }

      geoCache.set(cacheKey, { data: selected, timestamp: Date.now() });
      return selected;
    } catch (err) {
      logger.warn(`[GeographicIntelligence] Hierarchy resolution error for "${raw}": ${err.message}`);
      return null;
    }
  }

  /**
   * Reverse geocodes (lat, lng) coordinates into a full address and locality hierarchy.
   */
  async reverseGeocodeLocation(lat, lng) {
    const nLat = Number(lat);
    const nLng = Number(lng);
    if (isNaN(nLat) || isNaN(nLng)) return null;

    const cacheKey = `rev_${nLat.toFixed(4)}_${nLng.toFixed(4)}`;
    if (geoCache.has(cacheKey)) {
      const entry = geoCache.get(cacheKey);
      if (Date.now() - entry.timestamp < GEO_CACHE_TTL) {
        return entry.data;
      }
    }

    try {
      const url = `${this.baseUrl}/reverse?lat=${nLat}&lon=${nLng}&format=json&addressdetails=1`;
      const res = await apiClient.request(url, {
        provider: "NominatimReverseGeocode",
        timeoutMs: 5000,
        maxRetries: 1,
        headers: {
          "User-Agent": "AdvenzaTravelIntelligence/2.0 (team@advenza.travel)",
          "Accept-Language": "en",
        },
      });

      if (res.ok) {
        const item = await res.json();
        const parsed = this._parseNominatimItem(item, item.name || "");
        geoCache.set(cacheKey, { data: parsed, timestamp: Date.now() });
        return parsed;
      }
    } catch (err) {
      logger.warn(`[GeographicIntelligence] Reverse geocode error: ${err.message}`);
    }
    return null;
  }

  /**
   * Parse Nominatim item into structured entity preserving locality, suburb, city, state, country.
   */
  _parseNominatimItem(item, originalQuery) {
    const addr = item.address || {};
    const locality =
      addr.suburb ||
      addr.neighbourhood ||
      addr.city_district ||
      addr.quarter ||
      addr.borough ||
      (item.type === "suburb" || item.type === "neighbourhood" ? item.name : "");

    const city =
      addr.city ||
      addr.town ||
      addr.municipality ||
      addr.village ||
      addr.county ||
      addr.state_district ||
      "";

    const state = addr.state || addr.province || addr.region || "";
    const country = addr.country || "";
    const district = addr.county || addr.state_district || "";
    const postcode = addr.postcode || "";

    // Primary place name: prefer locality if it matches query, else city or item name
    let primaryName = item.name || locality || city;
    if (locality && originalQuery && locality.toLowerCase().includes(originalQuery.toLowerCase())) {
      primaryName = locality;
    } else if (city && originalQuery && city.toLowerCase().includes(originalQuery.toLowerCase())) {
      primaryName = city;
    }

    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);

    return {
      name: primaryName,
      locality: locality || "",
      suburb: addr.suburb || "",
      neighbourhood: addr.neighbourhood || "",
      city: city || primaryName,
      district: district || "",
      stateOrRegion: state,
      country: country || "India",
      postcode,
      displayName: item.display_name,
      coordinates: { lat, lng },
      type: item.type || "locality",
      category: item.class || "place",
      importance: Number(item.importance) || 0.5,
      hierarchy: {
        locality: locality || "",
        city: city || "",
        district: district || "",
        state: state || "",
        country: country || "",
      },
      hierarchyString: [locality, city, state, country].filter(Boolean).join(", "),
      dataSource: "NOMINATIM_VERIFIED",
    };
  }
}

export const geographicIntelligenceService = new GeographicIntelligenceService();
export default geographicIntelligenceService;
