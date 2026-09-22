import { Star } from "lucide-react";
import { inr } from "@/lib/utils";
import { AiBadge } from "./ai-badge";
import type { TradeoffOption } from "@/lib/ai-engine";

function Bar({ value, tone = "bg-primary" }: { value: number; tone?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${value}%` }} />
    </div>
  );
}

export function TradeoffMatrix({ title, options }: { title: string; options: TradeoffOption[] }) {
  return (
    <div className="rounded-2xl glass-panel p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">
            Advenza does not pick one; here is the honest tradeoff.
          </p>
        </div>
        <AiBadge>Tradeoff engine</AiBadge>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {options.map((o) => (
          <div
            key={o.id}
            className="flex flex-col gap-3 rounded-xl border border-border/60 bg-background/60 p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold leading-tight">{o.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Best for: {o.bestFor}</p>
              </div>
              <span className="rounded-full bg-primary/8 px-2 py-0.5 text-[10px] font-semibold text-primary">
                {o.confidence}%
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="font-display text-2xl">{inr(o.price)}</span>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Star className="h-3 w-3 fill-current text-primary" />
                {o.rating}
              </span>
            </div>
            <div className="space-y-2 text-[11px]">
              <div className="flex justify-between text-muted-foreground">
                <span>Comfort</span>
                <span>{o.comfort}</span>
              </div>
              <Bar value={o.comfort} tone="bg-accent" />
              <div className="flex justify-between text-muted-foreground">
                <span>Crowd</span>
                <span>{o.crowd}</span>
              </div>
              <Bar value={o.crowd} tone="bg-[oklch(0.78_0.16_75)]" />
              <div className="flex justify-between text-muted-foreground">
                <span>Transit</span>
                <span>{o.timeMin} min</span>
              </div>
              <Bar value={Math.max(0, 100 - o.timeMin * 3)} tone="bg-primary" />
            </div>
            <div className="grid gap-1 border-t border-border/60 pt-3 text-[11px]">
              {o.pros.slice(0, 2).map((p) => (
                <p key={p} className="text-foreground">
                  + {p}
                </p>
              ))}
              {o.cons.slice(0, 1).map((c) => (
                <p key={c} className="text-muted-foreground">
                  − {c}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
