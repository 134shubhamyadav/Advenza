import OpenAI from "openai";
import { BaseAIProvider } from "./base.provider.js";
import { env } from "../../../config/env.js";

export class GroqProvider extends BaseAIProvider {
  constructor() {
    super("Groq");
    this.models = [
      "openai/gpt-oss-120b",
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

  async createCompletion({ messages, temperature = 0.7, maxTokens = 8192, signal, preferredModel }) {
    const client = this.getClient();
    if (!client) {
      throw new Error("Groq API key is not configured");
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
        // If aborted or rate limit, break or throw to let router decide
        if (err.name === "AbortError" || signal?.aborted) {
          throw err;
        }
      }
    }

    throw lastError || new Error("All Groq models failed");
  }
}

export default new GroqProvider();
