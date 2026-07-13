import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { budgetCategories } from "@/lib/mock-data";
import { inr } from "@/lib/utils";
import { TrendingDown, Sparkles, Plus } from "lucide-react";

export const Route = createFileRoute("/budget")({ component: Budget });

function Budget() {
  const total = budgetCategories.reduce((a, b) => a + b.total, 0);
  const spent = budgetCategories.reduce((a, b) => a + b.spent, 0);
  const remaining = total - spent;

  return (
    <AppShell title="Budget" subtitle="Udaipur · Jun 12 – 18" actions={
      <Button><Plus className="mr-1.5 h-4 w-4" />Add expense</Button>
    }>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl glass-panel p-6 lg:col-span-2">
          <div className="grid gap-6 md:grid-cols-[220px_1fr] md:items-center">
            <div className="relative mx-auto h-52 w-52">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={budgetCategories} dataKey="spent" innerRadius={65} outerRadius={95} paddingAngle={2}>
                    {budgetCategories.map((c, i) => <Cell key={i} fill={c.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-xs text-muted-foreground">Spent</p>
                <p className="font-display text-3xl">{inr(spent)}</p>
                <p className="text-xs text-muted-foreground">of {inr(total)}</p>
              </div>
            </div>
            <div className="space-y-3">
              {budgetCategories.map((b) => (
                <div key={b.name}>
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: b.color }} />
                      {b.name}
                    </span>
                    <span className="text-muted-foreground">{inr(b.spent)} / {inr(b.total)}</span>
                  </div>
                  <Progress value={(b.spent / b.total) * 100} className="mt-1.5 h-1.5" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl glass-panel p-6">
            <p className="text-sm text-muted-foreground">Remaining</p>
            <p className="mt-1 font-display text-4xl text-accent">{inr(remaining)}</p>
            <p className="mt-1 text-xs text-muted-foreground">On track — 62% used with 71% of trip left.</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-gradient-to-br from-primary/5 to-accent/5 p-6">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-primary" />
              <div>
                <p className="font-semibold">Aventra tip</p>
                <p className="mt-1 text-sm text-muted-foreground">Swap the private car for a shared auto to Sajjangarh and save ~₹3,600 across the week.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl glass-panel p-6 lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">Recent expenses</h3>
            <span className="flex items-center gap-1 text-xs text-accent"><TrendingDown className="h-3.5 w-3.5" />12% under weekly average</span>
          </div>
          <div className="divide-y divide-border/60">
            {[
              { d: "Jun 14", n: "Jag Mandir dinner cruise", c: "Activities", a: 5600 },
              { d: "Jun 13", n: "Ambrai riverside dinner", c: "Food", a: 3500 },
              { d: "Jun 12", n: "Taj Lake Palace — night 1", c: "Stays", a: 26000 },
              { d: "Jun 12", n: "UDR airport transfer", c: "Transit", a: 1500 },
              { d: "Jun 11", n: "IndiGo flight DEL→UDR", c: "Flights", a: 8000 },
            ].map((e) => (

              <div key={e.n} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="font-medium">{e.n}</p>
                  <p className="text-xs text-muted-foreground">{e.d} · {e.c}</p>
                </div>
                <p className="font-semibold">{inr(e.a)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
