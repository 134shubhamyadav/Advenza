import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { AiBadge } from "@/components/ai/ai-badge";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Shield, Phone, ShieldAlert, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/risk")({ component: Risk });

const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

// Real India emergency numbers — not placeholder data
const INDIA_EMERGENCY = [
  { label: "Emergency (All)", value: "112" },
  { label: "Ambulance", value: "108" },
  { label: "Police", value: "100" },
  { label: "Fire", value: "101" },
  { label: "Tourist helpline", value: "1363" },
];

const toneOf = (l: "low" | "med" | "high") =>
  l === "high"
    ? "text-destructive bg-destructive/8 border-destructive/30"
    : l === "med"
      ? "text-[oklch(0.55_0.15_60)] bg-[oklch(0.78_0.16_75)]/12 border-[oklch(0.78_0.16_75)]/40"
      : "text-accent bg-accent/8 border-accent/30";

type RiskItem = {
  key: string;
  label: string;
  level: "low" | "med" | "high";
  summary: string;
  tips: string[];
};

type Trip = { _id: string; title: string; destination?: string };

function Risk() {
  const { user } = useAuth();
  const [risks, setRisks] = useState<RiskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [destination, setDestination] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    // First fetch trips to get the real destination
    apiFetch("/api/trips")
      .then(async (data: Trip[]) => {
        const trips = Array.isArray(data) ? data : [];
        const trip = trips.find((t) => t.destination) ?? trips[0] ?? null;
        const dest = trip?.destination ?? null;
        setDestination(dest);

        if (!dest) {
          setLoading(false);
          return;
        }

        // Then fetch risk analysis for the real destination
        const token = user ? await user.getIdToken() : null;
        const res = await fetch(`${BACKEND}/api/ai/risk`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ destination: dest }),
        });
        if (res.ok) {
          const riskData = await res.json();
          setRisks(riskData.risks ?? []);
        }
      })
      .catch((err) => console.error("Risk fetch error:", err))
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <AppShell
      title="AI Risk Radar"
      subtitle={
        destination
          ? `A calm, honest read on risks for ${destination}`
          : "Risk analysis for your trips"
      }
      actions={<AiBadge>Live AI Analysis</AiBadge>}
    >
      {loading ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-2xl glass-panel p-5 h-40" />
            ))}
          </div>
        </div>
      ) : !destination ? (
        <div className="flex flex-col items-center justify-center rounded-2xl glass-panel p-16 text-center">
          <ShieldAlert className="h-12 w-12 text-muted-foreground/30" />
          <p className="mt-4 text-lg font-semibold">No trip destination found</p>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Create a trip with a destination to get real-time AI risk analysis including weather,
            safety, crowd levels, and travel advisories.
          </p>
          <Button className="mt-6" asChild>
            <Link to="/trips/new">
              <Plus className="mr-1.5 h-4 w-4" />
              Create a trip
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="grid gap-4 sm:grid-cols-2">
            {risks.length === 0 ? (
              <div className="sm:col-span-2 rounded-2xl glass-panel p-10 text-center">
                <Shield className="mx-auto h-8 w-8 text-muted-foreground/40" />
                <p className="mt-3 text-muted-foreground">
                  No risk data available yet for {destination}.
                </p>
              </div>
            ) : (
              risks.map((r) => (
                <article key={r.key} className="rounded-2xl glass-panel p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/8 text-primary">
                        <Shield className="h-4 w-4" />
                      </span>
                      <h3 className="font-semibold">{r.label}</h3>
                    </div>
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                        toneOf(r.level),
                      )}
                    >
                      {r.level === "med" ? "medium" : r.level}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-foreground">{r.summary}</p>
                  <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                    {r.tips?.map((t) => (
                      <li key={t} className="flex gap-1.5">
                        <span className="text-primary">·</span>
                        {t}
                      </li>
                    ))}
                  </ul>
                </article>
              ))
            )}
          </div>

          <aside className="space-y-6">
            <div className="rounded-2xl glass-panel p-6">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">Emergency contacts</h3>
              </div>
              <ul className="mt-3 divide-y divide-border/60">
                {INDIA_EMERGENCY.map((c) => (
                  <li key={c.label} className="flex items-baseline justify-between py-2 text-sm">
                    <span>{c.label}</span>
                    <a
                      href={`tel:${c.value}`}
                      className="font-semibold tabular-nums text-primary hover:underline"
                    >
                      {c.value}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-border/70 bg-gradient-to-br from-primary/5 to-accent/5 p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                AI-powered analysis
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Risk levels are generated in real-time using AI analysis of your destination's
                current conditions, seasonal patterns, and travel advisories.
              </p>
            </div>
          </aside>
        </div>
      )}
    </AppShell>
  );
}
