import OpenAI from "openai";
import { BaseAIProvider } from "./base.provider.js";
import { env } from "../../../config/env.js";
import { logger } from "../../../utils/logger.js";

export class GroqProvider extends BaseAIProvider {
  constructor() {
    super("Groq");
    // Verified active Groq models:
    // 1. qwen/qwen3.8-27b: ultra-fast (~1.1s), exceptional structured JSON (OTPM capped to 900)
    // 2. openai/gpt-oss-20b: fast (~1.7s) fallback
    this.models = [
      "qwen/qwen3.8-27b",
      "openai/gpt-oss-20b",
    ];
    this.client = null;
  }

  isConfigured() {
    return Boolean(env.GROQ_API_KEY);
  }

  getClient() {
    if (!this.client && this.isConfigured()) {
      this.client = new OpenAI({
        apiKey: env.GROQ_API_KEY,
        baseURL: "https://api.groq.com/openai/v1",
      });
    }
    return this.client;
  }

  async createCompletion({ messages, temperature = 0.7, maxTokens = 4096, signal, preferredModel, jsonMode = false }) {
    const client = this.getClient();
    if (!client) {
      throw new Error("Groq API key is not configured");
    }

    const modelsToTry = preferredModel ? [preferredModel, ...this.models.filter((m) => m !== preferredModel)] : this.models;
    // Cap max_tokens to 4096 to prevent hitting Groq's 6,000 TPM limit on free tier
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
        const modelMaxTokens = model.includes("qwen") ? Math.min(effectiveMaxTokens, 900) : effectiveMaxTokens;
        const params = {
          model,
          messages,
          temperature,
          max_tokens: modelMaxTokens,
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
        logger.warn(`[Groq] Model ${model} failed: ${err.message}`, {
          model,
          status: err.status || err.statusCode,
          isTimeout: modelController.signal.aborted,
        });

        if (signal?.aborted) {
          throw err;
        }
      }
    }

    throw lastError || new Error("All Groq models failed");
  }
}

export default new GroqProvider();
