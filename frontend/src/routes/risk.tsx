import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
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

function getEmergencyHelplines(destination: string | null) {
  const d = (destination || "").toLowerCase();

  // United Kingdom
  if (
    d.includes("london") || d.includes("uk") || d.includes("united kingdom") ||
    d.includes("england") || d.includes("scotland") || d.includes("edinburgh") || d.includes("manchester")
  ) {
    return {
      country: "United Kingdom",
      numbers: [
        { label: "Emergency (All)", value: "999" },
        { label: "Universal Emergency", value: "112" },
        { label: "Police (Non-Emergency)", value: "101" },
        { label: "NHS Medical Advice", value: "111" },
      ],
    };
  }

  // USA & Canada
  if (
    d.includes("usa") || d.includes("united states") || d.includes("new york") ||
    d.includes("california") || d.includes("chicago") || d.includes("san francisco") ||
    d.includes("los angeles") || d.includes("canada") || d.includes("toronto") || d.includes("vancouver")
  ) {
    return {
      country: "USA & Canada",
      numbers: [
        { label: "Emergency (All)", value: "911" },
        { label: "Municipal Non-Emergency", value: "311" },
        { label: "Poison Control Center", value: "1-800-222-1222" },
        { label: "Traffic / Road Assistance", value: "511" },
      ],
    };
  }

  // European Union (France, Italy, Spain, Germany, etc.)
  if (
    d.includes("paris") || d.includes("france") || d.includes("rome") ||
    d.includes("italy") || d.includes("spain") || d.includes("barcelona") ||
    d.includes("madrid") || d.includes("germany") || d.includes("berlin") ||
    d.includes("amsterdam") || d.includes("netherlands") || d.includes("switzerland") ||
    d.includes("zurich") || d.includes("austria") || d.includes("vienna")
  ) {
    return {
      country: "European Union",
      numbers: [
        { label: "EU Universal Emergency", value: "112" },
        { label: "Medical Emergency (SAMU)", value: "15" },
        { label: "Police Secours", value: "17" },
        { label: "Fire & Rescue (Pompiers)", value: "18" },
      ],
    };
  }

  // UAE / Dubai
  if (d.includes("dubai") || d.includes("uae") || d.includes("abu dhabi") || d.includes("sharjah")) {
    return {
      country: "United Arab Emirates",
      numbers: [
        { label: "Police Emergency", value: "999" },
        { label: "Ambulance", value: "998" },
        { label: "Civil Defense & Fire", value: "997" },
        { label: "Tourist Police", value: "901" },
      ],
    };
  }

  // Japan
  if (d.includes("japan") || d.includes("tokyo") || d.includes("kyoto") || d.includes("osaka")) {
    return {
      country: "Japan",
      numbers: [
        { label: "Police Emergency", value: "110" },
        { label: "Fire & Ambulance", value: "119" },
        { label: "Japan Visitor Helpline", value: "050-3816-2720" },
        { label: "Emergency (Mobile GSM)", value: "112" },
      ],
    };
  }

  // Singapore
  if (d.includes("singapore")) {
    return {
      country: "Singapore",
      numbers: [
        { label: "Police Emergency", value: "999" },
        { label: "Ambulance & Fire", value: "995" },
        { label: "Non-Emergency Ambulance", value: "1777" },
        { label: "Police Hotline", value: "1800-255-0000" },
      ],
    };
  }

  // Thailand
  if (d.includes("thailand") || d.includes("bangkok") || d.includes("phuket") || d.includes("chiang mai") || d.includes("pattaya")) {
    return {
      country: "Thailand",
      numbers: [
        { label: "Tourist Police (English)", value: "1155" },
        { label: "Police Emergency", value: "191" },
        { label: "Medical Emergency / Ambulance", value: "1669" },
        { label: "Fire Service", value: "199" },
      ],
    };
  }

  // Indonesia / Bali
  if (d.includes("indonesia") || d.includes("bali") || d.includes("jakarta") || d.includes("ubud") || d.includes("kuta")) {
    return {
      country: "Indonesia",
      numbers: [
        { label: "National Emergency", value: "112" },
        { label: "Police Assistance", value: "110" },
        { label: "Ambulance", value: "118" },
        { label: "Search & Rescue (BASARNAS)", value: "115" },
      ],
    };
  }

  // Australia
  if (d.includes("australia") || d.includes("sydney") || d.includes("melbourne") || d.includes("brisbane") || d.includes("perth")) {
    return {
      country: "Australia",
      numbers: [
        { label: "Emergency (All Services)", value: "000" },
        { label: "Mobile Emergency (GSM)", value: "112" },
        { label: "Police Non-Emergency", value: "131 444" },
        { label: "State Emergency Service (SES)", value: "132 500" },
      ],
    };
  }

  // India (Domestic Default)
  return {
    country: "India",
    numbers: [
      { label: "National Emergency (All)", value: "112" },
      { label: "Ambulance", value: "108" },
      { label: "Police Assistance", value: "100" },
      { label: "Fire Service", value: "101" },
      { label: "Tourist Helpline", value: "1363" },
    ],
  };
}

