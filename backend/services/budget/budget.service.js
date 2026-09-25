import Trip from "../../models/Trip.js";
import TripBudget from "../../models/TripBudget.js";
import Expense, { EXPENSE_CATEGORIES } from "../../models/Expense.js";
import { currencyService } from "./currency.service.js";
import { logger } from "../../utils/logger.js";

export class BudgetService {
  /**
   * Retrieves or initializes the TripBudget configuration for a trip.
   */
  async getOrCreateTripBudget(tripId, tripCurrency = "INR", initialTotal = 0) {
    let budget = await TripBudget.findOne({ tripId });
    if (!budget) {
      budget = await TripBudget.create({
        tripId,
        currency: tripCurrency,
        totalBudget: initialTotal,
        allocatedCategories: {
          flights: Math.round(initialTotal * 0.3),
          hotels: Math.round(initialTotal * 0.3),
          food: Math.round(initialTotal * 0.15),
          activities: Math.round(initialTotal * 0.1),
          transport: Math.round(initialTotal * 0.05),
          localTransport: Math.round(initialTotal * 0.05),
          shopping: 0,
          miscellaneous: Math.round(initialTotal * 0.05),
        },
      });
    }
    return budget;
  }

  /**
   * Calculates complete planned vs actual financial metrics, category breakdowns,
   * daily spending limits, and threshold alert triggers.
   */
  async getBudgetSummary(tripId) {
    const trip = await Trip.findById(tripId).lean();
    if (!trip) throw new Error("Trip not found");

    const tripCurrency = trip.currency || "INR";
    const initialTotal = Number(trip.budgetTotal) || 0;
    const tripBudget = await this.getOrCreateTripBudget(tripId, tripCurrency, initialTotal);

    // Fetch all active, non-deleted expenses
    const expenses = await Expense.find({ tripId, isDeleted: false })
      .sort({ date: -1, createdAt: -1 })
      .lean();

    // 1. Calculate Actual and Planned per category
    const categoryStats = {};
    for (const cat of EXPENSE_CATEGORIES) {
      categoryStats[cat] = {
        category: cat,
        allocated: Number(tripBudget.allocatedCategories?.[cat]) || 0,
        actual: 0,
        planned: 0,
        count: 0,
      };
    }

    let actualTotal = 0;
    let livePriceTotal = 0;
    let estimatedTotal = 0;

    const todayIso = new Date().toISOString().slice(0, 10);
    let todaySpend = 0;
    const dailySpendMap = {};

    for (const exp of expenses) {
      const amt = Number(exp.amount) || 0;
      const cat = EXPENSE_CATEGORIES.includes(exp.category) ? exp.category : "miscellaneous";

      if (exp.type === "ACTUAL") {
        actualTotal += amt;
        categoryStats[cat].actual += amt;
        categoryStats[cat].count += 1;

        if (exp.date === todayIso) {
          todaySpend += amt;
        }

        if (exp.date) {
          dailySpendMap[exp.date] = (dailySpendMap[exp.date] || 0) + amt;
        }
      } else if (exp.type === "LIVE_PRICE") {
        livePriceTotal += amt;
        categoryStats[cat].planned += amt;
      } else {
        // ESTIMATED
        estimatedTotal += amt;
        categoryStats[cat].planned += amt;
      }
    }

    // 2. Extract Planned Costs from Itinerary Activities if not already an expense
    try {
      const days = trip.days || [];
      for (const day of days) {
        for (const act of day.activities || []) {
          const desc = act.description || act.title || "";
          const costMatch = desc.match(/[₹$€£]\s*([\d,]+)/i);
          if (costMatch) {
            const parsedCost = parseInt(costMatch[1].replace(/,/g, ""), 10);
            if (parsedCost > 0) {
              categoryStats.activities.planned += parsedCost;
            }
          }
        }
      }
    } catch (_) {}

    // Complete Category Computations
    const categories = EXPENSE_CATEGORIES.map((cat) => {
      const stat = categoryStats[cat];
      const remaining = stat.allocated - stat.actual;
      const percentageUsed = stat.allocated > 0 ? Math.round((stat.actual / stat.allocated) * 100) : 0;
      const isOver = stat.actual > stat.allocated && stat.allocated > 0;

      return {
        category: cat,
        allocated: stat.allocated,
        actual: Math.round(stat.actual * 100) / 100,
        planned: Math.round(stat.planned * 100) / 100,
        remaining: Math.round(remaining * 100) / 100,
        percentageUsed,
        isOverBudget: isOver,
        expenseCount: stat.count,
      };
    });

    // 3. High-Level Metrics
    const totalBudget = Number(tripBudget.totalBudget) || 0;
    const remainingBuffer = totalBudget - actualTotal;
    const percentageUsedTotal = totalBudget > 0 ? Math.round((actualTotal / totalBudget) * 100) : 0;
    const isOverBudget = actualTotal > totalBudget && totalBudget > 0;
    const overspentAmount = Math.max(0, actualTotal - totalBudget);

    // Projected Total: Actual spending + remaining planned commitments
    let remainingPlanned = 0;
    for (const cat of categories) {
      if (cat.planned > cat.actual) {
        remainingPlanned += cat.planned - cat.actual;
      }
    }
    const projectedTotal = Math.round((actualTotal + remainingPlanned) * 100) / 100;
    const projectedOverage = Math.max(0, Math.round((projectedTotal - totalBudget) * 100) / 100);

    // 4. Daily Spending Analysis
    let daysTotal = 1;
    let daysRemaining = 1;
    let daysElapsed = 1;

    if (trip.startDate && trip.endDate) {
      const start = new Date(trip.startDate);
      const end = new Date(trip.endDate);
      const now = new Date();
      daysTotal = Math.max(1, Math.ceil((end - start) / 86400000) + 1);

      if (now < start) {
        daysElapsed = 1;
        daysRemaining = daysTotal;
      } else if (now > end) {
        daysElapsed = daysTotal;
        daysRemaining = 0;
      } else {
        daysElapsed = Math.max(1, Math.ceil((now - start) / 86400000));
        daysRemaining = Math.max(1, Math.ceil((end - now) / 86400000));
      }
    }

    const averageDailySpend = Math.round((actualTotal / Math.max(1, daysElapsed)) * 100) / 100;
    const remainingDailyAllowance = Math.max(
      0,
      Math.round((remainingBuffer / Math.max(1, daysRemaining)) * 100) / 100
    );

    // 5. Threshold Alerts Evaluation
    const alertSettings = tripBudget.alertSettings || { thresholds: [70, 85, 100], lastTriggeredThresholds: [] };
    const configuredThresholds = alertSettings.thresholds || [70, 85, 100];
    const triggeredAlerts = [];
    const updatedTriggered = [...(alertSettings.lastTriggeredThresholds || [])];
    let needsBudgetSave = false;

    for (const t of configuredThresholds) {
      if (percentageUsedTotal >= t && !updatedTriggered.includes(t)) {
        updatedTriggered.push(t);
        needsBudgetSave = true;

        triggeredAlerts.push({
          type: "BUDGET_THRESHOLD",
          threshold: t,
          severity: t >= 100 ? "bad" : t >= 85 ? "warn" : "info",
          title: `Trip budget reached ${t}%`,
          message: `You have spent ${tripCurrency} ${actualTotal.toLocaleString("en-IN")} of your ${tripCurrency} ${totalBudget.toLocaleString("en-IN")} budget (${percentageUsedTotal}% used).`,
          delta: `${percentageUsedTotal}% of limit`,
        });
      }
    }

    // Check individual category overspending
    for (const cat of categories) {
      if (cat.isOverBudget) {
        triggeredAlerts.push({
          type: "CATEGORY_OVERSPENT",
          category: cat.category,
          severity: "bad",
          title: `Overspent in ${cat.category}`,
          message: `Expenses in ${cat.category} (${tripCurrency} ${cat.actual.toLocaleString("en-IN")}) exceed the allocation of ${tripCurrency} ${cat.allocated.toLocaleString("en-IN")}.`,
          delta: `+${tripCurrency} ${(cat.actual - cat.allocated).toLocaleString("en-IN")} overrun`,
        });
      }
    }

    if (needsBudgetSave) {
      tripBudget.alertSettings.lastTriggeredThresholds = updatedTriggered;
      tripBudget.alertSettings.lastAlertedAt = new Date();
      await tripBudget.save();
    }

    // Spending Timeline Data
    const spendingTimeline = Object.keys(dailySpendMap)
      .sort()
      .map((date) => ({
        date,
        amount: Math.round(dailySpendMap[date] * 100) / 100,
      }));

    return {
      tripId,
      currency: tripCurrency,
      totalBudget,
      actualTotal: Math.round(actualTotal * 100) / 100,
      plannedTotal: Math.round((livePriceTotal + estimatedTotal) * 100) / 100,
      remainingBuffer: Math.round(remainingBuffer * 100) / 100,
      percentageUsed: percentageUsedTotal,
      isOverBudget,
      overspentAmount,
      projectedTotal,
      projectedOverage,
      daily: {
        daysTotal,
        daysElapsed,
        daysRemaining,
        averageDailySpend,
        todaySpend: Math.round(todaySpend * 100) / 100,
        remainingDailyAllowance,
      },
      categories,
      timeline: spendingTimeline,
      alerts: triggeredAlerts,
      alertSettings: {
        thresholds: configuredThresholds,
        lastTriggeredThresholds: updatedTriggered,
        lastAlertedAt: tripBudget.alertSettings?.lastAlertedAt,
      },
      totalExpensesCount: expenses.length,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Adds an expense with multi-currency conversion, payment method, and group split support.
   */
  async addExpense(tripId, userId, data) {
    const trip = await Trip.findById(tripId);
    if (!trip) throw new Error("Trip not found");

    const tripCurrency = trip.currency || "INR";
    const originalCurrency = data.originalCurrency || data.currency || tripCurrency;
    const originalAmount = Number(data.originalAmount !== undefined ? data.originalAmount : data.amount) || 0;

    // Convert to Trip Currency
    const conversion = await currencyService.convert({
      amount: originalAmount,
      fromCurrency: originalCurrency,
      toCurrency: tripCurrency,
    });

    const normalizedAmount = conversion.convertedAmount;
    const cat = data.category ? String(data.category).toLowerCase().trim() : "miscellaneous";
    const category = EXPENSE_CATEGORIES.includes(cat) ? cat : "miscellaneous";

    // Handle Group Participants
    let participants = Array.isArray(data.participants) ? data.participants : [];
    if (participants.length === 0 && Array.isArray(trip.members) && trip.members.length > 0) {
      participants = trip.members.map((m) => ({
        userId: m.userId || null,
        name: m.name || m.email || "Member",
        email: m.email || null,
        share: 1,
        shareAmount: Math.round((normalizedAmount / trip.members.length) * 100) / 100,
      }));
    }

    const expense = await Expense.create({
      tripId,
      userId,
      name: data.name || data.title || "Expense",
      description: data.description || "",
      amount: normalizedAmount,
      currency: tripCurrency,
      originalAmount,
      originalCurrency,
      exchangeRate: conversion.exchangeRate,
      rateTimestamp: conversion.rateTimestamp,
      category,
      type: data.type || "ACTUAL",
      paymentMethod: data.paymentMethod || "card",
      date: data.date || new Date().toISOString().slice(0, 10),
      paidBy: data.paidBy || { userId, name: "User" },
      splitType: data.splitType || "equal",
      participants,
      receiptUrl: data.receiptUrl || null,
      receiptStorageKey: data.receiptStorageKey || null,
      source: data.source || "User",
    });

    // Synchronize legacy embedded trip.expenses for seamless backward compatibility
    trip.expenses.push({
      _id: expense._id,
      name: expense.name,
      amount: expense.amount,
      category: expense.category,
      date: expense.date,
    });
    await trip.save();

    return expense;
  }

  /**
   * Updates an existing expense.
   */
  async updateExpense(expenseId, tripId, updates) {
    const expense = await Expense.findOne({ _id: expenseId, tripId, isDeleted: false });
    if (!expense) throw new Error("Expense not found");

    if (updates.name !== undefined) expense.name = updates.name;
    if (updates.description !== undefined) expense.description = updates.description;
    if (updates.category !== undefined) {
      const cat = String(updates.category).toLowerCase().trim();
      expense.category = EXPENSE_CATEGORIES.includes(cat) ? cat : expense.category;
    }
    if (updates.type !== undefined) expense.type = updates.type;
    if (updates.paymentMethod !== undefined) expense.paymentMethod = updates.paymentMethod;
    if (updates.date !== undefined) expense.date = updates.date;
    if (updates.paidBy !== undefined) expense.paidBy = updates.paidBy;
    if (updates.splitType !== undefined) expense.splitType = updates.splitType;
    if (updates.participants !== undefined) expense.participants = updates.participants;
    if (updates.receiptUrl !== undefined) expense.receiptUrl = updates.receiptUrl;
    if (updates.receiptStorageKey !== undefined) expense.receiptStorageKey = updates.receiptStorageKey;

    // If amount or currency modified, re-convert
    if (updates.amount !== undefined || updates.originalCurrency !== undefined || updates.originalAmount !== undefined) {
      const origAmt = Number(updates.originalAmount !== undefined ? updates.originalAmount : updates.amount);
      const origCurr = updates.originalCurrency || expense.originalCurrency || expense.currency;

      const conversion = await currencyService.convert({
        amount: origAmt,
        fromCurrency: origCurr,
        toCurrency: expense.currency,
      });

      expense.originalAmount = origAmt;
      expense.originalCurrency = origCurr;
      expense.amount = conversion.convertedAmount;
      expense.exchangeRate = conversion.exchangeRate;
      expense.rateTimestamp = conversion.rateTimestamp;
    }

    await expense.save();

    // Synchronize embedded trip.expenses
    await Trip.updateOne(
      { _id: tripId, "expenses._id": expense._id },
      {
        $set: {
          "expenses.$.name": expense.name,
          "expenses.$.amount": expense.amount,
          "expenses.$.category": expense.category,
          "expenses.$.date": expense.date,
        },
      }
    );

    return expense;
  }

  /**
   * Deletes an expense (soft-delete with cascade cleanup in trip.expenses).
   */
  async deleteExpense(expenseId, tripId) {
    const expense = await Expense.findOne({ _id: expenseId, tripId });
    if (!expense) throw new Error("Expense not found");

    expense.isDeleted = true;
    expense.deletedAt = new Date();
    await expense.save();

    // Remove from legacy embedded array
    await Trip.updateOne(
      { _id: tripId },
      { $pull: { expenses: { _id: expense._id } } }
    );

    return { success: true, message: "Expense deleted successfully" };
  }

  /**
   * Updates TripBudget allocations and alert settings.
   */
  async updateTripBudget(tripId, updates) {
    const trip = await Trip.findById(tripId);
    if (!trip) throw new Error("Trip not found");

    const budget = await this.getOrCreateTripBudget(tripId, trip.currency || "INR", trip.budgetTotal || 0);

    if (updates.totalBudget !== undefined) {
      budget.totalBudget = Math.max(0, Number(updates.totalBudget));
      trip.budgetTotal = budget.totalBudget;
      await trip.save();
    }

    if (updates.currency !== undefined) {
      budget.currency = updates.currency.toUpperCase().trim();
    }

    if (updates.allocatedCategories && typeof updates.allocatedCategories === "object") {
      for (const cat of EXPENSE_CATEGORIES) {
        if (updates.allocatedCategories[cat] !== undefined) {
          budget.allocatedCategories[cat] = Math.max(0, Number(updates.allocatedCategories[cat]));
        }
      }
    }

    if (updates.alertSettings && typeof updates.alertSettings === "object") {
      if (Array.isArray(updates.alertSettings.thresholds)) {
        budget.alertSettings.thresholds = updates.alertSettings.thresholds.map(Number);
      }
      if (updates.alertSettings.notifyOnOverspend !== undefined) {
        budget.alertSettings.notifyOnOverspend = Boolean(updates.alertSettings.notifyOnOverspend);
      }
    }

    await budget.save();
    return this.getBudgetSummary(tripId);
  }
}

export const budgetService = new BudgetService();
export default budgetService;
