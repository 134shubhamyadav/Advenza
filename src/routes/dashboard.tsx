import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Plus, Sparkles, MessageCircle, Wallet, Map, Plane, TrendingUp, Radar, ShieldAlert } from "lucide-react";
import { destinations, upcomingTrips } from "@/lib/mock-data";
import { inr } from "@/lib/utils";
import { AiBadge } from "@/components/ai/ai-badge";
import { tripEvents } from "@/lib/ai-engine";

export const Route = createFileRoute("/dashboard")({ component: Dashboard });

function Dashboard() {
  return (
    <AppShell
      title="Welcome back, Aditi."
      subtitle="Two trips in motion. A quiet week to shape them."

      actions={<>
        <Button variant="outline" asChild><Link to="/chat"><Sparkles className="mr-1.5 h-4 w-4" />Ask Aventra</Link></Button>
        <Button asChild><Link to="/trips/new"><Plus className="mr-1.5 h-4 w-4" />New trip</Link></Button>
      </>}
    >
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Stats */}
        <div className="lg:col-span-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Countries visited", value: "14", icon: Map, delta: "+2 this year" },
            { label: "Trips planned", value: "23", icon: Plane, delta: "3 upcoming" },
            { label: "Saved this year", value: "₹2,84,000", icon: Wallet, delta: "vs. average" },
            { label: "Miles flown", value: "48,210", icon: TrendingUp, delta: "Gold status" },
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
            <h2 className="text-lg font-semibold">Upcoming trips</h2>
            <Link to="/trips/santorini" className="text-sm text-primary hover:underline">View all</Link>
          </div>
          {upcomingTrips.map((t) => (
            <Link key={t.id} to="/trips/santorini" className="hover-lift block overflow-hidden rounded-2xl glass-panel">
              <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
                <div className="relative h-40 sm:h-full">
                  <img src={t.image} alt={t.destination} className="h-full w-full object-cover" />
                  <span className="absolute left-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-medium">{t.daysLeft} days away</span>
                </div>
                <div className="p-5">
                  <p className="text-xs text-muted-foreground">{t.destination}</p>
                  <p className="mt-1 text-xl font-semibold">{t.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{t.dates} · {t.travelers} travelers</p>
                  <div className="mt-4">
                    <div className="mb-1.5 flex justify-between text-xs">
                      <span className="text-muted-foreground">Planning progress</span>
                      <span className="font-medium">{t.progress}%</span>
                    </div>
                    <Progress value={t.progress} className="h-1.5" />
                  </div>
                </div>
              </div>
            </Link>
          ))}
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
              {tripEvents.slice(0, 4).map((e) => (
                <li key={e.id} className="flex items-start gap-3 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground">{e.title}</p>
                    <p className="text-xs text-muted-foreground">{e.when} · {e.action ?? e.reason}</p>
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
          <div className="rounded-2xl glass-panel p-6 hover-lift">
            <div className="flex items-center gap-2">
              <Radar className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">Trip Commander</p>
              <AiBadge className="ml-auto">Live</AiBadge>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              4 events tracked today. Flight buffer preserved, Ambrai dinner rescheduled.
            </p>
            <p className="mt-3 text-xs text-primary">Open commander →</p>
          </div>
          <Link to="/risk" className="rounded-2xl glass-panel p-6 hover-lift">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">Risk Radar</p>
              <AiBadge className="ml-auto">Live</AiBadge>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              2 medium signals watched, flight delay probability and monsoon rain window on Day 4.
            </p>
            <p className="mt-3 text-xs text-primary">Open radar →</p>
          </Link>
          <Link to="/simulator" className="rounded-2xl glass-panel p-6 hover-lift">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">What-If Simulator</p>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Try dropping to Comfort tier or adding one traveler, see the full trip reshape in a second.
            </p>
            <p className="mt-3 text-xs text-primary">Simulate →</p>
          </Link>
        </div>

        {/* Recommendations */}
        <div className="lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recommended for you</h2>
            <span className="text-xs text-muted-foreground">Based on your taste</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {destinations.map((d) => (
              <Link key={d.id} to="/trips/santorini" className="hover-lift block overflow-hidden rounded-2xl glass-panel">
                <div className="aspect-[4/3] overflow-hidden">
                  <img loading="lazy" src={d.image} alt={d.name} className="h-full w-full object-cover" />
                </div>
                <div className="p-4">
                  <p className="font-semibold">{d.name}</p>
                  <p className="text-xs text-muted-foreground">{d.country} · from {inr(d.price)}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
