import { logger } from "../../../utils/logger.js";
import { z } from "zod";

export const BudgetFeasibilitySchema = z.object({
  totalEstimatedBudgetINR: z.number(),
  userBudgetINR: z.number().nullable(),
  isFeasible: z.boolean(),
  budgetStatus: z.enum(["FEASIBLE", "EXCEEDS_BUDGET", "NO_BUDGET_SET"]),
  shortfallAmountINR: z.number().default(0),
  surplusAmountINR: z.number().default(0),
  perPersonTotalINR: z.number(),
  breakdown: z.object({
    transportation: z.object({
      outboundAndReturnIntercity: z.number(),
      connectingAndLastMile: z.number(),
      localDailyCommute: z.number(),
      total: z.number(),
    }),
    accommodation: z.object({
      tier: z.string(),
      costPerNight: z.number(),
      nights: z.number(),
      rooms: z.number(),
      total: z.number(),
      isFree: z.boolean(),
    }),
    foodAndDining: z.object({
      dailyPerPerson: z.number(),
      total: z.number(),
    }),
    activitiesAndTickets: z.object({
      total: z.number(),
      details: z.string(),
    }),
    miscellaneousAndBuffer: z.object({
      amount: z.number(),
      explanation: z.string(),
    }),
  }),
  costDrivers: z.array(z.string()),
  actionableSavingsOptions: z.array(
    z.object({
      title: z.string(),
      potentialSavingsINR: z.number(),
      description: z.string(),
      tradeoff: z.string(),
    })
  ).default([]),
  scenarios: z.object({
    frugalMinimumINR: z.number(),
    realisticRecommendedINR: z.number(),
    premiumComfortINR: z.number(),
  }),
});

export class BudgetIntelligenceAgent {
  constructor() {
    this.name = "Budget Intelligence Agent";
  }

