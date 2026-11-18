import OpenAI from "openai";
import { BaseAIProvider } from "./base.provider.js";
import { env } from "../../../config/env.js";
import { logger } from "../../../utils/logger.js";

export class NvidiaProvider extends BaseAIProvider {
  constructor() {
    super("Nvidia");
    // Verified active models on NVIDIA API Catalog (NIM):
    // 1. nvidia/nemotron-3.5-bolt-e4b: Ultra-fast (~1000ms), high throughput JSON synthesis
    // 2. nvidia/nemotron-3.5-lightning-30b-a3b: High-depth 30B MoE reasoning model
    // 3. nvidia/nemotron-3-nano-omni-30b-a3b-reasoning: Multimodal reasoning fallback
    this.models = [
      "nvidia/nemotron-3.5-bolt-e4b",
      "nvidia/nemotron-3.5-lightning-30b-a3b",
      "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
    ];
    this.client = null;
  }

  isConfigured() {
    return Boolean(env.NVIDIA_API_KEY);
  }

  getClient() {
    if (!this.client && this.isConfigured()) {
      this.client = new OpenAI({
        apiKey: env.NVIDIA_API_KEY,
        baseURL: "https://integrate.api.nvidia.com/v1",
      });
    }
    return this.client;
  }

  async createCompletion({ messages, temperature = 0.7, maxTokens = 4096, signal, preferredModel, jsonMode = false }) {
    const client = this.getClient();
    if (!client) {
      throw new Error("NVIDIA API key is not configured");
    }

    const modelsToTry = preferredModel ? [preferredModel, ...this.models.filter((m) => m !== preferredModel)] : this.models;
    const effectiveMaxTokens = Math.min(Number(maxTokens) || 4096, 4096);
    const PER_MODEL_TIMEOUT_MS = 25_000;
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
        logger.warn(`[Nvidia] Model ${model} failed: ${err.message}`, {
          model,
          status: err.status || err.statusCode,
          isTimeout: modelController.signal.aborted,
        });

        if (signal?.aborted) {
          throw err;
        }
      }
    }

    throw lastError || new Error("All configured NVIDIA models failed");
  }
}

export const nvidiaProvider = new NvidiaProvider();
export default nvidiaProvider;
