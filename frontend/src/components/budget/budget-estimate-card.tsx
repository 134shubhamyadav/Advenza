import React, { useMemo } from "react";
import {
  Wallet,
  Train,
  Plane,
  Building2,
  Utensils,
  Ticket,
  Receipt,
  ShoppingBag,
  Info,
  Car,
  Bus,
  Coins,
  ShieldAlert,
} from "lucide-react";
import { inr, cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { BudgetBreakdown, BudgetCategoryItem, TripSummary } from "@/services/tripService";

interface BudgetEstimateCardProps {
  trip?: Partial<TripSummary> | any;
  budgetBreakdown?: BudgetBreakdown | null;
  budgetEstimate?: string | null;
  travelers?: number;
  nights?: number;
  className?: string;
}

/**
 * Extracts label, description, and standard category key from a raw label string.
 */
function parseLabelAndDesc(raw: string): { label: string; desc: string; category: string } {
  let label = raw.trim();
  let desc = "";

  // Check for parenthesized description: "Train (2 Sleeper tickets)" -> "Train", "2 Sleeper tickets"
  const parenMatch = raw.match(/^(.*?)\s*\((.*?)\)$/);
  if (parenMatch) {
    label = parenMatch[1].trim();
    desc = parenMatch[2].trim();
  }

  const lower = label.toLowerCase();
  let category = "miscellaneous";

  if (
    lower.includes("activit") ||
    lower.includes("entry") ||
    lower.includes("ticket") ||
    lower.includes("sightsee") ||
    lower.includes("tour") ||
    lower.includes("monument") ||
    lower.includes("attraction") ||
    lower.includes("local transport")
  ) {
    category = "activities";
  } else if (
    lower.includes("train") ||
    lower.includes("flight") ||
    lower.includes("transport") ||
    lower.includes("travel") ||
    lower.includes("cab") ||
    lower.includes("transit") ||
    lower.includes("bus")
  ) {
    category = "transport";
  } else if (
    lower.includes("accommodat") ||
    lower.includes("hotel") ||
    lower.includes("stay") ||
    lower.includes("guesthouse") ||
    lower.includes("resort") ||
    lower.includes("hostel")
  ) {
    category = "accommodation";
  } else if (
    lower.includes("food") ||
    lower.includes("dining") ||
    lower.includes("meal") ||
    lower.includes("restaurant") ||
    lower.includes("cafe")
  ) {
    category = "food";
  } else if (lower.includes("shop")) {
    category = "shopping";
  }

  return { label: label || "Other Expense", desc, category };
}

/**
 * Client-side parser for legacy pipe-separated strings:
 * "Train (2 Sleeper tickets): ₹3,000 | Accommodation (budget guesthouses, 15 nights): ₹7,500 | Food (average ₹400/day for 2): ₹6,000 | Local transport & entry fees: ₹2,000 | Miscellaneous/contingency: ₹1,500 = ₹20,000 total"
 */
function parseLegacyString(
  str: string,
  travelers: number = 1,
  nights: number = 1
): BudgetBreakdown | null {
  if (!str || typeof str !== "string") return null;

  // Clean trailing "= ₹20,000 total"
  const cleaned = str.replace(/=\s*(?:₹|INR|Rs\.?)?\s*[\d,]+(?:\s*total)?$/i, "").trim();
  const chunks = cleaned.split("|").map((s) => s.trim()).filter(Boolean);
  if (chunks.length === 0) return null;

  const categories: BudgetCategoryItem[] = [];

  for (const chunk of chunks) {
    const match = chunk.match(/^(.*?)(?::|-)\s*(?:₹|INR|Rs\.?)?\s*([\d,]+)(?:\s*(?:INR|Rs\.?))?$/i);
    let rawLabel = "";
    let amount = 0;

    if (match) {
      rawLabel = match[1].trim();
      amount = parseInt(match[2].replace(/,/g, ""), 10);
    } else {
      const fallbackMatch = chunk.match(/^(.*?)\s*(?:₹|INR|Rs\.?)\s*([\d,]+)$/i);
      if (fallbackMatch) {
        rawLabel = fallbackMatch[1].trim();
        amount = parseInt(fallbackMatch[2].replace(/,/g, ""), 10);
      }
    }

    if (!rawLabel || isNaN(amount) || amount <= 0) continue;

    const { label, desc, category } = parseLabelAndDesc(rawLabel);

    categories.push({
      category,
      label,
      description: desc,
      amount,
      type: "ESTIMATED",
    });
  }

  if (categories.length === 0) return null;

  return {
    currency: "INR",
    travelers,
    nights,
    categories,
  };
}

/**
 * Returns an appropriate icon component for a category.
 */
function getCategoryIcon(category: string, label: string) {
  const c = (category || "").toLowerCase();
  const l = (label || "").toLowerCase();

  if (c === "transport" || l.includes("train") || l.includes("flight") || l.includes("transport")) {
    if (l.includes("train")) return Train;
    if (l.includes("flight") || l.includes("air")) return Plane;
    if (l.includes("bus")) return Bus;
    return Car;
  }
  if (c === "accommodation" || l.includes("hotel") || l.includes("stay") || l.includes("guesthouse")) {
    return Building2;
  }
  if (c === "food" || l.includes("food") || l.includes("dining") || l.includes("meal")) {
    return Utensils;
  }
  if (
    c === "activities" ||
    l.includes("entry") ||
    l.includes("ticket") ||
    l.includes("local transport") ||
    l.includes("sightsee")
  ) {
    if (l.includes("bus") || l.includes("local transport")) return Bus;
    return Ticket;
  }
  if (c === "shopping" || l.includes("shop")) {
    return ShoppingBag;
  }
  if (c === "miscellaneous" || l.includes("misc") || l.includes("contingency") || l.includes("buffer")) {
    return Receipt;
  }

  return Wallet;
}

const TYPE_CONFIG: Record<
  string,
  { label: string; badgeClass: string; tooltip: string }
> = {
  ESTIMATED: {
    label: "ESTIMATED",
    badgeClass: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    tooltip: "AI / General market estimate",
  },
  LIVE_PRICE: {
    label: "LIVE PRICE",
    badgeClass: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    tooltip: "Verified live provider pricing",
  },
  ACTUAL: {
    label: "ACTUAL",
    badgeClass: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    tooltip: "User recorded expense",
  },
  PROJECTED: {
    label: "PROJECTED",
    badgeClass: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    tooltip: "Forecasted trip expense",
  },
};

export function BudgetEstimateCard({
  trip,
  budgetBreakdown: propBreakdown,
  budgetEstimate: propEstimate,
  travelers: propTravelers,
  nights: propNights,
  className,
}: BudgetEstimateCardProps) {
  // Resolve inputs from props or trip object
  const breakdownSource = propBreakdown || trip?.budgetBreakdown || null;
  const legacyString = propEstimate || trip?.budgetEstimate || null;

  // Determine travelers count
  const travelers = Math.max(
    1,
    propTravelers ??
      breakdownSource?.travelers ??
      trip?.travelers ??
      trip?.members?.length ??
      1
  );

  // Determine nights count
  const nights = Math.max(
    1,
    propNights ??
      breakdownSource?.nights ??
      (trip?.days?.length ? trip.days.length : 1)
  );

  // Parse structured data or fallback to parsing the legacy string
  const structuredData: BudgetBreakdown | null = useMemo(() => {
    if (breakdownSource && Array.isArray(breakdownSource.categories) && breakdownSource.categories.length > 0) {
      return {
        ...breakdownSource,
        travelers: breakdownSource.travelers || travelers,
        nights: breakdownSource.nights || nights,
      };
    }
    if (legacyString) {
      return parseLegacyString(legacyString, travelers, nights);
    }
    return null;
  }, [breakdownSource, legacyString, travelers, nights]);

  // If no structured data could be extracted, check for simple total or empty state
  if (!structuredData || !structuredData.categories || structuredData.categories.length === 0) {
    if (legacyString) {
      // Graceful fallback for non-pipe simple string
      return (
        <div className={cn("rounded-2xl glass-panel p-6 border border-border/60", className)}>
          <div className="flex items-center justify-between pb-3 border-b border-border/50">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Wallet className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-base">Budget Estimate</h3>
            </div>
            <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-500 border-amber-500/20">
              Estimated
            </Badge>
          </div>
          <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
            {legacyString}
          </p>
          <div className="mt-4 pt-3 border-t border-border/30 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Info className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
            <span>Prices may vary · General AI travel estimate</span>
          </div>
        </div>
      );
    }

    return (
      <div className={cn("rounded-2xl glass-panel p-6 text-center border border-border/60", className)}>
        <Wallet className="mx-auto h-8 w-8 text-muted-foreground/40" />
        <p className="mt-2 text-sm font-medium">No budget estimate available</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Budget breakdown will appear once your itinerary is generated.
        </p>
      </div>
    );
  }

  // Filter out invalid items
  const validCategories = structuredData.categories.filter((cat) => {
    return cat && typeof cat.amount === "number" && !isNaN(cat.amount) && cat.amount >= 0;
  });

  // Calculate totals strictly on the frontend (Requirements 9, 10, 11)
  const total = validCategories.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const perPerson = travelers > 0 ? Math.round(total / travelers) : total;

  return (
    <div
      className={cn(
        "rounded-2xl glass-panel p-6 border border-border/60 shadow-sm transition-all",
        className
      )}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between pb-4 border-b border-border/50">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-base sm:text-lg tracking-tight">
              Budget Estimate
            </h3>
            <p className="text-xs text-muted-foreground">
              Categorized travel cost forecast
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className="text-xs font-medium px-2.5 py-0.5 bg-amber-500/10 text-amber-500 border-amber-500/20 select-none"
        >
          Estimated
        </Badge>
      </div>

      {/* ── Category Rows / Cards ── */}
      <div className="mt-4 space-y-3">
        {validCategories.map((item, idx) => {
          const IconComponent = getCategoryIcon(item.category || "miscellaneous", item.label || "Expense");
          const typeMeta = TYPE_CONFIG[item.type || "ESTIMATED"] || TYPE_CONFIG.ESTIMATED;

          return (
            <div
              key={idx}
              className="group rounded-xl p-3.5 sm:p-4 glass-tile border border-border/40 hover:border-primary/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              {/* Left: Icon, Category Name, Description */}
              <div className="flex items-start sm:items-center gap-3 min-w-0">
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 transition-transform group-hover:scale-105">
                  <IconComponent className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-foreground">
                      {item.label || "Other Expense"}
                    </span>
                  </div>
                  {item.description ? (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  ) : null}
                </div>
              </div>

              {/* Right: Amount & ESTIMATED Pill */}
              <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center pl-13 sm:pl-0 shrink-0 gap-1">
                <span className="font-display font-semibold text-base text-foreground tracking-tight">
                  {inr(item.amount)}
                </span>
                <span
                  title={typeMeta.tooltip}
                  className={cn(
                    "text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded border select-none",
                    typeMeta.badgeClass
                  )}
                >
                  {typeMeta.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Divider ── */}
      <div className="border-t border-border/60 my-5" />

      {/* ── Estimated Total & Per-Person Cost ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 p-4 rounded-xl bg-primary/[0.04] border border-primary/10">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
            Estimated Total
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-display text-2xl sm:text-3xl font-bold text-primary tracking-tight">
              {inr(total)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            For {travelers} traveler{travelers !== 1 ? "s" : ""} · {nights} night{nights !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="sm:text-right border-t sm:border-t-0 pt-3 sm:pt-0 border-border/40">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
            Per Person
          </span>
          <p className="font-display text-xl sm:text-2xl font-bold text-foreground mt-1">
            {inr(perPerson)}{" "}
            <span className="text-xs font-normal text-muted-foreground">/ person</span>
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Based on {travelers} traveler{travelers !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* ── Disclaimer Footer ── */}
      <div className="mt-4 pt-3 border-t border-border/30 flex items-center justify-between gap-2 flex-wrap text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
          <span>Prices may vary · General AI travel estimate, not a verified provider price</span>
        </div>
        <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">
          Currency: {structuredData.currency || "INR"}
        </span>
      </div>
    </div>
  );
}

export default BudgetEstimateCard;
