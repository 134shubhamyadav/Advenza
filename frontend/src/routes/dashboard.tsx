import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Plus,
  Sparkles,
  MessageCircle,
  Wallet,
  Map,
  Plane,
  TrendingUp,
  Radar,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { inr } from "@/lib/utils";
import { AiBadge } from "@/components/ai/ai-badge";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import type { TripSummary } from "@/services/tripService";

export const Route = createFileRoute("/dashboard")({ component: Dashboard });

const FALLBACK_TRAVEL_IMAGE =
  "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=600&q=75&auto=format&fit=crop";

const getTripCardImage = (trip: TripSummary): string => {
  if (trip.heroImage?.url) return trip.heroImage.url;
  return FALLBACK_TRAVEL_IMAGE;
};

const calculateTripProgress = (trip: any): number => {
  let score = 0;

  // 1. Destination & travel window specified (20%)
  if (trip.destination && (trip.startDate || trip.duration)) {
    score += 20;
  } else if (trip.destination) {
    score += 10;
  }

  // 2. Day-by-day Itinerary & activities planned (30%)
  const days = Array.isArray(trip.days) ? trip.days : [];
  const totalActivities = days.reduce(
    (sum: number, d: any) => sum + (Array.isArray(d?.activities) ? d.activities.length : 0),
    0
  );
  if (days.length > 0) {
    score += totalActivities >= days.length * 2 ? 30 : 15;
  }

  // 3. Accommodation / stay resolved (15%)
  const isFreeStay =
    trip.accommodation === "OWN_HOME" ||
    trip.accommodation === "NATIVE_HOME" ||
    trip.accommodation === "RELATIVES_HOME" ||
    trip.isFreeAccommodation === true;
  if (trip.hotelName || trip.hotelLocation || trip.accommodation || trip.accommodationType || isFreeStay) {
    score += 15;
  }

  // 4. Transit / travel route configured (15%)
  if (
    trip.outboundJourney?.transitRef ||
    trip.outboundJourney?.departureTime ||
    trip.transitRef ||
    trip.travelMode ||
    (Array.isArray(trip.transport) && trip.transport.length > 0)
  ) {
    score += 15;
  }

  // 5. Budget or tracked expenses (10%)
  if (Number(trip.budgetTotal) > 0 || trip.budgetEstimate || Number(trip.budget) > 0 || (Array.isArray(trip.expenses) && trip.expenses.length > 0)) {
    score += 10;
  }

  // 6. Traveler configuration or group collaboration (10%)
  const travelerCount = Number(trip.travelers) || 1;
  const memberCount = Array.isArray(trip.members) ? trip.members.length : 1;
  const hasActiveVotes = Array.isArray(trip.voteOptions) && trip.voteOptions.some((o: any) => Array.isArray(o.voters) && o.voters.length > 0);
  const isSoloTrip = travelerCount === 1 && memberCount <= 1;

  if (isSoloTrip) {
    // Solo trips do not require group voting and are 100% complete in party configuration
    score += 10;
  } else if (memberCount > 1 || hasActiveVotes || (Array.isArray(trip.expenses) && trip.expenses.length > 0)) {
    // Group trips with multiple members, active consensus votes, or shared expenses
    score += 10;
  } else {
    // Group trip configured for >1 travelers but awaiting members
    score += 5;
  }

  return Math.min(100, Math.max(5, score));
};

function Dashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [deleteTripId, setDeleteTripId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: trips = [], isLoading: loading } = useQuery({
    queryKey: queryKeys.trips(),
    queryFn: async () => {
      const data = await apiFetch("/api/trips");
      return Array.isArray(data) ? data : [];
    },
    enabled: !!user,
  });

  const handleDeleteConfirm = async () => {
    if (!deleteTripId) return;
    setIsDeleting(true);
    try {
      await apiFetch(`/api/trips/${deleteTripId}`, { method: "DELETE" });
      queryClient.setQueryData(queryKeys.trips(), (old: any[] = []) =>
        old.filter((t) => t._id !== deleteTripId),
      );
      toast.success("Trip deleted successfully");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to delete trip");
    } finally {
      setIsDeleting(false);
      setDeleteTripId(null);
    }
  };

  const displayName = user?.displayName?.split(" ")[0] || user?.email?.split("@")[0] || "Traveler";
  const upcomingTrips = trips.slice(0, 3);
  const uniqueDestinationsCount = new Set(
    trips.map((t) => t.destination?.split(",")[0]).filter(Boolean),
  ).size;
  const totalDaysPlanned = trips.reduce((sum: number, t: any) => sum + (t.days?.length || 0), 0);
  const totalExpenses = trips.reduce(
    (sum: number, t: any) =>
      sum + ((t.expenses || []).reduce((esum: number, e: any) => esum + (Number(e.amount) || 0), 0)),
    0,
  );

  return (
    <AppShell
      title={`Welcome back, ${displayName}.`}
      subtitle={
        loading
          ? "Loading your trips…"
          : trips.length > 0
            ? `${trips.length} trip${trips.length > 1 ? "s" : ""} in your collection. Keep exploring.`
            : "Start your journey — create your first trip."
      }
      actions={
        <>
          <Button variant="outline" asChild>
            <Link to="/chat">
              <Sparkles className="mr-1.5 h-4 w-4" />
              Ask Advenza
            </Link>
          </Button>
          <Button asChild>
            <Link to="/trips/new">
              <Plus className="mr-1.5 h-4 w-4" />
              New trip
            </Link>
          </Button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Dynamic Stats */}
        <div className="lg:col-span-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: "Trips planned",
              value: trips.length.toString(),
              icon: Plane,
              delta: `${upcomingTrips.length} upcoming`,
            },
            {
              label: "Destinations",
              value: uniqueDestinationsCount.toString(),
              icon: Map,
              delta: `${uniqueDestinationsCount} unique place${uniqueDestinationsCount !== 1 ? "s" : ""}`,
            },
            {
              label: "Days planned",
              value: totalDaysPlanned.toString(),
              icon: Sparkles,
              delta: `${totalDaysPlanned} total day${totalDaysPlanned !== 1 ? "s" : ""}`,
            },
            {
              label: "Budget logged",
              value: totalExpenses > 0 ? inr(totalExpenses) : "₹0",
              icon: Wallet,
              delta: "Tracked across trips",
            },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl glass-panel p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <s.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="mt-2 font-display text-3xl">{s.value}</p>
              <p className="mt-1 text-xs text-accent">{s.delta}</p>
            </div>
          ))}
        </div>

        {/* Recent trips */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent Trips</h2>
          </div>
          {loading ? (
            Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="animate-pulse h-40 rounded-2xl glass-panel" />
            ))
          ) : trips.length === 0 ? (
            <div className="rounded-2xl glass-panel p-12 text-center">
              <Plane className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <p className="mt-4 text-lg font-semibold">No trips yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Let AI plan your first adventure</p>
              <Button className="mt-4" asChild>
                <Link to="/trips/new">
                  <Plus className="mr-1.5 h-4 w-4" />
                  Create my first trip
                </Link>
              </Button>
            </div>
          ) : (
            upcomingTrips.map((t) => (
              <Link
                key={t._id}
                to="/trips/$tripId"
                params={{ tripId: t._id }}
                className="hover-lift block overflow-hidden rounded-2xl glass-panel group transition-all"
              >
                <div className="grid gap-0 sm:grid-cols-[200px_1fr] md:grid-cols-[220px_1fr] min-h-[160px]">
                  <div className="relative h-44 sm:h-full w-full min-h-[140px] overflow-hidden">
                    <img
                      src={getTripCardImage(t)}
                      alt={t.destination || t.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = FALLBACK_TRAVEL_IMAGE;
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 sm:from-transparent to-transparent pointer-events-none" />
                  </div>
                  <div className="flex flex-col justify-between p-5 min-w-0">
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            {t.destination || "Destination"}
                          </p>
                          <h3 className="mt-1 font-display text-lg sm:text-xl font-semibold text-foreground leading-snug break-words">
                            {t.title}
                          </h3>
                        </div>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDeleteTripId(t._id);
                          }}
                          className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors shrink-0"
                          title="Delete Trip"
                        >
                          <Trash2 className="h-4.5 w-4.5" />
                        </button>
                      </div>
                      <p className="mt-2 text-xs sm:text-sm text-muted-foreground">
                        {t.days?.length ? `${t.days.length} day${t.days.length !== 1 ? "s" : ""}` : "—"} · {t.members?.length || 1}{" "}
                        traveler{(t.members?.length || 1) > 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="mt-4 pt-2 border-t border-border/40">
                      {(() => {
                        const progressPct = calculateTripProgress(t);
                        return (
                          <>
                            <div className="mb-1.5 flex justify-between text-xs">
                              <span className="text-muted-foreground">Planning progress</span>
                              <span className="font-semibold text-foreground">
                                {progressPct}%
                              </span>
                            </div>
                            <Progress value={progressPct} className="h-1.5" />
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>

        {/* Quick actions + activity */}
        <div className="space-y-6">
          <div className="rounded-2xl glass-panel p-5">
            <h3 className="text-sm font-semibold">Quick actions</h3>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {[
                { to: "/chat", label: "Ask AI", icon: MessageCircle },
                { to: "/trips/new", label: "New trip", icon: Plus },
                { to: "/budget", label: "Budget", icon: Wallet },
                { to: "/itinerary", label: "Itinerary", icon: Map },
              ].map((a) => (
                <Link
                  key={a.label}
                  to={a.to}
                  className="flex flex-col items-start gap-2 rounded-xl glass-tile p-3 hover:border-primary/40 hover:bg-primary/5"
                >
                  <a.icon className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">{a.label}</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-2xl glass-panel p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Advenza AI</h3>
              <AiBadge>AI</AiBadge>
            </div>
            <ul className="mt-4 space-y-3 text-sm">
              {[
                { title: "Plan trips with AI chat", desc: "Ask anything about your destination" },
                { title: "Smart packing lists", desc: "Tailored to your trip & weather" },
                { title: "Risk & safety analysis", desc: "AI-powered for your destination" },
                { title: "Consensus decision engine", desc: "Maximize everyone's satisfaction" },
              ].map((e, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground">{e.title}</p>
                    <p className="text-xs text-muted-foreground">{e.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
            <Link
              to="/chat"
              className="mt-4 inline-flex text-xs font-semibold text-primary hover:underline"
            >
              Chat with Advenza →
            </Link>
          </div>
        </div>

        {/* Insights row */}
        <div className="lg:col-span-3 grid gap-4 md:grid-cols-[1fr_1fr_1fr]">
          <Link to="/commander" className="rounded-2xl glass-panel p-6 hover-lift">
            <div className="flex items-center gap-2">
              <Radar className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">Trip Commander</p>
              <AiBadge className="ml-auto">Live</AiBadge>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              AI watching your plan in real-time. Accept or dismiss suggestions.
            </p>
            <p className="mt-3 text-xs text-primary">Open commander →</p>
          </Link>
          <Link to="/risk" className="rounded-2xl glass-panel p-6 hover-lift">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">Risk Radar</p>
              <AiBadge className="ml-auto">Live</AiBadge>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              AI-powered risk analysis including weather, safety, and crowd signals.
            </p>
            <p className="mt-3 text-xs text-primary">Open radar →</p>
          </Link>
          <Link to="/chat" className="rounded-2xl glass-panel p-6 hover-lift">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">Ask Advenza AI</p>
              <AiBadge className="ml-auto">RAG</AiBadge>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Search-powered travel assistant. Knows live news, trains, and current events.
            </p>
            <p className="mt-3 text-xs text-primary">Chat now →</p>
          </Link>
        </div>
      </div>

      <AlertDialog open={deleteTripId !== null} onOpenChange={(open) => !open && setDeleteTripId(null)}>
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
