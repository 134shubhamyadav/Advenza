import OpenAI from "openai";
import { BaseAIProvider } from "./base.provider.js";
import { env } from "../../../config/env.js";
import { logger } from "../../../utils/logger.js";

export class OpenAIProvider extends BaseAIProvider {
  constructor() {
    super("OpenAI");
    this.models = ["gpt-4o-mini", "gpt-4o"];
    this.client = null;
  }

  isConfigured() {
    return Boolean(env.OPENAI_API_KEY);
  }

  getClient() {
    if (!this.client && this.isConfigured()) {
      this.client = new OpenAI({
        apiKey: env.OPENAI_API_KEY,
      });
    }
    return this.client;
  }

  async createCompletion({ messages, temperature = 0.7, maxTokens = 4096, signal, preferredModel, jsonMode = false }) {
    const client = this.getClient();
    if (!client) {
      throw new Error("OpenAI API key is not configured");
    }

    const modelsToTry = preferredModel ? [preferredModel, ...this.models.filter((m) => m !== preferredModel)] : this.models;
    const effectiveMaxTokens = Math.min(Number(maxTokens) || 4096, 4096);
    let lastError = null;

    for (const model of modelsToTry) {
      if (signal?.aborted) throw new Error("Aborted");

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

        const completion = await client.chat.completions.create(params, { signal });
        return { completion, provider: this.name, model };
      } catch (err) {
        lastError = err;
        logger.warn(`[OpenAI] Model ${model} failed: ${err.message}`, {
          model,
          status: err.status || err.statusCode,
        });

        if (signal?.aborted) throw err;
      }
    }

    throw lastError || new Error("All OpenAI models failed");
  }
}

export default new OpenAIProvider();

