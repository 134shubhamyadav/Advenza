import OpenAI from "openai";
import { BaseAIProvider } from "./base.provider.js";
import { env } from "../../../config/env.js";

export class CerebrasProvider extends BaseAIProvider {
  constructor() {
    super("Cerebras");
    this.models = ["llama3.1-70b", "llama3.1-8b"];
    this.client = null;
  }

  isConfigured() {
    return Boolean(env.CEREBRAS_API_KEY);
  }

  getClient() {
    if (!this.client && this.isConfigured()) {
      this.client = new OpenAI({
        apiKey: env.CEREBRAS_API_KEY,
        baseURL: "https://api.cerebras.ai/v1",
      });
    }
    return this.client;
  }

  async createCompletion({ messages, temperature = 0.7, maxTokens = 8192, signal, preferredModel }) {
    const client = this.getClient();
    if (!client) {
      throw new Error("Cerebras API key is not configured");
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

    throw lastError || new Error("All Cerebras models failed");
  }
}

export default new CerebrasProvider();
