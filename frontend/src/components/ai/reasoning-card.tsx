import { useState } from "react";
import { ChevronDown, Check, X } from "lucide-react";
import { AiBadge } from "./ai-badge";
import type { Reasoning } from "@/lib/ai-engine";
import { cn } from "@/lib/utils";

export function ReasoningCard({ r, compact = false }: { r: Reasoning; compact?: boolean }) {
  const [open, setOpen] = useState(!compact);
  return (
    <div className="rounded-xl border border-border/60 bg-background/50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <div className="flex items-center gap-2">
          <AiBadge>{r.match}% match</AiBadge>
          <span className="text-xs text-muted-foreground line-clamp-1">{r.why}</span>
        </div>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="space-y-2 border-t border-border/60 px-3 py-3">
          <p className="text-xs text-foreground">{r.why}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <ul className="space-y-1">
              {r.pros.map((p) => (
                <li key={p} className="flex items-start gap-1.5 text-xs">
                  <Check className="mt-0.5 h-3 w-3 shrink-0 text-accent" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
            <ul className="space-y-1">
              {r.cons.map((c) => (
                <li key={c} className="flex items-start gap-1.5 text-xs">
                  <X className="mt-0.5 h-3 w-3 shrink-0 text-destructive/80" />
                  <span className="text-muted-foreground">{c}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-[11px] text-muted-foreground">
            {r.costImpact && (
              <span>
                Cost · <span className="text-foreground">{r.costImpact}</span>
              </span>
            )}
            {r.timeImpact && (
              <span>
                Time · <span className="text-foreground">{r.timeImpact}</span>
              </span>
            )}
            {r.distance && (
              <span>
                Distance · <span className="text-foreground">{r.distance}</span>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