const toneOf = (l: string) => {
  const norm = (l || "").toLowerCase();
  if (norm === "critical" || norm === "high") {
    return "text-destructive bg-destructive/10 border-destructive/30";
  }
  if (norm === "med" || norm === "medium") {
    return "text-amber-600 dark:text-amber-400 bg-amber-500/15 border-amber-500/35";
  }
  return "text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 border-emerald-500/35";
};

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

type Trip = { _id: string; title: string; destination?: string; updatedAt?: string };

type WeatherData = {
  temp: number | null;
  condition: string;
  icon?: string;
  humidity?: number | null;
  windSpeed?: number | null;
  uv?: number | null;
  rainChance?: number | null;
  forecastDate?: string | null;
  forecastType?: string;
  forecastStatus?: string;
  isForecastAvailable?: boolean;
  isTargetDateForecast?: boolean;
  destinationTimezone?: string;
  alerts?: Array<{ event: string; headline: string; desc: string }>;
};

function Risk() {
  const { user } = useAuth();

  // Selection State
  const [selectedTripId, setSelectedTripId] = useState<string>("");
  const [customDestination, setCustomDestination] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [forceRefresh, setForceRefresh] = useState(false);

  // Query trips with cache
  const { data: trips = [], isLoading: loadingTrips } = useQuery<Trip[]>({
    queryKey: queryKeys.trips(),
    queryFn: async () => {
      const data = await apiFetch("/api/trips");
      return Array.isArray(data) ? (data as Trip[]) : [];
    },
    enabled: !!user,
  });

  // Keep dropdown synchronized with active trip
  useEffect(() => {
    if (trips.length > 0 && !selectedTripId && !customDestination) {
      const firstWithDest = trips.find((t) => t.destination) || trips[0];
      if (firstWithDest) setSelectedTripId(firstWithDest._id);
    }
  }, [trips, selectedTripId, customDestination]);

  // When custom search is chosen, activeTrip is strictly null (avoids evaluating old trip itinerary for custom cities)
  const activeTrip = selectedTripId === "custom"
    ? null
    : (selectedTripId ? trips.find((t) => t._id === selectedTripId) : (trips.find((t) => t.destination) ?? trips[0])) ?? null;

  const targetDestination = customDestination ?? activeTrip?.destination ?? null;

  // Query risk data with cache
  const {
    data: riskData,
    isLoading: loadingRisk,
    refetch: refetchRisk,
  } = useQuery({
    queryKey: queryKeys.riskRadar(
      targetDestination || "",
      activeTrip?._id || "",
      activeTrip?.updatedAt || ""
    ),
    queryFn: async ({ signal }) => {
      if (!targetDestination) return null;

      const res = await apiFetch("/api/ai/risk", {
        method: "POST",
        body: JSON.stringify({
          destination: targetDestination,
          tripId: activeTrip?._id || undefined,
          refresh: forceRefresh,
        }),
        signal,
      });
      return res;
    },
    enabled: !!user && !!targetDestination,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const risks: RiskItem[] = riskData?.risks ?? [];
  const weather: WeatherData | null = riskData?.weather ?? null;
  const safetyAdvisory: string = riskData?.safetyAdvisory ?? "";
  const overallLevel: string = riskData?.overallLevel ?? "LOW";
  const score: number = riskData?.score ?? 15;
  const destination: string | null = riskData?.resolvedCity ?? targetDestination;
  const loading = loadingTrips || loadingRisk;
  const emergencyInfo = getEmergencyHelplines(destination);

  const getCategoryIcon = (key: string) => {
    if (key.startsWith("weather")) return <CloudSun className="h-4.5 w-4.5 text-primary" />;
    if (key.startsWith("scams")) return <AlertTriangle className="h-4.5 w-4.5 text-primary" />;
    if (key.startsWith("crowd")) return <Users className="h-4.5 w-4.5 text-primary" />;
    if (key.startsWith("transport") || key.startsWith("logistics")) return <Compass className="h-4.5 w-4.5 text-primary" />;
    if (key.startsWith("activity") || key.startsWith("schedule")) return <Activity className="h-4.5 w-4.5 text-primary" />;
    if (key.startsWith("health") || key.startsWith("personal")) return <Lock className="h-4.5 w-4.5 text-primary" />;
    return <Shield className="h-4.5 w-4.5 text-primary" />;
  };

  const handleTripChange = (tripId: string) => {
    setSelectedTripId(tripId);
    if (tripId === "custom") {
      setCustomDestination(null);
      setSearchQuery("");
      return;
    }
    const trip = trips.find((t) => t._id === tripId);
    if (trip && trip.destination) {
      setCustomDestination(null);
    }
  };

  const handleCustomSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const query = searchQuery.trim();
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
          ? `Real-time weather telemetry, verified local hazards, and navigation safety for ${destination}`
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
            <option value="custom">Search custom city...</option>
          </select>
        </div>

        <form onSubmit={handleCustomSearch} className="flex flex-1 flex-col gap-1.5 md:max-w-md">
          <Label htmlFor="custom-search" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Search Another City</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="custom-search"
              type="text"
              placeholder="e.g. Mumbai, Goa, London, Paris..."
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
              {Array.from({ length: 4 }).map((_, i) => (
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
            {/* High-level Risk Summary Card with Calibrated Gauge */}
            <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-background to-accent/5 p-5 shadow-soft">
              <div className="flex items-center justify-between gap-4">
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
                    "rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider shrink-0",
                    toneOf(overallLevel)
                  )}
                >
                  {overallLevel} RISK
                </span>
              </div>

              {/* Visual Score Gauge Bar */}
              <div className="mt-4 space-y-1.5">
                <div className="flex justify-between text-[10px] font-semibold text-muted-foreground">
                  <span className="text-emerald-600 font-bold">0 Low</span>
                  <span className="text-amber-600 font-bold">25 Moderate</span>
                  <span className="text-orange-600 font-bold">50 Elevated</span>
                  <span className="text-destructive font-bold">75+ Critical</span>
                </div>
                <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10 p-0.5">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      score < 25
                        ? "bg-emerald-500"
                        : score < 50
                          ? "bg-amber-500"
                          : score < 75
                            ? "bg-orange-500"
                            : "bg-destructive"
                    )}
                    style={{ width: `${Math.max(6, Math.min(100, score))}%` }}
                  />
                </div>
              </div>

              {safetyAdvisory && (
                <p className="mt-3.5 text-sm font-medium text-foreground leading-relaxed">{safetyAdvisory}</p>
              )}
            </div>

            {/* Risk cards grid */}
            <div className="grid gap-4 sm:grid-cols-2">
              {risks.length === 0 ? (
                <div className="sm:col-span-2 rounded-2xl glass-panel p-10 text-center shadow-soft">
                  <Shield className="mx-auto h-8 w-8 text-muted-foreground/45" />
                  <p className="mt-3 text-sm text-muted-foreground font-medium">
                    No active risk advisories detected for {destination}. Conditions are optimal.
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
                        {r.tips?.map((t, idx) => (
                          <li key={idx} className="flex gap-2">
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
                      <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        {weather.forecastType || (weather.isTargetDateForecast ? "Trip Forecast" : "Live Weather")}
                      </h4>
                      <p className="text-xl font-display font-bold text-foreground leading-tight">
                        {weather.temp !== null && weather.temp !== undefined ? `${weather.temp}°C` : "—"}
                      </p>
                      <p className="text-[11px] text-muted-foreground capitalize font-semibold">{weather.condition}</p>
                      {weather.forecastDate && (
                        <p className="text-[10px] text-muted-foreground/75 mt-0.5 font-medium">{weather.forecastDate}</p>
                      )}
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

                {weather.isForecastAvailable === false ? (
                  <div className="mt-3.5 rounded-xl bg-white/20 p-3 text-center border border-white/25">
                    <p className="text-xs font-semibold text-foreground">Weather forecast not yet available</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Live 5-day precipitation & temperature radar activates within 5 days of departure.
                    </p>
                  </div>
                ) : (
                  <div className="mt-3.5 grid grid-cols-2 gap-3.5">
                    <div className="rounded-xl bg-white/25 p-2.5 flex items-center gap-2">
                      <Droplets className="h-4.5 w-4.5 text-sky-500 shrink-0" />
                      <div>
                        <p className="text-[9px] uppercase font-bold text-muted-foreground">Humidity</p>
                        <p className="text-xs font-bold text-foreground">
                          {weather.humidity !== null && weather.humidity !== undefined ? `${weather.humidity}%` : "—"}
                        </p>
                      </div>
                    </div>
                    <div className="rounded-xl bg-white/25 p-2.5 flex items-center gap-2">
                      <CloudSun className="h-4.5 w-4.5 text-indigo-500 shrink-0" />
                      <div>
                        <p className="text-[9px] uppercase font-bold text-muted-foreground">
                          {weather.isTargetDateForecast ? "Daily Max Rain" : "Rain Chance"}
                        </p>
                        <p className="text-xs font-bold text-foreground">
                          {weather.rainChance !== null && weather.rainChance !== undefined ? `${weather.rainChance}%` : "—"}
                        </p>
                      </div>
                    </div>
                    <div className="rounded-xl bg-white/25 p-2.5 flex items-center gap-2">
                      <Wind className="h-4.5 w-4.5 text-teal-500 shrink-0" />
                      <div>
                        <p className="text-[9px] uppercase font-bold text-muted-foreground">Wind Speed</p>
                        <p className="text-xs font-bold text-foreground">
                          {weather.windSpeed !== null && weather.windSpeed !== undefined ? `${weather.windSpeed} km/h` : "—"}
                        </p>
                      </div>
                    </div>
                    <div className="rounded-xl bg-white/25 p-2.5 flex items-center gap-2">
                      <Sun className="h-4.5 w-4.5 text-amber-500 shrink-0" />
                      <div>
                        <p className="text-[9px] uppercase font-bold text-muted-foreground">UV Index</p>
                        <p className="text-xs font-bold text-foreground">
                          {weather.uv !== null && weather.uv !== undefined ? weather.uv : "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

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

            {/* Localized Emergency Numbers */}
            <div className="rounded-2xl glass-panel p-5 shadow-soft border border-white/35">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm">Emergency numbers</h3>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {emergencyInfo.country}
                </span>
              </div>
              <ul className="mt-3.5 divide-y divide-border/45">
                {emergencyInfo.numbers.map((c) => (
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
                Evaluates real-time weather telemetry, localized street scam patterns, transit network guidelines, and itinerary pacing.
              </p>
            </div>
          </aside>
        </div>
      )}
    </AppShell>
  );
}
