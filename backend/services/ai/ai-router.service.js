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
    if (!preferredProvider) return configured;
    const pref = configured.filter((p) => p.name.toLowerCase() === preferredProvider.toLowerCase());
    const rest = configured.filter((p) => p.name.toLowerCase() !== preferredProvider.toLowerCase());
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
