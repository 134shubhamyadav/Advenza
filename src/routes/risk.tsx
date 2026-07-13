import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { AiBadge } from "@/components/ai/ai-badge";
import { risks, emergencyContacts } from "@/lib/ai-engine";
import { Shield, Phone } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/risk")({ component: Risk });

const toneOf = (l: "low" | "med" | "high") =>
  l === "high" ? "text-destructive bg-destructive/8 border-destructive/30" :
  l === "med"  ? "text-[oklch(0.55_0.15_60)] bg-[oklch(0.78_0.16_75)]/12 border-[oklch(0.78_0.16_75)]/40" :
                 "text-accent bg-accent/8 border-accent/30";

function Risk() {
  return (
    <AppShell
      title="AI Risk Radar"
      subtitle="A calm, honest read on what could go wrong, and how Aventra plans around it."
      actions={<AiBadge>Monitored 24/7</AiBadge>}
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="grid gap-4 sm:grid-cols-2">
          {risks.map((r) => (
            <article key={r.key} className="rounded-2xl glass-panel p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/8 text-primary">
                    <Shield className="h-4 w-4" />
                  </span>
                  <h3 className="font-semibold">{r.label}</h3>
                </div>
                <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider", toneOf(r.level))}>
                  {r.level === "med" ? "medium" : r.level}
                </span>
              </div>
              <p className="mt-3 text-sm text-foreground">{r.summary}</p>
              <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                {r.tips.map((t) => (
                  <li key={t} className="flex gap-1.5"><span className="text-primary">·</span>{t}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <aside className="space-y-6">
          <div className="rounded-2xl glass-panel p-6">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Emergency contacts</h3>
            </div>
            <ul className="mt-3 divide-y divide-border/60">
              {emergencyContacts.map((c) => (
                <li key={c.label} className="flex items-baseline justify-between py-2 text-sm">
                  <span>{c.label}</span>
                  <span className="font-semibold tabular-nums">{c.value}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-border/70 bg-gradient-to-br from-primary/5 to-accent/5 p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Auto-share on trip start</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Live location, hotel details, and the group WhatsApp share automatically with your two emergency contacts on Day 1.
            </p>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
