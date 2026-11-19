import { logger } from "../../utils/logger.js";
import { aiRouter } from "../ai/ai-router.service.js";
import { parseAIJson } from "../ai/ai-parser.js";

// Cache disambiguation results
const disambiguationCache = new Map();

export const KNOWN_AMBIGUOUS_DESTINATIONS = {
  hyderabad: [
    {
      name: "Hyderabad",
      stateOrRegion: "Telangana",
      district: "Hyderabad",
      country: "India",
      coordinates: { lat: 17.385, lng: 78.4867 },
      referenceInfo: "Major metropolitan tech hub and historic capital of Telangana, India.",
    },
    {
      name: "Hyderabad",
      stateOrRegion: "Sindh",
      district: "Hyderabad District",
      country: "Pakistan",
      coordinates: { lat: 25.396, lng: 68.3578 },
      referenceInfo: "Historic city in the Sindh province of Pakistan, along the Indus River.",
    },
  ],
  paris: [
    {
      name: "Paris",
      stateOrRegion: "Île-de-France",
      district: "Paris",
      country: "France",
      coordinates: { lat: 48.8566, lng: 2.3522 },
      referenceInfo: "Capital of France, famous for art, fashion, gastronomy, and culture.",
    },
    {
      name: "Paris",
      stateOrRegion: "Texas",
      district: "Lamar County",
      country: "United States",
      coordinates: { lat: 33.6609, lng: -95.5555 },
      referenceInfo: "City in northeast Texas, known for its replica Eiffel Tower with a red cowboy hat.",
    },
  ],
  santiago: [
    {
      name: "Santiago",
      stateOrRegion: "Santiago Metropolitan",
      district: "Santiago",
      country: "Chile",
      coordinates: { lat: -33.4489, lng: -70.6693 },
      referenceInfo: "Capital and largest city of Chile, nestled in a valley surrounded by the Andes.",
    },
    {
      name: "Santiago de Compostela",
      stateOrRegion: "Galicia",
      district: "A Coruña",
      country: "Spain",
      coordinates: { lat: 42.8782, lng: -8.5448 },
      referenceInfo: "Capital of Galicia, Spain, and final stop of the Camino de Santiago pilgrimage.",
    },
  ],
  springfield: [
    {
      name: "Springfield",
      stateOrRegion: "Illinois",
      district: "Sangamon County",
      country: "United States",
      coordinates: { lat: 39.7817, lng: -89.6501 },
      referenceInfo: "Capital of Illinois and longtime home of Abraham Lincoln.",
    },
    {
      name: "Springfield",
      stateOrRegion: "Massachusetts",
      district: "Hampden County",
      country: "United States",
      coordinates: { lat: 42.1015, lng: -72.5898 },
      referenceInfo: "City in western Massachusetts, birthplace of basketball.",
    },
  ],
};

export class DestinationDisambiguationService {
  constructor() {
    this.name = "Destination Disambiguation Service";
  }

