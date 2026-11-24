import { aiRouter } from "./ai-router.service.js";
import { parseAIJson } from "./ai-parser.js";
import { logger } from "../../utils/logger.js";
import { AIProviderError } from "../../utils/errors.js";

export class AIRetryService {
  async executeWithSchemaValidation({ messages, schema, options = {}, maxAttempts = 2 }) {
    const configuredProviders = aiRouter.getConfiguredProviders(options.preferredProvider);

    if (configuredProviders.length === 0) {
      throw new AIProviderError("No AI providers are configured with valid API keys.", 503);
    }

    const attemptsSummary = [];

    // Iterate through configured providers in order (Groq -> OpenRouter -> Cerebras -> Together -> OpenAI)
    for (const provider of configuredProviders) {
      let currentMessages = [...messages];

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        let response;
        try {
          response = await aiRouter.executeOnProvider(provider, {
            ...options,
            messages: currentMessages,
            jsonMode: true,
          });
        } catch (apiErr) {
          logger.warn(`[AIRetry] Provider ${provider.name} attempt ${attempt} API error: ${apiErr.message}`);
          attemptsSummary.push({ provider: provider.name, attempt, error: apiErr.message });
          // If the provider fails with an API error, advance to the next provider
          break;
        }

        // 1. Parse JSON
        let parsed;
        try {
          parsed = parseAIJson(response.content);
        } catch (jsonErr) {
          logger.warn(`[AIRetry] Provider ${provider.name} attempt ${attempt}: JSON parse error: ${jsonErr.message}`);
          attemptsSummary.push({ provider: provider.name, attempt, error: jsonErr.message });

          if (attempt < maxAttempts) {
            // If response was severely truncated (long output that cut off), don't reinject 16k chars into context
            const isTruncated = (response.content || "").length > 4000;
            const assistantSnippet = isTruncated
              ? (response.content || "").slice(0, 500) + "... [truncated]"
              : response.content || "{}";

            const repairPrompt = isTruncated
              ? `Your previous response was truncated before completion. Please output the complete, valid JSON structure from start to finish. Ensure all brackets are closed and do not truncate.`
              : `The previous response was not valid JSON (${jsonErr.message}). Return ONLY a valid, raw JSON object matching the required structure. Do not include markdown code fences, thoughts, or conversational prose.`;

            currentMessages = [
              ...messages,
              { role: "assistant", content: assistantSnippet },
              { role: "user", content: repairPrompt },
            ];
            continue; // Retry once on same provider
          }
          break; // Move to next provider
        }

        // 2. Validate with Zod Schema (if provided)
        if (schema) {
          if (parsed && typeof parsed === "object") {
            if (!Array.isArray(parsed.days)) {
              if (Array.isArray(parsed.itinerary)) parsed.days = parsed.itinerary;
              else if (Array.isArray(parsed.schedule)) parsed.days = parsed.schedule;
              else if (Array.isArray(parsed.plan)) parsed.days = parsed.plan;
              else if (Array.isArray(parsed.trip)) parsed.days = parsed.trip;
            }
          }

          const validated = schema.safeParse(parsed);
          if (validated.success) {
            logger.info(`[AIRetry] Provider ${provider.name} succeeded with valid schema on attempt ${attempt}`);
            return {
              data: validated.data,
              provider: response.provider,
              model: response.model,
              attempt,
              durationMs: response.durationMs,
            };
          }

          const issuesSummary = validated.error.issues
            .map((i) => `${i.path.join(".") || "root"}: ${i.message}`)
            .slice(0, 5)
            .join("; ");

          logger.warn(`[AIRetry] Provider ${provider.name} attempt ${attempt}: Schema validation failed: ${issuesSummary}`);
          attemptsSummary.push({ provider: provider.name, attempt, error: `Schema errors: ${issuesSummary}` });

          if (attempt < maxAttempts) {
            const repairPrompt = `The previous JSON response did not match the required schema: ${issuesSummary}. Please return ONLY the corrected, valid JSON object matching the required schema.`;
            currentMessages = [
              ...messages,
              { role: "assistant", content: response.content || "{}" },
              { role: "user", content: repairPrompt },
            ];
            continue; // Retry once on same provider
          }
          break; // Move to next provider
        }

        // If no schema required, parsed JSON is sufficient
        return {
          data: parsed,
          provider: response.provider,
          model: response.model,
          attempt,
          durationMs: response.durationMs,
        };
      }
    }

    const cleanErrorSummary = attemptsSummary
      .map((a) => `${a.provider} (attempt ${a.attempt}): ${a.error}`)
      .join(" | ");

    throw new AIProviderError(
      `All AI providers failed. Attempts: ${cleanErrorSummary}`,
      502
    );
  }
}

export const aiRetryService = new AIRetryService();

/**
 * Convenience helper to execute an AI prompt with schema validation and retry.
 */
export const executeWithSchema = async (schema, options = {}, retryOptions = {}) => {
  const result = await aiRetryService.executeWithSchemaValidation({
    schema,
    messages: options.messages,
    options,
    maxAttempts: retryOptions.maxAttempts || 2,
  });
  return result.data;
};

export default aiRetryService;


