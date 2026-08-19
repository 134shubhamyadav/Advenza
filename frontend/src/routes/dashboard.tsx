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

export const Route = createFileRoute("/dashboard")({ component: Dashboard });

const DESTINATION_IMAGES: Record<string, string> = {
  default:
    "https://images.unsplash.com/photo-1477587458883-47145ed94245?w=600&q=75&auto=format&fit=crop",
  udaipur:
    "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=600&q=75&auto=format&fit=crop",
  goa: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=600&q=75&auto=format&fit=crop",
  manali:
    "https://images.unsplash.com/photo-1486911278844-a81c5267e227?w=600&q=75&auto=format&fit=crop",
  jaipur:
    "https://images.unsplash.com/photo-1477587458883-47145ed94245?w=600&q=75&auto=format&fit=crop",
};

const getImage = (dest: string) => {
  if (!dest) return DESTINATION_IMAGES.default;
  const key = dest.toLowerCase().split(",")[0].trim();
  return DESTINATION_IMAGES[key] || DESTINATION_IMAGES.default;
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
        {/* Stats */}
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
              value: new Set(
                trips.map((t) => t.destination?.split(",")[0]).filter(Boolean),
              ).size.toString(),
              icon: Map,
              delta: "Unique places",
            },
            { label: "AI chats", value: "∞", icon: Sparkles, delta: "Always available" },
            { label: "Saved via AI", value: "₹—", icon: Wallet, delta: "Track in Budget" },
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

        {/* Upcoming trips */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Your trips</h2>
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
                className="hover-lift block overflow-hidden rounded-2xl glass-panel"
              >
                <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
                  <div className="relative h-40 sm:h-full">
                    <img
                      src={getImage(t.destination)}
                      alt={t.destination}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground">
                          {t.destination || "Destination"}
                        </p>
                        <p className="mt-1 text-xl font-semibold truncate">{t.title}</p>
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
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t.days?.length ? `${t.days.length} days` : "—"} · {t.members?.length || 1}{" "}
                      traveler{(t.members?.length || 1) > 1 ? "s" : ""}
                    </p>
                    <div className="mt-4">
                      <div className="mb-1.5 flex justify-between text-xs">
                        <span className="text-muted-foreground">Planning progress</span>
                        <span className="font-medium">
                          {t.expenses?.length > 0 ? "80%" : "40%"}
                        </span>
                      </div>
                      <Progress value={t.expenses?.length > 0 ? 80 : 40} className="h-1.5" />
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
                { title: "Group consensus engine", desc: "Maximize everyone's satisfaction" },
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
