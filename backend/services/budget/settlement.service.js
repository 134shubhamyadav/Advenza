/**
 * Deterministic Group Debt Settlement Service.
 * Implements a pure graph min-cash-flow algorithm (Splitwise style).
 * ZERO LLM is used for financial calculations.
 */

export class SettlementService {
  /**
   * Computes individual balances and the minimum set of settlement transactions.
   *
   * @param {Array} expenses - List of non-deleted expenses for the trip.
   * @param {Array} tripMembers - List of trip members [{ userId, name, email }].
   * @param {string} currency - Trip currency (e.g. "INR").
   * @returns {Object} { balances: Array, settlements: Array, totalGroupSpend: number }
   */
  calculateSettlements(expenses = [], tripMembers = [], currency = "INR") {
    // 1. Build a roster of all participating members
    const roster = new Map();

    // Seed roster with known trip members
    for (const m of tripMembers) {
      const key = m.userId || m.email || m.name;
      if (key) {
        roster.set(key, {
          id: key,
          name: m.name || m.email || "Member",
          email: m.email || null,
          totalPaid: 0,
          totalOwed: 0,
        });
      }
    }

    let totalGroupSpend = 0;

    // 2. Aggregate spending and debt per expense
    for (const exp of expenses) {
      if (exp.isDeleted) continue;
      const amt = Number(exp.amount) || 0;
      if (amt <= 0) continue;

      totalGroupSpend += amt;

      // Identify Payer
      const payerId = exp.paidBy?.userId || exp.paidBy?.email || exp.paidBy?.name || "Unknown Payer";
      const payerName = exp.paidBy?.name || exp.paidBy?.email || "Unknown Payer";

      if (!roster.has(payerId)) {
        roster.set(payerId, {
          id: payerId,
          name: payerName,
          email: exp.paidBy?.email || null,
          totalPaid: 0,
          totalOwed: 0,
        });
      }

      const payerEntry = roster.get(payerId);
      payerEntry.totalPaid += amt;

      // Identify Participants
      let parts = Array.isArray(exp.participants) && exp.participants.length > 0 ? exp.participants : [];

      // If no participants specified, default to all roster members or payer
      if (parts.length === 0) {
        if (roster.size > 0) {
          parts = Array.from(roster.values()).map((m) => ({
            userId: m.id,
            name: m.name,
            email: m.email,
            share: 1,
          }));
        } else {
          parts = [{ userId: payerId, name: payerName, share: 1 }];
        }
      }

      // Calculate share amounts
      if (exp.splitType === "custom" || exp.splitType === "exact") {
        // Exact custom amount provided per participant
        for (const p of parts) {
          const partId = p.userId || p.email || p.name;
          const partName = p.name || p.email || "Member";
          const shareAmt = Number(p.shareAmount) || 0;

          if (!roster.has(partId)) {
            roster.set(partId, { id: partId, name: partName, email: p.email || null, totalPaid: 0, totalOwed: 0 });
          }
          roster.get(partId).totalOwed += shareAmt;
        }
      } else {
        // Equal split by weight (default)
        const totalShares = parts.reduce((sum, p) => sum + (Number(p.share) || 1), 0) || 1;
        for (const p of parts) {
          const partId = p.userId || p.email || p.name;
          const partName = p.name || p.email || "Member";
          const weight = Number(p.share) || 1;
          const shareAmt = (amt * weight) / totalShares;

          if (!roster.has(partId)) {
            roster.set(partId, { id: partId, name: partName, email: p.email || null, totalPaid: 0, totalOwed: 0 });
          }
          roster.get(partId).totalOwed += shareAmt;
        }
      }
    }

    // 3. Compute net balances (Paid - Owed)
    const balances = [];
    const debtors = [];
    const creditors = [];

    for (const member of roster.values()) {
      const net = Math.round((member.totalPaid - member.totalOwed) * 100) / 100;
      const record = {
        id: member.id,
        name: member.name,
        email: member.email,
        totalPaid: Math.round(member.totalPaid * 100) / 100,
        totalOwed: Math.round(member.totalOwed * 100) / 100,
        netBalance: net,
        status: net > 0.01 ? "gets_back" : net < -0.01 ? "owes" : "settled",
      };
      balances.push(record);

      if (net < -0.01) {
        debtors.push({ id: member.id, name: member.name, amount: Math.abs(net) });
      } else if (net > 0.01) {
        creditors.push({ id: member.id, name: member.name, amount: net });
      }
    }

    // 4. Min-Cash-Flow greedy resolution
    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    const settlements = [];
    let dIdx = 0;
    let cIdx = 0;

    while (dIdx < debtors.length && cIdx < creditors.length) {
      const debtor = debtors[dIdx];
      const creditor = creditors[cIdx];

      const settleAmt = Math.round(Math.min(debtor.amount, creditor.amount) * 100) / 100;

      if (settleAmt > 0) {
        settlements.push({
          fromId: debtor.id,
          from: debtor.name,
          toId: creditor.id,
          to: creditor.name,
          amount: settleAmt,
          currency,
          summary: `${debtor.name} pays ${creditor.name} ${currency} ${settleAmt.toLocaleString("en-IN")}`,
        });
      }

      debtor.amount = Math.round((debtor.amount - settleAmt) * 100) / 100;
      creditor.amount = Math.round((creditor.amount - settleAmt) * 100) / 100;

      if (debtor.amount <= 0.01) dIdx++;
      if (creditor.amount <= 0.01) cIdx++;
    }

    return {
      totalGroupSpend: Math.round(totalGroupSpend * 100) / 100,
      currency,
      memberCount: roster.size,
      balances,
      settlements,
    };
  }
}

export const settlementService = new SettlementService();
export default settlementService;
