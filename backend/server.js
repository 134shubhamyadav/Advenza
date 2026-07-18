import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";

import dns from "dns";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });

dns.setServers(["8.8.8.8"]); // Fix for local network/sandbox SRV lookup failures

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "2mb" })); // Itinerary payloads can be 15-80KB; 2MB is safe with auth in place

// ─── Rate Limiting ─────────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});

const aiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // Max 20 AI requests per minute
  message: { error: "AI rate limit reached. Please wait a moment." },
});

app.use(globalLimiter);
app.use("/api/ai", aiLimiter);

// ─── MongoDB ───────────────────────────────────────────────────────────────────
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/aventra";

mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("✅ Connected to MongoDB Atlas"))
  .catch((err) => console.error("❌ MongoDB error:", err.message));

// ─── Health check ──────────────────────────────────────────────────────────────
app.get("/", (req, res) =>
  res.json({
    status: "ok",
    service: "Aventra API",
    version: "1.0.0",
    db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  }),
);

// ─── Routes ────────────────────────────────────────────────────────────────────
import tripRoutes from "./routes/trips.js";
import aiRoutes from "./routes/ai.js";

app.use("/api/trips", tripRoutes);
app.use("/api/ai", aiRoutes);

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  // Sanity-check required credentials so missing keys surface immediately on startup
  const required = { GROQ_API_KEY: process.env.GROQ_API_KEY, OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY };
  for (const [k, v] of Object.entries(required)) {
    console.log(`🔑 ${k}: ${v ? "✅ loaded (" + v.slice(0, 8) + "...)" : "❌ MISSING — AI features will fail!"}`);
  }
});
