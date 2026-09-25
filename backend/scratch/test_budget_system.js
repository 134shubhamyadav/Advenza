/**
 * Automated Verification Script for Advenza Budget & Expense System
 */
import { currencyService } from "../services/budget/currency.service.js";
import { settlementService } from "../services/budget/settlement.service.js";
import { aiService } from "../services/ai/ai.service.js";
import { budgetAiService } from "../services/ai/budget-ai.service.js";

async function runTests() {
  console.log("=== 1. TESTING MULTI-CURRENCY CONVERSION ===");
  try {
    const resEur = await currencyService.convert({
      amount: 100,
      fromCurrency: "EUR",
      toCurrency: "INR",
    });
    console.log(`✓ EUR to INR Conversion:`, resEur);
    if (!resEur.convertedAmount || resEur.convertedAmount <= 100 || resEur.originalAmount !== 100) {
      throw new Error("Currency conversion logic failed for EUR -> INR");
    }

    const resUsd = await currencyService.convert({
      amount: 50,
      fromCurrency: "USD",
      toCurrency: "INR",
    });
    console.log(`✓ USD to INR Conversion:`, resUsd);
    if (!resUsd.convertedAmount || resUsd.convertedAmount <= 50) {
      throw new Error("Currency conversion logic failed for USD -> INR");
    }
  } catch (err) {
    console.error("Currency Service Test Failed:", err);
    process.exit(1);
  }

  console.log("\n=== 2. TESTING DETERMINISTIC GROUP DEBT SETTLEMENT ===");
  try {
    // 4 members: A, B, C, D
    const members = [
      { userId: "user_a", name: "Person A", email: "a@test.com" },
      { userId: "user_b", name: "Person B", email: "b@test.com" },
      { userId: "user_c", name: "Person C", email: "c@test.com" },
      { userId: "user_d", name: "Person D", email: "d@test.com" },
    ];

    // Expenses:
    // A paid 8,000 for all 4
    // B paid 4,000 for all 4
    // C paid 2,000 for all 4
    // D paid 0
    const expenses = [
      {
        name: "Hotel Stay",
        amount: 8000,
        paidBy: { userId: "user_a", name: "Person A" },
        splitType: "equal",
        participants: members.map((m) => ({ userId: m.userId, name: m.name, share: 1 })),
      },
      {
        name: "Group Dinner",
        amount: 4000,
        paidBy: { userId: "user_b", name: "Person B" },
        splitType: "equal",
        participants: members.map((m) => ({ userId: m.userId, name: m.name, share: 1 })),
      },
      {
        name: "Cab Rentals",
        amount: 2000,
        paidBy: { userId: "user_c", name: "Person C" },
        splitType: "equal",
        participants: members.map((m) => ({ userId: m.userId, name: m.name, share: 1 })),
      },
    ];

    const settlementResult = settlementService.calculateSettlements(expenses, members, "INR");
    console.log(`✓ Settlement Calculated (Total Group Spend: ₹${settlementResult.totalGroupSpend}):`);
    console.log("  Balances:", settlementResult.balances);
    console.log("  Transactions:", settlementResult.settlements);

    // Verify math:
    // Total = 14,000, per person share = 3,500
    // A: 8000 - 3500 = +4500
    // B: 4000 - 3500 = +500
    // C: 2000 - 3500 = -1500 (owes 1500)
    // D: 0 - 3500 = -3500 (owes 3500)
    const balA = settlementResult.balances.find((b) => b.id === "user_a")?.netBalance;
    const balD = settlementResult.balances.find((b) => b.id === "user_d")?.netBalance;
    if (balA !== 4500 || balD !== -3500) {
      throw new Error(`Unexpected net balances: A=${balA}, D=${balD}`);
    }

    const totalSettledAmount = settlementResult.settlements.reduce((sum, s) => sum + s.amount, 0);
    if (totalSettledAmount !== 5000) {
      throw new Error(`Expected total settled transactions to sum to 5000, got ${totalSettledAmount}`);
    }
    console.log(`✓ Mathematical zero-sum settlement verified: ₹${totalSettledAmount} total transfers.`);
  } catch (err) {
    console.error("Settlement Service Test Failed:", err);
    process.exit(1);
  }

  console.log("\n=== 3. TESTING BUDGET ESTIMATION (NO GOOGLE SCRAPING) ===");
  try {
    const est = await aiService.estimateBudget({
      destination: "Goa",
      startDate: "2026-10-01",
      endDate: "2026-10-05",
      travelers: 2,
    });
    console.log(`✓ Estimated Budget Result:`, est);
    if (!est.minimumBudget || est.type !== "ESTIMATED" || !est.categoryEstimates) {
      throw new Error("Estimate budget returned invalid structure or missing category estimates");
    }
    console.log(`  Minimum Budget: ₹${est.minimumBudget.toLocaleString("en-IN")}`);
    console.log(`  Category Breakdown:`, est.categoryEstimates);
  } catch (err) {
    console.error("Budget Estimation Test Failed:", err);
    process.exit(1);
  }

  console.log("\n=== 4. TESTING RECEIPT OCR PARSER ===");
  try {
    const mockReceiptText = "AMBRAI RESTAURANT UDAIPUR\nDate: 2026-09-23\nTable 4\nDal Baati Churma x2: 1200\nMocktail x2: 600\nTotal: INR 1800.00\nThank you!";
    const ocrRes = await budgetAiService.parseReceiptOCR({ textContent: mockReceiptText });
    console.log(`✓ OCR Result:`, ocrRes);
    if (ocrRes.status !== "OCR_RESULT") {
      throw new Error("OCR response did not have status OCR_RESULT");
    }
  } catch (err) {
    console.error("Receipt OCR Test Failed:", err);
    process.exit(1);
  }

  console.log("\n=== ALL BUDGET SYSTEM TESTS PASSED ===");
  process.exit(0);
}

runTests();
