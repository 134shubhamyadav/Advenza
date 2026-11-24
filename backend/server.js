import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dns from "dns";

// Ensure IPv4 lookup precedence to avoid IPv6 getaddrinfo timeouts on Windows/home networks
try {
  dns.setDefaultResultOrder("ipv4first");
} catch (_) {}

import { config } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { requestId } from "./middleware/requestId.js";
import { globalLimiter } from "./middleware/rateLimiter.js";
import { errorHandler } from "./middleware/errorHandler.js";

// Routes
import healthRoutes from "./routes/health.js";
import tripRoutes from "./routes/trips.js";
import aiRoutes from "./routes/ai.js";
import memoriesRoutes from "./routes/memories.js";
import collageRoutes from "./routes/collages.js";
import travelRoutes from "./routes/travel.js";
import budgetRoutes from "./routes/budget.js";
import userRoutes from "./routes/user.js";
import mediaRoutes from "./routes/media.js";
import mediaUploadsRouter from "./routes/media-uploads.js";
import mailRoutes from "./routes/mail.js";
import invitationRoutes from "./routes/invitations.js";
import { collageWorker } from "./services/collage/collage-worker.js";
import { startPriceWatchScheduler, stopPriceWatchScheduler } from "./services/price-watch/price-watch.worker.js";
import { runStartupMigrations } from "./services/database/migration.service.js";

// Optional DNS override if explicitly specified in environment
if (process.env.CUSTOM_DNS) {
  try {
    dns.setServers([process.env.CUSTOM_DNS]);
  } catch (_) {}
}

const app = express();
const PORT = config.PORT;

// ─── Core Middleware ───────────────────────────────────────────────────────────
app.use(requestId);

const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(",").map((s) => s.trim())
  : ["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000", "http://127.0.0.1:5173"];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (
        config.NODE_ENV !== "production" ||
        allowedOrigins.includes(origin) ||
        allowedOrigins.includes("*") ||
        /\.netlify\.app$/.test(origin) ||
        /\.vercel\.app$/.test(origin)
      ) {
        return callback(null, true);
      }
      return callback(new Error("CORS origin not allowed by Advenza security policy"), false);
    },
    credentials: true,
  })
);

// Secure local media handler with authentication, IDOR checks, and share token support
app.use("/uploads", mediaUploadsRouter);

// Request context logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.http(`${req.method} ${req.originalUrl} ${res.statusCode} (${duration}ms) [${req.id}]`);
  });
  next();
});

// Specific controlled limits for body parsing
app.use("/api/ai", express.json({ limit: "2mb" }));
app.use(express.json({ limit: "1mb" }));

// Tiered Global Rate Limiter
app.use(globalLimiter);

// ─── Health Checks ─────────────────────────────────────────────────────────────
app.use("/health", healthRoutes);

// Root path compatibility check
app.get("/", (req, res) =>
  res.json({
    status: "ok",
    service: "Advenza API",
    version: "2.0.0",
    db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  })
);

// ─── Application API Routes ────────────────────────────────────────────────────
app.use("/api/trips", budgetRoutes);
app.use("/api/trips", tripRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/memories", memoriesRoutes);
app.use("/api/collages", collageRoutes);
app.use("/api/travel", travelRoutes);
app.use("/api/users", userRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/mail", mailRoutes);
app.use("/api/invitations", invitationRoutes);

// ─── Centralized Error Handler ─────────────────────────────────────────────────
app.use(errorHandler);

// ─── Database & Server Initialization ──────────────────────────────────────────
mongoose
  .connect(config.MONGODB_URI)
  .then(async () => {
    logger.info("✅ Connected to MongoDB Atlas");
    try {
      await runStartupMigrations();
      await collageWorker.recoverStuckJobs();
      startPriceWatchScheduler();
    } catch (migErr) {
      logger.error(`Startup initialization warning: ${migErr.message}`);
    }
  })
  .catch((err) => logger.error(`❌ MongoDB connection error: ${err.message}`));

const server = app.listen(PORT, () => {
  logger.info(`🚀 Advenza Server running on http://localhost:${PORT}`);
  // Redacted configuration sanity check
  const providers = [
    "GROQ_API_KEY",
    "NVIDIA_API_KEY",
    "OPENROUTER_API_KEY",
    "GEMINI_API_KEY",
    "COHERE_API_KEY",
    "MISTRAL_API_KEY",
    "CEREBRAS_API_KEY",
    "OPENAI_API_KEY",
    "TOGETHER_API_KEY",
  ];
  for (const k of providers) {
    const isSet = Boolean(process.env[k]);
    logger.info(`🔑 ${k}: ${isSet ? "✅ configured" : "⚠️  not set"}`);
  }
});

// ─── Graceful Shutdown ─────────────────────────────────────────────────────────
const gracefulShutdown = (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  server.close(async () => {
    logger.info("HTTP server closed.");
    try {
      stopPriceWatchScheduler();
      await mongoose.connection.close(false);
      logger.info("MongoDB connection closed.");
      process.exit(0);
    } catch (err) {
      logger.error(`Error closing MongoDB: ${err.message}`);
      process.exit(1);
    }
  });
};



process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

export default app;
