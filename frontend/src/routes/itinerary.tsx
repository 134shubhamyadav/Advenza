import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Plane,
  Train,
  Bus,
  Car,
  Ship,
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
  Clock,
  ArrowRight,
  ShieldCheck,
  CloudSun,
  Sunrise,
  Sunset,
  CheckCircle2,
  HelpCircle,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { 
  normalizeTimeTo24h, 
  inr, 
  formatDurationMinutes, 
  getDurationStatusBadge,
  calculateInclusiveDays
} from "@/lib/utils";
import { BudgetEstimateCard } from "@/components/budget/budget-estimate-card";
import type { TripSummary, DayTimingWindow, JourneyLeg } from "@/services/tripService";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";

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

const getTransportIcon = (type?: string) => {
  const lower = (type || "").toLowerCase();
  if (lower.includes("train") || lower.includes("rail")) return Train;
  if (lower.includes("bus")) return Bus;
  if (lower.includes("car") || lower.includes("drive") || lower.includes("cab") || lower.includes("taxi")) return Car;
  if (lower.includes("ferry") || lower.includes("boat") || lower.includes("ship")) return Ship;
  return Plane;
};

const getActivityIcon = (desc: string) => {
  const lower = desc.toLowerCase();
  if (
    lower.includes("flight") ||
    lower.includes("airport") ||
    lower.includes("train") ||
    lower.includes("station") ||
    lower.includes("bus") ||
    lower.includes("cab") ||
    lower.includes("journey") ||
    lower.includes("travel to") ||
    lower.includes("return journey") ||
    lower.includes("transit") ||
    lower.includes("depart") ||
    lower.includes("arrival") ||
    lower.includes("arrive at")
  ) {
    return Plane;
  }
  if (
    lower.includes("hotel") ||
    lower.includes("check in") ||
    lower.includes("check-in") ||
    lower.includes("checkout") ||
    lower.includes("check-out") ||
    lower.includes("stay") ||
    lower.includes("resort") ||
    lower.includes("freshen up") ||
    lower.includes("settle in") ||
    lower.includes("unpack")
  ) {
    return Hotel;
  }
  if (
    lower.includes("dinner") ||
    lower.includes("lunch") ||
    lower.includes("breakfast") ||
    lower.includes("café") ||
    lower.includes("cafe") ||
    lower.includes("food") ||
    lower.includes("restaurant") ||
    lower.includes("tasting") ||
    lower.includes("street food") ||
    lower.includes("snack") ||
    lower.includes("thali") ||
    lower.includes("meal")
  ) {
    return Utensils;
  }
  if (
    lower.includes("night") ||
    lower.includes("club") ||
    lower.includes("pub") ||
    lower.includes("bar") ||
    lower.includes("rooftop") ||
    lower.includes("bazaar") ||
    lower.includes("evening walk")
  ) {
    return Moon;
  }
  if (
    lower.includes("photo") ||
    lower.includes("viewpoint") ||
    lower.includes("sunset") ||
    lower.includes("sunrise") ||
    lower.includes("monument") ||
    lower.includes("fort") ||
    lower.includes("temple") ||
    lower.includes("palace") ||
    lower.includes("museum") ||
    lower.includes("beach") ||
    lower.includes("explore") ||
    lower.includes("sightseeing")
  ) {
    return Camera;
  }
  return MapPin;
};

function formatIsoTimeToHHMM(isoStr?: string): string {
  if (!isoStr) return "";
  try {
    if (isoStr.includes("T")) {
      const timePart = isoStr.split("T")[1];
      return timePart.substring(0, 5);
    }
    return normalizeTimeTo24h(isoStr);
  } catch {
    return "";
  }
}

function getDayTimingBadgeConfig(window?: DayTimingWindow, dayNumber?: number) {
  if (!window || !window.status) {
    return {
      label: "Full Exploration Day",
      variant: "default",
      hours: null,
      description: "Exploration day",
    };
  }

  const status = window.status;
  const startTime = formatIsoTimeToHHMM(window.usableStartDateTime);
  const endTime = formatIsoTimeToHHMM(window.usableEndDateTime);
  const hrs = window.availableHours != null ? `${window.availableHours}h` : "";

  switch (status) {
    case "TRAVEL_OUTBOUND":
      return {
        label: "🚆 Outbound Travel",
        variant: "amber",
        hours: "0h sightseeing",
        description: "Travel consumes this day · No destination activities",
      };
    case "ARRIVAL_DAY":
      return {
        label: "🛬 Arrival & Settling",
        variant: "blue",
        hours: hrs ? `${hrs} usable` : "",
        description: startTime ? `Exploration starts ~${startTime}` : "Exploration begins after arrival",
      };
    case "FULL_DESTINATION_DAY":
      return {
        label: "☀️ Full Sightseeing",
        variant: "emerald",
        hours: hrs ? `${hrs} usable` : "Full Day",
        description: "Full day available for exploration",
      };
    case "RETURN_DAY":
      return {
        label: "🛫 Return Day",
        variant: "orange",
        hours: hrs ? `${hrs} usable` : "",
        description: endTime ? `Sightseeing cutoff ~${endTime}` : "Sightseeing wraps up for return departure",
      };
    case "TRAVEL_RETURN":
      return {
        label: "🚆 Return Travel",
        variant: "purple",
        hours: "0h sightseeing",
        description: "Return travel day",
      };
    default:
      return {
        label: "Sightseeing Day",
        variant: "default",
        hours: hrs,
        description: window.reason || "Exploration day",
      };
  }
}

