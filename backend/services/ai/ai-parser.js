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

/**
 * Repairs truncated JSON responses where output token limits cut off the response
 * before all strings, arrays, and objects could be properly closed.
 */
export const repairTruncatedJson = (str) => {
  if (!str || typeof str !== "string") return null;

  const cleaned = str.trim();
  const firstBrace = cleaned.indexOf("{");
  const firstBracket = cleaned.indexOf("[");

  if (firstBrace === -1 && firstBracket === -1) return null;

  const startIdx =
    firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)
      ? firstBrace
      : firstBracket;

  let text = cleaned.slice(startIdx);

  // Scan and track open delimiters & string state
  const stack = [];
  let insideString = false;
  let escapeNext = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (ch === "\\") {
      escapeNext = true;
      continue;
    }
    if (ch === '"') {
      insideString = !insideString;
      continue;
    }
    if (!insideString) {
      if (ch === "{" || ch === "[") {
        stack.push(ch);
      } else if (ch === "}") {
        if (stack.length > 0 && stack[stack.length - 1] === "{") {
          stack.pop();
        }
      } else if (ch === "]") {
        if (stack.length > 0 && stack[stack.length - 1] === "[") {
          stack.pop();
        }
      }
    }
  }

  // If already balanced and closed, test simple parse
  if (!insideString && stack.length === 0) {
    try {
      return JSON.parse(text);
    } catch {
      // Continue to cleanup below
    }
  }

  // If cut off inside a string literal, close the string
  if (insideString) {
    text += '"';
  }

  // Remove trailing dangling key/colon or comma
  text = text.replace(/,\s*"[^"]*"\s*:\s*$/, "");
  text = text.replace(/,\s*"[^"]*"\s*$/, "");
  text = text.replace(/:\s*$/, "");
  text = text.replace(/,\s*$/, "");

  // Close all unclosed brackets/braces in reverse order
  for (let i = stack.length - 1; i >= 0; i--) {
    const openDelim = stack[i];
    if (openDelim === "{") {
      text += "}";
    } else if (openDelim === "[") {
      text += "]";
    }
  }

  // Clean trailing commas before closing delimiters
  text = text.replace(/,\s*([\]}])/g, "$1");

  try {
    return JSON.parse(text);
  } catch {
    // If still failing, try progressively trimming to previous commas
    let lastComma = text.lastIndexOf(",");
    let attempts = 0;
    while (lastComma > 0 && attempts < 10) {
      attempts++;
      const sub = text.slice(0, lastComma);
      const subStack = [];
      let subInsideStr = false;
      let subEsc = false;

      for (let i = 0; i < sub.length; i++) {
        const c = sub[i];
        if (subEsc) {
          subEsc = false;
          continue;
        }
        if (c === "\\") {
          subEsc = true;
          continue;
        }
        if (c === '"') {
          subInsideStr = !subInsideStr;
          continue;
        }
        if (!subInsideStr) {
          if (c === "{" || c === "[") subStack.push(c);
          else if (c === "}" && subStack[subStack.length - 1] === "{") subStack.pop();
          else if (c === "]" && subStack[subStack.length - 1] === "[") subStack.pop();
        }
      }

      let candidate = sub;
      if (subInsideStr) candidate += '"';
      while (subStack.length > 0) {
        candidate += subStack.pop() === "{" ? "}" : "]";
      }
      candidate = candidate.replace(/,\s*([\]}])/g, "$1");

      try {
        return JSON.parse(candidate);
      } catch {
        lastComma = text.lastIndexOf(",", lastComma - 1);
      }
    }

    return null;
  }
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

  if (hasBrace || hasBracket) {
    const isObject = hasBrace && (!hasBracket || firstBrace < firstBracket);
    const candidate = isObject
      ? cleaned.slice(firstBrace, lastBrace + 1)
      : cleaned.slice(firstBracket, lastBracket + 1);

    try {
      return JSON.parse(candidate);
    } catch {
      // Attempt basic syntax repair: remove trailing commas before } or ]
      try {
        const repaired = candidate.replace(/,\s*([\]}])/g, "$1");
        return JSON.parse(repaired);
      } catch {
        // Fall through to truncated repair
      }
    }
  }

  // 4. If normal parsing failed or JSON structure is unclosed/truncated, attempt truncated repair
  const repairedObj = repairTruncatedJson(cleaned);
  if (repairedObj !== null && typeof repairedObj === "object") {
    return repairedObj;
  }

  if (firstBrace !== -1 || firstBracket !== -1) {
    throw new Error("Failed to parse AI JSON: incomplete or unclosed JSON structure");
  }

  const preview = cleaned.slice(0, 40).replace(/\r?\n/g, " ").trim();
  if (/^we need to/i.test(preview) || /^[a-z]/i.test(preview)) {
    throw new Error(`AI response does not contain valid JSON (received non-JSON text starting with "${preview}...")`);
  }
  throw new Error("AI response does not contain a JSON object or array");
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
