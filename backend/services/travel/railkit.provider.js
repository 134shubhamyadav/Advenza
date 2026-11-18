import * as railkitSdk from "railkit";
import { env } from "../../config/env.js";
import { logger } from "../../utils/logger.js";
import { railcoreProvider } from "../ai/providers/railcore.provider.js";

/**
 * RailKit Indian Railways Provider
 * Official programmatic integration with RailKit API & SDK (https://railkit.in/docs)
 * Provides verified train information, complete station timetables, route sequencing,
 * live tracking V1 (NTES schedule) & V2 (WIMT GPS), delay metrics, and station lookups.
 */
export class RailKitProvider {
  constructor() {
    this.name = "RailKit";
    this.apiKey = env.RAILKIT_API_KEY || env.RAILCORE_API_KEY || null;
    this.isConfiguredFlag = false;
    this.cache = new Map();
    this.CACHE_TTL = 30 * 60 * 1000; // 30 mins

    if (this.apiKey) {
      try {
        railkitSdk.configure(this.apiKey);
        this.isConfiguredFlag = true;
        logger.info(`[RailKitProvider] RailKit SDK successfully initialized.`);
      } catch (err) {
        logger.warn(`[RailKitProvider] Initialization error: ${err.message}`);
      }
    }
  }

  isConfigured() {
    return Boolean(this.isConfiguredFlag && this.apiKey);
  }

  /**
   * Check provider health.
   */
  async checkAvailability() {
    if (!this.isConfigured()) {
      return {
        provider: "RailKit Indian Railways API",
        status: "NOT_CONFIGURED",
        isLive: false,
        message: "RailKit API key not configured (RAILKIT_API_KEY in backend/.env).",
      };
    }

    try {
      const res = await this.getTrainInfo("12618");
      return {
        provider: "RailKit Indian Railways API",
        status: res?.success ? "HEALTHY" : "DEGRADED",
        isLive: Boolean(res?.success),
        message: res?.success ? "RailKit API operational & verified." : "RailKit returned unexpected format.",
      };
    } catch (err) {
      return {
        provider: "RailKit Indian Railways API",
        status: "UNAVAILABLE",
        isLive: false,
        message: `RailKit probe failed: ${err.message}`,
      };
    }
  }

  /**
   * Retrieve complete train information including all intermediate stoppages,
   * scheduled arrival/departure, halt duration, distance, and railway Day number.
   *
   * @param {string} trainNumber - 5-digit Indian Railways train number
   * @returns {Promise<Object>} Normalized train info and route
   */
  async getTrainInfo(trainNumber) {
    const tNo = String(trainNumber || "").trim().slice(0, 5);
    if (!tNo) return null;

    const cacheKey = `train_info_${tNo}`;
    if (this.cache.has(cacheKey)) {
      const entry = this.cache.get(cacheKey);
      if (Date.now() - entry.timestamp < this.CACHE_TTL) {
        return entry.data;
      }
    }

    if (this.isConfigured()) {
      try {
        logger.debug(`[RailKitProvider] Fetching getTrainInfo for ${tNo}`);
        const res = await railkitSdk.getTrainInfo(tNo);
        if (res?.success && res?.data) {
          const rawInfo = res.data.trainInfo || {};
          const rawRoute = Array.isArray(res.data.route) ? res.data.route : [];

          const normalizedRoute = rawRoute.map((st, idx) => ({
            stationSequence: idx + 1,
            stnCode: st.stnCode,
            stnName: st.stnName,
            stationNameHindi: st.stationNameHindi || "",
            arrival: st.arrival === "--" ? null : st.arrival,
            departure: st.departure === "--" ? null : st.departure,
            halt: st.halt || "0 min",
            haltMinutes: Number(st.haltMinutes) || 0,
            distanceKm: Number(st.distance) || 0,
            day: Number(st.day) || 1, // Authoritative railway Day (1, 2, 3...)
            platform: st.platform || "",
            coordinates: st.coordinates?.latitude
              ? { lat: Number(st.coordinates.latitude), lng: Number(st.coordinates.longitude) }
              : null,
            division: st.division || "",
            zone: st.zone || "",
          }));

          const result = {
            success: true,
            source: "RAILKIT_VERIFIED",
            trainNumber: rawInfo.train_no || tNo,
            trainName: rawInfo.train_name,
            trainNameHindi: rawInfo.train_name_hindi || "",
            fromStationName: rawInfo.from_stn_name,
            fromStationCode: rawInfo.from_stn_code,
            toStationName: rawInfo.to_stn_name,
            toStationCode: rawInfo.to_stn_code,
            fromTime: rawInfo.from_time,
            toTime: rawInfo.to_time,
            travelTime: rawInfo.travel_time,
            runningDays: rawInfo.running_days,
            type: rawInfo.type || "SUPERFAST",
            route: normalizedRoute,
          };

          this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
          return result;
        }
      } catch (err) {
        logger.warn(`[RailKitProvider] getTrainInfo failed for ${tNo}: ${err.message}. Checking fallback.`);
      }
    }

    return null;
  }

