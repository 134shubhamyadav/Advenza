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
  CLIENT_URL: z.string().optional().default("http://localhost:3000"),
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

  // Firebase
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  FIREBASE_STORAGE_BUCKET: z.string().optional(),

  // AI Providers
  GROQ_API_KEY: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  CEREBRAS_API_KEY: z.string().optional(),
  TOGETHER_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
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

  return {
    redis: {
      configured: Boolean(env.REDIS_URL || process.env.REDIS_HOST),
      requiredInProduction: true,
      status: env.REDIS_URL || (!isProd && env.REDIS_HOST) ? "CONFIGURED" : (isProd ? "REQUIRED_MISSING" : "NOT_CONFIGURED"),
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
    weather: {
      configured: Boolean(env.WEATHER_API_KEY || env.OPENWEATHER_API_KEY || env.VITE_WEATHER_API_KEY),
      fallbackAvailable: true, // Open-Meteo works without keys
      status: "CONFIGURED", // Fallback Open-Meteo is always ready
    },
    ai: {
      groq: Boolean(env.GROQ_API_KEY),
      openrouter: Boolean(env.OPENROUTER_API_KEY),
      together: Boolean(env.TOGETHER_API_KEY),
      cerebras: Boolean(env.CEREBRAS_API_KEY),
      openai: Boolean(env.OPENAI_API_KEY),
      anyConfigured: Boolean(
        env.GROQ_API_KEY ||
        env.OPENROUTER_API_KEY ||
        env.TOGETHER_API_KEY ||
        env.CEREBRAS_API_KEY ||
        env.OPENAI_API_KEY
      ),
      status: (
        env.GROQ_API_KEY ||
        env.OPENROUTER_API_KEY ||
        env.TOGETHER_API_KEY ||
        env.CEREBRAS_API_KEY ||
        env.OPENAI_API_KEY
      ) ? "CONFIGURED" : "NOT_CONFIGURED",
    },
  };
}

export default env;


