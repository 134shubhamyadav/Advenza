import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Plus, Sparkles, MessageCircle, Wallet, Map, Plane, TrendingUp, Radar, ShieldAlert } from "lucide-react";
import { inr } from "@/lib/utils";
import { AiBadge } from "@/components/ai/ai-badge";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export const Route = createFileRoute("/dashboard")({ component: Dashboard });

const DESTINATION_IMAGES: Record<string, string> = {
  default: "https://images.unsplash.com/photo-1477587458883-47145ed94245?w=600&q=75&auto=format&fit=crop",
  udaipur: "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=600&q=75&auto=format&fit=crop",
  goa: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=600&q=75&auto=format&fit=crop",
  manali: "https://images.unsplash.com/photo-1486911278844-a81c5267e227?w=600&q=75&auto=format&fit=crop",
  jaipur: "https://images.unsplash.com/photo-1477587458883-47145ed94245?w=600&q=75&auto=format&fit=crop",
};

const getImage = (dest: string) => {
  if (!dest) return DESTINATION_IMAGES.default;
  const key = dest.toLowerCase().split(",")[0].trim();
  return DESTINATION_IMAGES[key] || DESTINATION_IMAGES.default;
};

function Dashboard() {
  const { user } = useAuth();
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    apiFetch('/api/trips')
      .then(data => setTrips(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  const displayName = user?.displayName?.split(" ")[0] || user?.email?.split("@")[0] || "Traveler";
  const upcomingTrips = trips.slice(0, 3);

  return (
    <AppShell
      title={`Welcome back, ${displayName}.`}
      subtitle={
        loading ? "Loading your trips…" :
        trips.length > 0 ? `${trips.length} trip${trips.length > 1 ? "s" : ""} in your collection. Keep exploring.` :
        "Start your journey — create your first trip."
      }
      actions={<>
        <Button variant="outline" asChild><Link to="/chat"><Sparkles className="mr-1.5 h-4 w-4" />Ask Aventra</Link></Button>
        <Button asChild><Link to="/trips/new"><Plus className="mr-1.5 h-4 w-4" />New trip</Link></Button>
      </>}
    >
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Stats */}
        <div className="lg:col-span-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Trips planned", value: trips.length.toString(), icon: Plane, delta: `${upcomingTrips.length} upcoming` },
            { label: "Destinations", value: new Set(trips.map(t => t.destination?.split(",")[0]).filter(Boolean)).size.toString(), icon: Map, delta: "Unique places" },
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
              <Button className="mt-4" asChild><Link to="/trips/new"><Plus className="mr-1.5 h-4 w-4" />Create my first trip</Link></Button>
            </div>
          ) : (
            upcomingTrips.map((t) => (
              <Link key={t._id} to={`/trips/${t._id}`} className="hover-lift block overflow-hidden rounded-2xl glass-panel">
                <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
                  <div className="relative h-40 sm:h-full">
                    <img src={getImage(t.destination)} alt={t.destination} className="h-full w-full object-cover" loading="lazy" />
                  </div>
                  <div className="p-5">
                    <p className="text-xs text-muted-foreground">{t.destination || "Destination"}</p>
                    <p className="mt-1 text-xl font-semibold">{t.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t.days?.length ? `${t.days.length} days` : "—"} · {t.members?.length || 1} traveler{(t.members?.length || 1) > 1 ? "s" : ""}
                    </p>
                    <div className="mt-4">
                      <div className="mb-1.5 flex justify-between text-xs">
                        <span className="text-muted-foreground">Planning progress</span>
                        <span className="font-medium">{t.expenses?.length > 0 ? "80%" : "40%"}</span>
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
                <Link key={a.label} to={a.to} className="flex flex-col items-start gap-2 rounded-xl glass-tile p-3 hover:border-primary/40 hover:bg-primary/5">
                  <a.icon className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">{a.label}</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-2xl glass-panel p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Trip Twin, live</h3>
              <AiBadge>AI</AiBadge>
            </div>
            <ul className="mt-4 space-y-3">
              {[
                { title: "Real-time search enabled", when: "Live" },
                { title: "Groq → OpenRouter fallback ready", when: "Standby" },
                { title: "Risk Radar active", when: "Monitoring" },
                { title: "AI Packing lists available", when: "Ready" },
              ].map((e, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground">{e.title}</p>
                    <p className="text-xs text-muted-foreground">{e.when}</p>
                  </div>
                </li>
              ))}
            </ul>
            <Link to="/commander" className="mt-4 inline-flex text-xs font-semibold text-primary hover:underline">
              Open Trip Commander →
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
              <p className="text-sm font-semibold">Ask Aventra AI</p>
              <AiBadge className="ml-auto">RAG</AiBadge>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Search-powered travel assistant. Knows live news, trains, and current events.
            </p>
            <p className="mt-3 text-xs text-primary">Chat now →</p>
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
