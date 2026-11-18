import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  CLIENT_URL: z.string().optional().default(process.env.FRONTEND_URL || process.env.APP_URL || "http://localhost:3000"),
  FRONTEND_URL: z.string().optional(),
  APP_URL: z.string().optional(),
  ALLOWED_ORIGINS: z.string().optional(),
  MONGODB_URI: z.string().default("mongodb://localhost:27017/Advenza"),

  // Security & Media
  JWT_SECRET: z.string().optional(),
  MEDIA_ACCESS_SECRET: z.string().optional(),

  // Redis & BullMQ
  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().default("127.0.0.1"),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  SKIP_REDIS: z.preprocess((v) => v === "true" || v === true || v === "1", z.boolean()).default(false),
  REDIS_ENABLED: z.preprocess((v) => {
    if (v === undefined || v === null || v === "") return undefined;
    return v === "true" || v === true || v === "1";
  }, z.boolean().optional()),

  // Firebase
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  FIREBASE_STORAGE_BUCKET: z.string().optional(),

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  CLOUDINARY_URL: z.string().optional(),

  // AI Providers
  GROQ_API_KEY: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  CEREBRAS_API_KEY: z.string().optional(),
  TOGETHER_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  COHERE_API_KEY: z.string().optional(),
  MISTRAL_API_KEY: z.string().optional(),
  NVIDIA_API_KEY: z.string().optional(),
  AI_TIMEOUT_MS: z.coerce.number().default(30000),
  AI_MAX_RETRIES: z.coerce.number().default(2),

  // Travel Providers
  AMADEUS_CLIENT_ID: z.string().optional(),
  AMADEUS_CLIENT_SECRET: z.string().optional(),
  AMADEUS_HOSTNAME: z.string().default("test.api.amadeus.com"),
  HOTEL_API_KEY: z.string().optional(),
  GOOGLE_MAPS_API_KEY: z.string().optional(),
  MAPS_API_KEY: z.string().optional(),
  WEATHER_API_KEY: z.string().optional(),
  VITE_WEATHER_API_KEY: z.string().optional(),
  OPENWEATHER_API_KEY: z.string().optional(),

  // Brevo Email Provider
  BREVO_API_KEY: z.string().optional(),
  BREVO_SENDER_EMAIL: z.string().email().optional().default("advenzaaa@gmail.com"),
  BREVO_SENDER_NAME: z.string().optional().default("Advenza Travel Companion"),

  // RailKit & RailCore Indian Railways API Providers
  RAILKIT_API_KEY: z.string().optional(),
  RAILCORE_API_KEY: z.string().optional(),
  RAILCORE_BASE_URL: z.string().default("https://ir.railcore.tech/v1"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment configuration:", parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
export const config = parsed.data;

/**
 * Returns configuration status for all external providers without leaking secrets.
 */
export function getProviderConfigStatus() {
  const isProd = env.NODE_ENV === "production";
  const isRedisDisabled = env.SKIP_REDIS || env.REDIS_ENABLED === false;

  return {
    redis: {
      configured: Boolean(!isRedisDisabled && (env.REDIS_URL || env.REDIS_HOST)),
      requiredInProduction: true,
      status: isRedisDisabled
        ? "NOT_CONFIGURED"
        : (env.REDIS_URL || (!isProd && env.REDIS_HOST) ? "CONFIGURED" : (isProd ? "REQUIRED_MISSING" : "NOT_CONFIGURED")),
    },
    firebaseAuth: {
      configured: Boolean(env.FIREBASE_SERVICE_ACCOUNT_JSON),
      status: env.FIREBASE_SERVICE_ACCOUNT_JSON ? "CONFIGURED" : "NOT_CONFIGURED",
    },
    firebaseStorage: {
      configured: Boolean(env.FIREBASE_STORAGE_BUCKET || env.FIREBASE_SERVICE_ACCOUNT_JSON),
      status: (env.FIREBASE_STORAGE_BUCKET || env.FIREBASE_SERVICE_ACCOUNT_JSON) ? "CONFIGURED" : "NOT_CONFIGURED",
    },
    amadeusFlight: {
      configured: Boolean(env.AMADEUS_CLIENT_ID && env.AMADEUS_CLIENT_SECRET),
      status: (env.AMADEUS_CLIENT_ID && env.AMADEUS_CLIENT_SECRET) ? "CONFIGURED" : "NOT_CONFIGURED",
    },
    hotelProvider: {
      configured: Boolean(env.HOTEL_API_KEY || (env.AMADEUS_CLIENT_ID && env.AMADEUS_CLIENT_SECRET)),
      status: (env.HOTEL_API_KEY || (env.AMADEUS_CLIENT_ID && env.AMADEUS_CLIENT_SECRET)) ? "CONFIGURED" : "NOT_CONFIGURED",
    },
    googleMapsTransit: {
      configured: Boolean(env.GOOGLE_MAPS_API_KEY || env.MAPS_API_KEY),
      status: (env.GOOGLE_MAPS_API_KEY || env.MAPS_API_KEY) ? "CONFIGURED" : "NOT_CONFIGURED",
    },
    googlePlaces: {
      configured: Boolean(env.GOOGLE_MAPS_API_KEY || env.MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY),
      fallbackAvailable: true,
      status: (env.GOOGLE_MAPS_API_KEY || env.MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY) ? "CONFIGURED" : "CURATED_FALLBACK_ACTIVE",
    },
    weather: {
      configured: Boolean(env.WEATHER_API_KEY || env.OPENWEATHER_API_KEY || env.VITE_WEATHER_API_KEY),
      fallbackAvailable: true, // Open-Meteo works without keys
      status: "CONFIGURED", // Fallback Open-Meteo is always ready
    },
    ai: {
      groq: Boolean(env.GROQ_API_KEY),
      openrouter: Boolean(env.OPENROUTER_API_KEY),
      gemini: Boolean(env.GEMINI_API_KEY),
      cohere: Boolean(env.COHERE_API_KEY),
      mistral: Boolean(env.MISTRAL_API_KEY),
      nvidia: Boolean(env.NVIDIA_API_KEY),
      together: Boolean(env.TOGETHER_API_KEY),
      cerebras: Boolean(env.CEREBRAS_API_KEY),
      openai: Boolean(env.OPENAI_API_KEY),
      anyConfigured: Boolean(
        env.GROQ_API_KEY ||
        env.OPENROUTER_API_KEY ||
        env.GEMINI_API_KEY ||
        env.COHERE_API_KEY ||
        env.MISTRAL_API_KEY ||
        env.NVIDIA_API_KEY ||
        env.TOGETHER_API_KEY ||
        env.CEREBRAS_API_KEY ||
        env.OPENAI_API_KEY
      ),
      status: (
        env.GROQ_API_KEY ||
        env.OPENROUTER_API_KEY ||
        env.GEMINI_API_KEY ||
        env.COHERE_API_KEY ||
        env.MISTRAL_API_KEY ||
        env.NVIDIA_API_KEY ||
        env.TOGETHER_API_KEY ||
        env.CEREBRAS_API_KEY ||
        env.OPENAI_API_KEY
      ) ? "CONFIGURED" : "NOT_CONFIGURED",
    },
    brevo: {
      configured: Boolean(env.BREVO_API_KEY),
      status: env.BREVO_API_KEY ? "CONFIGURED" : "NOT_CONFIGURED",
    },
  };
}

/**
 * Resolves the client base URL for public links (invitations, email callbacks).
 * Enforces production domain usage and avoids accidental localhost links.
 *
 * @param {Object} [req] Optional Express request to extract Origin / Host if valid
 * @returns {string} Fully-qualified base URL without trailing slash
 */
export function getClientBaseUrl(req) {
  // 1. Explicit environment configuration
  const configured = (env.CLIENT_URL || env.FRONTEND_URL || env.APP_URL || "").trim().replace(/\/$/, "");

  // If a valid production URL (non-localhost) is configured in env, strictly prefer it
  if (configured && !configured.includes("localhost") && !configured.includes("127.0.0.1")) {
    return configured;
  }

  // 2. Inspect request origin header from client request (e.g. browser on mobile/LAN or reverse proxy)
  if (req) {
    const originHeader = (typeof req.get === "function" ? (req.get("origin") || req.get("x-forwarded-host")) : null)
      || (req.headers && (req.headers.origin || req.headers["x-forwarded-host"]));

    if (originHeader && typeof originHeader === "string") {
      let candidate = originHeader.trim().replace(/\/$/, "");
      if (!candidate.startsWith("http://") && !candidate.startsWith("https://")) {
        const proto = (typeof req.get === "function" && req.get("x-forwarded-proto")) || "https";
        candidate = `${proto}://${candidate}`;
      }
      try {
        const parsed = new URL(candidate);
        if (parsed.hostname && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
          return candidate;
        }
      } catch (_) {}
    }
  }

  // 3. Fallback: configured URL or localhost in development
  if (env.NODE_ENV === "production" && (!configured || configured.includes("localhost"))) {
    console.warn("[Config] ⚠️ WARNING: Neither CLIENT_URL nor FRONTEND_URL is set to a production domain. Defaulting to localhost:3000.");
  }

  return configured || "http://localhost:3000";
}

export default env;


