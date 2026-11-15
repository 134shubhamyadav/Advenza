/**
 * Robust JSON extraction and repair parser for AI completions.
 */

export const extractAIContent = (completion) => {
  if (typeof completion?.content === "string" && completion.content.trim().length > 0) {
    return completion.content.trim();
  }
  const msg = completion?.choices?.[0]?.message;
  if (!msg) return "";

  // Only extract actual model content. Never return internal model reasoning or thought blocks.
  if (typeof msg.content === "string" && msg.content.trim().length > 0) {
    return msg.content.trim();
  }

  // Model reasoning / thought fields (e.g. msg.reasoning, msg.reasoning_content)
  // are internal model thoughts and must NEVER be returned as completion content.
  return "";
};

export const parseAIJson = (raw) => {
  if (!raw || typeof raw !== "string" || !raw.trim()) {
    throw new Error("AI returned empty content");
  }

  // 1. Strip thinking/reasoning blocks
  let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  // 2. Extract content from markdown code fences if present
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch && fenceMatch[1]?.trim()) {
    cleaned = fenceMatch[1].trim();
  } else {
    // Strip partial or edge code fences
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  }

  // 3. Search for object or array bounds
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  const firstBracket = cleaned.indexOf("[");
  const lastBracket = cleaned.lastIndexOf("]");

  const hasBrace = firstBrace !== -1 && lastBrace > firstBrace;
  const hasBracket = firstBracket !== -1 && lastBracket > firstBracket;

  if (!hasBrace && !hasBracket) {
    if (firstBrace !== -1 || firstBracket !== -1) {
      throw new Error("Failed to parse AI JSON: incomplete or unclosed JSON structure");
    }
    const preview = cleaned.slice(0, 40).replace(/\r?\n/g, " ").trim();
    if (/^we need to/i.test(preview) || /^[a-z]/i.test(preview)) {
      throw new Error(`AI response does not contain valid JSON (received non-JSON text starting with "${preview}...")`);
    }
    throw new Error("AI response does not contain a JSON object or array");
  }

  // Determine whether it's an object or array
  const isObject = hasBrace && (!hasBracket || firstBrace < firstBracket);

  if (isObject) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  } else {
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

/**
 * Strips raw markdown formatting (bold, italic, headers, backticks)
 * from text fields to satisfy the plain text requirement.
 */
export const sanitizeAIString = (str) => {
  if (typeof str !== "string") return str;
  return str
    .replace(/\*\*(.*?)\*\*/g, "$1") // bold **
    .replace(/\*(.*?)\*/g, "$1")     // italic *
    .replace(/__(.*?)__/g, "$1")     // bold __
    .replace(/_(.*?)_/g, "$1")       // italic _
    .replace(/`([^`]+)`/g, "$1")     // backticks `
    .replace(/#+\s*/g, "")           // headers
    .replace(/^[-*]\s+/gm, "")       // bullet points
    .trim();
};

