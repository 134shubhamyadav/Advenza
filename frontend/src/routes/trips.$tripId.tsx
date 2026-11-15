import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  MapPin, 
  Calendar, 
  Users, 
  Plane, 
  Train,
  Bus,
  Car,
  Ship,
  Share2, 
  Wallet, 
  Plus, 
  Trash2,
  Clock,
  RotateCcw,
  Sparkles,
  Compass,
  ArrowRight,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { inr, normalizeTimeTo24h, formatDurationMinutes, getDurationStatusBadge, calculateInclusiveDays } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { TripMemoriesTab } from "@/components/trips/trip-memories-tab";
import { BudgetEstimateCard } from "@/components/budget/budget-estimate-card";
import type { TripSummary, DayTimingWindow, HeroImage } from "@/services/tripService";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";

export const Route = createFileRoute("/trips/$tripId")({ component: TripDetails });

const FALLBACK_TRAVEL_IMAGE =
  "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1600&q=80&auto=format&fit=crop";

const getTripHeroImage = (trip: TripSummary | null): string => {
  if (!trip) return FALLBACK_TRAVEL_IMAGE;
  if (trip.heroImage?.url) return trip.heroImage.url;
  return FALLBACK_TRAVEL_IMAGE;
};

const getTransportIcon = (type?: string) => {
  const lower = (type || "").toLowerCase();
  if (lower.includes("train") || lower.includes("rail")) return Train;
  if (lower.includes("bus")) return Bus;
  if (lower.includes("car") || lower.includes("drive") || lower.includes("cab")) return Car;
  if (lower.includes("ferry") || lower.includes("boat") || lower.includes("ship")) return Ship;
  return Plane;
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

function getDayTimingBadge(window?: DayTimingWindow) {
  if (!window || !window.status) return null;
  const status = window.status;
  const hrs = window.availableHours != null ? `${window.availableHours}h` : "";
  const startTime = formatIsoTimeToHHMM(window.usableStartDateTime);
  const endTime = formatIsoTimeToHHMM(window.usableEndDateTime);

  switch (status) {
    case "TRAVEL_OUTBOUND":
      return { label: "🚆 Outbound Travel", hrs: "0h usable", color: "bg-amber-500/10 text-amber-600 border-amber-500/20" };
    case "ARRIVAL_DAY":
      return { label: `🛬 Arrival Day`, hrs: hrs ? `${hrs} usable` : "", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" };
    case "FULL_DESTINATION_DAY":
      return { label: "☀️ Full Day", hrs: hrs ? `${hrs} usable` : "", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" };
    case "RETURN_DAY":
      return { label: "🛫 Return Day", hrs: hrs ? `${hrs} usable` : "", color: "bg-orange-500/10 text-orange-600 border-orange-500/20" };
    case "TRAVEL_RETURN":
      return { label: "🚆 Return Travel", hrs: "0h usable", color: "bg-purple-500/10 text-purple-600 border-purple-500/20" };
    default:
      return null;
  }
}

function TripDetails() {
  const { tripId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: trip = null, isLoading: loading } = useQuery({
    queryKey: queryKeys.tripDetails(tripId),
    queryFn: async () => {
      const data = await apiFetch(`/api/trips/${tripId}`);
      return data as TripSummary;
    },
    enabled: !!tripId,
  });

  const regenerateMutation = useMutation({
    mutationFn: async () => {
      return await apiFetch(`/api/ai/regenerate/${tripId}`, {
        method: "POST",
        body: JSON.stringify({}),
      });
    },
    onSuccess: (updatedTrip: TripSummary) => {
      toast.success("Itinerary refreshed with fresh AI suggestions!");
      queryClient.setQueryData(queryKeys.tripDetails(tripId), updatedTrip);
      queryClient.setQueryData(queryKeys.trips(), (old: TripSummary[] = []) =>
        old.map((t) => (t._id === tripId ? updatedTrip : t))
      );
    },
    onError: (err: any) => {
      console.error("Regenerate error:", err);
      toast.error(err.message || "Failed to regenerate itinerary");
    },
  });

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      await apiFetch(`/api/trips/${tripId}`, { method: "DELETE" });
      queryClient.setQueryData(queryKeys.trips(), (old: TripSummary[] = []) =>
        old.filter((t) => t._id !== tripId),
      );
      toast.success("Trip deleted successfully");
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to delete trip");
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  const isOwner = user && trip && trip.createdBy === user.uid;

  if (loading)
    return (
      <AppShell>
        <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="font-display text-2xl text-muted-foreground animate-pulse">
            Loading your itinerary...
          </p>
        </div>
      </AppShell>
    );

  if (!trip)
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center rounded-2xl glass-panel p-16 text-center">
          <Plane className="h-12 w-12 text-muted-foreground/30" />
          <p className="mt-4 text-lg font-semibold">Trip not found</p>
          <p className="mt-2 text-sm text-muted-foreground">
            This trip may have been deleted or doesn't exist.
          </p>
          <Button className="mt-6" asChild>
            <Link to="/dashboard">
              <Plus className="mr-1.5 h-4 w-4" />
              Back to dashboard
            </Link>
          </Button>
        </div>
      </AppShell>
    );

  // Budget summary from real expenses
  const expensesByCategory = (trip.expenses ?? []).reduce<Record<string, number>>((acc, e) => {
    const cat = e.category || "General";
    acc[cat] = (acc[cat] ?? 0) + e.amount;
    return acc;
  }, {});
  const totalSpent = Object.values(expensesByCategory).reduce((a, b) => a + b, 0);

  const outboundLeg = trip.outboundJourney;
  const returnLeg = trip.returnJourney;
  const timing = trip.tripTiming;
  const calendarDays = calculateInclusiveDays(trip.startDate, trip.endDate);

  const outboundDuration = outboundLeg?.durationMinutes ?? timing?.outbound?.durationMinutes;
  const returnDuration = returnLeg?.durationMinutes ?? timing?.return?.durationMinutes;
  const totalUsableHours = timing?.destination?.totalUsableHours;

  const outboundStatus = getDurationStatusBadge(outboundLeg?.status, outboundLeg?.durationSource, outboundLeg?.booked);
  const returnStatus = getDurationStatusBadge(returnLeg?.status, returnLeg?.durationSource, returnLeg?.booked);

  const OutboundIcon = getTransportIcon(outboundLeg?.transportType || trip.travelMode);
  const ReturnIcon = getTransportIcon(returnLeg?.transportType || outboundLeg?.transportType || trip.travelMode);

  return (
    <AppShell>
      <div className="relative h-72 overflow-hidden rounded-3xl">
        <img
          src={getTripHeroImage(trip)}
          alt={trip.destination ?? trip.title}
          className="h-full w-full object-cover transition-opacity duration-500"
          onError={(e) => {
            (e.target as HTMLImageElement).src = FALLBACK_TRAVEL_IMAGE;
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent" />
        {trip.heroImage?.photographer && (
          <div className="absolute top-4 right-4 z-10">
            <span className="text-[10px] text-white/70 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 select-none">
              Photo: {trip.heroImage.photographer} ({trip.heroImage.source || "Wikimedia"})
            </span>
          </div>
        )}
        <div className="absolute bottom-6 left-6 right-6 text-white">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Badge className="bg-white/20 text-white hover:bg-white/25">AI Generated</Badge>
                {trip.style && <Badge className="bg-white/15 text-white">{trip.style} Pace</Badge>}
              </div>
              <h1 className="mt-2.5 font-display text-3xl md:text-5xl">{trip.title}</h1>
              <p className="mt-2 flex flex-wrap items-center gap-4 text-sm opacity-90">
                {trip.origin && trip.destination ? (
                  <span className="flex items-center gap-1.5 font-medium">
                    <Compass className="h-4 w-4" />
                    {trip.origin} → {trip.destination}
                  </span>
                ) : trip.destination ? (
                  <span className="flex items-center gap-1.5 font-medium">
                    <MapPin className="h-4 w-4" />
                    {trip.destination}
                  </span>
                ) : null}
                {trip.days?.length ? (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    {trip.days.length} day{trip.days.length !== 1 ? "s" : ""}
                  </span>
                ) : null}
                {trip.travelers || trip.members?.length ? (
                  <span className="flex items-center gap-1.5">
                    <Users className="h-4 w-4" />
                    {trip.travelers || trip.members?.length} traveler{((trip.travelers || trip.members?.length) !== 1) ? "s" : ""}
                  </span>
                ) : null}
                {trip.durationMode ? (
                  <Badge variant="outline" className="text-[11px] bg-white/10 text-white/90 border-white/20">
                    {trip.durationMode === "CUSTOM" ? "Custom Duration" : "Recommended Pacing"}
                  </Badge>
                ) : null}
              </p>
            </div>
            <div className="flex gap-2 items-center flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => regenerateMutation.mutate()}
                disabled={regenerateMutation.isPending}
                className="bg-white/10 text-white border-white/20 hover:bg-white/20 backdrop-blur-sm"
              >
                {regenerateMutation.isPending ? "Regenerating..." : "Regenerate AI"}
              </Button>
              {isOwner && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setIsDeleteDialogOpen(true)}
                  className="bg-red-500/20 text-red-500 border border-red-500/30 hover:bg-red-500/30 shrink-0"
                >
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  Delete
                </Button>
              )}
              <Button variant="secondary" size="sm">
                <Share2 className="mr-1.5 h-4 w-4" />
                Share
              </Button>
              <Button size="sm" asChild>
                <Link to="/itinerary" search={{ tripId: trip._id }}>Open itinerary</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="mt-8">
        <TabsList className="rounded-xl">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="budget">Budget</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="memories">Memories</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <div className="rounded-2xl glass-panel p-6">
                <h3 className="font-semibold">Trip summary</h3>
                {trip.summary ? (
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {trip.summary}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground italic">
                    No summary generated yet.
                  </p>
                )}

                {/* Usable Destination Time Highlights */}
                {totalUsableHours != null && (
                  <div className="mt-5 rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-2.5">
                      <Clock className="h-5 w-5 text-primary shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-foreground">
                          {totalUsableHours} Usable Sightseeing Hours ({calendarDays} calendar days)
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Travel times automatically accounted for in exploration windows.
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs font-mono text-primary border-primary/30">
                      Protected Usable Window
                    </Badge>
                  </div>
                )}

                {(trip.budgetBreakdown || trip.budgetEstimate) && (
                  <div className="mt-6">
                    <BudgetEstimateCard
                      trip={trip}
                      budgetBreakdown={trip.budgetBreakdown}
                      budgetEstimate={trip.budgetEstimate}
                      travelers={trip.travelers || trip.members?.length || 1}
                      nights={trip.days?.length || 1}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar Details */}
            <div className="space-y-6">
              <div className="rounded-2xl glass-panel p-6 space-y-4">
                <h3 className="font-semibold">Trip details</h3>
                <ul className="space-y-3.5 text-sm">
                  {trip.origin && trip.destination && (
                    <li className="flex items-start gap-2.5 text-muted-foreground">
                      <Compass className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">Route</p>
                        <p className="font-medium text-foreground">{trip.origin} → {trip.destination}</p>
                      </div>
                    </li>
                  )}
                  {trip.days?.length ? (
                    <li className="flex items-start gap-2.5 text-muted-foreground">
                      <Calendar className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">Timeline</p>
                        <p className="font-medium text-foreground">{trip.days.length} days planned ({trip.startDate} → {trip.endDate})</p>
                      </div>
                    </li>
                  ) : null}
                  {(outboundLeg?.transportType || trip.travelMode) && (
                    <li className="flex items-start gap-2.5 text-muted-foreground">
                      <OutboundIcon className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">Outbound Transit</p>
                        <p className="font-medium text-foreground">
                          {outboundLeg?.transportType || trip.travelMode}
                          {outboundDuration ? ` · ${formatDurationMinutes(outboundDuration)}` : ""}
                          <span className="ml-1.5 text-[10px] text-muted-foreground">({outboundStatus.label})</span>
                        </p>
                      </div>
                    </li>
                  )}
                  {returnLeg && (returnLeg.transportType || returnLeg.booked) && (
                    <li className="flex items-start gap-2.5 text-muted-foreground">
                      <ReturnIcon className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">Return Transit</p>
                        <p className="font-medium text-foreground">
                          {returnLeg.transportType || "Return Transit"}
                          {returnDuration ? ` · ${formatDurationMinutes(returnDuration)}` : ""}
                          <span className="ml-1.5 text-[10px] text-muted-foreground">({returnStatus.label})</span>
                        </p>
                      </div>
                    </li>
                  )}
                  {trip.hotelName && (
                    <li className="flex items-start gap-2.5 text-muted-foreground">
                      <MapPin className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">Hotel / Stay</p>
                        <p className="font-medium text-foreground">{trip.hotelName} {trip.hotelLocation ? `(${trip.hotelLocation})` : ""}</p>
                      </div>
                    </li>
                  )}
                  {trip.travelers ? (
                    <li className="flex items-start gap-2.5 text-muted-foreground">
                      <Users className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">Travelers</p>
                        <p className="font-medium text-foreground">{trip.travelers} {trip.travelers === 1 ? "traveler" : "travelers"}</p>
                      </div>
                    </li>
                  ) : null}
                </ul>

                {trip.interests && trip.interests.length > 0 && (
                  <div className="border-t border-border/50 pt-3">
                    <p className="text-xs text-muted-foreground mb-2">Selected Interests</p>
                    <div className="flex flex-wrap gap-1.5">
                      {trip.interests.map((i) => (
                        <Badge key={i} variant="outline" className="text-xs bg-muted/30">
                          {i}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="memories" className="mt-6">
          <TripMemoriesTab tripId={trip._id} />
        </TabsContent>

        <TabsContent value="timeline" className="mt-6">
          <div className="rounded-2xl glass-panel p-6">
            {!trip.days?.length ? (
              <div className="py-10 text-center">
                <Calendar className="mx-auto h-10 w-10 text-muted-foreground/40" />
                <p className="mt-3 text-muted-foreground">No timeline available for this trip.</p>
              </div>
            ) : (
              trip.days.map((d, dayIndex) => {
                const dayWindow: DayTimingWindow | undefined = 
                  timing?.destination?.days?.find((w) => w.date === d.date) ??
                  timing?.destination?.days?.[dayIndex];

                const timingBadge = getDayTimingBadge(dayWindow);

                return (
                  <div
                    key={d.dayNumber}
                    className="border-b border-border/60 py-6 first:pt-0 last:border-0 last:pb-0"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-baseline gap-3 flex-wrap">
                        <span className="font-display text-3xl text-primary">Day {d.dayNumber}</span>
                        <span className="text-sm font-semibold text-foreground/90">
                          {d.date ? `${d.date} · ` : ""}
                          {d.title}
                        </span>
                      </div>
                      {timingBadge && (
                        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${timingBadge.color}`}>
                          {timingBadge.label} {timingBadge.hrs ? `· ${timingBadge.hrs}` : ""}
                        </span>
                      )}
                    </div>
                    <ul className="mt-4 space-y-3">
                      {(d.activities ?? []).map((item, idx) => (
                        <li key={idx} className="flex gap-4 rounded-xl glass-tile p-4">
                          <span className="w-20 shrink-0 text-sm font-semibold text-primary whitespace-nowrap">
                            {normalizeTimeTo24h(item.time)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm leading-relaxed">{item.description}</p>
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
                            {(item.placeSubcategory || item.openingHours || item.verificationStatus) && (
                              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                {item.placeSubcategory && (
                                  <span className="font-medium text-foreground/80">
                                    {item.placeSubcategory}
                                  </span>
                                )}
                                {item.openingHours && (
                                  <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[11px]">
                                    <Clock className="h-3 w-3" />
                                    {item.openingHours}
                                  </span>
                                )}
                                {item.verificationStatus && (
                                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                                    <ShieldCheck className="h-3 w-3" />
                                    {item.verificationStatus === "LIVE_VERIFIED"
                                      ? "Live Verified"
                                      : item.verificationStatus === "CURATED_VERIFIED"
                                      ? "Verified Venue"
                                      : "Indicative"}
                                  </span>
                                )}
                                {item.mapLink && (
                                  <a
                                    href={item.mapLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-0.5 text-[11px] text-primary hover:underline"
                                  >
                                    <MapPin className="h-3 w-3" />
                                    Map
                                    <ExternalLink className="h-2.5 w-2.5" />
                                  </a>
                                )}
                              </div>
                            )}
                            {/* Hidden Gem Badge & Why Special */}
                            {item.isPlaceHiddenGem && (item.gemConfidence === "POTENTIAL_HIDDEN_GEM" || item.placeType === "POTENTIAL_HIDDEN_GEM") ? (
                              <div className="mt-1.5 flex items-center gap-1.5">
                                <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 dark:bg-purple-900/30 px-2 py-0.5 text-[11px] font-semibold text-purple-700 dark:text-purple-300 ring-1 ring-purple-300/50">
                                  🔍 Potential Hidden Gem
                                </span>
                                {item.region && (
                                  <span className="text-[10px] text-muted-foreground">
                                    ({item.region})
                                  </span>
                                )}
                              </div>
                            ) : item.isPlaceHiddenGem ? (
                              <div className="mt-1.5 flex items-center gap-1.5">
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300 ring-1 ring-amber-300/50">
                                  💎 Confirmed Hidden Gem
                                </span>
                                {item.region && (
                                  <span className="text-[10px] text-muted-foreground">
                                    ({item.region})
                                  </span>
                                )}
                              </div>
                            ) : null}
                            {item.isPlaceHiddenGem && item.whySpecial && (
                              <p className="mt-1 text-xs text-amber-800 dark:text-amber-300 italic leading-relaxed">
                                Why it's special: {item.whySpecial}
                              </p>
                            )}
                            {item.matchReason && (
                              <p className="mt-1 text-xs text-muted-foreground/90 italic">
                                ★ {item.matchReason}
                              </p>
                            )}
                            {item.isFutureScheduleUnconfirmed && (
                              <p className="mt-0.5 text-[11px] text-amber-600 dark:text-amber-400">
                                ⚠️ Regular hours shown · Schedule subject to seasonal confirmation
                              </p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })
            )}
          </div>
        </TabsContent>

        <TabsContent value="budget" className="mt-6 space-y-6">
          {(trip.budgetBreakdown || trip.budgetEstimate) && (
            <BudgetEstimateCard
              trip={trip}
              budgetBreakdown={trip.budgetBreakdown}
              budgetEstimate={trip.budgetEstimate}
              travelers={trip.travelers || trip.members?.length || 1}
              nights={trip.days?.length || 1}
            />
          )}

          <div className="rounded-2xl glass-panel p-6">
            <h3 className="font-semibold mb-4">Actual Recorded Expenses</h3>
            {Object.keys(expensesByCategory).length === 0 ? (
              <div className="py-10 text-center">
                <Wallet className="mx-auto h-10 w-10 text-muted-foreground/40" />
                <p className="mt-3 text-muted-foreground">No expenses recorded yet.</p>
                <Button variant="outline" className="mt-4" asChild>
                  <Link to="/budget">Add expenses</Link>
                </Button>
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-baseline justify-between">
                  <p className="text-sm text-muted-foreground">Total spent</p>
                  <p className="font-display text-2xl">{inr(totalSpent)}</p>
                </div>
                <div className="space-y-4">
                  {Object.entries(expensesByCategory).map(([cat, spent]) => (
                    <div key={cat}>
                      <div className="flex justify-between text-sm">
                        <span>{cat}</span>
                        <span className="text-muted-foreground">{inr(spent)}</span>
                      </div>
                      <Progress
                        value={totalSpent > 0 ? (spent / totalSpent) * 100 : 0}
                        className="mt-1.5 h-2"
                      />
                    </div>
                  ))}
                </div>
                <Button asChild variant="outline" className="mt-6">
                  <Link to="/budget">Full budget view</Link>
                </Button>
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="notes" className="mt-6">
          <div className="rounded-2xl glass-panel p-6">
            <p className="text-sm text-muted-foreground">Notes are private to your group.</p>
            <div className="mt-6 flex flex-col items-center py-8 text-center">
              <p className="text-sm text-muted-foreground">
                No notes yet. Add notes to share with your group.
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={(open) => !open && setIsDeleteDialogOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this trip?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the trip and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteConfirm();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

export default TripDetails;
