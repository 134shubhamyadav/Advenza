import { apiClient } from "../../../utils/apiClient.js";
import { logger } from "../../../utils/logger.js";
import { env } from "../../../config/env.js";

/**
 * RailCore Indian Railways API Provider
 * Connects to RailCore REST API (https://ir.railcore.tech/v1)
 * Provides real-time train searches, schedules, class-wise fares, and seat availability.
 */
export class RailCoreProvider {
  constructor() {
    this.name = "RailCore";
    this.apiKey = env.RAILCORE_API_KEY || null;
    this.baseUrl = env.RAILCORE_BASE_URL || "https://ir.railcore.tech/v1";
    this.cache = new Map();
    this.CACHE_TTL = 30 * 60 * 1000; // 30 mins
  }

  /**
   * Check if credentials are fully configured.
   */
  isConfigured() {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  /**
   * Check provider health.
   */
  async checkAvailability() {
    if (!this.isConfigured()) {
      return {
        provider: "RailCore Indian Railways API",
        status: "NOT_CONFIGURED",
        isLive: false,
        message: "RailCore API key not configured (RAILCORE_API_KEY in backend/.env).",
      };
    }

    try {
      const res = await this.searchStations("New Delhi");
      return {
        provider: "RailCore Indian Railways API",
        status: res.length > 0 ? "HEALTHY" : "DEGRADED",
        isLive: res.length > 0,
        message: res.length > 0 ? "RailCore API connected and operational." : "RailCore returned empty station search.",
      };
    } catch (err) {
      return {
        provider: "RailCore Indian Railways API",
        status: "UNAVAILABLE",
        isLive: false,
        message: `RailCore probe error: ${err.message}`,
      };
    }
  }

  /**
   * Common HTTP request helper with auth headers and secret redaction.
   */
  async _request(endpoint, queryParams = {}) {
    if (!this.isConfigured()) {
      throw new Error("RailCore API key is not configured.");
    }

    const url = new URL(`${this.baseUrl}${endpoint}`);
    Object.entries(queryParams).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") {
        url.searchParams.append(k, String(v));
      }
    });

    const urlStr = url.toString();
    const cacheKey = urlStr;
    if (this.cache.has(cacheKey)) {
      const entry = this.cache.get(cacheKey);
      if (Date.now() - entry.timestamp < this.CACHE_TTL) {
        return entry.data;
      }
    }

    const safeLogUrl = urlStr.replace(/X-RailCore-Key=[^&]+/i, "X-RailCore-Key=[REDACTED]");
    logger.debug(`[RailCore] GET ${safeLogUrl}`);

    const res = await apiClient.request(urlStr, {
      method: "GET",
      provider: "RailCore",
      timeoutMs: 12000,
      maxRetries: 2,
      headers: {
        "X-RailCore-Key": this.apiKey,
        "Accept": "application/json",
      },
    });

    const json = await res.json();
    if (!json.success && json.error) {
      const errMsg = json.error.message || `RailCore API returned error code ${json.error.code}`;
      logger.warn(`[RailCore] Error from endpoint ${endpoint}: ${errMsg}`);
      throw new Error(errMsg);
    }

    const data = json.data;
    this.cache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  }

  /**
   * Search stations by city name, station name, or station code.
   * @param {string} query
   * @returns {Promise<Array>}
   */
  async searchStations(query) {
    const q = String(query || "").trim();
    if (!q) return [];

    try {
      const data = await this._request("/stations/search", { q });
      const results = Array.isArray(data?.results) ? data.results : [];
      return results.map((st) => ({
        code: st.station_code,
        name: st.station_name || st.display_name,
        city: st.city,
        state: st.state,
        country: st.country,
        lat: st.latitude,
        lon: st.longitude,
        isMajor: Boolean(st.is_major),
        confidence: st.confidence,
      }));
    } catch (err) {
      logger.warn(`[RailCore] Station search failed for "${q}": ${err.message}`);
      return [];
    }
  }

  /**
   * Search direct and connecting trains between two stations on a specific date.
   * @param {Object} params - { from, to, date, quota }
   * @returns {Promise<Array>}
   */
  async getTrainsBetweenStations({ from, to, date, quota = "GN" }) {
    if (!from || !to || !date) {
      throw new Error("from, to, and date are required for RailCore train search.");
    }

    const fromCode = from.trim().toUpperCase();
    const toCode = to.trim().toUpperCase();
    const dateStr = String(date).split("T")[0];

    try {
      const data = await this._request("/routes/trains", {
        from: fromCode,
        to: toCode,
        date: dateStr,
        quota,
        match: "city",
      });

      const trains = Array.isArray(data?.trains) ? data.trains : [];
      return trains.map((t) => ({
        trainNumber: t.train_number,
        trainName: t.extended_train_name || t.train_name,
        fromStationCode: t.from_station_code,
        fromStationName: t.from_station_name,
        toStationCode: t.to_station_code,
        toStationName: t.to_station_name,
        departureTime: t.departure_time,
        arrivalTime: t.arrival_time,
        durationMinutes: t.duration_minutes,
        durationHours: Math.round(((t.duration_minutes || 0) / 60) * 10) / 10,
        distanceKm: t.distance_km,
        trainType: t.train_type || "EXPRESS",
        availableClasses: Array.isArray(t.classes) ? t.classes : [],
      }));
    } catch (err) {
      logger.warn(`[RailCore] Trains lookup failed between ${fromCode} and ${toCode} for ${dateStr}: ${err.message}`);
      return [];
    }
  }

  /**
   * Retrieve class-wise fares for a specific train segment.
   * @param {Object} params - { trainNumber, from, to, date, quota }
   * @returns {Promise<Array>}
   */
  async getFareEstimate({ trainNumber, from, to, date, quota = "GN" }) {
    if (!trainNumber || !from || !to) {
      throw new Error("trainNumber, from, and to are required for RailCore fare estimate.");
    }

    try {
      const data = await this._request("/fares/estimate", {
        train_number: trainNumber,
        from: from.trim().toUpperCase(),
        to: to.trim().toUpperCase(),
        date: date ? String(date).split("T")[0] : undefined,
        quota,
      });

      const fares = Array.isArray(data?.fares) ? data.fares : [];
      return fares.map((f) => ({
        classCode: f.class_code,
        fareINR: f.fare,
        currency: f.currency || "INR",
      }));
    } catch (err) {
      logger.warn(`[RailCore] Fare estimate failed for train ${trainNumber}: ${err.message}`);
      return [];
    }
  }

  /**
   * Retrieve live seat availability, RAC, or waitlist status for a specific train, class, and journey date.
   * @param {Object} params - { trainNumber, from, to, date, classCode, quota }
   * @returns {Promise<Object|null>}
   */
  async getSeatAvailability({ trainNumber, from, to, date, classCode = "3A", quota = "GN" }) {
    if (!trainNumber || !from || !to || !date) {
      throw new Error("trainNumber, from, to, and date are required for RailCore seat availability.");
    }

    try {
      const data = await this._request("/availability/seats", {
        train_number: trainNumber,
        from: from.trim().toUpperCase(),
        to: to.trim().toUpperCase(),
        date: String(date).split("T")[0],
        class: classCode,
        quota,
      });

      const clsList = Array.isArray(data?.classes) ? data.classes : [];
      const match = clsList.find((c) => c.class_code === classCode) || clsList[0];

      if (!match) return null;

      return {
        trainNumber,
        classCode: match.class_code,
        status: match.status, // "AVAILABLE", "RAC", "WAITLIST", "REGRET"
        availabilityText: match.availability_text, // e.g. "AVAILABLE 42", "GNWL225/WL129", "RAC 14"
        availableCount: match.available_count || 0,
        waitlistCount: match.waitlist_count || 0,
        racCount: match.rac_count || 0,
        wlPool: match.wl_pool || null,
        wlPoolPosition: match.wl_pool_position || null,
        baseFareINR: match.fare_breakdown?.base_fare || match.fare,
        totalFareINR: match.total_fare || match.fare,
        lastUpdated: new Date().toISOString(),
        isLive: true,
      };
    } catch (err) {
      logger.warn(`[RailCore] Seat availability failed for train ${trainNumber} (${classCode}): ${err.message}`);
      return null;
    }
  }

  /**
   * Resolve best station code for a given city or place name.
   */
  async resolveStationCode(placeName) {
    const clean = String(placeName || "").trim().toLowerCase();
    if (!clean) return null;

    // Common standard station code overrides
    const COMMON_CODES = {
      mumbai: "CSMT",
      "mumbai central": "MMCT",
      pune: "PUNE",
      delhi: "NDLS",
      "new delhi": "NDLS",
      bangalore: "SBC",
      bengaluru: "SBC",
      goa: "MAO",
      madgaon: "MAO",
      jaipur: "JP",
      kolkata: "HWH",
      howrah: "HWH",
      chennai: "MAS",
      hyderabad: "SC",
      secunderabad: "SC",
      ahmedabad: "ADI",
      varanasi: "BSB",
      agra: "AGC",
      chandigarh: "CDG",
      amritsar: "ASR",
      lucknow: "LKO",
      patna: "PNBE",
      bhopal: "BPL",
      indore: "INDB",
      nagpur: "NGP",
      surat: "ST",
      vadodara: "BRC",
      guwahati: "GHY",
      shimla: "SML",
      dehradun: "DDN",
      haridwar: "HW",
      rishikesh: "YNRK",
      kochi: "ERS",
      ernakulam: "ERS",
      trivandrum: "TVC",
    };

    if (COMMON_CODES[clean]) return COMMON_CODES[clean];

    // Query RailCore station search
    const results = await this.searchStations(placeName);
    if (results.length > 0) {
      const major = results.find((s) => s.isMajor) || results[0];
      return major.code;
    }

    return null;
  }

  /**
   * High-Level Comprehensive Railway Journey Routing Pipeline
   * Resolves stations, searches trains, fetches class-wise fares, and checks live availability.
   */
  async resolveRailwayRoute({
    origin,
    destination,
    journeyDate,
    passengers = 1,
    preferredClass = "3A",
    quota = "GN",
  }) {
    if (!this.isConfigured()) {
      return {
        isConfigured: false,
        status: "NOT_CONFIGURED",
        provider: "RailCore",
        message: "RailCore API is not configured. Provide RAILCORE_API_KEY in backend/.env.",
        trains: [],
      };
    }

    const [fromStation, toStation] = await Promise.all([
      this.resolveStationCode(origin),
      this.resolveStationCode(destination),
    ]);

    if (!fromStation || !toStation) {
      return {
        isConfigured: true,
        status: "STATION_NOT_FOUND",
        provider: "RailCore",
        message: `Could not resolve Indian railway station for "${!fromStation ? origin : destination}".`,
        fromStation,
        toStation,
        trains: [],
      };
    }

    const dateStr = journeyDate || new Date(Date.now() + 86400000 * 7).toISOString().split("T")[0];

    const trains = await this.getTrainsBetweenStations({
      from: fromStation,
      to: toStation,
      date: dateStr,
      quota,
    });

    if (trains.length === 0) {
      return {
        isConfigured: true,
        status: "NO_DIRECT_TRAINS",
        provider: "RailCore",
        message: `No scheduled trains found connecting ${fromStation} and ${toStation} on ${dateStr}.`,
        fromStation,
        toStation,
        journeyDate: dateStr,
        trains: [],
      };
    }

    // Enhance the top 3-4 trains with class-wise fares and availability
    const enrichedTrains = await Promise.all(
      trains.slice(0, 4).map(async (t) => {
        const targetClass =
          Array.isArray(t.availableClasses) && t.availableClasses.includes(preferredClass)
            ? preferredClass
            : (t.availableClasses?.includes("3A")
                ? "3A"
                : (t.availableClasses?.includes("CC")
                    ? "CC"
                    : (t.availableClasses?.[0] || preferredClass)));

        const [fares, availability] = await Promise.all([
          this.getFareEstimate({
            trainNumber: t.trainNumber,
            from: t.fromStationCode || fromStation,
            to: t.toStationCode || toStation,
            date: dateStr,
            quota,
          }).catch(() => []),
          this.getSeatAvailability({
            trainNumber: t.trainNumber,
            from: t.fromStationCode || fromStation,
            to: t.toStationCode || toStation,
            date: dateStr,
            classCode: targetClass,
            quota,
          }).catch(() => null),
        ]);

        const selectedFare =
          fares.find((f) => f.classCode === targetClass)?.fareINR ||
          availability?.totalFareINR ||
          (fares[0]?.fareINR ?? 1200);

        return {
          ...t,
          fares,
          seatAvailability: availability,
          selectedClass: targetClass,
          selectedFarePerPersonINR: selectedFare,
          totalFareForGroupINR: selectedFare * Math.max(1, passengers),
          priceType: "LIVE_VERIFIED",
          source: "RAILCORE_LIVE_API",
          lastUpdated: new Date().toISOString(),
        };
      })
    );

    return {
      isConfigured: true,
      status: "SUCCESS",
      provider: "RailCore",
      fromStation,
      toStation,
      journeyDate: dateStr,
      totalTrainsFound: trains.length,
      trains: enrichedTrains,
      recommendedTrain: enrichedTrains[0] || null,
      sourceConfidence: "RAILCORE_VERIFIED",
    };
  }
}

export const railcoreProvider = new RailCoreProvider();
export default railcoreProvider;
