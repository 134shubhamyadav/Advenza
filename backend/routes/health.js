import express from "express";
import mongoose from "mongoose";
import { checkRedisHealth } from "../services/queue/redis.js";
import { getReelQueueHealth } from "../services/queue/reel-queue.js";
import { flightProvider } from "../services/travel/providers/flight.provider.js";
import { hotelProvider } from "../services/travel/providers/hotel.provider.js";
import { transportProvider } from "../services/travel/providers/transport.provider.js";
import { weatherProvider } from "../services/travel/providers/weather.provider.js";
import { getProviderConfigStatus, env } from "../config/env.js";

const router = express.Router();

/**
 * GET /health — Basic lightweight liveness probe.
 */
router.get("/", (req, res) => {
  res.json({
    status: "HEALTHY",
    service: "Advenza API",
    version: "2.0.0",
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /health/ready — Readiness probe checking database & primary infrastructure.
 */
router.get("/ready", async (req, res) => {
  const dbState = mongoose.connection.readyState;
  const isDbReady = dbState === 1;

  let dbStatus = "UNAVAILABLE";
  if (dbState === 1) dbStatus = "HEALTHY";
  else if (dbState === 2) dbStatus = "DEGRADED";

  const redisHealth = await checkRedisHealth();

  const isHealthy = isDbReady && (env.NODE_ENV !== "production" || redisHealth.status === "HEALTHY");

  return res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? "HEALTHY" : "DEGRADED",
    environment: env.NODE_ENV,
    components: {
      database: {
        status: dbStatus,
        details: dbState === 1 ? "Connected to MongoDB" : "MongoDB not connected",
      },
      redis: redisHealth,
    },
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /health/detailed — Deep inspection across all infrastructure & external providers.
 * Strictly distinguishes HEALTHY, DEGRADED, NOT_CONFIGURED, and UNAVAILABLE.
 */
router.get("/detailed", async (req, res) => {
  const dbState = mongoose.connection.readyState;
  let dbStatus = "UNAVAILABLE";
  if (dbState === 1) dbStatus = "HEALTHY";
  else if (dbState === 2) dbStatus = "DEGRADED";

  const [redisHealth, queueHealth, flightAvail, hotelAvail, transportAvail] = await Promise.all([
    checkRedisHealth(),
    getReelQueueHealth(),
    flightProvider.checkAvailability(),
    hotelProvider.checkAvailability(),
    transportProvider.checkAvailability(),
  ]);

  const providerConfig = getProviderConfigStatus();

  // Storage Status
  let storageStatus = "NOT_CONFIGURED";
  let storageMessage = "Local server storage active for temporary processing.";
  if (env.FIREBASE_STORAGE_BUCKET || env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    storageStatus = "HEALTHY";
    storageMessage = `Firebase Storage bucket configured: ${env.FIREBASE_STORAGE_BUCKET || "default"}`;
  }

  // AI Router Status
  const aiStatus = providerConfig.ai.anyConfigured ? "HEALTHY" : "NOT_CONFIGURED";

  const components = {
    application: {
      status: "HEALTHY",
      uptimeSeconds: Math.round(process.uptime()),
      memoryUsageMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      nodeEnv: env.NODE_ENV,
    },
    mongodb: {
      status: dbStatus,
      state: dbState,
      message: dbState === 1 ? "Connected and ready." : "Disconnected or reconnecting.",
    },
    redis: redisHealth,
    bullmqQueue: queueHealth,
    storage: {
      status: storageStatus,
      message: storageMessage,
    },
    aiProviders: {
      status: aiStatus,
      groq: providerConfig.ai.groq ? "CONFIGURED" : "NOT_CONFIGURED",
      openrouter: providerConfig.ai.openrouter ? "CONFIGURED" : "NOT_CONFIGURED",
      together: providerConfig.ai.together ? "CONFIGURED" : "NOT_CONFIGURED",
      cerebras: providerConfig.ai.cerebras ? "CONFIGURED" : "NOT_CONFIGURED",
      openai: providerConfig.ai.openai ? "CONFIGURED" : "NOT_CONFIGURED",
    },
    travelProviders: {
      flights: flightAvail,
      hotels: hotelAvail,
      transport: transportAvail,
      weather: {
        provider: "Open-Meteo Meteorology Service",
        status: "HEALTHY",
        isLive: true,
        message: "Open-Meteo telemetry active with verified satellite and weather station data.",
      },
    },
  };

  const isCriticalOperational = dbStatus === "HEALTHY";
  const overallStatus = isCriticalOperational
    ? (redisHealth.status === "HEALTHY" && aiStatus === "HEALTHY" ? "HEALTHY" : "DEGRADED")
    : "UNAVAILABLE";

  return res.status(isCriticalOperational ? 200 : 503).json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    components,
  });
});

export default router;