  /**
   * Search for all direct trains between two stations on a specific date.
   *
   * @param {Object} params - { from, to, date (YYYY-MM-DD or DD-MM-YYYY) }
   * @returns {Promise<Array>} List of trains operating on that corridor
   */
  async searchTrainsBetweenStations({ from, to, date }) {
    if (!from || !to) return [];

    const fromCode = from.trim().toUpperCase();
    const toCode = to.trim().toUpperCase();
    const dateFormatted = date ? this._formatDateDDMMYYYY(date) : undefined;

    const cacheKey = `search_${fromCode}_${toCode}_${dateFormatted || "all"}`;
    if (this.cache.has(cacheKey)) {
      const entry = this.cache.get(cacheKey);
      if (Date.now() - entry.timestamp < this.CACHE_TTL) {
        return entry.data;
      }
    }

    if (this.isConfigured()) {
      try {
        logger.debug(`[RailKitProvider] Searching trains between ${fromCode} and ${toCode} on ${dateFormatted || "any"}`);
        const res = await railkitSdk.searchTrainBetweenStations(fromCode, toCode, dateFormatted);
        if (res?.success && Array.isArray(res?.data)) {
          const trains = res.data.map((t) => ({
            trainNumber: t.train_no,
            trainName: t.train_name,
            trainNameHindi: t.train_name_hindi || "",
            trainType: t.train_type_name || "EXPRESS",
            fromStationCode: t.from_stn_code || fromCode,
            fromStationName: t.from_stn_name || "",
            toStationCode: t.to_stn_code || toCode,
            toStationName: t.to_stn_name || "",
            departureTime: t.from_time || t.departure_time,
            arrivalTime: t.to_time || t.arrival_time,
            durationMinutes: t.duration_minutes || this._parseDurationTextToMinutes(t.travel_time),
            distanceKm: Number(t.distance) || null,
            classes: t.classes_of_travel ? t.classes_of_travel.split(",") : [],
            runningDays: t.running_days || "1111111",
            source: "RAILKIT_VERIFIED",
          }));

          this.cache.set(cacheKey, { data: trains, timestamp: Date.now() });
          return trains;
        }
      } catch (err) {
        logger.warn(`[RailKitProvider] searchTrainBetweenStations failed: ${err.message}. Checking RailCore fallback.`);
      }
    }

    // Fallback to RailCore provider if configured
    if (railcoreProvider.isConfigured()) {
      try {
        const rcTrains = await railcoreProvider.getTrainsBetweenStations({
          from: fromCode,
          to: toCode,
          date: date || new Date().toISOString().split("T")[0],
        });
        if (Array.isArray(rcTrains) && rcTrains.length > 0) {
          return rcTrains.map((t) => ({
            ...t,
            source: "RAILCORE_VERIFIED",
          }));
        }
      } catch (rcErr) {
        logger.debug(`[RailKitProvider] RailCore fallback also failed: ${rcErr.message}`);
      }
    }

    return [];
  }

  /**
   * Retrieve live train running status with actual arrival/departure,
   * current position, delay minutes, and expected arrival at destination.
   *
   * @param {string} trainNumber - 5-digit train number
   * @param {string} date - Journey start date in YYYY-MM-DD or DD-MM-YYYY format
   * @returns {Promise<Object|null>}
   */
  async trackLiveTrain(trainNumber, date) {
    const tNo = String(trainNumber || "").trim().slice(0, 5);
    const dateFormatted = this._formatDateDDMMYYYY(date);

    if (!tNo || !dateFormatted) return null;

    // Check if journey date is eligible for live tracking (within last 5 days through today)
    const isEligible = this._isDateEligibleForLiveTracking(date);
    if (!isEligible) {
      return {
        isLive: false,
        status: "FUTURE_SCHEDULE",
        message: "Live train tracking is currently unavailable for future journeys. Showing verified scheduled railway timetable.",
        delayMinutes: 0,
      };
    }

    if (this.isConfigured()) {
      // 1. Try Live Tracking V2 (WIMT live GPS tracker)
      try {
        logger.debug(`[RailKitProvider] Checking trackTrainV2 for ${tNo} on ${dateFormatted}`);
        const resV2 = await railkitSdk.trackTrainV2(tNo, dateFormatted);
        if (resV2?.success && resV2?.data) {
          const d = resV2.data;
          return {
            isLive: Boolean(d.isLive ?? true),
            status: d.status || "running",
            statusText: d.statusText || "",
            delayMinutes: Number(d.delayMinutes) || 0,
            currentLocation: d.currentLocation || null,
            previousHalt: d.previousHalt || null,
            nextHalt: d.nextHalt || null,
            lastUpdatedAt: d.lastUpdatedAt || new Date().toISOString(),
            dataSource: "RAILKIT_LIVE_V2",
            verificationStatus: "LIVE_VERIFIED",
          };
        }
      } catch (v2Err) {
        logger.debug(`[RailKitProvider] trackTrainV2 error: ${v2Err.message}. Trying trackTrain V1.`);
      }

      // 2. Try Live Tracking V1 (NTES schedule tracker)
      try {
        logger.debug(`[RailKitProvider] Checking trackTrain V1 for ${tNo} on ${dateFormatted}`);
        const resV1 = await railkitSdk.trackTrain(tNo, dateFormatted);
        if (resV1?.success && resV1?.data) {
          const d = resV1.data;
          return {
            isLive: true,
            status: "running",
            statusText: d.statusNote || "",
            delayMinutes: Number(d.trainDelay) || 0,
            currentStationCode: d.currentStationCode || null,
            lastUpdatedAt: d.lastUpdate || new Date().toISOString(),
            dataSource: "RAILKIT_NTES_LIVE_V1",
            verificationStatus: "LIVE_VERIFIED",
          };
        }
      } catch (v1Err) {
        logger.warn(`[RailKitProvider] trackTrain V1 error: ${v1Err.message}`);
      }
    }

    return {
      isLive: false,
      status: "UNAVAILABLE",
      message: "Live train tracking is currently unavailable. Showing verified scheduled railway timetable.",
      delayMinutes: 0,
      dataSource: "UNAVAILABLE",
      verificationStatus: "SCHEDULED_VERIFIED",
    };
  }

