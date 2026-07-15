import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { AppShell } from "@/components/app-shell";
import { AiBadge } from "@/components/ai/ai-badge";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Users, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/consensus")({ component: Consensus });

const CATS = ["food", "nature", "history", "nightlife", "adventure", "luxury", "walking"] as const;

type Member = {
  name: string;
  email?: string;
  initials: string;
};

type Trip = {
  _id: string;
  title: string;
  members?: Member[];
};

function RadarChart({ values, size = 220 }: { values: number[]; size?: number }) {
  const cx = size / 2,
    cy = size / 2,
    r = size / 2 - 20;
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
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            className="stroke-border"
            strokeDasharray="2 3"
          />
        );
      })}
      <polygon points={pts} className="fill-primary/20 stroke-primary" strokeWidth={2} />
      {CATS.map((c, i) => {
        const [x, y] = point(118, i);
        return (
          <text
            key={c}
            x={x}
            y={y}
            textAnchor="middle"
            className="fill-muted-foreground text-[10px] capitalize"
          >
            {c}
          </text>
        );
      })}
    </svg>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function Consensus() {
  const { user } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    apiFetch("/api/trips")
      .then((data) => setTrips(Array.isArray(data) ? data : []))
      .catch(() => setTrips([]))
      .finally(() => setLoading(false));
  }, [user]);

  // Pick the first trip that has members
  const activeTrip = trips.find((t) => t.members && t.members.length > 0) ?? trips[0] ?? null;
  const members: Member[] = activeTrip?.members ?? [];

  const colors = [
    "from-primary to-accent",
    "from-accent to-primary",
    "from-secondary to-accent",
    "from-primary to-secondary",
  ];

  return (
    <AppShell
      title="Decision Engine"
      subtitle="Instead of majority voting, Aventra maximizes overlap across every traveler."
      actions={<AiBadge>Consensus, not voting</AiBadge>}
    >
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-2xl glass-panel h-64" />
          ))}
        </div>
      ) : members.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl glass-panel p-16 text-center">
          <Users className="h-12 w-12 text-muted-foreground/30" />
          <p className="mt-4 text-lg font-semibold">No group trip found</p>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Invite friends to a trip to see consensus data — Aventra will show how well everyone's
            preferences align across food, nature, nightlife, and more.
          </p>
          <Button className="mt-6" asChild>
            <Link to="/trips/new">
              <Plus className="mr-1.5 h-4 w-4" />
              Create a group trip
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          <div className="rounded-3xl glass-panel p-6 text-center">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Group size</p>
            <p className="mt-3 font-display text-6xl text-accent">{members.length}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              traveler{members.length !== 1 ? "s" : ""} in {activeTrip?.title ?? "your trip"}
            </p>
            <div className="mt-6 divide-y divide-border/60 rounded-xl border border-border/60 bg-background/50 text-left">
              {members.map((m) => (
                <div key={m.name} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span
                    className={cn(
                      "grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br text-primary-foreground text-xs font-semibold",
                      colors[0],
                    )}
                  >
                    {initials(m.name)}
                  </span>
                  <span>{m.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {members.map((m, i) => {
              // Placeholder radar values until preference data is collected
              const values = CATS.map(() => 50);
              return (
                <motion.article
                  key={m.name}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="rounded-2xl glass-panel p-5"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br text-primary-foreground font-semibold",
                        colors[i % colors.length],
                      )}
                    >
                      {initials(m.name)}
                    </span>
                    <div>
                      <p className="font-semibold leading-tight">{m.name}</p>
                      <p className="text-xs text-muted-foreground">Preferences not yet set</p>
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
              <h3 className="font-semibold">Group preferences</h3>
              <AiBadge>Explainable</AiBadge>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              As members set their travel preferences, Aventra will automatically surface
              compromises and show which activities maximize group satisfaction.
            </p>
          </div>
        </div>
      )}
    </AppShell>
  );
}
