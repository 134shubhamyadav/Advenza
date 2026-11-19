import crypto from "crypto";
import { logger } from "./logger.js";

export class ExternalApiError extends Error {
  constructor({ message, provider, statusCode, endpoint, requestId, details, isTransient }) {
    super(message);
    this.name = "ExternalApiError";
    this.provider = provider || "ExternalService";
    this.statusCode = statusCode || 500;
    this.endpoint = endpoint || "";
    this.requestId = requestId || "";
    this.details = details || null;
    this.isTransient = Boolean(isTransient);
  }
}

/**
 * Sanitizes URL and headers for structured logging so secrets are never leaked.
 */
function sanitizeForLogging(url, options = {}) {
  try {
    const parsed = new URL(url);
    // Redact sensitive query parameters
    ["key", "apikey", "api_key", "secret", "token", "access_token"].forEach((k) => {
      if (parsed.searchParams.has(k)) {
        parsed.searchParams.set(k, "[REDACTED]");
      }
    });

    const headersCopy = { ...options.headers };
    if (headersCopy.Authorization || headersCopy.authorization) {
      headersCopy.authorization = "[REDACTED_AUTH]";
    }

    return {
      sanitizedUrl: parsed.toString(),
      method: options.method || "GET",
    };
  } catch {
    return { sanitizedUrl: "[Invalid URL]", method: options.method || "GET" };
  }
}

/**
 * Robust HTTP client layer for external travel & AI APIs.
 * Supports timeouts, exponential backoff, rate-limit backoff, request tracing, and normalized errors.
 */
export async function apiRequest(url, options = {}) {
  const {
    provider = "ExternalService",
    timeoutMs = 10000,
    maxRetries = 2,
    initialDelayMs = 500,
    maxDelayMs = 3000,
    headers = {},
    ...fetchOptions
  } = options;

  const requestId = options.requestId || crypto.randomUUID();
  const startTime = Date.now();
  const { sanitizedUrl, method } = sanitizeForLogging(url, options);

  let attempt = 0;

  while (attempt <= maxRetries) {
    const attemptStartTime = Date.now();
    try {
      const mergedHeaders = {
        "X-Request-Id": requestId,
        "User-Agent": "Advenza-Core/2.0",
        ...headers,
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      // Link external signal if provided
      if (options.signal) {
        options.signal.addEventListener("abort", () => controller.abort(), { once: true });
      }

      const res = await fetch(url, {
        ...fetchOptions,
        headers: mergedHeaders,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const durationMs = Date.now() - attemptStartTime;

      // Rate limit backoff (429)
      if (res.status === 429) {
        const retryAfterHeader = res.headers.get("retry-after");
        let retryAfterMs = (parseInt(retryAfterHeader, 10) || 1) * 1000;
        if (isNaN(retryAfterMs) || retryAfterMs <= 0) retryAfterMs = 1500;

        // If provider indicates a long cooldown (>10s, e.g. daily/quota exhaustion), do not retry; fail fast.
        if (retryAfterMs > 10000) {
          logger.warn(
            `[ApiClient][${provider}] Daily/quota rate limit (429) encountered on ${sanitizedUrl} (retry-after: ${retryAfterMs}ms). Failing fast to activate fallback. [reqId: ${requestId}]`
          );
          throw new ExternalApiError({
            message: `[${provider}] Daily/quota rate limit (429) exceeded on ${sanitizedUrl}`,
            provider,
            statusCode: 429,
            endpoint: sanitizedUrl,
            requestId,
            isTransient: false,
          });
        }

        if (attempt < maxRetries) {
          attempt++;
          const waitTime = Math.min(retryAfterMs, 3000);
          logger.warn(
            `[ApiClient][${provider}] Transient rate limit (429) on ${sanitizedUrl}. Retrying in ${waitTime}ms (attempt ${attempt}/${maxRetries}). [reqId: ${requestId}]`
          );
          await new Promise((r) => setTimeout(r, waitTime));
          continue;
        }
      }

      // Transient 5xx server errors eligible for retry
      const isTransient = [502, 503, 504].includes(res.status);
      if (!res.ok && isTransient && attempt < maxRetries) {
        attempt++;
        const backoff = Math.min(
          initialDelayMs * Math.pow(2, attempt) + Math.floor(Math.random() * 200),
          maxDelayMs
        );
        logger.warn(
          `[ApiClient][${provider}] Transient HTTP ${res.status} on ${sanitizedUrl}. Retrying in ${backoff}ms (attempt ${attempt}/${maxRetries}). [reqId: ${requestId}]`
        );
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }

      if (!res.ok) {
        let errBody = null;
        try {
          errBody = await res.json();
        } catch {
          errBody = await res.text().catch(() => null);
        }

        throw new ExternalApiError({
          message: `[${provider}] HTTP ${res.status} from ${sanitizedUrl}: ${typeof errBody === "object" ? JSON.stringify(errBody) : errBody || res.statusText}`,
          provider,
          statusCode: res.status,
          endpoint: sanitizedUrl,
          requestId,
          details: errBody,
          isTransient,
        });
      }

      logger.debug(`[ApiClient][${provider}] ${method} ${sanitizedUrl} -> ${res.status} (${durationMs}ms) [reqId: ${requestId}]`);
      return res;
    } catch (err) {
      const isAbort = err.name === "AbortError";
      const isNetwork = err.code === "ECONNRESET" || err.code === "ETIMEDOUT" || err.message?.includes("fetch failed");
      const isTransient = isAbort || isNetwork;

      if (isTransient && attempt < maxRetries) {
        attempt++;
        const backoff = Math.min(
          initialDelayMs * Math.pow(2, attempt) + Math.floor(Math.random() * 200),
          maxDelayMs
        );
        logger.warn(
          `[ApiClient][${provider}] ${isAbort ? "Timeout" : "Network error"} (${err.message}) on ${sanitizedUrl}. Retrying in ${backoff}ms (attempt ${attempt}/${maxRetries}). [reqId: ${requestId}]`
        );
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }

      if (err instanceof ExternalApiError) {
        throw err;
      }

      throw new ExternalApiError({
        message: `[${provider}] Request failed after ${Date.now() - startTime}ms: ${err.message}`,
        provider,
        statusCode: isAbort ? 504 : 502,
        endpoint: sanitizedUrl,
        requestId,
        details: err.message,
        isTransient,
      });
    }
  }
}

export const apiClient = {
  request: apiRequest,
  get: (url, options) => apiRequest(url, { ...options, method: "GET" }),
  post: (url, body, options) =>
    apiRequest(url, {
      ...options,
      method: "POST",
      headers: { "Content-Type": "application/json", ...options?.headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
};

export default apiClient;
