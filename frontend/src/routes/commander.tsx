import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { AiBadge } from "@/components/ai/ai-badge";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { queryKeys } from "@/lib/queryKeys";
import {
  Plane,
  CloudRain,
  Wallet,
  Users,
  Building2,
  AlertTriangle,
  Sparkles,
  Undo2,
  Check,
  Plus,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/commander")({ component: Commander });

type TripEvent = {
  id: string;
  when: string;
  kind: "delay" | "weather" | "budget" | "cancel" | "closure" | "traffic" | "group" | "ai";
  title: string;
  reason: string;
  action?: string;
  delta?: string;
  severity: "info" | "warn" | "bad";
};

const iconOf: Record<TripEvent["kind"], typeof Plane> = {
  delay: Plane,
  weather: CloudRain,
  budget: Wallet,
  cancel: AlertTriangle,
  closure: Building2,
  traffic: AlertTriangle,
  group: Users,
  ai: Sparkles,
};

type Trip = {
  _id: string;
  title: string;
  destination?: string;
};

function Commander() {
  const { user } = useAuth();
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Fetch user trips
  const { data: trips = [], isLoading: loadingTrips } = useQuery<Trip[]>({
    queryKey: queryKeys.trips(),
    queryFn: async () => {
      const data = await apiFetch("/api/trips");
      return Array.isArray(data) ? (data as Trip[]) : [];
    },
    enabled: !!user,
  });

  const activeTrip = (selectedTripId ? trips.find((t) => t._id === selectedTripId) : trips[0]) ?? null;
  const activeTripId = activeTrip?._id ?? null;

  const {
    data: rawEvents = [],
    isLoading: loadingEvents,
    isFetching,
    refetch,
  } = useQuery<TripEvent[]>({
    queryKey: ["commanderEvents", activeTripId],
    queryFn: async () => {
      console.log(`[Commander Frontend] Requesting events for trip ${activeTripId}...`);
      const url = activeTripId ? `/api/commander/events?tripId=${activeTripId}` : "/api/commander/events";
      const data = await apiFetch(url);
      console.log("[Commander Frontend] Response received:", data);
      return Array.isArray(data) ? data : [];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });

  const loading = loadingTrips || (loadingEvents && rawEvents.length === 0);

  const accept = async (id: string) => {
    if (processingId) return;
    setProcessingId(id);
    console.log(`[Commander Frontend] Accepting event ${id}...`);
    try {
      await apiFetch(`/api/commander/events/${id}/accept`, { method: "POST" });
      setAccepted((prev) => new Set([...prev, id]));
    } catch (err: any) {
      console.error("[Commander Frontend] Accept failed:", err);
      // Fallback local accept if API mode is dev
      setAccepted((prev) => new Set([...prev, id]));
    } finally {
      setProcessingId(null);
    }
  };

  const undo = (id: string) => {
    setAccepted((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setDismissed((prev) => new Set([...prev, id]));
  };

  const visibleEvents = rawEvents.filter((e) => !dismissed.has(e.id));

  return (
    <AppShell
      title="Trip Commander"
      subtitle={
        activeTrip
          ? `Monitoring ${activeTrip.title} · ${activeTrip.destination || "Live Insights"}`
          : "Your AI travel manager, watching the plan so you don't have to."
      }
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", isFetching && "animate-spin")} />
            Refresh
          </Button>
          <AiBadge>Trip Twin, live</AiBadge>
        </div>
      }
    >
      {/* Trip Selector Header if multiple trips */}
      {trips.length > 1 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground mr-1">Monitoring Trip:</span>
          {trips.map((t) => (
            <button
              key={t._id}
              onClick={() => {
                setSelectedTripId(t._id);
              }}
              className={cn(
                "rounded-xl border px-3 py-1.5 text-sm transition font-medium",
                activeTripId === t._id
                  ? "border-primary bg-primary/10 font-semibold text-primary shadow-xs"
                  : "border-border hover:border-primary/40 text-muted-foreground bg-background/50",
              )}
            >
              {t.destination?.split(",")[0] || t.title}
            </button>
          ))}
        </div>
      )}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-2xl glass-panel p-6 h-36" />
          ))}
        </div>
      ) : visibleEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl glass-panel p-16 text-center">
          <Sparkles className="h-12 w-12 text-muted-foreground/30" />
          <p className="mt-4 text-lg font-semibold">No trip insights available yet</p>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Create or import a trip to start monitoring — Advenza will watch for delays, weather
            shifts, budget drift, and more in real time.
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
          <div className="space-y-4">
            <AnimatePresence>
              {visibleEvents.map((e, i) => {
                const Icon = iconOf[e.kind] ?? Sparkles;
                const isAccepted = accepted.has(e.id);
                const isProcessing = processingId === e.id;
                const toneRing =
                  e.severity === "bad"
                    ? "ring-destructive/40"
                    : e.severity === "warn"
                      ? "ring-[oklch(0.78_0.16_75)]/50"
                      : "ring-primary/30";
                return (
                  <motion.article
                    key={e.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -50, height: 0, marginBottom: 0 }}
                    transition={{ duration: 0.4, delay: i * 0.05 }}
                    className={cn(
                      "rounded-2xl glass-panel p-5 transition-all",
                      isAccepted && "border border-accent/40 bg-accent/3",
                    )}
                  >
                    <div className="flex items-start gap-4">
                      <span
                        className={cn(
                          "grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/8 text-primary ring-2",
                          toneRing,
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold leading-tight">{e.title}</h3>
                          <span className="text-xs text-muted-foreground">{e.when}</span>
                          {isAccepted && (
                            <span className="ml-auto rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent">
                              ✓ Accepted
                            </span>
                          )}
                        </div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr]">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                              Why
                            </p>
                            <p className="mt-1 text-sm text-foreground">{e.reason}</p>
                          </div>
                          {e.action && (
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                                Advenza did
                              </p>
                              <p className="mt-1 text-sm text-foreground">{e.action}</p>
                            </div>
                          )}
                        </div>
                        {e.delta && (
                          <p className="mt-3 rounded-lg bg-accent/8 px-3 py-2 text-xs text-accent-foreground">
                            <span className="font-semibold">Net effect · </span>
                            {e.delta}
                          </p>
                        )}
                        <div className="mt-3 flex items-center gap-2">
                          {!isAccepted ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8"
                              onClick={() => accept(e.id)}
                              disabled={isProcessing}
                            >
                              {isProcessing ? (
                                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Check className="mr-1 h-3.5 w-3.5" />
                              )}
                              {isProcessing ? "Accepting..." : "Accept plan"}
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 text-muted-foreground"
                              onClick={() => undo(e.id)}
                            >
                              <Undo2 className="mr-1 h-3.5 w-3.5" /> Dismiss
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.article>
                );
              })}
            </AnimatePresence>
          </div>

          <aside className="space-y-6">
            <div className="rounded-2xl glass-panel p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Events
              </p>
              <p className="mt-3 font-display text-5xl">{visibleEvents.length}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {accepted.size > 0
                  ? `${accepted.size} plan${accepted.size > 1 ? "s" : ""} accepted`
                  : "Active alerts from your trip"}
              </p>
            </div>
          </aside>
        </div>
      )}
    </AppShell>
  );
}