  /**
   * Search stations by code or name prefix.
   */
  async searchStations(query) {
    const q = String(query || "").trim();
    if (!q) return [];

    if (this.isConfigured()) {
      try {
        // Try stationByCode if query looks like a 3-5 letter station code
        if (/^[A-Z]{2,5}$/i.test(q)) {
          const byCode = await railkitSdk.stationByCode(q.toUpperCase());
          if (byCode?.success && byCode?.data) {
            return [
              {
                code: byCode.data.stationCode || q.toUpperCase(),
                name: byCode.data.stationName || q.toUpperCase(),
                lat: byCode.data.coordinates?.latitude,
                lon: byCode.data.coordinates?.longitude,
              },
            ];
          }
        }

        // Try stationsByName
        const byName = await railkitSdk.stationsByName(q);
        if (byName?.success && Array.isArray(byName?.data)) {
          return byName.data.map((st) => ({
            code: st.stnCode || st.stationCode,
            name: st.stnName || st.stationName,
            lat: st.coordinates?.latitude,
            lon: st.coordinates?.longitude,
          }));
        }
      } catch (err) {
        logger.debug(`[RailKitProvider] station lookup failed: ${err.message}`);
      }
    }

    // Fallback to RailCore station search
    if (railcoreProvider.isConfigured()) {
      return await railcoreProvider.searchStations(q);
    }

    return [];
  }

  /**
   * Format any date string (YYYY-MM-DD or DD-MM-YYYY) into DD-MM-YYYY required by RailKit.
   */
  _formatDateDDMMYYYY(dateStr) {
    if (!dateStr) return "";
    const clean = String(dateStr).trim().split("T")[0];
    if (/^\d{2}-\d{2}-\d{4}$/.test(clean)) return clean;
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
      const [y, m, d] = clean.split("-");
      return `${d}-${m}-${y}`;
    }
    return clean;
  }

  /**
   * Format any date string into YYYY-MM-DD format.
   */
  _formatDateYYYYMMDD(dateStr) {
    if (!dateStr) return "";
    const clean = String(dateStr).trim().split("T")[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
    if (/^\d{2}-\d{2}-\d{4}$/.test(clean)) {
      const [d, m, y] = clean.split("-");
      return `${y}-${m}-${d}`;
    }
    return clean;
  }

  /**
   * Checks if date is within 5 days in the past through today (IST).
   */
  _isDateEligibleForLiveTracking(dateStr) {
    const ymd = this._formatDateYYYYMMDD(dateStr);
    if (!ymd) return false;
    const [y, m, d] = ymd.split("-").map(Number);
    const targetDt = new Date(Date.UTC(y, m - 1, d));

    const now = new Date();
    // Today in UTC
    const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const diffDays = Math.round((targetDt.getTime() - todayUtc.getTime()) / 86400000);

    // Eligible if today or up to 5 days ago; future dates cannot have live tracking
    return diffDays <= 0 && diffDays >= -5;
  }

  /**
   * Parse "49:55 hrs" or "30h 35m" to minutes.
   */
  _parseDurationTextToMinutes(text) {
    if (!text) return null;
    const str = String(text);
    const colonMatch = str.match(/(\d+):(\d+)/);
    if (colonMatch) {
      return parseInt(colonMatch[1], 10) * 60 + parseInt(colonMatch[2], 10);
    }
    const hmMatch = str.match(/(\d+)\s*h(?:rs?)?\s*(?:(\d+)\s*m)?/i);
    if (hmMatch) {
      return parseInt(hmMatch[1], 10) * 60 + (hmMatch[2] ? parseInt(hmMatch[2], 10) : 0);
    }
    return null;
  }
}

export const railkitProvider = new RailKitProvider();
export default railkitProvider;
