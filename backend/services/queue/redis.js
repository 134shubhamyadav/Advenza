import { Redis } from "ioredis";
import { logger } from "../../utils/logger.js";
import { env } from "../../config/env.js";

const REDIS_URL = env.REDIS_URL;
const REDIS_HOST = env.REDIS_HOST || "127.0.0.1";
const REDIS_PORT = env.REDIS_PORT || 6379;
const REDIS_PASSWORD = env.REDIS_PASSWORD;
const isProd = env.NODE_ENV === "production";
const isRedisDisabled = env.SKIP_REDIS || env.REDIS_ENABLED === false;

let redisClient = null;
let connectionStatus = "NOT_ATTEMPTED"; // 'HEALTHY', 'DEGRADED', 'NOT_CONFIGURED', 'UNAVAILABLE', 'CONNECTING'
let lastError = null;

export function getRedisClient() {
  if (redisClient) return redisClient;

  // If Redis is explicitly skipped or disabled (e.g. in development via SKIP_REDIS=true)
  if (isRedisDisabled) {
    if (connectionStatus !== "NOT_CONFIGURED") {
      connectionStatus = "NOT_CONFIGURED";
      logger.info("[Redis] Redis is disabled via SKIP_REDIS/REDIS_ENABLED. Operating with local in-memory fallbacks.");
    }
    return null;
  }

  // In production, REDIS_URL is strictly required
  if (isProd && !REDIS_URL) {
    connectionStatus = "NOT_CONFIGURED";
    logger.warn("[Redis] REDIS_URL is not configured in production environment. BullMQ distributed queue will report NOT_CONFIGURED.");
    return null;
  }

  // In development, if neither REDIS_URL nor a custom host is given, note that Redis will try local 127.0.0.1
  try {
    connectionStatus = "CONNECTING";

    const options = {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      connectTimeout: 5000,
      lazyConnect: false,
      retryStrategy(times) {
        if (times > (isProd ? 5 : 1)) {
          connectionStatus = isProd ? "UNAVAILABLE" : "DEGRADED";
          if (isProd) {
            logger.warn(`[Redis] Max reconnect attempts reached (${times}). Pausing retries.`);
          } else {
            logger.info(`[Redis] Local Redis not detected on ${REDIS_HOST}:${REDIS_PORT}. Operating in development with in-memory fallback.`);
          }
          return null; // Stop retrying
        }
        const delay = Math.min(times * 1000, 5000);
        logger.info(`[Redis] Reconnecting in ${delay}ms (attempt ${times})...`);
        return delay;
      },
    };

    if (REDIS_PASSWORD) {
      options.password = REDIS_PASSWORD;
    }

    if (REDIS_URL) {
      redisClient = new Redis(REDIS_URL, options);
    } else {
      redisClient = new Redis({
        host: REDIS_HOST,
        port: REDIS_PORT,
        ...options,
      });
    }

    redisClient.on("connect", () => {
      logger.info(`[Redis] Socket connected to ${REDIS_URL ? "configured REDIS_URL" : `${REDIS_HOST}:${REDIS_PORT}`}`);
    });

    redisClient.on("ready", () => {
      connectionStatus = "HEALTHY";
      lastError = null;
      logger.info("[Redis] Ready to accept commands.");
    });

    redisClient.on("error", (err) => {
      lastError = err.message;
      if (connectionStatus !== "UNAVAILABLE" && connectionStatus !== "DEGRADED") {
        connectionStatus = isProd ? "UNAVAILABLE" : "DEGRADED";
        if (isProd) {
          logger.warn(`[Redis] Connection warning: ${err.message}.`);
        } else {
          logger.info(`[Redis] Connection notice: ${err.message}. Using in-memory fallback.`);
        }
      }
    });

    redisClient.on("close", () => {
      if (connectionStatus === "HEALTHY") {
        connectionStatus = "UNAVAILABLE";
        logger.warn("[Redis] Connection closed.");
      }
    });

    redisClient.on("reconnecting", () => {
      connectionStatus = "CONNECTING";
      logger.info("[Redis] Reconnecting...");
    });

    return redisClient;
  } catch (err) {
    lastError = err.message;
    connectionStatus = isProd ? "UNAVAILABLE" : "DEGRADED";
    logger.warn(`[Redis] Initialization error: ${err.message}`);
    return null;
  }
}

export function isRedisAvailable() {
  return connectionStatus === "HEALTHY" && redisClient && redisClient.status === "ready";
}

/**
 * Health check reporter distinguishing HEALTHY, DEGRADED, NOT_CONFIGURED, and UNAVAILABLE.
 */
export async function checkRedisHealth() {
  if (isRedisDisabled) {
    return {
      status: "NOT_CONFIGURED",
      message: "Redis is disabled via SKIP_REDIS/REDIS_ENABLED. In-memory fallbacks active.",
      isLive: false,
    };
  }

  if (isProd && !REDIS_URL) {
    return {
      status: "NOT_CONFIGURED",
      message: "Redis is not configured. Set REDIS_URL in production environment.",
      isLive: false,
    };
  }

  if (!redisClient) {
    return {
      status: connectionStatus === "NOT_CONFIGURED" ? "NOT_CONFIGURED" : (isProd ? "UNAVAILABLE" : "DEGRADED"),
      message: lastError || "Redis client has not been initialized. In-memory fallbacks active in development.",
      isLive: false,
    };
  }

  try {
    if (redisClient.status === "ready") {
      const ping = await redisClient.ping();
      if (ping === "PONG") {
        return {
          status: "HEALTHY",
          message: "Redis connection active and responding to PING.",
          isLive: true,
          mode: REDIS_URL ? "remote_cluster_or_url" : "standalone",
        };
      }
    }

    return {
      status: isProd ? "UNAVAILABLE" : "DEGRADED",
      clientStatus: redisClient.status,
      message: lastError || `Redis client status is '${redisClient.status}'.`,
      isLive: false,
    };
  } catch (err) {
    return {
      status: isProd ? "UNAVAILABLE" : "DEGRADED",
      message: `Redis health probe error: ${err.message}`,
      isLive: false,
    };
  }
}

export async function disconnectRedis() {
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch {
      redisClient.disconnect();
    } finally {
      redisClient = null;
      connectionStatus = "NOT_CONFIGURED";
    }
  }
}

export default getRedisClient;

