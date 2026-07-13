import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { AiBadge } from "@/components/ai/ai-badge";
import { ScoreRing } from "@/components/ai/score-ring";
import { tripEvents, healthScore, type TripEvent } from "@/lib/ai-engine";
import { Plane, CloudRain, Wallet, Users, Building2, AlertTriangle, Sparkles, Undo2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/commander")({ component: Commander });

const iconOf: Record<TripEvent["kind"], typeof Plane> = {
  delay: Plane, weather: CloudRain, budget: Wallet, cancel: AlertTriangle,
  closure: Building2, traffic: AlertTriangle, group: Users, ai: Sparkles,
};

function Commander() {
  const score = healthScore();
  return (
    <AppShell
      title="Trip Commander"
      subtitle="Your AI travel manager, watching the plan so you don't have to."
      actions={<AiBadge>Trip Twin, live</AiBadge>}
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {tripEvents.map((e, i) => {
            const Icon = iconOf[e.kind];
            const toneRing =
              e.severity === "bad" ? "ring-destructive/40" :
              e.severity === "warn" ? "ring-[oklch(0.78_0.16_75)]/50" : "ring-primary/30";
            return (
              <motion.article
                key={e.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="rounded-2xl glass-panel p-5"
              >
                <div className="flex items-start gap-4">
                  <span className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/8 text-primary ring-2", toneRing)}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold leading-tight">{e.title}</h3>
                      <span className="text-xs text-muted-foreground">{e.when}</span>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr]">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Why</p>
                        <p className="mt-1 text-sm text-foreground">{e.reason}</p>
                      </div>
                      {e.action && (
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Aventra did</p>
                          <p className="mt-1 text-sm text-foreground">{e.action}</p>
                        </div>
                      )}
                    </div>
                    {e.delta && (
                      <p className="mt-3 rounded-lg bg-accent/8 px-3 py-2 text-xs text-accent-foreground">
                        <span className="font-semibold">Net effect · </span>{e.delta}
                      </p>
                    )}
                    <div className="mt-3 flex items-center gap-2">
                      <Button size="sm" variant="outline" className="h-8">
                        <Check className="mr-1 h-3.5 w-3.5" /> Accept plan
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8">
                        <Undo2 className="mr-1 h-3.5 w-3.5" /> Undo
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>

        <aside className="space-y-6">
          <div className="rounded-2xl glass-panel p-6">
            <p className="text-xs text-muted-foreground">Overall trip health</p>
            <div className="mt-3 flex justify-center">
              <ScoreRing value={score} size={168} />
            </div>
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Updated every time the plan changes.
            </p>
          </div>
          <div className="rounded-2xl glass-panel p-6">
            <h3 className="text-sm font-semibold">Watching for</h3>
            <ul className="mt-3 space-y-2 text-sm">
              {[
                ["Flight & train delays", "IndiGo, IRCTC"],
                ["Weather shifts", "IMD, OpenWeather"],
                ["Attraction closures", "ASI, museum feeds"],
                ["Traffic anomalies", "Google, HERE"],
                ["Budget drift", "Category vs. plan"],
                ["Group availability", "RSVP status"],
              ].map(([k, v]) => (
                <li key={k} className="flex items-baseline justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/40">
                  <span>{k}</span><span className="text-xs text-muted-foreground">{v}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
