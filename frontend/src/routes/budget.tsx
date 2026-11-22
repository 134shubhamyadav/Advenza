import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { inr } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { queryKeys } from "@/lib/queryKeys";
import {
  Wallet,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  Plus,
  Settings,
  Calendar,
  CreditCard,
  Banknote,
  Smartphone,
  Receipt,
  Edit2,
  Trash2,
  Clock,
  CheckCircle2,
  PieChart as PieIcon,
  Users,
  Search,
  Filter,
  RefreshCw,
  Loader2,
  Plane,
  Lightbulb,
  Building2,
  Utensils,
  Ticket,
  Car,
  Bus,
  ShoppingBag,
  MoreHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { ExpenseModal, CATEGORIES } from "@/components/budget/expense-modal";
import { SettlementView } from "@/components/budget/settlement-view";
import { BudgetSettingsModal } from "@/components/budget/budget-settings-modal";

export const Route = createFileRoute("/budget")({ component: BudgetDashboard });

const CATEGORY_ICON_MAP: Record<string, any> = {
  flights: Plane,
  hotels: Building2,
  food: Utensils,
  activities: Ticket,
  transport: Car,
  localtransport: Bus,
  shopping: ShoppingBag,
  miscellaneous: MoreHorizontal,
};

function getCategoryIcon(cat: string) {
  const clean = (cat || "").toLowerCase().replace(/\s+/g, "");
  return CATEGORY_ICON_MAP[clean] || MoreHorizontal;
}

function BudgetDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("ledger");
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState<any>(null);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // 1. Fetch User Trips
  const { data: trips = [], isLoading: loadingTrips } = useQuery<any[]>({
    queryKey: queryKeys.trips(),
    queryFn: async () => {
      const data = await apiFetch("/api/trips");
      return Array.isArray(data) ? data : [];
    },
    enabled: !!user,
  });

  const activeTrip = (selectedTripId ? trips.find((t) => t._id === selectedTripId) : trips[0]) ?? null;
  const activeTripId = activeTrip?._id ?? null;

  // 2. Fetch Budget Summary & Metrics for Active Trip
  const {
    data: budgetSummary,
    isLoading: loadingSummary,
    refetch: refetchBudget,
  } = useQuery({
    queryKey: ["tripBudgetSummary", activeTripId],
    queryFn: async () => {
      if (!activeTripId) return null;
      return await apiFetch(`/api/trips/${activeTripId}/budget`);
    },
    enabled: !!activeTripId,
  });

  // 3. Fetch Expenses List with filters
  const {
    data: expensesData,
    isLoading: loadingExpenses,
    refetch: refetchExpenses,
    isFetching: isFetchingExpenses,
  } = useQuery({
    queryKey: ["tripExpenses", activeTripId, categoryFilter, typeFilter, searchQuery],
    queryFn: async () => {
      if (!activeTripId) return { expenses: [], total: 0 };
      const params = new URLSearchParams();
      if (categoryFilter !== "all") params.append("category", categoryFilter);
      if (typeFilter !== "all") params.append("type", typeFilter);
      if (searchQuery.trim()) params.append("search", searchQuery.trim());
      params.append("limit", "100");

      return await apiFetch(`/api/trips/${activeTripId}/expenses?${params.toString()}`);
    },
    enabled: !!activeTripId,
  });

  // 4. Fetch AI Insights
  const {
    data: aiInsights,
    isLoading: loadingAi,
    refetch: refetchAi,
    isFetching: isFetchingAi,
  } = useQuery({
    queryKey: ["budgetAiInsights", activeTripId],
    queryFn: async () => {
      if (!activeTripId) return null;
      return await apiFetch(`/api/trips/${activeTripId}/budget/ai-insights`, { method: "POST" });
    },
    enabled: !!activeTripId && activeTab === "ai",
  });

  const expenses = expensesData?.expenses || [];
  const currency = budgetSummary?.currency || "INR";
  const totalBudget = budgetSummary?.totalBudget || 0;
  const actualTotal = budgetSummary?.actualTotal || 0;
  const remainingBuffer = budgetSummary?.remainingBuffer || 0;
  const projectedTotal = budgetSummary?.projectedTotal || 0;
  const isOverBudget = budgetSummary?.isOverBudget || false;
  const percentageUsed = budgetSummary?.percentageUsed || 0;
  const daily = budgetSummary?.daily || {};
  const categories = budgetSummary?.categories || [];
  const alerts = budgetSummary?.alerts || [];

  const handleRefreshAll = () => {
    refetchBudget();
    refetchExpenses();
    if (activeTab === "ai") refetchAi();
    queryClient.invalidateQueries({ queryKey: ["budgetSettlement", activeTripId] });
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!confirm("Are you sure you want to delete this expense?")) return;
    try {
      await apiFetch(`/api/trips/${activeTripId}/expenses/${expenseId}`, { method: "DELETE" });
      toast.success("Expense deleted");
      handleRefreshAll();
    } catch (err: any) {
      toast.error(`Delete failed: ${err.message}`);
    }
  };

  if (loadingTrips) {
    return (
      <AppShell title="Budget" subtitle="Loading your financial command center...">
        <div className="grid gap-6 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse h-32 rounded-2xl glass-panel" />
          ))}
        </div>
      </AppShell>
    );
  }

  if (!activeTripId) {
    return (
      <AppShell title="Budget Command Center" subtitle="Track real costs, allocations, and group settlements">
        <div className="rounded-2xl glass-panel p-12 text-center">
          <Wallet className="mx-auto h-12 w-12 text-muted-foreground/60 mb-3" />
          <h3 className="text-lg font-semibold">No Trips Found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a trip first to start planning your travel budget and tracking expenses.
          </p>
          <Button asChild className="mt-4">
            <Link to="/trips/new">Create Trip</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Budget Command Center"
      subtitle={`Financial telemetry & expenses for ${activeTrip.title} (${activeTrip.destination || "Trip"})`}
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSettingsModalOpen(true)}
            className="gap-1.5 border-border/80 hover:bg-muted/40 shadow-sm"
          >
            <Settings className="h-3.5 w-3.5" />
            Budget Settings
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setExpenseToEdit(null);
              setExpenseModalOpen(true);
            }}
            className="gap-1.5 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Record Expense
          </Button>
        </div>
      }
    >
      {/* Trip Switcher Header */}
      {trips.length > 1 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground mr-1">Active Trip:</span>
          {trips.map((t) => (
            <button
              key={t._id}
              onClick={() => setSelectedTripId(t._id)}
              className={`rounded-xl border px-3 py-1.5 text-xs transition ${
                activeTripId === t._id
                  ? "border-primary bg-primary/10 text-primary font-bold shadow-xs"
                  : "border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              {t.destination?.split(",")[0] || t.title}
            </button>
          ))}
        </div>
      )}

      {/* Threshold Alerts Banner if any */}
      {alerts.length > 0 && (
        <div className="mb-6 space-y-2">
          {alerts.map((alt: any, idx: number) => (
            <div
              key={idx}
              className={`flex items-start gap-3 rounded-2xl border p-4 shadow-sm ${
                alt.severity === "bad"
                  ? "border-destructive/40 bg-destructive/10 text-destructive dark:text-rose-400"
                  : "border-warning/40 bg-warning/10 text-warning-foreground"
              }`}
            >
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-sm">{alt.title}</p>
                <p className="text-xs mt-0.5 opacity-90">{alt.message}</p>
              </div>
              <span className="rounded-lg bg-background/50 px-2 py-0.5 text-xs font-bold border border-border/40">
                {alt.delta}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Top Metrics Ribbon (5 Stats) ─────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 mb-6">
        {/* 1. Total Target Budget */}
        <div className="rounded-2xl glass-panel p-5 border border-border/80">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Budget</span>
            <Wallet className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-foreground">
            {currency} {totalBudget.toLocaleString("en-IN")}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Allocated across {categories.length} categories
          </p>
        </div>

        {/* 2. Actual Spent */}
        <div className="rounded-2xl glass-panel p-5 border border-border/80">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Actual Spent</span>
            <TrendingDown className="h-4 w-4 text-rose-500" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-foreground">
            {currency} {actualTotal.toLocaleString("en-IN")}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Progress value={Math.min(100, percentageUsed)} className="h-1.5 flex-1" />
            <span className="text-[11px] font-semibold text-muted-foreground">{percentageUsed}%</span>
          </div>
        </div>

        {/* 3. Remaining Buffer */}
        <div className="rounded-2xl glass-panel p-5 border border-border/80">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Remaining Buffer</span>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </div>
          <p
            className={`mt-2 font-display text-2xl font-bold ${
              remainingBuffer < 0 ? "text-destructive" : "text-emerald-500"
            }`}
          >
            {currency} {Math.abs(remainingBuffer).toLocaleString("en-IN")}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {remainingBuffer < 0 ? "Budget exceeded!" : `${100 - percentageUsed}% remaining`}
          </p>
        </div>

        {/* 4. Projected Total */}
        <div className="rounded-2xl glass-panel p-5 border border-border/80 bg-gradient-to-br from-primary/5 via-card to-card">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">Projected Total</span>
            <Clock className="h-4 w-4 text-primary" />
          </div>
          <p
            className={`mt-2 font-display text-2xl font-bold ${
              projectedTotal > totalBudget && totalBudget > 0 ? "text-warning" : "text-foreground"
            }`}
          >
            {currency} {projectedTotal.toLocaleString("en-IN")}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {budgetSummary?.projectedOverage > 0
              ? `Forecast: +${currency} ${budgetSummary.projectedOverage.toLocaleString("en-IN")} over`
              : "Forecast: within limits"}
          </p>
        </div>

        {/* 5. Daily Allowance */}
        <div className="rounded-2xl glass-panel p-5 border border-border/80">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Daily Allowance</span>
            <Calendar className="h-4 w-4 text-sky-500" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-foreground">
            {currency} {(daily.remainingDailyAllowance || 0).toLocaleString("en-IN")}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Across {daily.daysRemaining || 1} day{(daily.daysRemaining || 1) !== 1 ? "s" : ""} remaining
          </p>
        </div>
      </div>

      {/* ── Primary Navigation Tabs ───────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-3">
          <TabsList className="bg-muted/40 p-1 rounded-xl">
            <TabsTrigger value="ledger" className="rounded-lg text-xs gap-1.5">
              <Receipt className="h-3.5 w-3.5" />
              Expenses Ledger ({expenses.length})
            </TabsTrigger>
            <TabsTrigger value="categories" className="rounded-lg text-xs gap-1.5">
              <PieIcon className="h-3.5 w-3.5" />
              Categories & Variance
            </TabsTrigger>
            <TabsTrigger value="settlement" className="rounded-lg text-xs gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Group Settlement
            </TabsTrigger>
            <TabsTrigger value="ai" className="rounded-lg text-xs gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              AI Budget Advisor
            </TabsTrigger>
          </TabsList>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefreshAll}
            disabled={isFetchingExpenses}
            className="h-8 text-xs text-muted-foreground gap-1"
          >
            <RefreshCw className={`h-3 w-3 ${isFetchingExpenses ? "animate-spin" : ""}`} />
            Sync
          </Button>
        </div>

        {/* ── TAB 1: EXPENSES LEDGER ─────────────────────────────────────── */}
        <TabsContent value="ledger" className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl glass-panel p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <Filter className="h-3.5 w-3.5" /> Category:
              </span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs font-medium"
              >
                <option value="all">All Categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>

              <span className="text-xs font-semibold text-muted-foreground ml-2">Type:</span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs font-medium"
              >
                <option value="all">All Types</option>
                <option value="ACTUAL">Actual</option>
                <option value="ESTIMATED">Estimated</option>
                <option value="LIVE_PRICE">Live Price</option>
              </select>
            </div>

            <div className="relative min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search expenses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-xs"
              />
            </div>
          </div>

          {/* Expenses Table / Cards */}
          <div className="rounded-2xl glass-panel p-4 overflow-hidden border border-border/80">
            {expenses.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <Receipt className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
                <p className="font-semibold text-foreground">No matching expenses found</p>
                <p className="text-xs mt-1">Record a new expense to start tracking real trip expenditures.</p>
                <Button
                  size="sm"
                  onClick={() => {
                    setExpenseToEdit(null);
                    setExpenseModalOpen(true);
                  }}
                  className="mt-4 gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" /> Record Expense
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {expenses.map((exp: any) => {
                  const Icon = getCategoryIcon(exp.category);
                  const isForeign = exp.originalCurrency && exp.originalCurrency !== currency;

                  return (
                    <div
                      key={exp._id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3.5 px-2 hover:bg-muted/20 rounded-xl transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className="rounded-xl border border-border/80 bg-background/80 p-2.5 shadow-xs">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-foreground">{exp.name}</span>
                            {/* Cost Type Badge */}
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                exp.type === "ACTUAL"
                                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                  : exp.type === "LIVE_PRICE"
                                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                                  : "bg-sky-500/15 text-sky-600 dark:text-sky-400"
                              }`}
                            >
                              {exp.type}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-2">
                            <span>{exp.date}</span>
                            <span>•</span>
                            <span className="capitalize">{exp.category}</span>
                            <span>•</span>
                            <span className="capitalize">{exp.paymentMethod || "card"}</span>
                            {exp.paidBy?.name && (
                              <>
                                <span>•</span>
                                <span>Paid by {exp.paidBy.name}</span>
                              </>
                            )}
                            {exp.receiptUrl && (
                              <>
                                <span>•</span>
                                <a
                                  href={exp.receiptUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-primary underline flex items-center gap-0.5"
                                >
                                  Receipt ↗
                                </a>
                              </>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-display text-base font-bold text-foreground">
                            {currency} {exp.amount.toLocaleString("en-IN")}
                          </p>
                          {isForeign && (
                            <p className="text-[11px] text-muted-foreground">
                              {exp.originalCurrency} {exp.originalAmount}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              setExpenseToEdit(exp);
                              setExpenseModalOpen(true);
                            }}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDeleteExpense(exp._id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── TAB 2: CATEGORIES & VARIANCE ───────────────────────────────── */}
        <TabsContent value="categories" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((cat: any) => {
              const Icon = getCategoryIcon(cat.category);
              const isOver = cat.isOverBudget;

              return (
                <div
                  key={cat.category}
                  className={`rounded-2xl glass-panel p-5 border transition ${
                    isOver ? "border-destructive/50 bg-destructive/5" : "border-border/80"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-primary" />
                      <h4 className="font-semibold text-sm capitalize">{cat.category}</h4>
                    </div>
                    <span
                      className={`text-xs font-bold ${
                        isOver ? "text-destructive" : "text-muted-foreground"
                      }`}
                    >
                      {cat.percentageUsed}%
                    </span>
                  </div>

                  <Progress
                    value={Math.min(100, cat.percentageUsed)}
                    className={`h-2 ${isOver ? "[&>div]:bg-destructive" : ""}`}
                  />

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Actual Spent</p>
                      <p className="font-bold text-foreground">
                        {currency} {cat.actual.toLocaleString("en-IN")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-muted-foreground">Allocated Cap</p>
                      <p className="font-semibold text-foreground">
                        {currency} {cat.allocated.toLocaleString("en-IN")}
                      </p>
                    </div>
                  </div>

                  <div className="mt-2 pt-2 border-t border-border/40 flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Remaining:</span>
                    <span
                      className={`font-semibold ${
                        cat.remaining < 0 ? "text-destructive" : "text-emerald-500"
                      }`}
                    >
                      {cat.remaining < 0
                        ? `-${currency} ${Math.abs(cat.remaining).toLocaleString("en-IN")}`
                        : `${currency} ${cat.remaining.toLocaleString("en-IN")}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Daily Timeline */}
          {budgetSummary?.timeline?.length > 0 && (
            <div className="rounded-2xl glass-panel p-6 border border-border/80">
              <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                Daily Spending Timeline
              </h4>
              <div className="space-y-2">
                {budgetSummary.timeline.map((point: any) => (
                  <div key={point.date} className="flex items-center justify-between text-sm py-1.5">
                    <span className="text-muted-foreground">{point.date}</span>
                    <span className="font-semibold text-foreground">
                      {currency} {point.amount.toLocaleString("en-IN")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── TAB 3: GROUP SETTLEMENT ────────────────────────────────────── */}
        <TabsContent value="settlement">
          <SettlementView tripId={activeTripId} tripCurrency={currency} />
        </TabsContent>

        {/* ── TAB 4: AI BUDGET ADVISOR ───────────────────────────────────── */}
        <TabsContent value="ai" className="space-y-6">
          <div className="rounded-2xl glass-panel p-6 border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2 text-primary">
                <Sparkles className="h-5 w-5" />
                <h3 className="text-lg font-bold">AI Budget Advisor</h3>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchAi()}
                disabled={isFetchingAi}
                className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isFetchingAi ? "animate-spin" : ""}`} />
                {isFetchingAi ? "Analyzing..." : "Re-Analyze"}
              </Button>
            </div>

            {loadingAi || isFetchingAi ? (
              <div className="flex h-40 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : aiInsights ? (
              <div className="space-y-5">
                <div className="rounded-xl border border-border bg-background/80 p-4">
                  <p className="text-sm font-semibold text-foreground">{aiInsights.summary}</p>
                  {aiInsights.dailyPacingAdvice && (
                    <p className="text-xs text-muted-foreground mt-2 leading-relaxed flex items-start gap-1.5">
                      <Lightbulb className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <span>{aiInsights.dailyPacingAdvice}</span>
                    </p>
                  )}
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Actionable Recommendations
                  </h4>
                  {Array.isArray(aiInsights.recommendations) &&
                    aiInsights.recommendations.map((rec: any, i: number) => (
                      <div
                        key={i}
                        className="rounded-xl border border-border bg-card p-4 flex items-start gap-3"
                      >
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-sm text-foreground">{rec.tip}</p>
                          <p className="text-xs text-muted-foreground mt-1">{rec.action}</p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Click Re-Analyze to generate tactical financial advice.</p>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Dialog Modals ────────────────────────────────────────────────── */}
      <ExpenseModal
        isOpen={expenseModalOpen}
        onOpenChange={setExpenseModalOpen}
        tripId={activeTripId}
        tripCurrency={currency}
        tripMembers={activeTrip.members || []}
        expenseToEdit={expenseToEdit}
        onSuccess={handleRefreshAll}
      />

      <BudgetSettingsModal
        isOpen={settingsModalOpen}
        onOpenChange={setSettingsModalOpen}
        tripId={activeTripId}
        tripCurrency={currency}
        currentBudgetSummary={budgetSummary}
        onSuccess={handleRefreshAll}
      />
    </AppShell>
  );
}
