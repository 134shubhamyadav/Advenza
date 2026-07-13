import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AppShell } from "@/components/app-shell";
import { AiBadge } from "@/components/ai/ai-badge";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { baseSim, simulate, type SimInput } from "@/lib/ai-engine";
import { inr, cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/simulator")({ component: Simulator });

function Simulator() {
  const [input, setInput] = useState<SimInput>(baseSim);
  const base = useMemo(() => simulate(baseSim), []);
  const proj = useMemo(() => simulate(input), [input]);

  const set = <K extends keyof SimInput>(k: K, v: SimInput[K]) => setInput((p) => ({ ...p, [k]: v }));

  const rows: Array<[string, string, string]> = [
    ["Projected spend", inr(base.projected), inr(proj.projected)],
    ["Per-day cost",    inr(base.perDay),    inr(proj.perDay)],
    ["Activities",      String(base.activities), String(proj.activities)],
    ["Travel time",     base.travelTime,     proj.travelTime],
    ["Health score",    `${base.health}`,    `${proj.health}`],
    ["Savings vs. budget", inr(base.savings), inr(proj.savings)],
  ];

  return (
    <AppShell
      title="What-If Simulator"
      subtitle="Nudge the knobs. See the trip reshape itself. Nothing is committed."
      actions={<AiBadge>Sandbox mode</AiBadge>}
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        {/* Controls */}
        <div className="space-y-5 rounded-3xl glass-panel p-6">
          <div>
            <Label className="text-xs">Budget</Label>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="font-display text-3xl">{inr(input.budget)}</span>
              <span className="text-xs text-muted-foreground">₹40k – ₹8L</span>
            </div>
            <Slider className="mt-3" value={[input.budget]} min={40000} max={800000} step={5000}
              onValueChange={([v]) => set("budget", v)} />
          </div>

          <div>
            <Label className="text-xs">Days</Label>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="font-display text-3xl">{input.days}</span>
              <span className="text-xs text-muted-foreground">2 – 21</span>
            </div>
            <Slider className="mt-3" value={[input.days]} min={2} max={21} step={1}
              onValueChange={([v]) => set("days", v)} />
          </div>

          <div>
            <Label className="text-xs">Travelers</Label>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="font-display text-3xl">{input.travelers}</span>
              <span className="text-xs text-muted-foreground">1 – 8</span>
            </div>
            <Slider className="mt-3" value={[input.travelers]} min={1} max={8} step={1}
              onValueChange={([v]) => set("travelers", v)} />
          </div>

          <div>
            <Label className="text-xs">Tier</Label>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {(["Economy", "Comfort", "Luxury"] as const).map((t) => (
                <button key={t} onClick={() => set("tier", t)}
                  className={cn("rounded-xl border p-3 text-sm transition",
                    input.tier === t ? "border-primary bg-primary/8 font-semibold" : "border-border bg-background hover:border-primary/40")}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs">Transport</Label>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {(["Train", "Flight", "Private car"] as const).map((t) => (
                <button key={t} onClick={() => set("transport", t)}
                  className={cn("rounded-xl border p-3 text-sm transition",
                    input.transport === t ? "border-primary bg-primary/8 font-semibold" : "border-border bg-background hover:border-primary/40")}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Diff */}
        <div className="rounded-3xl glass-panel p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Projected trip</h3>
            <AiBadge>Live diff</AiBadge>
          </div>
          <ul className="mt-4 divide-y divide-border/60">
            {rows.map(([k, a, b]) => {
              const changed = a !== b;
              return (
                <motion.li
                  key={k}
                  layout
                  className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 py-3 text-sm"
                >
                  <span className="text-muted-foreground">{k}</span>
                  <span className="tabular-nums text-muted-foreground line-through">{a}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className={cn("tabular-nums font-semibold", changed ? "text-primary" : "text-foreground")}>{b}</span>
                </motion.li>
              );
            })}
          </ul>
          <div className="mt-6 rounded-2xl border border-border/60 bg-background/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Aventra suggests</p>
            <p className="mt-1 text-sm">
              {proj.projected > input.budget
                ? `Dropping to Comfort tier would recover ${inr(proj.projected - input.budget)}. Want a plan you can accept in one tap?`
                : `You're ${inr(input.budget - proj.projected)} under budget. Aventra can upgrade one stay or add a chef-tasting night.`}
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
