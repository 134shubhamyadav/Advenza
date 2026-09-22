import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
<<<<<<< HEAD
import {
  Plane,
  Hotel,
  Utensils,
  MapPin,
  Camera,
  Plus,
  RotateCw,
  Calendar,
  Wallet,
  Users,
  Compass,
  Moon,
  Sparkles,
  Info,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { normalizeTimeTo24h, inr } from "@/lib/utils";
import { toast } from "sonner";
=======
import { Plane, Hotel, Utensils, MapPin, Camera, Plus } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { normalizeTimeTo24h } from "@/lib/utils";
>>>>>>> 6cf8129f1b59a8dafea26d19fadc7d6e6c81c6f4
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
<<<<<<< HEAD
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
=======
>>>>>>> 6cf8129f1b59a8dafea26d19fadc7d6e6c81c6f4

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

<<<<<<< HEAD
type Activity = { time: string; description: string; type?: string; meta?: string };
type Day = { dayNumber: number; date?: string; title: string; activities: Activity[] };
type Trip = {
  _id: string;
  title: string;
  destination?: string;
  summary?: string;
  budgetEstimate?: string;
  budgetTotal?: number;
  startDate?: string;
  endDate?: string;
  style?: string;
  interests?: string[];
  travelers?: number;
  travelMode?: string;
  hotelName?: string;
  hotelLocation?: string;
  days?: Day[];
};

const getActivityIcon = (desc: string) => {
  const lower = desc.toLowerCase();
  if (lower.includes("flight") || lower.includes("airport") || lower.includes("train") || lower.includes("bus") || lower.includes("cab") || lower.includes("journey") || lower.includes("transfer")) {
    return Plane;
  }
  if (lower.includes("hotel") || lower.includes("check in") || lower.includes("check-in") || lower.includes("stay") || lower.includes("resort") || lower.includes("freshen up")) {
    return Hotel;
  }
  if (lower.includes("dinner") || lower.includes("lunch") || lower.includes("breakfast") || lower.includes("café") || lower.includes("cafe") || lower.includes("food") || lower.includes("restaurant") || lower.includes("tasting")) {
    return Utensils;
  }
  if (lower.includes("night") || lower.includes("club") || lower.includes("pub") || lower.includes("bar") || lower.includes("rooftop") || lower.includes("bazaar")) {
    return Moon;
  }
  if (lower.includes("photo") || lower.includes("viewpoint") || lower.includes("sunset") || lower.includes("monument") || lower.includes("fort") || lower.includes("temple") || lower.includes("palace")) {
    return Camera;
  }
  return MapPin;
};
=======
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
>>>>>>> 6cf8129f1b59a8dafea26d19fadc7d6e6c81c6f4

function Itinerary() {
  const { user } = useAuth();
  const { tripId } = Route.useSearch();
<<<<<<< HEAD
  const queryClient = useQueryClient();
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);

  const { data: trips = [], isLoading: loading, isError } = useQuery({
=======
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);

  const { data: trips = [], isLoading: loading } = useQuery({
>>>>>>> 6cf8129f1b59a8dafea26d19fadc7d6e6c81c6f4
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

<<<<<<< HEAD
  const regenerateMutation = useMutation({
    mutationFn: async (targetTripId: string) => {
      return await apiFetch(`/api/ai/regenerate/${targetTripId}`, {
        method: "POST",
        body: JSON.stringify({}),
      });
    },
    onSuccess: (updatedTrip: Trip) => {
      toast.success("Itinerary refreshed with fresh AI suggestions!");
      queryClient.setQueryData(queryKeys.trips(), (old: Trip[] = []) =>
        old.map((t) => (t._id === updatedTrip._id ? updatedTrip : t))
      );
      queryClient.setQueryData(queryKeys.tripDetails(updatedTrip._id), updatedTrip);
    },
    onError: (err: any) => {
      console.error("Regenerate error:", err);
      toast.error(err.message || "Failed to regenerate itinerary. Please try again.");
    },
  });

  const handleRegenerate = () => {
    if (!trip?._id) return;
    regenerateMutation.mutate(trip._id);
  };

=======
>>>>>>> 6cf8129f1b59a8dafea26d19fadc7d6e6c81c6f4
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
<<<<<<< HEAD
        <div className="flex flex-wrap items-center gap-2">
          {trips.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground hidden sm:inline">Trip:</span>
              <Select value={trip?._id || ""} onValueChange={handleSelectTrip}>
                <SelectTrigger className="w-[180px] sm:w-[220px] bg-white/50 backdrop-blur-sm border-white/60">
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
          )}
          {trip && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerate}
              disabled={regenerateMutation.isPending}
              className="gap-1.5 shadow-sm"
            >
              <RotateCw
                className={`h-3.5 w-3.5 ${regenerateMutation.isPending ? "animate-spin text-primary" : ""}`}
              />
              <span className="hidden sm:inline">
                {regenerateMutation.isPending ? "Regenerating..." : "Regenerate"}
              </span>
            </Button>
          )}
        </div>
=======
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
>>>>>>> 6cf8129f1b59a8dafea26d19fadc7d6e6c81c6f4
      }
    >
      {loading ? (
        <div className="space-y-6">
<<<<<<< HEAD
          <div className="h-28 rounded-2xl glass-panel animate-pulse" />
=======
>>>>>>> 6cf8129f1b59a8dafea26d19fadc7d6e6c81c6f4
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-2xl glass-panel p-6 h-48" />
          ))}
        </div>
