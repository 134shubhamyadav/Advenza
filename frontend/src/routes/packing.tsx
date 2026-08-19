import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { AiBadge } from "@/components/ai/ai-badge";
import { Check, RefreshCw, Package, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { queryKeys } from "@/lib/queryKeys";

export const Route = createFileRoute("/packing")({ component: Packing });

type PackItem = { name: string; why: string };
type PackData = Record<string, PackItem[]>;
type Trip = {
  _id: string;
  title: string;
  destination?: string;
  startDate?: string;
  endDate?: string;
  style?: string;
};

function Packing() {
  const { user } = useAuth();
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const { data: trips = [], isLoading: loadingTrips } = useQuery<Trip[]>({
    queryKey: queryKeys.trips(),
    queryFn: async () => {
      const data = await apiFetch("/api/trips");
      return Array.isArray(data) ? (data as Trip[]) : [];
    },
    enabled: !!user,
  });

  const activeTrip = (selectedTripId ? trips.find((t) => t._id === selectedTripId) : trips[0]) ?? null;
  const destination = activeTrip?.destination ?? activeTrip?.title ?? "";

  const {
    data: packingData = {},
    isLoading: generating,
    refetch,
  } = useQuery<PackData>({
    queryKey: queryKeys.packingList(destination, activeTrip?.startDate, activeTrip?.endDate, activeTrip?.style),
    queryFn: async () => {
      if (!activeTrip || !destination) return {};
      const res = await apiFetch("/api/ai/packing", {
        method: "POST",
        body: JSON.stringify({
          destination,
          startDate: activeTrip.startDate ?? "",
          endDate: activeTrip.endDate ?? "",
          style: activeTrip.style ?? "Balanced",
        }),
      });
      return res || {};
    },
    enabled: !!activeTrip && !!destination,
    staleTime: 30 * 60 * 1000, // 30 minutes
  });

  const loading = loadingTrips;

  const groups = Object.keys(packingData);
  const total = groups.reduce((n, g) => n + packingData[g].length, 0);
  const done = Object.values(checked).filter(Boolean).length;

  return (
    <AppShell
      title="Smart Packing"
      subtitle={
        loading
          ? "Loading…"
          : !activeTrip
            ? "Select a trip to generate a packing list"
            : generating
              ? `AI is generating your packing list for ${activeTrip.destination ?? activeTrip.title}…`
              : total > 0
                ? `${done} of ${total} packed · AI list for ${activeTrip.destination ?? activeTrip.title}`
                : `Generating list for ${activeTrip.destination ?? activeTrip.title}…`
      }
      actions={
        activeTrip ? (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={generating}
            >
              <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", generating && "animate-spin")} />
              Regenerate
            </Button>
            <AiBadge>AI Generated</AiBadge>
          </div>
        ) : undefined
      }
    >
      {loading ? (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-2xl glass-panel p-5 h-48" />
          ))}
        </div>
      ) : trips.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl glass-panel p-16 text-center">
          <Package className="h-12 w-12 text-muted-foreground/30" />
          <p className="mt-4 text-lg font-semibold">No packing list yet</p>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Create a trip first — Advenza will automatically generate a smart packing list tailored
            to your destination, weather, and travel style.
          </p>
          <Button className="mt-6" asChild>
            <Link to="/trips/new">
              <Plus className="mr-1.5 h-4 w-4" />
              Create a trip
            </Link>
          </Button>
        </div>
      ) : generating || groups.length === 0 ? (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-2xl glass-panel p-5 h-48" />
          ))}
        </div>
      ) : (
        <>
          {/* Trip selector if multiple trips */}
          {trips.length > 1 && (
            <div className="mb-6 flex flex-wrap gap-2">
              {trips.map((t) => (
                <button
                  key={t._id}
                  onClick={() => setSelectedTripId(t._id)}
                  className={cn(
                    "rounded-xl border px-4 py-2 text-sm transition",
                    activeTrip?._id === t._id
                      ? "border-primary bg-primary/8 font-semibold"
                      : "border-border bg-background hover:border-primary/40",
                  )}
                >
                  {t.title}
                </button>
              ))}
            </div>
          )}
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {groups.map((g) => (
              <section key={g} className="rounded-2xl glass-panel p-5">
                <div className="mb-3 flex items-baseline justify-between">
                  <h3 className="font-semibold">{g}</h3>
                  <span className="text-xs text-muted-foreground">
                    {packingData[g].filter((_, i) => checked[`${g}:${i}`]).length}/
                    {packingData[g].length}
                  </span>
                </div>
                <ul className="space-y-2">
                  {packingData[g].map((item, i) => {
                    const key = `${g}:${i}`;
                    const on = !!checked[key];
                    return (
                      <li key={key}>
                        <button
                          onClick={() => setChecked((c) => ({ ...c, [key]: !c[key] }))}
                          className={cn(
                            "flex w-full gap-3 rounded-xl border p-3 text-left transition",
                            on
                              ? "border-accent/50 bg-accent/6"
                              : "border-border/60 bg-background/50 hover:border-primary/30",
                          )}
                        >
                          <span
                            className={cn(
                              "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border",
                              on
                                ? "border-accent bg-accent text-accent-foreground"
                                : "border-border",
                            )}
                          >
                            {on && <Check className="h-3 w-3" />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p
                              className={cn("text-sm font-medium", on && "line-through opacity-60")}
                            >
                              {item.name}
                            </p>
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
        </>
      )}
    </AppShell>
  );
}
