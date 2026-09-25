import { aiRouter } from "../ai/ai-router.service.js";
import { parseAIJson } from "../ai/ai-parser.js";
import { logger } from "../../utils/logger.js";

/**
 * Base Abstract OCR Provider
 */
export class BaseOCRProvider {
  constructor(name = "GenericOCRProvider") {
    this.name = name;
  }

  async extractReceipt(params) {
    throw new Error(`extractReceipt() not implemented in ${this.name}`);
  }
}

/**
 * Production-ready Vision AI Receipt OCR Provider
 */
export class VisionAIOCRProvider extends BaseOCRProvider {
  constructor() {
    super("VisionAIReceiptOCR");
  }

  /**
   * Process a receipt image URL, buffer, or text content and extract structured data.
   */
  async extractReceipt({ imageUrl, base64Image, mimeType = "image/jpeg", textContent = null }) {
    const messages = [];

    const systemPrompt = `You are a financial receipt parser for a travel expense management application.
Extract the following information from the receipt:
1. merchant: The business or store name (e.g., "Starbucks", "Uber", "Hotel Grand")
2. amount: Total numerical amount (e.g., 450.00)
3. currency: ISO 4217 currency code (e.g., "INR", "USD", "EUR")
4. date: Date of transaction in YYYY-MM-DD format
5. category: One of: "flights", "hotels", "food", "activities", "transport", "localTransport", "shopping", "miscellaneous"
6. confidence: Estimated extraction confidence between 0.0 and 1.0

Return ONLY valid JSON matching this exact structure:
{
  "merchant": string,
  "amount": number,
  "currency": string,
  "date": string,
  "category": string,
  "confidence": number
}`;

    if (imageUrl) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: systemPrompt },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      });
    } else if (base64Image) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: systemPrompt },
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } },
        ],
      });
    } else if (textContent) {
      messages.push({
        role: "user",
        content: `${systemPrompt}\n\nRECEIPT TEXT:\n"${textContent}"`,
      });
    } else {
      return {
        status: "OCR_RESULT",
        provider: this.name,
        merchant: "Manual Expense",
        amount: 0,
        currency: "INR",
        date: new Date().toISOString().slice(0, 10),
        category: "miscellaneous",
        confidence: 0,
        requiresUserConfirmation: true,
        disclaimer: "No image or text provided for OCR. Please enter details manually.",
      };
    }

    try {
      const completion = await aiRouter.callAI({
        messages,
        temperature: 0.1,
        max_tokens: 500,
      });

      const parsed = parseAIJson(completion.content);

      // Validate & normalize fields
      const amount = Math.max(0, parseFloat(parsed.amount) || 0);
      const currency = (parsed.currency || "INR").trim().toUpperCase();
      const merchant = (parsed.merchant || "Receipt").trim();
      const category = (parsed.category || "food").trim().toLowerCase();
      const date = (parsed.date || new Date().toISOString().slice(0, 10)).trim();
      const confidence = Math.min(1, Math.max(0, parseFloat(parsed.confidence) || 0.85));

      return {
        status: "OCR_RESULT",
        provider: this.name,
        merchant,
        amount,
        currency,
        date,
        category,
        confidence,
        requiresUserConfirmation: true,
        disclaimer: "OCR result requires user verification before saving as an actual expense.",
      };
    } catch (err) {
      logger.warn(`[VisionAIOCRProvider] OCR parsing failed: ${err.message}`);
      return {
        status: "OCR_RESULT",
        provider: this.name,
        merchant: "Receipt",
        amount: 0,
        currency: "INR",
        date: new Date().toISOString().slice(0, 10),
        category: "food",
        confidence: 0,
        requiresUserConfirmation: true,
        error: "Automatic receipt OCR failed or timed out. Please verify details manually.",
        disclaimer: "OCR result requires user verification before saving as an actual expense.",
      };
    }
  }
}

export const ocrProvider = new VisionAIOCRProvider();
export default ocrProvider;
