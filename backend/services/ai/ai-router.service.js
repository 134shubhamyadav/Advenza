import groqProvider from "./providers/groq.provider.js";
import openRouterProvider from "./providers/openrouter.provider.js";
import cerebrasProvider from "./providers/cerebras.provider.js";
import togetherProvider from "./providers/together.provider.js";
import { extractAIContent, parseAIJson } from "./ai-parser.js";
import { AIProviderError } from "../../utils/errors.js";
import { logger } from "../../utils/logger.js";
import { env } from "../../config/env.js";

export class AIRouterService {
  constructor() {
    this.providers = [
      groqProvider,
      openRouterProvider,
      cerebrasProvider,
      togetherProvider,
    ];
  }

  isNonRetryableError(err) {
    if (!err) return false;
    // 400 Bad Request usually means the prompt/format itself is rejected by API rules (not a provider outage)
    const status = err.status || err.statusCode;
    if (status === 400 && !err.message?.toLowerCase().includes("rate")) {
      return true;
    }
    return false;
  }

  async execute({ messages, temperature = 0.7, maxTokens = 8192, timeoutMs = env.AI_TIMEOUT_MS, preferredProvider = null, preferredModel = null }) {
    const configuredProviders = this.providers.filter((p) => p.isConfigured());

    if (configuredProviders.length === 0) {
      throw new AIProviderError("No AI providers are configured with valid API keys.", 503);
    }

    const providerQueue = preferredProvider
      ? [
          ...configuredProviders.filter((p) => p.name.toLowerCase() === preferredProvider.toLowerCase()),
          ...configuredProviders.filter((p) => p.name.toLowerCase() !== preferredProvider.toLowerCase()),
        ]
      : configuredProviders;

    const attempts = [];

    for (let i = 0; i < providerQueue.length; i++) {
      const provider = providerQueue[i];
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const startTime = Date.now();

      try {
        logger.debug(`[AIRouter] Attempting provider ${provider.name}...`);
        const result = await provider.createCompletion({
          messages,
          temperature,
          maxTokens,
          signal: controller.signal,
          preferredModel: i === 0 ? preferredModel : null,
        });

        clearTimeout(timer);
        const duration = Date.now() - startTime;
        logger.info(`[AIRouter] Provider ${provider.name} succeeded (${duration}ms)`, {
          provider: provider.name,
          model: result.model,
          durationMs: duration,
          fallbackCount: i,
        });

        return {
          content: extractAIContent(result.completion),
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

        attempts.push({ provider: provider.name, error: errMessage, isTimeout });

        // If it's a fatal prompt issue (400 Bad Request), stop immediately
        if (this.isNonRetryableError(err)) {
          throw new AIProviderError(`Invalid AI request: ${err.message}`, 400, provider.name);
        }
      }
    }

    throw new AIProviderError(
      `All AI providers failed. Attempts: ${attempts.map((a) => `${a.provider}: ${a.error}`).join(" | ")}`,
      502
    );
  }

  /**
   * Helper that executes prompt and returns parsed JSON.
   */
  async generateJSON(options) {
    const result = await this.execute(options);
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
