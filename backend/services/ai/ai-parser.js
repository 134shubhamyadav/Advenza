/**
 * Robust JSON extraction and repair parser for AI completions.
 */

export const extractAIContent = (completion) => {
  if (typeof completion?.content === "string" && completion.content.trim().length > 0) {
    return completion.content.trim();
  }
  const msg = completion?.choices?.[0]?.message;
  if (!msg) return "";
  if (typeof msg.content === "string" && msg.content.trim().length > 0) {
    return msg.content.trim();
  }
  if (typeof msg.reasoning === "string" && msg.reasoning.trim().length > 0) {
    return msg.reasoning.trim();
  }
  if (typeof msg.reasoning_content === "string" && msg.reasoning_content.trim().length > 0) {
    return msg.reasoning_content.trim();
  }
  return "";
};

export const parseAIJson = (raw) => {
  if (!raw || typeof raw !== "string" || !raw.trim()) {
    throw new Error("AI returned empty content");
  }

  // Strip thinking/reasoning blocks
  let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  // Strip markdown code fences
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();

  // Search for object or array bounds
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  const firstBracket = cleaned.indexOf("[");
  const lastBracket = cleaned.lastIndexOf("]");

  // Determine whether it's an object or array
  const isObject = firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket);

  if (isObject && firstBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  } else if (!isObject && firstBracket !== -1 && lastBracket > firstBracket) {
    cleaned = cleaned.slice(firstBracket, lastBracket + 1);
  }

  try {
    return JSON.parse(cleaned);
  } catch (initialErr) {
    // Attempt basic syntax repair: remove trailing commas before } or ]
    try {
      const repaired = cleaned.replace(/,\s*([\]}])/g, "$1");
      return JSON.parse(repaired);
    } catch {
      throw new Error(`Failed to parse AI JSON: ${initialErr.message}`);
    }
  }
};
