import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { AiBadge } from "@/components/ai/ai-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { queryKeys } from "@/lib/queryKeys";
import {
  Shield,
  Phone,
  ShieldAlert,
  Plus,
  CloudSun,
  Sun,
  Droplets,
  Wind,
  AlertTriangle,
  Search,
  Compass,
  Users,
  Activity,
  Lock,
  RefreshCw,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/risk")({ component: Risk });

const INDIA_EMERGENCY = [
  { label: "Emergency (All)", value: "112" },
  { label: "Ambulance", value: "108" },
  { label: "Police", value: "100" },
  { label: "Fire", value: "101" },
  { label: "Tourist helpline", value: "1363" },
];

const toneOf = (l: "low" | "med" | "high" | "critical" | string) =>
  l === "critical" || l === "high"
    ? "text-destructive bg-destructive/8 border-destructive/30"
    : l === "med"
      ? "text-[oklch(0.55_0.15_60)] bg-[oklch(0.78_0.16_75)]/12 border-[oklch(0.78_0.16_75)]/40"
      : "text-accent bg-accent/8 border-accent/30";

type RiskItem = {
  key: string;
  label: string;
  level: "low" | "med" | "high" | "critical";
  summary: string;
  tips: string[];
  affectedDate?: string | null;
  recommendation?: string;
  source?: string;
};

type Trip = { _id: string; title: string; destination?: string };

type WeatherData = {
  temp: number;
  condition: string;
  icon: string;
  humidity: number;
  windSpeed: number;
  uv: number;
  rainChance: number;
  alerts: Array<{ event: string; headline: string; desc: string }>;
};

function Risk() {
  const { user } = useAuth();

  // Selection State
  const [selectedTripId, setSelectedTripId] = useState<string>("");
  const [customDestination, setCustomDestination] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [forceRefresh, setForceRefresh] = useState(false);

  const failedDestinations = useRef<Set<string>>(new Set());

  // Query trips with cache
  const { data: trips = [], isLoading: loadingTrips } = useQuery<Trip[]>({
    queryKey: queryKeys.trips(),
    queryFn: async () => {
      const data = await apiFetch("/api/trips");
      return Array.isArray(data) ? (data as Trip[]) : [];
    },
    enabled: !!user,
  });

  const activeTrip = (selectedTripId && selectedTripId !== "custom"
    ? trips.find((t) => t._id === selectedTripId)
    : (trips.find((t) => t.destination) ?? trips[0])) ?? null;

  const targetDestination = customDestination ?? activeTrip?.destination ?? null;

  // Query risk data with cache
  const {
    data: riskData,
    isLoading: loadingRisk,
    refetch: refetchRisk,
  } = useQuery({
    queryKey: queryKeys.riskRadar(targetDestination || ""),
    queryFn: async ({ signal }) => {
      if (!targetDestination) return null;
      if (failedDestinations.current.has(targetDestination)) return null;

      console.log(`[Risk Radar Frontend] Fetching risk assessment for "${targetDestination}"...`);
      try {
        const res = await apiFetch("/api/ai/risk", {
          method: "POST",
          body: JSON.stringify({
            destination: targetDestination,
            tripId: activeTrip?._id,
            refresh: forceRefresh,
          }),
          signal,
        });
        console.log(`[Risk Radar Frontend] Received assessment:`, res);
        return res;
      } catch (err: any) {
        console.error(`[Risk Radar Frontend] Error fetching risk data:`, err);
        failedDestinations.current.add(targetDestination);
        throw err;
      }
    },
    enabled: !!user && !!targetDestination,
    staleTime: 30 * 60 * 1000, // 30 minutes
  });

  const risks: RiskItem[] = riskData?.risks ?? [];
  const weather: WeatherData | null = riskData?.weather ?? null;
  const safetyAdvisory: string = riskData?.safetyAdvisory ?? "";
  const overallLevel: string = riskData?.overallLevel ?? "LOW";
  const score: number = riskData?.score ?? 15;
  const destination: string | null = riskData?.resolvedCity ?? targetDestination;
  const loading = loadingTrips || loadingRisk;

  const getCategoryIcon = (key: string) => {
    if (key.startsWith("weather")) return <CloudSun className="h-4.5 w-4.5 text-primary" />;
    if (key.startsWith("scams")) return <AlertTriangle className="h-4.5 w-4.5 text-primary" />;
    if (key.startsWith("crowd")) return <Users className="h-4.5 w-4.5 text-primary" />;
    if (key.startsWith("transport") || key.startsWith("logistics")) return <Compass className="h-4.5 w-4.5 text-primary" />;
    if (key.startsWith("activity") || key.startsWith("schedule")) return <Activity className="h-4.5 w-4.5 text-primary" />;
    if (key.startsWith("personal")) return <Lock className="h-4.5 w-4.5 text-primary" />;
    return <Shield className="h-4.5 w-4.5 text-primary" />;
  };

  const handleTripChange = (tripId: string) => {
    setSelectedTripId(tripId);
    if (tripId === "custom") return;
    const trip = trips.find((t) => t._id === tripId);
    if (trip && trip.destination) {
      failedDestinations.current.clear();
      setCustomDestination(null);
    }
  };

  const handleCustomSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const query = searchQuery.trim();
    failedDestinations.current.clear();
    setCustomDestination(query);
    setSelectedTripId("custom");
  };

  const handleRefresh = () => {
    setForceRefresh(true);
    refetchRisk().finally(() => setForceRefresh(false));
  };

  return (
    <AppShell
      title="AI Risk Radar"
      subtitle={
        destination
          ? `Real-time weather, hazards, and travel guidelines for ${destination}`
          : "Safety guidelines & risk analysis for your trips"
      }
      actions={<AiBadge>Live Safety Radar</AiBadge>}
    >
      {/* Search and Selector Controls */}
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between rounded-3xl glass-panel p-6 shadow-soft">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Monitor Trip Destination</Label>
          <select
            value={selectedTripId}
            onChange={(e) => handleTripChange(e.target.value)}
            className="h-11 w-full rounded-xl border border-white/40 bg-white/65 px-3 text-sm shadow-soft backdrop-blur-md focus:outline-none focus:ring-1 focus:ring-primary md:max-w-xs"
          >
            {trips.map((t) => (
              <option key={t._id} value={t._id}>
                {t.title} ({t.destination})
              </option>
            ))}
            <option value="custom">🔍 Search custom city...</option>
          </select>
        </div>

        <form onSubmit={handleCustomSearch} className="flex flex-1 flex-col gap-1.5 md:max-w-md">
          <Label htmlFor="custom-search" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Search Another City</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="custom-search"
              type="text"
              placeholder="e.g. Mumbai, Goa, Paris..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-11 w-full pl-9 pr-24 rounded-xl border border-white/40 bg-white/65 shadow-soft focus-visible:ring-primary"
            />
            <Button type="submit" size="sm" className="absolute right-1.5 top-1.5 h-8">
              Analyze
            </Button>
          </div>
        </form>
      </div>

      {loading ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <div className="animate-pulse rounded-2xl glass-panel h-36" />
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-2xl glass-panel p-5 h-44" />
              ))}
            </div>
          </div>
          <div className="animate-pulse rounded-2xl glass-panel h-80" />
        </div>
      ) : !destination ? (
        <div className="flex flex-col items-center justify-center rounded-2xl glass-panel p-16 text-center shadow-soft">
          <ShieldAlert className="h-12 w-12 text-muted-foreground/30" />
          <p className="mt-4 text-lg font-semibold">Ready to Scan Destination</p>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Select a trip or search for a destination above to monitor real-time weather, active alerts, and AI safety warnings.
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
          <div className="space-y-6">
            {/* High-level Risk Summary Card */}
            <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 to-accent/5 p-5 shadow-soft">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Shield className="h-6 w-6 text-primary shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-primary uppercase tracking-wider">AI Safety Advisory</h4>
                    <p className="text-xs text-muted-foreground font-semibold">
                      Risk Score: {score}/100 · {overallLevel} RISK
                    </p>
                  </div>
                </div>
                <span
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider",
                    toneOf(overallLevel.toLowerCase())
                  )}
                >
                  {overallLevel} RISK
                </span>
              </div>
              {safetyAdvisory && (
                <p className="mt-3 text-sm font-medium text-foreground leading-relaxed">{safetyAdvisory}</p>
              )}
            </div>

            {/* Risk cards grid */}
            <div className="grid gap-4 sm:grid-cols-2">
              {risks.length === 0 ? (
                <div className="sm:col-span-2 rounded-2xl glass-panel p-10 text-center shadow-soft">
                  <Shield className="mx-auto h-8 w-8 text-muted-foreground/45" />
                  <p className="mt-3 text-sm text-muted-foreground font-medium">
                    No risk assessment details available for {destination}.
                  </p>
                </div>
              ) : (
                risks.map((r) => (
                  <article key={r.key} className="rounded-2xl glass-panel p-5 border border-white/35 flex flex-col justify-between shadow-soft">
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/8">
                            {getCategoryIcon(r.key)}
                          </span>
                          <div>
                            <h3 className="font-semibold text-foreground text-sm sm:text-base">{r.label}</h3>
                            {r.affectedDate && (
                              <span className="flex items-center gap-1 text-[11px] text-primary font-semibold">
                                <Calendar className="h-3 w-3" /> {r.affectedDate}
                              </span>
                            )}
                          </div>
                        </div>
                        <span
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider shrink-0",
                            toneOf(r.level),
                          )}
                        >
                          {r.level === "med" ? "medium" : r.level}
                        </span>
                      </div>
                      <p className="mt-3.5 text-xs sm:text-sm text-foreground leading-relaxed">{r.summary}</p>
                    </div>

                    <div className="mt-4 border-t border-white/30 pt-3.5">
                      {r.recommendation && (
                        <p className="text-xs font-semibold text-primary mb-2">
                          <span className="font-bold">Rec: </span>{r.recommendation}
                        </p>
                      )}
                      <ul className="space-y-1 text-xs text-muted-foreground font-medium">
                        {r.tips?.map((t) => (
                          <li key={t} className="flex gap-2">
                            <span className="text-primary">•</span>
                            <span className="flex-1 leading-normal">{t}</span>
                          </li>
                        ))}
                      </ul>
                      {r.source && (
                        <span className="mt-2 block text-[9px] uppercase tracking-wider text-muted-foreground/60 font-bold">
                          Source: {r.source}
                        </span>
                      )}
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>

          <aside className="space-y-6">
            {/* Live Weather Box */}
            {weather ? (
              <div className="rounded-2xl glass-panel p-5 border border-white/45 bg-gradient-to-br from-white/35 to-white/10 shadow-soft">
                <div className="flex items-center justify-between border-b border-white/35 pb-3">
                  <div className="flex items-center gap-2">
                    {weather.icon ? (
                      <img
                        src={
                          weather.icon.startsWith("http")
                            ? weather.icon
                            : `https:${weather.icon.startsWith("//") ? "" : "//"}${weather.icon}`
                        }
                        alt={weather.condition}
                        className="h-12 w-12 drop-shadow-sm"
                      />
                    ) : (
                      <CloudSun className="h-10 w-10 text-primary" />
                    )}
                    <div>
                      <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Live Weather</h4>
                      <p className="text-xl font-display font-bold text-foreground leading-tight">{weather.temp}°C</p>
                      <p className="text-[11px] text-muted-foreground capitalize font-semibold">{weather.condition}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleRefresh}
                    disabled={loading}
                    className="h-8 w-8 rounded-xl hover:bg-white/45"
                  >
                    <RefreshCw className={cn("h-3.5 w-3.5 text-muted-foreground", loading && "animate-spin")} />
                  </Button>
                </div>

                <div className="mt-3.5 grid grid-cols-2 gap-3.5">
                  <div className="rounded-xl bg-white/25 p-2.5 flex items-center gap-2">
                    <Droplets className="h-4.5 w-4.5 text-sky-500 shrink-0" />
                    <div>
                      <p className="text-[9px] uppercase font-bold text-muted-foreground">Humidity</p>
                      <p className="text-xs font-bold text-foreground">{weather.humidity}%</p>
                    </div>
                  </div>
                  <div className="rounded-xl bg-white/25 p-2.5 flex items-center gap-2">
                    <CloudSun className="h-4.5 w-4.5 text-indigo-500 shrink-0" />
                    <div>
                      <p className="text-[9px] uppercase font-bold text-muted-foreground">Rain Chance</p>
                      <p className="text-xs font-bold text-foreground">{weather.rainChance}%</p>
                    </div>
                  </div>
                  <div className="rounded-xl bg-white/25 p-2.5 flex items-center gap-2">
                    <Wind className="h-4.5 w-4.5 text-teal-500 shrink-0" />
                    <div>
                      <p className="text-[9px] uppercase font-bold text-muted-foreground">Wind Speed</p>
                      <p className="text-xs font-bold text-foreground">{weather.windSpeed} km/h</p>
                    </div>
                  </div>
                  <div className="rounded-xl bg-white/25 p-2.5 flex items-center gap-2">
                    <Sun className="h-4.5 w-4.5 text-amber-500 shrink-0" />
                    <div>
                      <p className="text-[9px] uppercase font-bold text-muted-foreground">UV Index</p>
                      <p className="text-xs font-bold text-foreground">{weather.uv}</p>
                    </div>
                  </div>
                </div>

                {/* Weather Alerts */}
                {weather.alerts && weather.alerts.length > 0 && (
                  <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/10 p-3 flex items-start gap-2.5">
                    <AlertTriangle className="h-4.5 w-4.5 text-destructive shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[11px] font-bold text-destructive">Active Weather Advisory</p>
                      {weather.alerts.map((a, i) => (
                        <p key={i} className="mt-1 text-[10px] font-semibold text-destructive/90 leading-tight">
                          {a.event} - {a.headline}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl glass-panel p-6 text-center border border-white/40 shadow-soft">
                <CloudSun className="mx-auto h-8 w-8 text-muted-foreground/45" />
                <p className="mt-2 text-xs font-semibold text-muted-foreground">Weather data temporarily unavailable</p>
              </div>
            )}

            {/* Emergency Numbers */}
            <div className="rounded-2xl glass-panel p-5 shadow-soft border border-white/35">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm">Emergency numbers</h3>
              </div>
              <ul className="mt-3.5 divide-y divide-border/45">
                {INDIA_EMERGENCY.map((c) => (
                  <li key={c.label} className="flex items-baseline justify-between py-2 text-xs font-medium text-foreground/90">
                    <span>{c.label}</span>
                    <a
                      href={`tel:${c.value}`}
                      className="font-bold tabular-nums text-primary hover:underline text-sm"
                    >
                      {c.value}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-border/70 bg-gradient-to-br from-primary/5 to-accent/5 p-5 shadow-soft">
              <p className="text-[10px] font-bold uppercase tracking-wider text-primary">
                Dynamic Risk Radar
              </p>
              <p className="mt-2 text-xs text-muted-foreground font-medium leading-relaxed">
                Evaluates weather signals, itinerary activities, pace overpacking, and return travel logistics in real-time.
              </p>
            </div>
          </aside>
        </div>
      )}
    </AppShell>
  );
}
