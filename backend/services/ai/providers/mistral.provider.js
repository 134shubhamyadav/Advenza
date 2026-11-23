import OpenAI from "openai";
import { BaseAIProvider } from "./base.provider.js";
import { env } from "../../../config/env.js";
import { logger } from "../../../utils/logger.js";

export class MistralProvider extends BaseAIProvider {
  constructor() {
    super("Mistral");
    this.models = ["mistral-small-latest", "mistral-medium-latest", "open-mistral-7b"];
    this.client = null;
  }

  isConfigured() {
    return Boolean(env.MISTRAL_API_KEY);
  }

  getClient() {
    if (!this.client && this.isConfigured()) {
      this.client = new OpenAI({
        apiKey: env.MISTRAL_API_KEY,
        baseURL: "https://api.mistral.ai/v1",
      });
    }
    return this.client;
  }

  async createCompletion({ messages, temperature = 0.7, maxTokens = 4096, signal, preferredModel, jsonMode = false }) {
    const client = this.getClient();
    if (!client) {
      throw new Error("Mistral API key is not configured");
    }

    const modelsToTry = preferredModel ? [preferredModel, ...this.models.filter((m) => m !== preferredModel)] : this.models;
    const effectiveMaxTokens = Math.min(Number(maxTokens) || 4096, 4096);
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
        logger.warn(`[Mistral] Model ${model} failed: ${err.message}`, {
          model,
          status,
          isTimeout: modelController.signal.aborted,
        });

        if (signal?.aborted) {
          throw err;
        }

        if (status === 401 || status === 402 || status === 429) {
          throw err;
        }
      }
    }

    throw lastError || new Error("All Mistral models failed");
  }
}

export default new MistralProvider();

