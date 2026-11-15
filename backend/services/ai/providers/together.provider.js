import OpenAI from "openai";
import { BaseAIProvider } from "./base.provider.js";
import { env } from "../../../config/env.js";

export class TogetherProvider extends BaseAIProvider {
  constructor() {
    super("Together");
    this.models = ["meta-llama/Llama-3.3-70B-Instruct-Turbo"];
    this.client = null;
  }

  isConfigured() {
    return Boolean(env.TOGETHER_API_KEY);
  }

  getClient() {
    if (!this.client && this.isConfigured()) {
      this.client = new OpenAI({
        apiKey: env.TOGETHER_API_KEY,
        baseURL: "https://api.together.xyz/v1",
      });
    }
    return this.client;
  }

  async createCompletion({ messages, temperature = 0.7, maxTokens = 4096, signal, preferredModel, jsonMode = false }) {
    const client = this.getClient();
    if (!client) {
      throw new Error("Together API key is not configured");
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
        if (err.name === "AbortError" || signal?.aborted) {
          throw err;
        }
      }
    }

    throw lastError || new Error("All Together models failed");
  }
}

export default new TogetherProvider();
