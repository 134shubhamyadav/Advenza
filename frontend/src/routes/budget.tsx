import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { inr } from "@/lib/utils";
import { TrendingDown, Sparkles, Plus, X, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { queryKeys } from "@/lib/queryKeys";

export const Route = createFileRoute("/budget")({ component: Budget });

const COLORS = [
  "var(--color-primary)",
  "var(--color-accent)",
  "var(--color-secondary)",
  "var(--color-warning)",
  "oklch(0.6 0.15 200)",
];

const CATEGORIES = ["Flights", "Stays", "Food", "Activities", "Transit", "Other"];

type Expense = { _id?: string; name: string; amount: number; category: string; date: string };
type Trip = {
  _id: string;
  title: string;
  destination?: string;
  budgetTotal?: number;
  expenses?: Expense[];
};

function Budget() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    amount: "",
    category: "Food",
    date: new Date().toISOString().slice(0, 10),
  });

  const { data: trips = [], isLoading: loading } = useQuery<Trip[]>({
    queryKey: queryKeys.trips(),
    queryFn: async () => {
      const data = await apiFetch("/api/trips");
      return Array.isArray(data) ? (data as Trip[]) : [];
    },
    enabled: !!user,
  });

  const activeTrip = (selectedTripId ? trips.find((t) => t._id === selectedTripId) : trips[0]) ?? null;
  const activeTripId = activeTrip?._id ?? null;
  const expenses: Expense[] = activeTrip?.expenses || [];

  // Compute chart data from actual expenses
  const categoryMap: Record<string, number> = {};
  CATEGORIES.forEach((c) => (categoryMap[c] = 0));
  expenses.forEach((e) => {
    const cat = CATEGORIES.includes(e.category) ? e.category : "Other";
    categoryMap[cat] = (categoryMap[cat] || 0) + e.amount;
  });
  const totalSpent = expenses.reduce((a, e) => a + e.amount, 0);
  const totalBudget = activeTrip?.budgetTotal || totalSpent * 1.4 || 100000;
  const remaining = totalBudget - totalSpent;
  const pct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

  const chartData = CATEGORIES.filter((c) => categoryMap[c] > 0).map((c, i) => ({
    name: c,
    value: categoryMap[c],
    color: COLORS[i % COLORS.length],
  }));

  const addExpense = async () => {
    const amount = parseFloat(form.amount);
    if (!form.name || !amount || !activeTrip) return;
    setSaving(true);
    try {
      const updatedTrip = await apiFetch(`/api/trips/${activeTrip._id}/expenses`, {
        method: "POST",
        body: JSON.stringify({ name: form.name, amount, category: form.category, date: form.date }),
      });
      queryClient.setQueryData(queryKeys.trips(), (old: any[] = []) =>
        old.map((t) => (t._id === updatedTrip._id ? updatedTrip : t)),
      );
      queryClient.setQueryData(queryKeys.tripDetails(activeTrip._id), updatedTrip);
      setForm({
        name: "",
        amount: "",
        category: "Food",
        date: new Date().toISOString().slice(0, 10),
      });
      setShowModal(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <AppShell title="Budget" subtitle="Loading...">
        <div className="grid gap-6 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse h-40 rounded-2xl glass-panel" />
          ))}
        </div>
      </AppShell>
    );

  return (
    <AppShell
      title="Budget"
      subtitle={
        activeTrip
          ? `${activeTrip.title} · ${activeTrip.destination || ""}`
          : "Select a trip to track budget"
      }
      actions={
        activeTrip ? (
          <Button onClick={() => setShowModal(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add expense
          </Button>
        ) : undefined
      }
    >
      {/* Trip selector */}
      {trips.length > 1 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {trips.map((t) => (
            <button
              key={t._id}
              onClick={() => setSelectedTripId(t._id)}
              className={`rounded-xl border px-3 py-1.5 text-sm transition ${activeTrip?._id === t._id ? "border-primary bg-primary/8 font-semibold" : "border-border hover:border-primary/40"}`}
            >
              {t.destination?.split(",")[0] || t.title}
            </button>
          ))}
        </div>
      )}

      {/* Add Expense Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl glass-panel p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Add Expense</h3>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg p-1 hover:bg-muted/50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <Label className="text-xs">Description</Label>
                <Input
                  className="mt-1.5 h-11 rounded-xl"
                  placeholder="e.g. Dinner at Ambrai"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">Amount (₹)</Label>
                <Input
                  className="mt-1.5 h-11 rounded-xl"
                  type="number"
                  placeholder="0"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">Category</Label>
                <div className="mt-1.5 grid grid-cols-3 gap-2">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c}
                      onClick={() => setForm((f) => ({ ...f, category: c }))}
                      className={`rounded-xl border p-2.5 text-sm transition ${form.category === c ? "border-primary bg-primary/8 font-semibold" : "border-border bg-background hover:border-primary/40"}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs">Date</Label>
                <Input
                  className="mt-1.5 h-11 rounded-xl"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                />
              </div>
              <Button className="w-full h-11" onClick={addExpense} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {saving ? "Saving…" : "Add Expense"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {!activeTripId ? (
        <div className="rounded-2xl glass-panel p-12 text-center">
          <p className="text-muted-foreground">
            No trips found.{" "}
            <a href="/trips/new" className="text-primary underline">
              Create a trip first
            </a>
            .
          </p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Pie Chart */}
          <div className="rounded-2xl glass-panel p-6 lg:col-span-2">
            {chartData.length === 0 ? (
              <div className="flex h-52 items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <p className="font-medium">No expenses yet</p>
                  <p className="text-sm">Add your first expense above</p>
                </div>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-[220px_1fr] md:items-center">
                <div className="relative mx-auto h-52 w-52">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={chartData}
                        dataKey="value"
                        innerRadius={65}
                        outerRadius={95}
                        paddingAngle={2}
                      >
                        {chartData.map((c, i) => (
                          <Cell key={i} fill={c.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <p className="text-xs text-muted-foreground">Spent</p>
                    <p className="font-display text-3xl">{inr(totalSpent)}</p>
                    <p className="text-xs text-muted-foreground">of {inr(totalBudget)}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {chartData.map((b) => (
                    <div key={b.name}>
                      <div className="flex justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ background: b.color }}
                          />
                          {b.name}
                        </span>
                        <span className="text-muted-foreground">{inr(b.value)}</span>
                      </div>
                      <Progress
                        value={(b.value / (totalBudget || 1)) * 100}
                        className="mt-1.5 h-1.5"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="space-y-6">
            <div className="rounded-2xl glass-panel p-6">
              <p className="text-sm text-muted-foreground">Remaining</p>
              <p
                className={`mt-1 font-display text-4xl ${remaining < 0 ? "text-destructive" : "text-accent"}`}
              >
                {inr(Math.abs(remaining))}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {remaining < 0
                  ? `₹${inr(Math.abs(remaining))} over budget!`
                  : `${pct}% used · ${100 - pct}% remaining`}
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-gradient-to-br from-primary/5 to-accent/5 p-6">
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-semibold">Advenza tip</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Expenses are saved to your trip and persist across sessions.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Expenses List */}
          <div className="rounded-2xl glass-panel p-6 lg:col-span-3">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold">All expenses</h3>
              <span className="flex items-center gap-1 text-xs text-accent">
                <TrendingDown className="h-3.5 w-3.5" />
                {expenses.length} recorded
              </span>
            </div>
            {expenses.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-6">
                No expenses yet. Click "Add expense" to start tracking.
              </p>
            ) : (
              <div className="divide-y divide-border/60">
                {[...expenses].reverse().map((e, i) => (
                  <div key={e._id || i} className="flex items-center justify-between py-3 text-sm">
                    <div>
                      <p className="font-medium">{e.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {e.date} · {e.category}
                      </p>
                    </div>
                    <p className="font-semibold">{inr(e.amount)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
