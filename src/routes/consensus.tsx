import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { AppShell } from "@/components/app-shell";
import { AiBadge } from "@/components/ai/ai-badge";
import { travelers, compatibility } from "@/lib/ai-engine";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/consensus")({ component: Consensus });

const CATS = ["food", "nature", "history", "nightlife", "adventure", "luxury", "walking"] as const;

function RadarChart({ values, size = 220 }: { values: number[]; size?: number }) {
  const cx = size / 2, cy = size / 2, r = size / 2 - 20;
  const angle = (i: number) => (Math.PI * 2 * i) / CATS.length - Math.PI / 2;
  const point = (v: number, i: number) => {
    const rr = (v / 100) * r;
    return [cx + Math.cos(angle(i)) * rr, cy + Math.sin(angle(i)) * rr] as const;
  };
  const pts = values.map((v, i) => point(v, i).join(",")).join(" ");
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {[0.25, 0.5, 0.75, 1].map((s) => (
        <polygon
          key={s}
          points={CATS.map((_, i) => {
            const [x, y] = point(100 * s, i);
            return `${x},${y}`;
          }).join(" ")}
          className="fill-none stroke-border"
          strokeDasharray="2 3"
        />
      ))}
      {CATS.map((_, i) => {
        const [x, y] = point(100, i);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} className="stroke-border" strokeDasharray="2 3" />;
      })}
      <polygon points={pts} className="fill-primary/20 stroke-primary" strokeWidth={2} />
      {CATS.map((c, i) => {
        const [x, y] = point(118, i);
        return (
          <text key={c} x={x} y={y} textAnchor="middle" className="fill-muted-foreground text-[10px] capitalize">
            {c}
          </text>
        );
      })}
    </svg>
  );
}

function Consensus() {
  const compat = compatibility();
  return (
    <AppShell
      title="Decision Engine"
      subtitle="Instead of majority voting, Aventra maximizes overlap across every traveler."
      actions={<AiBadge>Consensus, not voting</AiBadge>}
    >
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <div className="rounded-3xl glass-panel p-6 text-center">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Group compatibility</p>
          <p className="mt-3 font-display text-6xl text-accent">{compat.overall}%</p>
          <p className="mt-2 text-sm text-muted-foreground">
            of everyone's preferences are satisfied by the current itinerary.
          </p>
          <div className="mt-6 divide-y divide-border/60 rounded-xl border border-border/60 bg-background/50 text-left">
            {CATS.map((c) => (
              <div key={c} className="flex items-center justify-between px-3 py-2 text-sm capitalize">
                <span>{c}</span>
                <span className="tabular-nums text-muted-foreground">{compat.byCategory[c]}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {travelers.map((t, i) => {
            const values = CATS.map((c) => t.prefs[c]);
            return (
              <motion.article
                key={t.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-2xl glass-panel p-5"
              >
                <div className="flex items-center gap-3">
                  <span className={cn("grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br text-primary-foreground font-semibold", t.color)}>
                    {t.initials}
                  </span>
                  <div>
                    <p className="font-semibold leading-tight">{t.name}</p>
                    <p className="text-xs text-muted-foreground">Budget ₹{t.prefs.budget.toLocaleString("en-IN")}</p>
                  </div>
                </div>
                <div className="mt-3 grid place-items-center">
                  <RadarChart values={values} size={200} />
                </div>
              </motion.article>
            );
          })}
        </div>

        <div className="lg:col-span-2 rounded-2xl glass-panel p-6">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">How compromises were made</h3>
            <AiBadge>Explainable</AiBadge>
          </div>
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {[
              ["Nightlife dialed down to 45%", "Priya and Aditi wanted early mornings; Maya's nightlife score (65) is honored with one late-night lounge."],
              ["Luxury tier chosen: Comfort+", "Balances Arjun (45) with Maya (80). One splurge night at Taj kept everyone happy."],
              ["Walking cap set to 7 km/day", "Respects the lowest walker (Maya at 60) without shortchanging Arjun's hikes."],
              ["One vegetarian night added", "Aligns with Priya's preference; Aditi and Maya rated it as delightful, not compromise."],
            ].map(([k, v]) => (
              <li key={k} className="rounded-xl border border-border/60 bg-background/50 p-4">
                <p className="text-sm font-semibold">{k}</p>
                <p className="mt-1 text-xs text-muted-foreground">{v}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AppShell>
  );
}
