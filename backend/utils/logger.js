/**
 * Structured logger for Advenza.
 * Automatically redacts secrets, tokens, and passwords.
 */

const SENSITIVE_KEYS = new Set([
  "authorization",
  "apiKey",
  "api_key",
  "secret",
  "password",
  "token",
  "private_key",
  "privateKey",
  "serviceAccount",
]);

function redact(obj, depth = 0) {
  if (depth > 5 || !obj) return obj;
  if (typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => redact(item, depth + 1));
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase()) || key.toLowerCase().includes("token") || key.toLowerCase().includes("secret")) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = redact(value, depth + 1);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

const formatMessage = (level, message, meta = {}) => {
  const timestamp = new Date().toISOString();
  const safeMeta = redact(meta);
  return {
    timestamp,
    level,
    message,
    ...safeMeta,
  };
};

export const logger = {
  info: (message, meta) => {
    const formatted = formatMessage("INFO", message, meta);
    console.log(`[INFO] ${formatted.timestamp} - ${formatted.message}`, meta ? JSON.stringify(redact(meta)) : "");
  },
  warn: (message, meta) => {
    const formatted = formatMessage("WARN", message, meta);
    console.warn(`[WARN] ${formatted.timestamp} - ${formatted.message}`, meta ? JSON.stringify(redact(meta)) : "");
  },
  error: (message, meta) => {
    const formatted = formatMessage("ERROR", message, meta);
    console.error(`[ERROR] ${formatted.timestamp} - ${formatted.message}`, meta ? JSON.stringify(redact(meta)) : "");
  },
  debug: (message, meta) => {
    if (process.env.NODE_ENV !== "production") {
      const formatted = formatMessage("DEBUG", message, meta);
      console.log(`[DEBUG] ${formatted.timestamp} - ${formatted.message}`, meta ? JSON.stringify(redact(meta)) : "");
    }
  },
  http: (message, meta) => {
    const formatted = formatMessage("HTTP", message, meta);
    console.log(`[HTTP] ${formatted.timestamp} - ${formatted.message}`, meta ? JSON.stringify(redact(meta)) : "");
  },
};

export default logger;
