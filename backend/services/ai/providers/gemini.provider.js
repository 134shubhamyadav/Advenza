import OpenAI from "openai";
import { BaseAIProvider } from "./base.provider.js";
import { env } from "../../../config/env.js";
import { logger } from "../../../utils/logger.js";

export class GeminiProvider extends BaseAIProvider {
  constructor() {
    super("Gemini");
    this.models = ["gemini-flash-lite-latest", "gemini-2.5-flash-lite", "gemini-3.8-flash", "gemini-flash-latest"];
    this.client = null;
  }

  isConfigured() {
    return Boolean(env.GEMINI_API_KEY);
  }

  getClient() {
    if (!this.client && this.isConfigured()) {
      this.client = new OpenAI({
        apiKey: env.GEMINI_API_KEY,
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      });
    }
    return this.client;
  }

  async createCompletion({ messages, temperature = 0.7, maxTokens = 8192, signal, preferredModel, jsonMode = false }) {
    const client = this.getClient();
    if (!client) {
      throw new Error("Gemini API key is not configured");
    }

    const modelsToTry = preferredModel ? [preferredModel, ...this.models.filter((m) => m !== preferredModel)] : this.models;
    // Gemini models support 8192+ output tokens; do not artificially throttle to 4096 which causes truncated JSON
    const effectiveMaxTokens = Math.min(Number(maxTokens) || 8192, 8192);
    const PER_MODEL_TIMEOUT_MS = 30_000;
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
        const status = err.status || err.statusCode;
        logger.warn(`[Gemini] Model ${model} failed: ${err.message}`, {
          model,
          status,
          isTimeout: modelController.signal.aborted,
        });

        if (signal?.aborted) {
          throw err;
        }

        // Account-level errors: skip attempting other models on same key
        if (status === 401 || status === 402 || status === 429) {
          throw err;
        }
      }
    }

    throw lastError || new Error("All Gemini models failed");
  }
}

export default new GeminiProvider();
