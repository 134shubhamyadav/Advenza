import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { logger } from "../../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Calculate great-circle distance in kilometers using the Haversine formula
function calculateHaversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export class AirportLookupService {
  constructor() {
    this.name = "Airport Lookup Service";
    this.metadata = null;
    this.airports = [];
    this.byId = new Map();
    this.byIata = new Map();
    this.byIcao = new Map();
    this.byCity = new Map();
    this._initialized = false;
    this._loadDataset();
  }

  _loadDataset() {
    if (this._initialized) return;

    // Search common paths for data/airports/india_operational_airports.json
    const candidates = [
      path.resolve(process.cwd(), "data", "airports", "india_operational_airports.json"),
      path.resolve(__dirname, "../../../data/airports/india_operational_airports.json"),
      path.resolve(__dirname, "../../data/airports/india_operational_airports.json"),
    ];

    let filePath = null;
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        filePath = p;
        break;
      }
    }

    if (!filePath) {
      logger.warn(`[${this.name}] Warning: Airport master dataset not found at candidates`);
      return;
    }

    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      this.metadata = parsed.metadata || {};
      this.airports = Array.isArray(parsed.airports) ? parsed.airports : [];

      for (const ap of this.airports) {
        if (ap.airport_id) {
          this.byId.set(ap.airport_id.toUpperCase(), ap);
        }
        if (ap.iata_code) {
          this.byIata.set(ap.iata_code.toUpperCase(), ap);
        }
        if (ap.icao_code) {
          this.byIcao.set(ap.icao_code.toUpperCase(), ap);
        }
        if (ap.served_city) {
          const cityKey = ap.served_city.toLowerCase().trim();
          if (!this.byCity.has(cityKey)) {
            this.byCity.set(cityKey, []);
          }
          this.byCity.get(cityKey).push(ap);
        }
      }

      this._initialized = true;
      logger.info(
        `[${this.name}] Successfully loaded ${this.airports.length} verified operational airports from ${filePath}`
      );
    } catch (err) {
      logger.error(`[${this.name}] Failed to load airport master dataset: ${err.message}`);
    }
  }

  getMetadata() {
    return this.metadata;
  }

  getAllAirports({ onlyScheduled = false } = {}) {
    if (onlyScheduled) {
      return this.airports.filter((a) => a.scheduled_service === true);
    }
    return this.airports;
  }

  getAirportById(airportId) {
    if (!airportId) return null;
    return this.byId.get(String(airportId).trim().toUpperCase()) || null;
  }

  findAirportByCode(code) {
    if (!code) return null;
    const clean = String(code).trim().toUpperCase();
    if (this.byIata.has(clean)) {
      return this.byIata.get(clean);
    }
    if (this.byIcao.has(clean)) {
      return this.byIcao.get(clean);
    }
    return null;
  }

  findAirportsByCity(cityName) {
    if (!cityName) return [];
    const query = String(cityName).trim().toLowerCase();
    const results = [];
    for (const [cityKey, list] of this.byCity.entries()) {
      if (cityKey.includes(query) || query.includes(cityKey)) {
        results.push(...list);
      }
    }
    return results;
  }

  searchAirports(query, { onlyScheduled = false, limit = 10 } = {}) {
    if (!query) return [];
    const q = String(query).trim().toLowerCase();

    // Check direct code match first
    const codeMatch = this.findAirportByCode(q);
    if (codeMatch) {
      return [codeMatch];
    }

    const matches = [];
    for (const ap of this.airports) {
      if (onlyScheduled && ap.scheduled_service !== true) continue;

      const name = (ap.airport_name || "").toLowerCase();
      const city = (ap.served_city || "").toLowerCase();
      const mun = (ap.municipality || "").toLowerCase();
      const state = (ap.state_ut || "").toLowerCase();
      const iata = (ap.iata_code || "").toLowerCase();
      const icao = (ap.icao_code || "").toLowerCase();

      if (
        name.includes(q) ||
        city.includes(q) ||
        mun.includes(q) ||
        state.includes(q) ||
        iata === q ||
        icao === q
      ) {
        matches.push(ap);
        if (matches.length >= limit) break;
      }
    }

    return matches;
  }

  findNearbyAirports({
    latitude,
    longitude,
    maxRadiusKm = 250,
    limit = 5,
    onlyScheduled = false,
    types = null,
  }) {
    const lat = Number(latitude);
    const lon = Number(longitude);

    if (isNaN(lat) || isNaN(lon)) {
      return [];
    }

    const allowedTypes = Array.isArray(types)
      ? new Set(types.map((t) => t.toLowerCase()))
      : null;

    const nearby = [];

    for (const ap of this.airports) {
      if (ap.latitude == null || ap.longitude == null) continue;
      if (onlyScheduled && ap.scheduled_service !== true) continue;
      if (allowedTypes && !allowedTypes.has(String(ap.airport_type).toLowerCase())) continue;

      const dist = calculateHaversineDistanceKm(lat, lon, ap.latitude, ap.longitude);
      if (dist <= maxRadiusKm) {
        nearby.push({
          airport: ap,
          distanceKm: dist,
        });
      }
    }

    // Sort ascending by geographical distance
    nearby.sort((a, b) => a.distanceKm - b.distanceKm);

    return nearby.slice(0, limit);
  }
}

export const airportLookupService = new AirportLookupService();
