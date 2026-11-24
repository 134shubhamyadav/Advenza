import rateLimit from "express-rate-limit";

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many requests from this IP. Please try again after 15 minutes.",
    code: "RATE_LIMIT_EXCEEDED",
  },
});

export const aiGenerateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // Max 10 itinerary generations per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Itinerary generation rate limit reached. Please wait a moment before generating another trip.",
    code: "AI_RATE_LIMIT",
  },
});

export const aiChatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Max 30 chat/planb turns per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "AI conversation rate limit reached. Please wait a few seconds before sending more messages.",
    code: "AI_CHAT_RATE_LIMIT",
  },
});

export const travelSearchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 40, // Max 40 searches per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Travel search rate limit reached. Please wait a few seconds before searching again.",
    code: "TRAVEL_SEARCH_RATE_LIMIT",
  },
});

export const priceWatchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Max 30 watch operations per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Price watch rate limit reached. Please wait a few minutes before adding more watchers.",
    code: "PRICE_WATCH_RATE_LIMIT",
  },
});
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60, // Max 60 uploads per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Upload limit reached. Please wait a few minutes before uploading more files.",
    code: "UPLOAD_RATE_LIMIT",
  },
});
