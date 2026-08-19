import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plane, Hotel, Utensils, MapPin, Camera, Plus } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { normalizeTimeTo24h } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ItinerarySearchSchema = {
  tripId?: string;
};

export const Route = createFileRoute("/itinerary")({
  validateSearch: (search: Record<string, unknown>): ItinerarySearchSchema => {
    return {
      tripId: (search.tripId as string) || undefined,
    };
  },
  component: Itinerary,
});

const GMAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const icons: Record<string, typeof Plane> = {
  transport: Plane,
  stay: Hotel,
  food: Utensils,
  activity: Camera,
};

type Activity = { time: string; description: string; type?: string; meta?: string };
type Day = { dayNumber: number; date?: string; title: string; activities: Activity[] };
type Trip = { _id: string; title: string; destination?: string; days?: Day[] };

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";

function Itinerary() {
  const { user } = useAuth();
  const { tripId } = Route.useSearch();
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);

  const { data: trips = [], isLoading: loading } = useQuery({
    queryKey: queryKeys.trips(),
    queryFn: async () => {
      const data = await apiFetch("/api/trips");
      return Array.isArray(data) ? (data as Trip[]) : [];
    },
    enabled: !!user,
  });

  const trip = (() => {
    const activeId = selectedTripId || tripId;
    if (activeId) {
      const found = trips.find((t) => t._id === activeId);
      if (found) return found;
    }
    return trips.find((t) => t.days && t.days.length > 0) ?? trips[0] ?? null;
  })();

  const handleSelectTrip = (id: string) => {
    setSelectedTripId(id);
    const url = new URL(window.location.href);
    url.searchParams.set("tripId", id);
    window.history.pushState({}, "", url.pathname + url.search);
  };

  const days = trip?.days ?? [];
  const totalActivities = days.reduce((a, d) => a + (d.activities?.length ?? 0), 0);

  const mapUrl =
    GMAPS_KEY && trip?.destination
      ? `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(trip.destination)}&zoom=13&size=640x320&scale=2&maptype=roadmap&style=element:geometry%7Ccolor:0x242f3e&style=element:labels.text.fill%7Ccolor:0x746855&style=element:labels.text.stroke%7Ccolor:0x242f3e&key=${GMAPS_KEY}`
      : null;

  return (
    <AppShell
      title="Itinerary"
      subtitle={
        loading
          ? "Loading your itinerary…"
          : trip
            ? `${trip.destination ?? trip.title} · ${days.length} day${days.length !== 1 ? "s" : ""} · ${totalActivities} activities`
            : "No itinerary yet"
      }
      actions={
        trips.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Select Trip:</span>
            <Select value={trip?._id || ""} onValueChange={handleSelectTrip}>
              <SelectTrigger className="w-[200px] bg-white/50 backdrop-blur-sm border-white/60">
                <SelectValue placeholder="Choose a trip" />
              </SelectTrigger>
              <SelectContent>
                {trips.map((t) => (
                  <SelectItem key={t._id} value={t._id}>
                    {t.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )
      }
    >
      {loading ? (
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-2xl glass-panel p-6 h-48" />
          ))}
        </div>
      ) : !trip || days.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl glass-panel p-16 text-center">
          <MapPin className="h-12 w-12 text-muted-foreground/30" />
          <p className="mt-4 text-lg font-semibold">No itinerary available yet</p>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Create a trip and let Advenza AI build your day-by-day itinerary automatically.
          </p>
          <Button className="mt-6" asChild>
            <Link to="/trips/new">
              <Plus className="mr-1.5 h-4 w-4" />
              Plan a trip
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            {days.map((d) => (
              <div key={d.dayNumber} className="rounded-2xl glass-panel p-6">
                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="font-display text-3xl text-primary">Day {d.dayNumber}</span>
                    <span className="ml-3 text-sm text-muted-foreground">
                      {d.date ? `${d.date} · ` : ""}
                      {d.title}
                    </span>
                  </div>
                  <Badge variant="secondary">{d.activities?.length ?? 0} activities</Badge>
                </div>
                <div className="mt-6 space-y-1">
                  {(d.activities ?? []).map((item, idx) => {
                    const Icon = item.type && icons[item.type] ? icons[item.type] : MapPin;
                    return (
                      <div key={idx} className="flex gap-4 rounded-xl px-3 py-3 hover:bg-muted/50">
                        <div className="w-20 shrink-0 text-sm font-semibold text-primary whitespace-nowrap">
                          {normalizeTimeTo24h(item.time)}
                        </div>
                        <div className="relative shrink-0">
                          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/8 text-primary">
                            <Icon className="h-4 w-4" />
                          </span>
                          {idx < (d.activities?.length ?? 0) - 1 && (
                            <span className="absolute left-1/2 top-9 h-full w-px -translate-x-1/2 bg-border" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1 pb-2">
                          <p className="font-medium">{item.description}</p>
                          {item.meta && (
                            <p className="text-xs text-muted-foreground">{item.meta}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-6">
            <div className="overflow-hidden rounded-2xl glass-panel">
              {mapUrl ? (
                <img
                  src={mapUrl}
                  alt={`Map of ${trip.destination}`}
                  className="h-56 w-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <div className="relative h-56 bg-gradient-to-br from-sky-500/20 via-primary/10 to-accent/20 flex items-center justify-center">
                  <p className="text-xs text-muted-foreground">
                    Add VITE_GOOGLE_MAPS_API_KEY to enable map
                  </p>
                </div>
              )}
              {trip.destination && (
                <div className="p-4">
                  <p className="text-sm font-medium">{trip.destination}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{days.length} days planned</p>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border/70 bg-gradient-to-br from-primary/5 to-accent/5 p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                AI-generated
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                This itinerary was crafted by Advenza AI based on your trip preferences and
                destination.
              </p>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