<<<<<<< HEAD
      ) : isError ? (
        <div className="flex flex-col items-center justify-center rounded-2xl glass-panel p-16 text-center">
          <Info className="h-12 w-12 text-destructive/80" />
          <p className="mt-4 text-lg font-semibold">Failed to load itinerary</p>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            There was a problem retrieving your trip details.
          </p>
          <Button className="mt-6" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
=======
>>>>>>> 6cf8129f1b59a8dafea26d19fadc7d6e6c81c6f4
      ) : !trip || days.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl glass-panel p-16 text-center">
          <MapPin className="h-12 w-12 text-muted-foreground/30" />
          <p className="mt-4 text-lg font-semibold">No itinerary available yet</p>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
<<<<<<< HEAD
            Create a trip and let Advenza AI build your personalized, day-by-day itinerary automatically.
=======
            Create a trip and let Advenza AI build your day-by-day itinerary automatically.
>>>>>>> 6cf8129f1b59a8dafea26d19fadc7d6e6c81c6f4
          </p>
          <Button className="mt-6" asChild>
            <Link to="/trips/new">
              <Plus className="mr-1.5 h-4 w-4" />
              Plan a trip
            </Link>
          </Button>
        </div>
      ) : (
<<<<<<< HEAD
        <div className="space-y-6">
          {/* Trip Summary Card */}
          <div className="rounded-2xl glass-panel p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                    <Sparkles className="mr-1 h-3 w-3" /> AI Tailored
                  </Badge>
                  {trip.style && <Badge variant="secondary">{trip.style} Pace</Badge>}
                </div>
                <h2 className="mt-2 font-display text-2xl md:text-3xl">{trip.title}</h2>
                {trip.summary && (
                  <p className="mt-1.5 text-sm text-muted-foreground max-w-3xl leading-relaxed">
                    {trip.summary}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 border-t border-border/50 pt-4">
              {trip.destination && (
                <div className="flex items-center gap-2.5">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Destination</p>
                    <p className="text-xs font-semibold">{trip.destination}</p>
                  </div>
                </div>
              )}

              {trip.startDate && trip.endDate && (
                <div className="flex items-center gap-2.5">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Dates</p>
                    <p className="text-xs font-semibold">
                      {trip.startDate} → {trip.endDate}
                    </p>
                  </div>
                </div>
              )}

              {trip.budgetTotal ? (
                <div className="flex items-center gap-2.5">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Wallet className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Budget</p>
                    <p className="text-xs font-semibold">{inr(trip.budgetTotal)}</p>
                  </div>
                </div>
              ) : null}

              {trip.travelers ? (
                <div className="flex items-center gap-2.5">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Users className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Travelers</p>
                    <p className="text-xs font-semibold">
                      {trip.travelers} {trip.travelers === 1 ? "person" : "people"}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>

            {trip.interests && trip.interests.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5 pt-2">
                {trip.interests.map((interest) => (
                  <Badge key={interest} variant="outline" className="text-xs bg-muted/30">
                    {interest}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Itinerary Days Grid */}
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="space-y-6">
              {days.map((d) => (
                <div key={d.dayNumber} className="rounded-2xl glass-panel p-6 transition-all hover:border-primary/30">
                  <div className="flex items-baseline justify-between border-b border-border/50 pb-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="font-display text-2xl md:text-3xl text-primary">
                          Day {d.dayNumber}
                        </span>
                        {d.date && (
                          <Badge variant="secondary" className="font-mono text-xs">
                            {d.date}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-sm font-medium text-foreground/90">{d.title}</p>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {d.activities?.length ?? 0} activities
                    </Badge>
                  </div>

                  <div className="mt-5 space-y-1">
                    {(d.activities ?? []).map((item, idx) => {
                      const Icon = getActivityIcon(item.description);
                      return (
                        <div
                          key={idx}
                          className="group flex gap-4 rounded-xl px-3 py-3 transition hover:bg-muted/50"
                        >
                          <div className="w-16 sm:w-20 shrink-0 font-mono text-xs sm:text-sm font-semibold text-primary pt-0.5 whitespace-nowrap">
                            {normalizeTimeTo24h(item.time)}
                          </div>
                          <div className="relative shrink-0">
                            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                              <Icon className="h-4 w-4" />
                            </span>
                            {idx < (d.activities?.length ?? 0) - 1 && (
                              <span className="absolute left-1/2 top-9 h-full w-px -translate-x-1/2 bg-border/80" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1 pb-3">
                            <p className="text-sm font-medium leading-relaxed">{item.description}</p>
                            {item.meta && (
                              <p className="mt-1 text-xs text-muted-foreground">{item.meta}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Sidebar */}
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
                  <div className="relative h-56 bg-gradient-to-br from-sky-500/20 via-primary/10 to-accent/20 flex flex-col items-center justify-center p-4 text-center">
                    <Compass className="h-8 w-8 text-primary/60 mb-2" />
                    <p className="text-xs font-medium text-foreground/80">{trip.destination}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{days.length} days planned</p>
                  </div>
                )}
                {trip.destination && (
                  <div className="p-4 border-t border-border/50">
                    <p className="text-sm font-medium">{trip.destination}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {days.length} days · {totalActivities} activities scheduled
                    </p>
                  </div>
                )}
              </div>

              {trip.budgetEstimate && (
                <div className="rounded-2xl glass-panel p-5">
                  <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-wider">
                    <Wallet className="h-3.5 w-3.5" /> Budget Overview
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                    {trip.budgetEstimate}
                  </p>
                </div>
              )}

              {trip.hotelLocation && (
                <div className="rounded-2xl glass-panel p-5">
                  <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-wider">
                    <Hotel className="h-3.5 w-3.5" /> Stay & Hub Anchor
                  </div>
                  <p className="mt-2 text-xs font-medium">{trip.hotelName || "Hotel Anchor"}</p>
                  <p className="text-xs text-muted-foreground">{trip.hotelLocation}</p>
                </div>
              )}

              <div className="rounded-2xl border border-border/70 bg-gradient-to-br from-primary/5 to-accent/5 p-5">
                <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-wider">
                  <Sparkles className="h-3.5 w-3.5" /> Dynamic Planning
                </div>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                  Need fresh suggestions or alternative attractions? Click <strong>Regenerate</strong> at the top right to explore new variations anytime.
                </p>
              </div>
=======
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
>>>>>>> 6cf8129f1b59a8dafea26d19fadc7d6e6c81c6f4
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
<<<<<<< HEAD
export default Itinerary;
=======
>>>>>>> 6cf8129f1b59a8dafea26d19fadc7d6e6c81c6f4
