import OpenAI from "openai";
import { BaseAIProvider } from "./base.provider.js";
import { env } from "../../../config/env.js";

export class OpenRouterProvider extends BaseAIProvider {
  constructor() {
    super("OpenRouter");
    this.models = [
      "qwen/qwen-2.5-72b-instruct",
      "meta-llama/llama-3.3-70b-instruct",
      "mistralai/mistral-large",
      "google/gemini-flash-1.5",
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
      });
    }
    return this.client;
  }

  async createCompletion({ messages, temperature = 0.7, maxTokens = 8192, signal, preferredModel }) {
    const client = this.getClient();
    if (!client) {
      throw new Error("OpenRouter API key is not configured");
    }

    const modelsToTry = preferredModel ? [preferredModel, ...this.models.filter((m) => m !== preferredModel)] : this.models;
    let lastError = null;

    for (const model of modelsToTry) {
      try {
        const completion = await client.chat.completions.create(
          {
            model,
            messages,
            temperature,
            max_tokens: maxTokens,
          },
          { signal }
        );
        return { completion, provider: this.name, model };
      } catch (err) {
        lastError = err;
        if (err.name === "AbortError" || signal?.aborted) {
          throw err;
        }
      }
    }

    throw lastError || new Error("All OpenRouter models failed");
  }
}

export default new OpenRouterProvider();
