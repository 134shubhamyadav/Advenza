import { aiRouter } from "./ai-router.service.js";
import { parseAIJson } from "./ai-parser.js";
import { logger } from "../../utils/logger.js";
import { AIProviderError } from "../../utils/errors.js";

export class AIRetryService {
  async executeWithSchemaValidation({ messages, schema, options = {}, maxAttempts = 2 }) {
    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await aiRouter.execute({
          ...options,
          messages,
        });

        // 1. Parse JSON
        let parsed;
        try {
          parsed = parseAIJson(response.content);
        } catch (jsonErr) {
          logger.warn(`[AIRetry] Attempt ${attempt}: JSON parse error: ${jsonErr.message}`);
          if (attempt === maxAttempts) throw jsonErr;
          continue;
        }

        // 2. Validate with Zod Schema
        if (schema) {
          const validated = schema.safeParse(parsed);
          if (validated.success) {
            return {
              data: validated.data,
              provider: response.provider,
              model: response.model,
              attempt,
            };
          }

          logger.warn(`[AIRetry] Attempt ${attempt}: Schema validation failed:`, validated.error.format());

          // 3. Attempt in-flight repair prompt if another attempt remains
          if (attempt < maxAttempts) {
            const repairPrompt = `The previous JSON response had schema errors: ${JSON.stringify(
              validated.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`)
            )}.
Please fix the JSON and return ONLY the corrected, valid JSON object matching the required schema.`;

            messages = [
              ...messages,
              { role: "assistant", content: response.content },
              { role: "user", content: repairPrompt },
            ];
            continue;
          }

          // If last attempt failed schema validation, fallback to parsed if structure has minimum required fields
          return {
            data: parsed,
            provider: response.provider,
            model: response.model,
            attempt,
            schemaWarning: validated.error.message,
          };
        }

        return {
          data: parsed,
          provider: response.provider,
          model: response.model,
          attempt,
        };
      } catch (err) {
        lastError = err;
        logger.warn(`[AIRetry] Attempt ${attempt} failed: ${err.message}`);
      }
    }

    throw new AIProviderError(`AI schema validation and retry failed: ${lastError?.message || "Unknown error"}`, 502);
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

