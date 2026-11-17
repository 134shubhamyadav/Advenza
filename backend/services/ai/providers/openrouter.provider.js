import OpenAI from "openai";
import { BaseAIProvider } from "./base.provider.js";
import { env } from "../../../config/env.js";
import { logger } from "../../../utils/logger.js";

export class OpenRouterProvider extends BaseAIProvider {
  constructor() {
    super("OpenRouter");
    // Priority order:
    // 1. Fast, highly reliable models first (llama-3.1-8b finishes in ~3s)
    // 2. High-quality 70B models (llama-3.3-70b finishes in ~8s)
    // 3. Fallbacks
    this.models = [
      "meta-llama/llama-3.1-8b-instruct",
      "meta-llama/llama-3.3-70b-instruct",
      "openai/gpt-4o-mini",
      "qwen/qwen-2.5-72b-instruct",
      "openrouter/auto",
    ];
    this.client = null;
  }

  isConfigured() {
    return Boolean(env.OPENROUTER_API_KEY);
  }

  getClient() {
    if (!this.client && this.isConfigured()) {
      this.client = new OpenAI({
        apiKey: env.OPENROUTER_API_KEY,
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: {
          "HTTP-Referer": env.CLIENT_URL || "http://localhost:3000",
          "X-Title": "Advenza Travel Companion",
        },
      });
    }
    return this.client;
  }

  async createCompletion({ messages, temperature = 0.7, maxTokens = 4096, signal, preferredModel, jsonMode = false }) {
    const client = this.getClient();
    if (!client) {
      throw new Error("OpenRouter API key is not configured");
    }

    const modelsToTry = preferredModel ? [preferredModel, ...this.models.filter((m) => m !== preferredModel)] : this.models;
    const effectiveMaxTokens = Math.min(Number(maxTokens) || 4096, 4096);
    const PER_MODEL_TIMEOUT_MS = 15_000;
    let lastError = null;

    for (const model of modelsToTry) {
      if (signal?.aborted) throw new Error("Aborted");

      const modelController = new AbortController();
      const perModelTimer = setTimeout(() => modelController.abort(), PER_MODEL_TIMEOUT_MS);
      if (signal) {
        signal.addEventListener("abort", () => modelController.abort(), { once: true });
      }

      try {
        const params = {
          model,
          messages,
          temperature,
          max_tokens: effectiveMaxTokens,
        };

        if (jsonMode) {
          params.response_format = { type: "json_object" };
        }

        const completion = await client.chat.completions.create(params, { signal: modelController.signal });
        clearTimeout(perModelTimer);
        return { completion, provider: this.name, model };
      } catch (err) {
        clearTimeout(perModelTimer);
        lastError = err;
        logger.warn(`[OpenRouter] Model ${model} failed: ${err.message}`, {
          model,
          status: err.status || err.statusCode,
          isTimeout: modelController.signal.aborted,
        });

        if (signal?.aborted) throw err;
      }
    }

    throw lastError || new Error("All OpenRouter models failed");
  }
}

export default new OpenRouterProvider();