function Itinerary() {
  const { user } = useAuth();
  const { tripId } = Route.useSearch();
  const queryClient = useQueryClient();
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);

  const { data: trips = [], isLoading: loading, isError } = useQuery({
    queryKey: queryKeys.trips(),
    queryFn: async () => {
      const data = await apiFetch("/api/trips");
      return Array.isArray(data) ? (data as TripSummary[]) : [];
    },
    enabled: !!user,
  });

  const trip: TripSummary | null = (() => {
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

  const regenerateMutation = useMutation({
    mutationFn: async (targetTripId: string) => {
      return await apiFetch(`/api/ai/regenerate/${targetTripId}`, {
        method: "POST",
        body: JSON.stringify({}),
      });
    },
    onSuccess: (updatedTrip: TripSummary) => {
      toast.success("Itinerary refreshed with fresh travel-aware AI suggestions!");
      queryClient.setQueryData(queryKeys.trips(), (old: TripSummary[] = []) =>
        old.map((t) => (t._id === updatedTrip._id ? updatedTrip : t))
      );
      queryClient.setQueryData(queryKeys.tripDetails(updatedTrip._id), updatedTrip);
    },
    onError: (err: Error) => {
      console.error("Regenerate error:", err);
      toast.error(err.message || "Failed to regenerate itinerary. Please try again.");
    },
  });

  const handleRegenerate = () => {
    if (!trip?._id) return;
    regenerateMutation.mutate(trip._id);
  };

  const days = trip?.days ?? [];
  const totalActivities = days.reduce((a, d) => a + (d.activities?.length ?? 0), 0);
  const calendarDays = calculateInclusiveDays(trip?.startDate, trip?.endDate);

  const outboundLeg = trip?.outboundJourney;
  const returnLeg = trip?.returnJourney;
  const timing = trip?.tripTiming;

  const outboundDuration = outboundLeg?.durationMinutes ?? timing?.outbound?.durationMinutes;
  const returnDuration = returnLeg?.durationMinutes ?? timing?.return?.durationMinutes;
  const totalUsableHours = timing?.destination?.totalUsableHours;

  const outboundStatus = getDurationStatusBadge(
    outboundLeg?.status,
    outboundLeg?.durationSource,
    outboundLeg?.booked
  );
  const returnStatus = getDurationStatusBadge(
    returnLeg?.status,
    returnLeg?.durationSource,
    returnLeg?.booked
  );

  const OutboundIcon = getTransportIcon(outboundLeg?.transportType || trip?.travelMode);
  const ReturnIcon = getTransportIcon(returnLeg?.transportType || outboundLeg?.transportType || trip?.travelMode);

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
      }
    >
      {loading ? (
        <div className="space-y-6">
          <div className="h-32 rounded-2xl glass-panel animate-pulse" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-2xl glass-panel p-6 h-48" />
          ))}
        </div>
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
      ) : !trip || days.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl glass-panel p-16 text-center">
          <MapPin className="h-12 w-12 text-muted-foreground/30" />
          <p className="mt-4 text-lg font-semibold">No itinerary available yet</p>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Create a trip and let Advenza AI build your personalized, day-by-day itinerary automatically.
          </p>
          <Button className="mt-6" asChild>
            <Link to="/trips/new">
              <Plus className="mr-1.5 h-4 w-4" />
              Plan a trip
            </Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Trip Summary & Journey Intelligence Card */}
          <div className="rounded-2xl glass-panel p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                    <Sparkles className="mr-1 h-3 w-3" /> Travel-Aware AI
                  </Badge>
                  {trip.style && <Badge variant="secondary">{trip.style} Pace</Badge>}
                  {trip.origin && trip.destination && (
                    <Badge variant="outline" className="font-mono text-xs bg-muted/40">
                      {trip.origin} → {trip.destination}
                    </Badge>
                  )}
                </div>
                <h2 className="mt-2.5 font-display text-2xl md:text-3xl">{trip.title}</h2>
                {trip.summary && (
                  <p className="mt-1.5 text-sm text-muted-foreground max-w-3xl leading-relaxed">
                    {trip.summary}
                  </p>
                )}
              </div>
            </div>

            {/* Travel Intelligence & Usable Sightseeing Time Strip */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 border-t border-border/50 pt-4">
              {/* Outbound Travel Leg */}
              <div className="rounded-xl border border-border/70 bg-background/50 p-3.5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wide">
                    <OutboundIcon className="h-3.5 w-3.5 text-primary" /> Outbound Travel
                  </span>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                    outboundStatus.variant === "confirmed"
                      ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                      : outboundStatus.variant === "estimated"
                        ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                        : "bg-muted text-muted-foreground"
                  }`}>
                    {outboundStatus.label}
                  </span>
                </div>
                <p className="text-sm font-semibold text-foreground">
                  {trip.origin || outboundLeg?.departureLocation || "Origin"} → {trip.destination || outboundLeg?.arrivalLocation || "Destination"}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{outboundLeg?.transportType || trip.travelMode || "Transit"}</span>
                  {outboundDuration && (
                    <>
                      <span>·</span>
                      <span className="font-medium text-foreground">{formatDurationMinutes(outboundDuration)}</span>
                    </>
                  )}
                  {timing?.outbound?.isOvernight && (
                    <>
                      <span>·</span>
                      <span className="text-indigo-500 font-medium">🌙 Overnight</span>
                    </>
                  )}
                </div>
              </div>

              {/* Usable Destination Sightseeing Time */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-primary flex items-center gap-1.5 uppercase tracking-wide">
                    <Clock className="h-3.5 w-3.5" /> Destination Usable Time
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    {calendarDays} Calendar Days
                  </span>
                </div>
                <p className="text-sm font-bold text-foreground">
                  {totalUsableHours != null ? `${totalUsableHours} usable sightseeing hours` : `${days.length} exploration days`}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Protected exploration window (travel times excluded from sightseeing).
                </p>
              </div>

              {/* Return Travel Leg (if specified) */}
              {returnLeg && (returnLeg.booked || returnLeg.departureTime || returnLeg.transportType) ? (
                <div className="rounded-xl border border-border/70 bg-background/50 p-3.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wide">
                      <ReturnIcon className="h-3.5 w-3.5 text-primary" /> Return Journey
                    </span>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      returnStatus.variant === "confirmed"
                        ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                        : returnStatus.variant === "estimated"
                          ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                          : "bg-muted text-muted-foreground"
                    }`}>
                      {returnStatus.label}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    {returnLeg.departureLocation || trip.destination} → {returnLeg.arrivalLocation || trip.origin || "Home"}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{returnLeg.transportType || outboundLeg?.transportType || trip.travelMode || "Transit"}</span>
                    {returnDuration && (
                      <>
                        <span>·</span>
                        <span className="font-medium text-foreground">{formatDurationMinutes(returnDuration)}</span>
                      </>
                    )}
                    {timing?.return?.isOvernight && (
                      <>
                        <span>·</span>
                        <span className="text-indigo-500 font-medium">🌙 Overnight</span>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-border/70 bg-background/50 p-3.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wide">
                      <Calendar className="h-3.5 w-3.5 text-primary" /> Trip Dates
                    </span>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {days.length} Days Planned
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    {trip.startDate} → {trip.endDate}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {trip.travelers ? `${trip.travelers} traveler(s)` : "1 traveler"} · {trip.budgetTotal ? inr(trip.budgetTotal) : "Flexible budget"}
                  </p>
                </div>
              )}
            </div>

            {/* Interest Tags */}
            {trip.interests && trip.interests.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-xs text-muted-foreground mr-1">Interests:</span>
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
              {days.map((d, dayIndex) => {
                // Find matching timing window from tripTiming.destination.days
                const dayWindow: DayTimingWindow | undefined = 
                  timing?.destination?.days?.find((w) => w.date === d.date) ??
                  timing?.destination?.days?.[dayIndex];

                const timingBadge = getDayTimingBadgeConfig(dayWindow, d.dayNumber);

                return (
                  <div key={d.dayNumber} className="rounded-2xl glass-panel p-6 transition-all hover:border-primary/30 space-y-4">
                    {/* Day Header with Timing Window Status */}
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/50 pb-4">
                      <div>
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-display text-2xl md:text-3xl text-primary">
                            Day {d.dayNumber}
                          </span>
                          {d.date && (
                            <Badge variant="secondary" className="font-mono text-xs">
                              {d.date}
                            </Badge>
                          )}
                          {/* Day Timing Window Badge */}
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                            timingBadge.variant === "amber"
                              ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                              : timingBadge.variant === "blue"
                                ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                                : timingBadge.variant === "emerald"
                                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                  : timingBadge.variant === "orange"
                                    ? "bg-orange-500/10 text-orange-600 border-orange-500/20"
                                    : timingBadge.variant === "purple"
                                      ? "bg-purple-500/10 text-purple-600 border-purple-500/20"
                                      : "bg-muted/50 text-foreground border-border"
                          }`}>
                            {timingBadge.label} {timingBadge.hours ? `· ${timingBadge.hours}` : ""}
                          </span>
                        </div>
                        <p className="mt-1.5 text-sm font-semibold text-foreground/90">{d.title}</p>
                        {timingBadge.description && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">{timingBadge.description}</p>
                        )}
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0 bg-background/50">
                        {d.activities?.length ?? 0} activities
                      </Badge>
                    </div>

                    {/* Activities List */}
                    <div className="space-y-1">
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
                              {item.interestTags && item.interestTags.length > 0 && (
                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                  {item.interestTags.map((tag, tIdx) => (
                                    <span
                                      key={tIdx}
                                      className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {item.meta && (
                                <p className="mt-1 text-xs text-muted-foreground">{item.meta}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Map & Destination Card */}
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

              {/* Weather Telemetry Card (if available) */}
              {trip.weather && (
                <div className="rounded-2xl glass-panel p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-wider">
                      <CloudSun className="h-4 w-4" /> Local Weather
                    </div>
                    {trip.weather.temp != null && (
                      <span className="text-base font-bold text-foreground">{trip.weather.temp}°C</span>
                    )}
                  </div>
                  {trip.weather.condition && (
                    <p className="text-xs font-medium capitalize text-muted-foreground">{trip.weather.condition}</p>
                  )}
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground border-t border-border/40 pt-2">
                    {trip.weather.rainChance != null && (
                      <div>Rain: <strong className="text-foreground">{trip.weather.rainChance}%</strong></div>
                    )}
                    {trip.weather.humidity != null && (
                      <div>Humidity: <strong className="text-foreground">{trip.weather.humidity}%</strong></div>
                    )}
                    {trip.weather.windSpeed != null && (
                      <div>Wind: <strong className="text-foreground">{trip.weather.windSpeed} km/h</strong></div>
                    )}
                  </div>
                </div>
              )}

              {/* Budget Card */}
              {(trip.budgetBreakdown || trip.budgetEstimate) && (
                <BudgetEstimateCard
                  trip={trip}
                  budgetBreakdown={trip.budgetBreakdown}
                  budgetEstimate={trip.budgetEstimate}
                  travelers={trip.travelers || 1}
                  nights={trip.days?.length || 1}
                />
              )}

              {/* Stay & Hub Anchor */}
              {(trip.hotelLocation || trip.hotelName) && (
                <div className="rounded-2xl glass-panel p-5">
                  <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-wider">
                    <Hotel className="h-3.5 w-3.5" /> Stay Anchor
                  </div>
                  <p className="mt-2 text-xs font-semibold">{trip.hotelName || "Hotel Anchor"}</p>
                  {trip.hotelLocation && (
                    <p className="text-xs text-muted-foreground mt-0.5">{trip.hotelLocation}</p>
                  )}
                  {(trip.checkInTime || trip.checkOutTime) && (
                    <p className="text-[11px] text-muted-foreground mt-1.5 pt-1.5 border-t border-border/40">
                      {trip.checkInTime ? `Check-in: ${normalizeTimeTo24h(trip.checkInTime)}` : ""}
                      {trip.checkInTime && trip.checkOutTime ? " · " : ""}
                      {trip.checkOutTime ? `Check-out: ${normalizeTimeTo24h(trip.checkOutTime)}` : ""}
                    </p>
                  )}
                </div>
              )}

              {/* Dynamic Planning Notice */}
              <div className="rounded-2xl border border-border/70 bg-gradient-to-br from-primary/5 to-accent/5 p-5">
                <div className="flex items-center gap-2 text-primary font-semibold text-xs uppercase tracking-wider">
                  <Sparkles className="h-3.5 w-3.5" /> Dynamic Regeneration
                </div>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                  Need fresh suggestions or alternative attractions? Click <strong>Regenerate</strong> at the top right to explore new variations anytime.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

export default Itinerary;