  evaluate({
    userBudget = null,
    transportCost = 0,
    lastMileCost = 0,
    accommodationResult,
    durationDays = 3,
    travelers = 1,
    activities = [],
    destinationPriceTier = "standard",
  }) {
    const effectiveDays = Math.max(1, Number(durationDays) || 1);
    const effectiveTravelers = Math.max(1, Number(travelers) || 1);
    const effectiveUserBudget = userBudget ? Number(userBudget) : null;

    logger.info(`[${this.name}] Calculating arithmetic budget for ${effectiveTravelers} pax across ${effectiveDays} days`);

    // 1. Transportation
    const intercity = Number(transportCost) || 0;
    const lastMile = Number(lastMileCost) || (effectiveTravelers * 400);
    // Local daily commuting (cabs/autos/metro per day for the group)
    const localDaily = effectiveDays * 600 * Math.ceil(effectiveTravelers / 3);
    const totalTransport = intercity + lastMile + localDaily;

    // 2. Accommodation
    const totalStay = accommodationResult?.totalAccommodationCostINR ?? 0;
    const isFreeStay = accommodationResult?.isFreeAccommodation ?? false;

    // 3. Food & Dining (Realistic per person per day based on destination)
    let foodPerPersonPerDay = 900;
    if (destinationPriceTier === "luxury" || destinationPriceTier === "international") {
      foodPerPersonPerDay = 2500;
    } else if (destinationPriceTier === "budget") {
      foodPerPersonPerDay = 550;
    }
    const totalFood = foodPerPersonPerDay * effectiveDays * effectiveTravelers;

    // 4. Activities & Entry Tickets
    let totalActivities = 0;
    if (Array.isArray(activities) && activities.length > 0) {
      for (const act of activities) {
        const fee = act.entryFee?.amount || (act.price ? Number(act.price) : 0);
        totalActivities += fee * effectiveTravelers;
      }
    }
    if (totalActivities === 0) {
      // Conservative estimate based on typical landmark entry tickets
      totalActivities = 350 * effectiveDays * effectiveTravelers;
    }

    // 5. Miscellaneous & Emergency Buffer (7% of total spend)
    const subtotal = totalTransport + totalStay + totalFood + totalActivities;
    const miscBuffer = Math.round(subtotal * 0.07);

    // 6. Total Sum
    const totalEstimated = subtotal + miscBuffer;
    const perPersonTotal = Math.round(totalEstimated / effectiveTravelers);

    // 7. Feasibility Evaluation
    let isFeasible = true;
    let budgetStatus = "NO_BUDGET_SET";
    let shortfall = 0;
    let surplus = 0;

    if (effectiveUserBudget !== null && effectiveUserBudget > 0) {
      if (effectiveUserBudget >= totalEstimated) {
        isFeasible = true;
        budgetStatus = "FEASIBLE";
        surplus = effectiveUserBudget - totalEstimated;
      } else {
        isFeasible = false;
        budgetStatus = "EXCEEDS_BUDGET";
        shortfall = totalEstimated - effectiveUserBudget;
      }
    }

    // 8. Cost Driver Identification
    const driverList = [];
    const items = [
      { name: "Intercity Transportation", amount: intercity },
      { name: "Accommodation", amount: totalStay },
      { name: "Food & Dining", amount: totalFood },
      { name: "Local Commute & Activities", amount: localDaily + totalActivities },
    ].sort((a, b) => b.amount - a.amount);

    for (const item of items) {
      if (item.amount > 0) {
        const pct = Math.round((item.amount / totalEstimated) * 100);
        driverList.push(`${item.name} accounts for ${pct}% of estimated expenses (₹${item.amount.toLocaleString("en-IN")})`);
      }
    }

    // 9. Actionable Savings Options (if shortfall or to optimize)
    const savings = [];
    if (!isFreeStay && totalStay > 0) {
      savings.push({
        title: "Choose Budget Accommodation or Verified Homestay",
        potentialSavingsINR: Math.round(totalStay * 0.5),
        description: "Switching from standard hotel to a high-rated guesthouse or hostel saves up to 50% on lodging.",
        tradeoff: "Simpler room amenities, shared social lounges rather than full room service.",
      });
      savings.push({
        title: "Stay at Own Home or Relative's Residence",
        potentialSavingsINR: totalStay,
        description: "If traveling to a hometown or near relatives, opting for family lodging eliminates commercial room tariffs completely.",
        tradeoff: "Dependent on host schedules and location.",
      });
    }

    if (intercity > 3000) {
      savings.push({
        title: "Opt for Premium Train / High-Speed Rail over Flights",
        potentialSavingsINR: Math.round(intercity * 0.4),
        description: "Booking Vande Bharat or Rajdhani Express reduces transit costs while maintaining comfort.",
        tradeoff: "Longer journey time than flights, requires advance ticket confirmation.",
      });
    }

    if (effectiveDays > 2) {
      savings.push({
        title: "Dine at Acclaimed Local Eateries over Hotel Dining",
        potentialSavingsINR: Math.round(totalFood * 0.3),
        description: "Eating at iconic local food streets, authentic thali centers, and bakeries saves 30% on food costs.",
        tradeoff: "Casual dining ambiance with genuine regional culinary flavors.",
      });
    }

    // 10. Multi-Scenario Modeling
    const frugalTotal = Math.round(
      (intercity * 0.6) + (isFreeStay ? 0 : totalStay * 0.45) + (totalFood * 0.7) + (totalActivities * 0.6) + (miscBuffer * 0.5)
    );
    const premiumTotal = Math.round(
      (intercity * 1.3) + (isFreeStay ? 0 : totalStay * 1.8) + (totalFood * 1.5) + (totalActivities * 1.4) + (miscBuffer * 1.5)
    );

    return BudgetFeasibilitySchema.parse({
      totalEstimatedBudgetINR: totalEstimated,
      userBudgetINR: effectiveUserBudget,
      isFeasible,
      budgetStatus,
      shortfallAmountINR: shortfall,
      surplusAmountINR: surplus,
      perPersonTotalINR: perPersonTotal,
      breakdown: {
        transportation: {
          outboundAndReturnIntercity: intercity,
          connectingAndLastMile: lastMile,
          localDailyCommute: localDaily,
          total: totalTransport,
        },
        accommodation: {
          tier: accommodationResult?.tierDescription || "Standard",
          costPerNight: accommodationResult?.costPerNightINR || 0,
          nights: effectiveDays,
          rooms: accommodationResult?.roomsNeeded || 0,
          total: totalStay,
          isFree: isFreeStay,
        },
        foodAndDining: {
          dailyPerPerson: foodPerPersonPerDay,
          total: totalFood,
        },
        activitiesAndTickets: {
          total: totalActivities,
          details: `Entry fees and experiences for ${effectiveTravelers} traveler(s)`,
        },
        miscellaneousAndBuffer: {
          amount: miscBuffer,
          explanation: "7% contingency reserve for emergencies, water, tips, and incidentals",
        },
      },
      costDrivers: driverList,
      actionableSavingsOptions: savings.slice(0, 3),
      scenarios: {
        frugalMinimumINR: frugalTotal,
        realisticRecommendedINR: totalEstimated,
        premiumComfortINR: premiumTotal,
      },
    });
  }
}

export const budgetIntelligenceAgent = new BudgetIntelligenceAgent();
