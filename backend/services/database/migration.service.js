import Trip from "../../models/Trip.js";
import Expense from "../../models/Expense.js";
import { logger } from "../../utils/logger.js";

/**
 * Idempotent migration service.
 * Backfills legacy embedded trip expenses into the dedicated Expense collection
 * so existing data is queryable independently with indexes.
 */
export async function backfillTripExpenses() {
  try {
    const tripsWithExpenses = await Trip.find({
      expenses: { $exists: true, $ne: [] },
    }).lean();

    if (!tripsWithExpenses || tripsWithExpenses.length === 0) {
      return { migratedCount: 0, tripsProcessed: 0 };
    }

    let totalMigrated = 0;

    for (const trip of tripsWithExpenses) {
      const expenses = trip.expenses || [];
      for (const exp of expenses) {
        // Check if already migrated to avoid duplication
        const existing = await Expense.findOne({
          tripId: trip._id,
          name: exp.name,
          amount: exp.amount,
        });

        if (!existing) {
          await Expense.create({
            _id: exp._id,
            tripId: trip._id,
            userId: trip.createdBy || "unknown",
            name: exp.name,
            amount: exp.amount,
            category: exp.category || "General",
            date: exp.date || (exp.addedAt ? new Date(exp.addedAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)),
            createdAt: exp.addedAt || new Date(),
          });
          totalMigrated++;
        }
      }
    }

    if (totalMigrated > 0) {
      logger.info(`[DatabaseMigration] ✅ Successfully backfilled ${totalMigrated} expenses from ${tripsWithExpenses.length} trips into Expense collection.`);
    }

    return { migratedCount: totalMigrated, tripsProcessed: tripsWithExpenses.length };
  } catch (err) {
    logger.error(`[DatabaseMigration] Expense backfill error: ${err.message}`);
    return { migratedCount: 0, error: err.message };
  }
}

export async function runStartupMigrations() {
  logger.info("[DatabaseMigration] Checking database consistency and backfills...");
  await backfillTripExpenses();
}

export default {
  backfillTripExpenses,
  runStartupMigrations,
};
