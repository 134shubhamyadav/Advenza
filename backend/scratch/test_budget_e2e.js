/**
 * End-to-End Budget & Expense Engine Verification
 */
import { budgetService } from "../services/budget/budget.service.js";
import { settlementService } from "../services/budget/settlement.service.js";
import { currencyService } from "../services/budget/currency.service.js";

async function runE2ETests() {
  console.log("=== 1. VERIFYING CURRENCY CONVERSION & RATE TIMESTAMPING ===");
  const conv = await currencyService.convert({
    amount: 150,
    fromCurrency: "USD",
    toCurrency: "INR",
  });
  console.log("✓ Converted $150 to INR:", conv);
  if (conv.originalAmount !== 150 || conv.convertedAmount <= 150 || !conv.rateTimestamp) {
    throw new Error("Currency conversion failed");
  }

  console.log("\n=== 2. VERIFYING GROUP DEBT SETTLEMENT GRAPH ALGORITHM ===");
  const members = [
    { userId: "u1", name: "Alice", email: "alice@test.com" },
    { userId: "u2", name: "Bob", email: "bob@test.com" },
    { userId: "u3", name: "Charlie", email: "charlie@test.com" },
  ];

  // Alice paid 3000 for Alice, Bob, Charlie (1000 each)
  // Bob paid 1500 for Bob, Charlie (750 each)
  const groupExpenses = [
    {
      name: "Villa Rental",
      amount: 3000,
      paidBy: { userId: "u1", name: "Alice" },
      splitType: "equal",
      participants: [
        { userId: "u1", name: "Alice", share: 1 },
        { userId: "u2", name: "Bob", share: 1 },
        { userId: "u3", name: "Charlie", share: 1 },
      ],
    },
    {
      name: "Groceries",
      amount: 1500,
      paidBy: { userId: "u2", name: "Bob" },
      splitType: "equal",
      participants: [
        { userId: "u2", name: "Bob", share: 1 },
        { userId: "u3", name: "Charlie", share: 1 },
      ],
    },
  ];

  const settlement = settlementService.calculateSettlements(groupExpenses, members, "INR");
  console.log("✓ Calculated Group Settlement:", settlement);

  // Expected balances:
  // Alice: paid 3000, owed 1000 -> net +2000
  // Bob: paid 1500, owed 1750 (1000 + 750) -> net -250
  // Charlie: paid 0, owed 1750 (1000 + 750) -> net -1750
  // Settle: Bob pays Alice 250, Charlie pays Alice 1750. Total = 2000.
  const aliceBal = settlement.balances.find((b) => b.id === "u1")?.netBalance;
  const bobBal = settlement.balances.find((b) => b.id === "u2")?.netBalance;
  const charlieBal = settlement.balances.find((b) => b.id === "u3")?.netBalance;

  console.log(`✓ Balances: Alice=${aliceBal}, Bob=${bobBal}, Charlie=${charlieBal}`);
  if (aliceBal !== 2000 || bobBal !== -250 || charlieBal !== -1750) {
    throw new Error("Net balance math mismatch");
  }

  const transferSum = settlement.settlements.reduce((sum, s) => sum + s.amount, 0);
  if (transferSum !== 2000) {
    throw new Error(`Expected transfer sum 2000, got ${transferSum}`);
  }
  console.log(`✓ Min Cash Flow Transfer Sum: ₹${transferSum} matches Alice creditor balance exactly!`);

  console.log("\n=== ALL E2E BUDGET VERIFICATIONS PASSED ===");
  setTimeout(() => process.exit(0), 100);
}

runE2ETests().catch((err) => {
  console.error("E2E Test Failed:", err);
  process.exit(1);
});
