import crypto from "crypto";
import { getRedisClient, isRedisAvailable } from "../queue/redis.js";
import { logger } from "../../utils/logger.js";

// In-memory fallback cache
const memoryCache = new Map();

export const CACHE_TTLS = {
  WEATHER: 30 * 60,       // 30 minutes
  FLIGHT_SEARCH: 15 * 60, // 15 minutes
  HOTEL_SEARCH: 30 * 60,  // 30 minutes
  TRANSPORT: 15 * 60,     // 15 minutes
};

export class TravelCacheService {
  /**
   * Compute a deterministic hash for search params.
   */
  hashParams(params) {
    const sorted = Object.keys(params || {})
      .sort()
      .reduce((acc, k) => {
        acc[k] = params[k];
        return acc;
      }, {});
    return crypto.createHash("md5").update(JSON.stringify(sorted)).digest("hex").slice(0, 16);
  }

  // Key generators
  weatherKey(location, date = "current") {
    const loc = (location || "").toLowerCase().replace(/[^a-z0-9]/g, "_");
    return `travel:weather:${loc}:${date}`;
  }

  flightSearchKey(params) {
    const hash = this.hashParams(params);
    return `travel:flights:${params.origin || "any"}:${params.destination || "any"}:${hash}`;
  }

  hotelSearchKey(params) {
    const hash = this.hashParams(params);
    const dest = (params.destination || "any").toLowerCase().replace(/[^a-z0-9]/g, "_");
    return `travel:hotels:${dest}:${hash}`;
  }

  transportKey(origin, destination, mode = "driving") {
    const o = (origin || "").toLowerCase().replace(/[^a-z0-9]/g, "_");
    const d = (destination || "").toLowerCase().replace(/[^a-z0-9]/g, "_");
    return `travel:transport:${o}:${d}:${mode}`;
  }

  /**
   * Get cached entry.
   */
  async get(key) {
    const redis = getRedisClient();

    if (isRedisAvailable() && redis) {
      try {
        const raw = await redis.get(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          return {
            ...parsed,
            isCached: true,
          };
        }
      } catch (err) {
        logger.warn(`[TravelCache] Redis get error for ${key}: ${err.message}`);
      }
    }

    // In-memory fallback
    const mem = memoryCache.get(key);
    if (mem) {
      if (Date.now() < mem.expiresAtMs) {
        return {
          data: mem.data,
          lastUpdated: mem.lastUpdated,
          expiresAt: mem.expiresAt,
          source: mem.source,
          isCached: true,
        };
      } else {
        memoryCache.delete(key);
      }
    }

    return null;
  }

  /**
   * Set cache entry with TTL in seconds.
   */
  async set(key, data, ttlSeconds, source = "Travel Data API") {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

    const payload = {
      data,
      lastUpdated: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      source,
    };

    const redis = getRedisClient();
    if (isRedisAvailable() && redis) {
      try {
        await redis.setex(key, ttlSeconds, JSON.stringify(payload));
        return true;
      } catch (err) {
        logger.warn(`[TravelCache] Redis set error for ${key}: ${err.message}`);
      }
    }

    // In-memory fallback
    memoryCache.set(key, {
      ...payload,
      expiresAtMs: expiresAt.getTime(),
    });

    // Prune expired in-memory keys if map grows large
    if (memoryCache.size > 200) {
      const nowMs = Date.now();
      for (const [k, v] of memoryCache.entries()) {
        if (nowMs >= v.expiresAtMs) memoryCache.delete(k);
      }
    }

    return true;
  }
}

export const travelCacheService = new TravelCacheService();
export const travelCache = travelCacheService;
export default travelCacheService;