  /**
   * Evaluates a user-input destination for ambiguity and returns either a resolved location
   * or a list of interactive candidate selection cards.
   *
   * @param {string} input - User-entered query (e.g. "Hyderabad", "Springfield", "Kochi", "Paris")
   * @returns {Promise<{ isAmbiguous: boolean, resolved?: Object, candidates?: Array<Object> }>}
   */
  async disambiguate(input) {
    const raw = String(input || "").trim();
    if (!raw || raw.length < 2) {
      return { isAmbiguous: false, resolved: null, candidates: [] };
    }

    const key = raw.toLowerCase();
    if (disambiguationCache.has(key)) {
      return disambiguationCache.get(key);
    }

    logger.info(`[${this.name}] Analyzing geographical ambiguity for: "${raw}"`);

    // 0. Check known prominent multi-entity destinations for single-word queries
    const lowerKey = raw.toLowerCase().trim();
    if (!raw.includes(",") && KNOWN_AMBIGUOUS_DESTINATIONS[lowerKey]) {
      const candidates = KNOWN_AMBIGUOUS_DESTINATIONS[lowerKey].map((c) => ({
        id: `${c.name}-${c.stateOrRegion}-${c.country}`.toLowerCase().replace(/[^a-z0-9]/g, "-"),
        destinationName: c.name,
        stateOrRegion: c.stateOrRegion,
        district: c.district || "",
        country: c.country,
        fullName: `${c.name}, ${c.stateOrRegion ? c.stateOrRegion + ", " : ""}${c.country}`,
        coordinates: c.coordinates,
        referenceInfo: c.referenceInfo,
      }));

      const result = {
        isAmbiguous: true,
        query: raw,
        candidates,
      };
      disambiguationCache.set(key, result);
      return result;
    }

    // 1. Query global geocoding registry (Nominatim)
    let geoCandidates = [];
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(raw)}&format=json&addressdetails=1&limit=6`;
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Advenza-Travel-Intelligence/2.0 (team@advenza.travel)",
          "Accept-Language": "en",
          Accept: "application/json",
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          geoCandidates = data.map((item) => {
            const addr = item.address || {};
            const city = addr.city || addr.town || addr.village || addr.municipality || item.name;
            const state = addr.state || addr.province || addr.region || "";
            const country = addr.country || "";
            const district = addr.county || addr.state_district || "";

            return {
              name: city,
              displayName: item.display_name,
              stateOrRegion: state,
              district,
              country,
              coordinates: {
                lat: parseFloat(item.lat),
                lng: parseFloat(item.lon),
              },
              type: item.type,
              importance: item.importance || 0.5,
            };
          });
        }
      }
    } catch (geoErr) {
      logger.warn(`[${this.name}] Nominatim geocoding error: ${geoErr.message}`);
    }

    if (geoCandidates.length === 0 && raw.includes(",")) {
      const parts = raw.split(",").map((s) => s.trim());
      geoCandidates = [
        {
          name: parts[0],
          stateOrRegion: parts.length > 2 ? parts[1] : "",
          district: "",
          country: parts[parts.length - 1],
          coordinates: null,
          type: "city",
          importance: 0.8,
        },
      ];
    }

    // 2. Group candidates by distinct country / major state
    const distinctEntities = new Map();
    for (const cand of geoCandidates) {
      const entityKey = `${cand.name.toLowerCase()}|${cand.stateOrRegion.toLowerCase()}|${cand.country.toLowerCase()}`;
      if (!distinctEntities.has(entityKey)) {
        distinctEntities.set(entityKey, cand);
      }
    }

    const uniqueCandidates = Array.from(distinctEntities.values());

    // Check if there are multiple prominent distinct entities across different states or countries
    const isMultiEntity = uniqueCandidates.length > 1;
    const hasDifferentCountriesOrStates = uniqueCandidates.some(
      (c, idx) =>
        idx > 0 &&
        (c.country !== uniqueCandidates[0].country ||
          (c.stateOrRegion && uniqueCandidates[0].stateOrRegion && c.stateOrRegion !== uniqueCandidates[0].stateOrRegion))
    );

    // If ambiguous (multiple distinct countries or major states for a short/single-token input)
    if (isMultiEntity && hasDifferentCountriesOrStates && !raw.includes(",")) {
      const formattedCandidates = uniqueCandidates.slice(0, 4).map((c) => ({
        id: `${c.name}-${c.stateOrRegion}-${c.country}`.toLowerCase().replace(/[^a-z0-9]/g, "-"),
        destinationName: c.name,
        stateOrRegion: c.stateOrRegion,
        district: c.district,
        country: c.country,
        fullName: `${c.name}, ${c.stateOrRegion ? c.stateOrRegion + ", " : ""}${c.country}`,
        coordinates: c.coordinates,
        referenceInfo: `Located in ${c.stateOrRegion || c.country}${c.district ? ` (${c.district} district)` : ""}.`,
      }));

      const result = {
        isAmbiguous: true,
        query: raw,
        candidates: formattedCandidates,
      };

      disambiguationCache.set(key, result);
      return result;
    }

    // Unambiguous: resolve directly
    const top = uniqueCandidates[0] || {
      name: raw.includes(",") ? raw.split(",")[0].trim() : raw,
      stateOrRegion: "",
      district: "",
      country: raw.includes(",") ? raw.split(",").pop().trim() : "",
      coordinates: null,
    };

    const resolvedCoords =
      top.coordinates && (top.coordinates.lat !== 0 || top.coordinates.lng !== 0)
        ? top.coordinates
        : null;

    const resolvedCountry = top.country || (raw.includes(",") ? raw.split(",").pop().trim() : "");
    const resolved = {
      destinationName: top.name,
      stateOrRegion: top.stateOrRegion,
      district: top.district,
      country: resolvedCountry,
      fullName: resolvedCountry ? `${top.name}${top.stateOrRegion ? `, ${top.stateOrRegion}` : ""}, ${resolvedCountry}` : top.name,
      coordinates: resolvedCoords,
      isCoordinatesUnresolved: resolvedCoords === null,
    };

    const result = {
      isAmbiguous: false,
      query: raw,
      resolved,
      candidates: [],
    };

    disambiguationCache.set(key, result);
    return result;
  }
}

export const destinationDisambiguationService = new DestinationDisambiguationService();
