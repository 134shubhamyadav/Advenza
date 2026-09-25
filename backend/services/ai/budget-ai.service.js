import { aiRouter } from "./ai-router.service.js";
import { parseAIJson } from "./ai-parser.js";
import { logger } from "../../utils/logger.js";

export class BudgetAiService {
  /**
   * Generates actionable financial advice grounded strictly in real ledger metrics.
   */
  async generateBudgetInsights(summary, trip) {
    const prompt = `You are the Advenza Financial Travel Advisor.
Analyze this trip budget data for "${trip.title || "Trip"}" to ${trip.destination || "Destination"}:

BUDGET DATA:
${JSON.stringify(
  {
    currency: summary.currency,
    totalBudget: summary.totalBudget,
    actualTotal: summary.actualTotal,
    remainingBuffer: summary.remainingBuffer,
    percentageUsed: summary.percentageUsed,
    projectedTotal: summary.projectedTotal,
    projectedOverage: summary.projectedOverage,
    daily: summary.daily,
    categories: summary.categories.map((c) => ({
      category: c.category,
      allocated: c.allocated,
      actual: c.actual,
      percentageUsed: c.percentageUsed,
      remaining: c.remaining,
      isOverBudget: c.isOverBudget,
    })),
  },
  null,
  2
)}

STRICT ANTI-HALLUCINATION RULES:
1. You may ONLY reference numbers present in the input. Do NOT invent expenses, hotel rates, or ticket prices.
2. If totalBudget is 0 or actualTotal is 0, give helpful setup suggestions.
3. Identify which categories are high-risk (>80% used or overspent).
4. Provide practical, high-value recommendations (e.g. reallocating buffer from underspent categories).

Return ONLY valid JSON matching this schema:
{
  "status": "AI_INSIGHT",
  "summary": "1-2 sentence overall health summary",
  "recommendations": [
    {
      "category": "category_name_or_General",
      "severity": "info|warn|bad",
      "tip": "Concrete recommendation referencing real numbers",
      "action": "What the traveler should do"
    }
  ],
  "dailyPacingAdvice": "Advice on today's and remaining daily spend allowance"
}`;

    try {
      const res = await aiRouter.callAI({
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 1000,
      });

      const parsed = parseAIJson(res.content);
      return {
        ...parsed,
        source: "Advenza AI Budget Advisor",
        generatedAt: new Date().toISOString(),
      };
    } catch (err) {
      logger.warn(`[BudgetAiService] AI insights fallback: ${err.message}`);
      // Deterministic rule-based fallback
      return {
        status: "RULE_INSIGHT",
        summary: summary.isOverBudget
          ? `Budget exceeded by ${summary.currency} ${summary.overspentAmount.toLocaleString("en-IN")}.`
          : `You have used ${summary.percentageUsed}% of your ${summary.currency} ${summary.totalBudget.toLocaleString("en-IN")} budget with ${summary.daily.daysRemaining} days remaining.`,
        recommendations: summary.categories
          .filter((c) => c.isOverBudget || c.percentageUsed >= 80)
          .map((c) => ({
            category: c.category,
            severity: c.isOverBudget ? "bad" : "warn",
            tip: `${c.category} is at ${c.percentageUsed}% (${summary.currency} ${c.actual} of ${c.allocated}).`,
            action: "Pause non-essential bookings in this category.",
          })),
        dailyPacingAdvice: `Your safe daily allowance is ${summary.currency} ${summary.daily.remainingDailyAllowance} per day.`,
        source: "Deterministic Rules Engine",
        generatedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Parse financial receipt image or text using dedicated OCR abstraction.
   * Extracts merchant, amount, currency, and date from receipt text or image.
   * Result is clearly tagged OCR_RESULT and requires user confirmation.
   */
  async parseReceiptOCR({ textContent, base64Image, receiptUrl, mimeType = "image/jpeg" }) {
    const { ocrProvider } = await import("../ocr/ocr-provider.service.js");
    return ocrProvider.extractReceipt({
      imageUrl: receiptUrl,
      base64Image,
      mimeType,
      textContent,
    });
  }
}

export const budgetAiService = new BudgetAiService();
export default budgetAiService;
