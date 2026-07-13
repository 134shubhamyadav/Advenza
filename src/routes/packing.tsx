import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AiBadge } from "@/components/ai/ai-badge";
import { packing } from "@/lib/ai-engine";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/packing")({ component: Packing });

function Packing() {
  const groups = Object.keys(packing);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const total = groups.reduce((n, g) => n + packing[g].length, 0);
  const done = Object.values(checked).filter(Boolean).length;

  return (
    <AppShell
      title="Smart Packing"
      subtitle={`${done} of ${total} packed · tailored to Udaipur, monsoon fringe, 6 days`}
      actions={<AiBadge>Generated for this trip</AiBadge>}
    >
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((g) => (
          <section key={g} className="rounded-2xl glass-panel p-5">
            <div className="mb-3 flex items-baseline justify-between">
              <h3 className="font-semibold">{g}</h3>
              <span className="text-xs text-muted-foreground">
                {packing[g].filter((_, i) => checked[`${g}:${i}`]).length}/{packing[g].length}
              </span>
            </div>
            <ul className="space-y-2">
              {packing[g].map((item, i) => {
                const key = `${g}:${i}`;
                const on = !!checked[key];
                return (
                  <li key={key}>
                    <button
                      onClick={() => setChecked((c) => ({ ...c, [key]: !c[key] }))}
                      className={cn(
                        "flex w-full gap-3 rounded-xl border p-3 text-left transition",
                        on ? "border-accent/50 bg-accent/6" : "border-border/60 bg-background/50 hover:border-primary/30",
                      )}
                    >
                      <span className={cn("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border",
                        on ? "border-accent bg-accent text-accent-foreground" : "border-border")}>
                        {on && <Check className="h-3 w-3" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={cn("text-sm font-medium", on && "line-through opacity-60")}>{item.name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{item.why}</p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </AppShell>
  );
}
