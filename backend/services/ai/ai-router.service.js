import groqProvider from "./providers/groq.provider.js";
import nvidiaProvider from "./providers/nvidia.provider.js";
import openRouterProvider from "./providers/openrouter.provider.js";
import geminiProvider from "./providers/gemini.provider.js";
import mistralProvider from "./providers/mistral.provider.js";
import cohereProvider from "./providers/cohere.provider.js";
import cerebrasProvider from "./providers/cerebras.provider.js";
import togetherProvider from "./providers/together.provider.js";
import openaiProvider from "./providers/openai.provider.js";
import { extractAIContent, parseAIJson } from "./ai-parser.js";
import { AIProviderError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";
import { env } from "../../config/env.js";

// Provider Health Tracker: tracks authentication, quota, and transient timeouts
export const providerHealth = new Map();

export function recordProviderSuccess(providerName) {
  providerHealth.set(providerName.toLowerCase(), {
    status: "HEALTHY",
    cooldownUntil: 0,
    consecutiveFailures: 0,
    lastSuccess: Date.now(),
  });
}

export function recordProviderFailure(providerName, err) {
  const name = providerName.toLowerCase();
  const current = providerHealth.get(name) || { consecutiveFailures: 0 };
  const failures = current.consecutiveFailures + 1;
  const status = err.status || err.statusCode;

  let cooldownMs = 30_000;
  let reason = "UNKNOWN";

  if (status === 401) {
    reason = "AUTH_FAILED";
    cooldownMs = 24 * 60 * 60 * 1000; // 24 hours cooldown for invalid API keys
    logger.error(`[AIRouter] Provider ${providerName} failed authentication (401). Marked unavailable for 24h.`);
  } else if (status === 402) {
    reason = "BILLING_EXHAUSTED";
    cooldownMs = 6 * 60 * 60 * 1000; // 6 hours cooldown for exhausted quota/credits
    logger.warn(`[AIRouter] Provider ${providerName} credits exhausted (402). Cooldown for 6h.`);
  } else if (status === 429) {
    reason = "RATE_LIMITED";
    const retrySec = Number(err.headers?.["retry-after"] || err.response?.headers?.["retry-after"]) || 60;
    cooldownMs = Math.max(retrySec * 1000, 45_000);
    logger.warn(`[AIRouter] Provider ${providerName} rate limited (429). Cooldown for ${Math.round(cooldownMs / 1000)}s.`);
  } else if (err.isTimeout) {
    reason = "TIMEOUT";
    cooldownMs = Math.min(30_000 * failures, 120_000);
    logger.warn(`[AIRouter] Provider ${providerName} timed out. Cooldown for ${Math.round(cooldownMs / 1000)}s.`);
  } else {
    reason = "ERROR";
    cooldownMs = 15_000;
  }

  providerHealth.set(name, {
    status: reason,
    cooldownUntil: Date.now() + cooldownMs,
    consecutiveFailures: failures,
    lastError: err.message,
  });
}

export function isProviderAvailable(providerName) {
  const health = providerHealth.get(providerName.toLowerCase());
  if (!health) return true;
  if (health.cooldownUntil && Date.now() < health.cooldownUntil) {
    return false;
  }
  return true;
}

export function resetProviderHealth() {
  providerHealth.clear();
}

export class AIRouterService {
  constructor() {
    this.providers = [
      groqProvider,
      nvidiaProvider,
      openRouterProvider,
      geminiProvider,
      mistralProvider,
      cohereProvider,
      cerebrasProvider,
      togetherProvider,
      openaiProvider,
    ];
  }

  getConfiguredProviders(preferredProvider = null) {
    const configured = this.providers.filter((p) => p.isConfigured());
    // Filter available providers (not currently in cooldown)
    const available = configured.filter((p) => isProviderAvailable(p.name));

    // If all configured providers are in cooldown, don't return an empty array—fallback to configured
    // so we don't immediately throw 503 if all hit transient timeouts.
    const pool = available.length > 0 ? available : configured;

    if (!preferredProvider) return pool;
    const pref = pool.filter((p) => p.name.toLowerCase() === preferredProvider.toLowerCase());
    const rest = pool.filter((p) => p.name.toLowerCase() !== preferredProvider.toLowerCase());
    return [...pref, ...rest];
  }

  async executeOnProvider(provider, options = {}) {
    const {
      messages,
      temperature = 0.7,
      maxTokens = 4096,
      max_tokens,
      timeoutMs = 25000,
      preferredModel = null,
      jsonMode = false,
    } = options;

    const effectiveMaxTokens = maxTokens ?? max_tokens ?? 4096;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const startTime = Date.now();

    try {
      logger.debug(`[AIRouter] Calling provider ${provider.name}...`);
      const result = await provider.createCompletion({
        messages,
        temperature,
        maxTokens: effectiveMaxTokens,
        signal: controller.signal,
        preferredModel,
        jsonMode,
      });

      clearTimeout(timer);
      const duration = Date.now() - startTime;
      const content = extractAIContent(result.completion);

      logger.info(`[AIRouter] Provider ${provider.name} responded (${duration}ms)`, {
        provider: provider.name,
        model: result.model,
        durationMs: duration,
        contentLength: content.length,
      });

      recordProviderSuccess(provider.name);

      return {
        content,
        rawCompletion: result.completion,
        provider: provider.name,
        model: result.model,
        durationMs: duration,
      };
    } catch (err) {
      clearTimeout(timer);
      const duration = Date.now() - startTime;
      const isTimeout = err.name === "AbortError" || controller.signal.aborted;
      const errMessage = isTimeout ? `Timed out after ${timeoutMs}ms` : err.message;

      logger.warn(`[AIRouter] Provider ${provider.name} failed (${duration}ms): ${errMessage}`, {
        provider: provider.name,
        durationMs: duration,
        isTimeout,
        status: err.status || err.statusCode,
      });

      const providerErr = new Error(errMessage);
      providerErr.provider = provider.name;
      providerErr.isTimeout = isTimeout;
      providerErr.status = err.status || err.statusCode;
      providerErr.headers = err.headers;

      recordProviderFailure(provider.name, providerErr);

      throw providerErr;
    }
  }

  async execute(options = {}) {
    const configuredProviders = this.getConfiguredProviders(options.preferredProvider);

    if (configuredProviders.length === 0) {
      throw new AIProviderError("No AI providers are configured with valid API keys.", 503);
    }

    const attempts = [];

    for (let i = 0; i < configuredProviders.length; i++) {
      const provider = configuredProviders[i];
      try {
        return await this.executeOnProvider(provider, {
          ...options,
          preferredModel: i === 0 ? options.preferredModel : null,
        });
      } catch (err) {
        attempts.push({
          provider: provider.name,
          error: err.message,
          isTimeout: err.isTimeout,
        });
      }
    }

    throw new AIProviderError(
      `All AI providers failed. Attempts: ${attempts.map((a) => `${a.provider}: ${a.error}`).join(" | ")}`,
      502
    );
  }

  /**
   * Returns configured, available vision-capable providers in prioritized order.
   */
  getVisionProviders(preferredProvider = null) {
    const visionPriority = [
      { provider: geminiProvider, preferredModel: "gemini-flash-lite-latest" },
      { provider: openaiProvider, preferredModel: "gpt-4o-mini" },
      { provider: openRouterProvider, preferredModel: "openai/gpt-4o-mini" },
      { provider: groqProvider, preferredModel: "qwen/qwen3.8-27b" },
    ];

    const configured = visionPriority.filter(({ provider }) => provider.isConfigured());
    const available = configured.filter(({ provider }) => isProviderAvailable(provider.name));
    const pool = available.length > 0 ? available : configured;

    if (!preferredProvider) return pool;
    const pref = pool.filter(({ provider }) => provider.name.toLowerCase() === preferredProvider.toLowerCase());
    const rest = pool.filter(({ provider }) => provider.name.toLowerCase() !== preferredProvider.toLowerCase());
    return [...pref, ...rest];
  }

  /**
   * Executes a multimodal vision AI request with automatic fallback between vision providers.
   */
  async executeVision(options = {}) {
    const visionTargets = this.getVisionProviders(options.preferredProvider);

    if (visionTargets.length === 0) {
      throw new AIProviderError("No vision-capable AI providers are configured with valid API keys.", 503);
    }

    const attempts = [];
    const visionTimeoutMs = options.timeoutMs || 35_000;

    for (let i = 0; i < visionTargets.length; i++) {
      const { provider, preferredModel } = visionTargets[i];
      try {
        return await this.executeOnProvider(provider, {
          ...options,
          timeoutMs: visionTimeoutMs,
          preferredModel: options.preferredModel || (i === 0 ? preferredModel : null),
        });
      } catch (err) {
        attempts.push({
          provider: provider.name,
          error: err.message,
          isTimeout: err.isTimeout,
        });
      }
    }

    throw new AIProviderError(
      `All vision AI providers failed. Attempts: ${attempts.map((a) => `${a.provider}: ${a.error}`).join(" | ")}`,
      502
    );
  }

  /**
   * Vision helper that executes prompt with image parts and returns parsed JSON.
   */
  async generateVisionJSON(options) {
    const result = await this.executeVision({ ...options, jsonMode: true });
    const parsed = parseAIJson(result.content);
    return { data: parsed, ...result };
  }

  /**
   * Vision helper that executes multimodal request and returns content + provider metadata.
   */
  async callVisionAI(options) {
    const result = await this.executeVision(options);
    const base = typeof result.rawCompletion === "object" && result.rawCompletion !== null ? result.rawCompletion : {};
    return {
      ...base,
      content: result.content,
      provider: result.provider,
      model: result.model,
    };
  }

  /**
   * Helper that executes prompt and returns parsed JSON.
   */
  async generateJSON(options) {
    const result = await this.execute({ ...options, jsonMode: true });
    const parsed = parseAIJson(result.content);
    return { data: parsed, ...result };
  }

  /**
   * Backward-compatible callAI function matching legacy signature.
   */
  async callAI(options) {
    const result = await this.execute(options);
    const base = typeof result.rawCompletion === "object" && result.rawCompletion !== null ? result.rawCompletion : {};
    return {
      ...base,
      content: result.content,
      provider: result.provider,
      model: result.model,
    };
  }
}

export const aiRouter = new AIRouterService();
export default aiRouter;
