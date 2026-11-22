import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { AiBadge } from "@/components/ai/ai-badge";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { queryKeys } from "@/lib/queryKeys";
import {
  Plane,
  CloudRain,
  Wallet,
  Users,
  Building2,
  AlertTriangle,
  Sparkles,
  Undo2,
  Check,
  Plus,
  RefreshCw,
  Loader2,
  Bell,
  Radar,
  Search,
  ArrowUpRight,
  ShieldCheck,
  Activity,
  Calendar,
  Compass,
  Send,
  Thermometer,
  Sun,
  Zap,
  CheckCircle2,
  Radio,
  SlidersHorizontal,
  MapPin,
  Clock,
} from "lucide-react";
import { TravelRadarModal } from "@/components/travel/travel-radar-modal";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/commander")({ component: Commander });

export type TripEvent = {
  id: string;
  when: string;
  kind: "delay" | "weather" | "budget" | "cancel" | "closure" | "traffic" | "group" | "ai";
  alertType?: string;
  title: string;
  reason: string;
  action?: string;
  delta?: string;
  severity: "info" | "warn" | "bad";
  dataType?: "LIVE_VERIFIED" | "CACHED_VERIFIED" | "ESTIMATED" | "AI_GENERATED" | "UNAVAILABLE";
  source?: string;
  updatedAt?: string;
  actionable?: boolean;
  actionLabel?: string;
  actionPayload?: any;
  actionType?: string;
  isAccepted?: boolean;
  acceptedAt?: string;
  actionTaken?: string;
  facts?: any;
};

const iconOf: Record<TripEvent["kind"], typeof Plane> = {
  delay: Plane,
  weather: CloudRain,
  budget: Wallet,
  cancel: AlertTriangle,
  closure: Building2,
  traffic: AlertTriangle,
  group: Users,
  ai: Sparkles,
};

type Trip = {
  _id: string;
  title: string;
  destination?: string;
  origin?: string;
  startDate?: string;
  endDate?: string;
  duration?: number;
  travelMode?: string;
  transitRef?: string;
  budgetTotal?: number;
  acceptedCommanderEvents?: Array<{
    eventId: string;
    acceptedAt?: string;
    actionTaken?: string;
  }>;
};

type CommanderVitals = {
  status: "NOMINAL" | "ATTENTION" | "CRITICAL";
  actionableCount: number;
  weather: {
    temperatureC: number;
    condition: string;
    rainProbabilityPercent: number;
    windSpeedKmh: number;
    location: string;
    station: string;
    status: string;
  };
  flight: {
    transitRef: string;
    travelMode: string;
    status: string;
    flightNumber?: string | null;
    origin?: string;
    destination?: string;
    delayMinutes: number;
    gate?: string | null;
    terminal?: string | null;
  };
  budget: {
    budgetTotal: number;
    totalSpent: number;
    remaining: number;
    pctUsed: number;
    status: "HEALTHY" | "WARNING" | "OVER_BUDGET";
  };
  schedule: {
    totalDays: number;
    totalActivities: number;
    hasTimingConflict: boolean;
  };
  lastSync: string;
};

type FilterCategory = "all" | "actionable" | "weather" | "transit" | "budget" | "resolved";

function Commander() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [radarModalOpen, setRadarModalOpen] = useState(false);
  const [filter, setFilter] = useState<FilterCategory>("all");
  const [transitInputOpen, setTransitInputOpen] = useState(false);
  const [transitRefValue, setTransitRefValue] = useState("");
  const [isSavingTransit, setIsSavingTransit] = useState(false);
  const [commandText, setCommandText] = useState("");
  const [isExecutingCommand, setIsExecutingCommand] = useState(false);
  const [commandFeedback, setCommandFeedback] = useState<string | null>(null);
  const [dismissedLocal, setDismissedLocal] = useState<Set<string>>(new Set());

  // 1. Fetch user trips
  const { data: trips = [], isLoading: loadingTrips } = useQuery<Trip[]>({
    queryKey: queryKeys.trips(),
    queryFn: async () => {
      const data = await apiFetch("/api/trips");
      return Array.isArray(data) ? (data as Trip[]) : [];
    },
    enabled: !!user,
  });

  const activeTrip = (selectedTripId ? trips.find((t) => t._id === selectedTripId) : trips[0]) ?? null;
  const activeTripId = activeTrip?._id ?? null;

  // 2. Fetch live Commander events & vitals
  const {
    data: commanderPayload,
    isLoading: loadingEvents,
    isFetching,
    refetch,
  } = useQuery<{
    events?: TripEvent[];
    vitals?: CommanderVitals;
    acceptedEvents?: any[];
    activeTrip?: any;
  } | TripEvent[]>({
    queryKey: ["commanderEvents", activeTripId],
    queryFn: async () => {
      const url = activeTripId ? `/api/commander/events?tripId=${activeTripId}` : "/api/commander/events";
      const data = await apiFetch(url);
      return data;
    },
    enabled: !!user && !!activeTripId,
    staleTime: 5 * 60 * 1000,
  });

  // Normalize response
  const rawEvents: TripEvent[] = useMemo(() => {
    if (Array.isArray(commanderPayload)) {
      return commanderPayload;
    }
    return Array.isArray(commanderPayload?.events) ? commanderPayload.events : [];
  }, [commanderPayload]);

  const vitals: CommanderVitals | null = useMemo(() => {
    if (!Array.isArray(commanderPayload) && commanderPayload?.vitals) {
      return commanderPayload.vitals;
    }
    return null;
  }, [commanderPayload]);

  const loading = loadingTrips || (loadingEvents && rawEvents.length === 0);

  // Filter events
  const filteredEvents = useMemo(() => {
    return rawEvents
      .filter((e) => !dismissedLocal.has(e.id))
      .filter((e) => {
        if (filter === "actionable") return e.actionable && !e.isAccepted;
        if (filter === "weather") return e.kind === "weather";
        if (filter === "transit") return e.kind === "delay" || e.kind === "cancel" || e.kind === "traffic";
        if (filter === "budget") return e.kind === "budget";
        if (filter === "resolved") return e.isAccepted;
        return true;
      });
  }, [rawEvents, dismissedLocal, filter]);

  const actionableCount = useMemo(() => {
    return rawEvents.filter((e) => e.actionable && !e.isAccepted && !dismissedLocal.has(e.id)).length;
  }, [rawEvents, dismissedLocal]);

  const resolvedCount = useMemo(() => {
    return rawEvents.filter((e) => e.isAccepted).length;
  }, [rawEvents]);

  // Actions
  const acceptPlan = async (event: TripEvent) => {
    if (processingId || !activeTripId) return;
    setProcessingId(event.id);
    try {
      await apiFetch(`/api/commander/events/${encodeURIComponent(event.id)}/accept`, {
        method: "POST",
        body: JSON.stringify({
          tripId: activeTripId,
          payload: event.actionPayload,
        }),
      });
      // Invalidate queries to reload fresh trip & commander events
      await queryClient.invalidateQueries({ queryKey: ["commanderEvents", activeTripId] });
      await queryClient.invalidateQueries({ queryKey: queryKeys.trips() });
      if (activeTripId) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.tripDetails(activeTripId) });
      }
    } catch (err: any) {
      console.error("[Commander] Accept failed:", err);
    } finally {
      setProcessingId(null);
    }
  };

  const revertPlan = async (eventId: string) => {
    if (processingId || !activeTripId) return;
    setProcessingId(eventId);
    try {
      await apiFetch(`/api/commander/events/${encodeURIComponent(eventId)}/revert`, {
        method: "POST",
        body: JSON.stringify({ tripId: activeTripId }),
      });
      await queryClient.invalidateQueries({ queryKey: ["commanderEvents", activeTripId] });
      await queryClient.invalidateQueries({ queryKey: queryKeys.trips() });
      if (activeTripId) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.tripDetails(activeTripId) });
      }
    } catch (err: any) {
      console.error("[Commander] Revert failed:", err);
    } finally {
      setProcessingId(null);
    }
  };

  const saveTransitRef = async () => {
    if (!transitRefValue.trim() || !activeTripId || isSavingTransit) return;
    setIsSavingTransit(true);
    try {
      await apiFetch("/api/commander/transit", {
        method: "POST",
        body: JSON.stringify({
          tripId: activeTripId,
          transitRef: transitRefValue.trim(),
          travelMode: activeTrip?.travelMode || "Flight",
        }),
      });
      setTransitInputOpen(false);
      setTransitRefValue("");
      await queryClient.invalidateQueries({ queryKey: ["commanderEvents", activeTripId] });
      await queryClient.invalidateQueries({ queryKey: queryKeys.trips() });
      if (activeTripId) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.tripDetails(activeTripId) });
      }
    } catch (err: any) {
      console.error("[Commander] Transit update failed:", err);
    } finally {
      setIsSavingTransit(false);
    }
  };

  const executeInstruction = async (textToRun?: string) => {
    const text = textToRun || commandText;
    if (!text.trim() || !activeTripId || isExecutingCommand) return;
    setIsExecutingCommand(true);
    setCommandFeedback(null);
    try {
      const res = await apiFetch("/api/commander/command", {
        method: "POST",
        body: JSON.stringify({
          tripId: activeTripId,
          instruction: text.trim(),
        }),
      });
      setCommandFeedback(res.message || "Command executed successfully.");
      setCommandText("");
      await queryClient.invalidateQueries({ queryKey: ["commanderEvents", activeTripId] });
      await queryClient.invalidateQueries({ queryKey: queryKeys.trips() });
      if (activeTripId) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.tripDetails(activeTripId) });
      }
    } catch (err: any) {
      setCommandFeedback(`Command failed: ${err.message}`);
    } finally {
      setIsExecutingCommand(false);
    }
  };

  const statusTone =
    vitals?.status === "CRITICAL"
      ? "bg-destructive/15 text-destructive border-destructive/30"
      : vitals?.status === "ATTENTION"
        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
        : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";

  return (
    <AppShell
      title="Trip Commander"
      subtitle={
        activeTrip
          ? `Autonomous Operations · ${activeTrip.title} (${activeTrip.destination || "Destination"})`
          : "Your AI travel operations autopilot, watching the plan so you don't have to."
      }
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Badge */}
          {vitals && (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wider",
                statusTone,
              )}
            >
              <Radio className="h-3 w-3 animate-pulse" />
              {vitals.status === "CRITICAL"
                ? "Disruption Detected"
                : vitals.status === "ATTENTION"
                  ? `${vitals.actionableCount} Actions Advised`
                  : "All Systems Nominal"}
            </span>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setRadarModalOpen(true)}
            className="border-primary/40 text-primary hover:bg-primary/10 shadow-xs"
          >
            <Bell className="mr-1.5 h-3.5 w-3.5" />
            Travel Radar & Price Watch
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="shadow-xs"
          >
            <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", isFetching && "animate-spin")} />
            {isFetching ? "Syncing..." : "Sync Feeds"}
          </Button>

          <AiBadge>Trip Twin, live</AiBadge>
        </div>
      }
    >
      {/* ── 1. Trip Switcher Header ── */}
      {trips.length > 1 && (
        <div className="mb-6 flex flex-wrap items-center gap-2 rounded-2xl glass-panel p-2">
          <span className="text-xs font-semibold text-muted-foreground ml-2 mr-1">Active Trip:</span>
          {trips.map((t) => (
            <button
              key={t._id}
              onClick={() => {
                setSelectedTripId(t._id);
                setDismissedLocal(new Set());
              }}
              className={cn(
                "rounded-xl border px-3 py-1.5 text-xs transition font-medium flex items-center gap-1.5",
                activeTripId === t._id
                  ? "border-primary bg-primary/15 font-semibold text-primary shadow-xs"
                  : "border-border/60 hover:border-primary/40 text-muted-foreground bg-background/50",
              )}
            >
              <MapPin className="h-3 w-3" />
              {t.destination?.split(",")[0] || t.title}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-2xl glass-panel p-5 h-28" />
            ))}
          </div>
          <div className="animate-pulse rounded-2xl glass-panel p-8 h-64" />
        </div>
      ) : !activeTrip ? (
        <div className="flex flex-col items-center justify-center rounded-2xl glass-panel p-16 text-center">
          <Compass className="h-14 w-14 text-muted-foreground/30 animate-pulse" />
          <p className="mt-4 text-xl font-semibold">No active trips found</p>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Create or import a trip to initialize Trip Commander — Advenza will monitor flights,
            weather stations, itinerary pacing, and ledger health in real time.
          </p>
          <Button className="mt-6 shadow-sm" asChild>
            <Link to="/trips/new">
              <Plus className="mr-1.5 h-4 w-4" />
              Create a trip
            </Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* ── 2. Mission Control Vitals Bar ── */}
          {vitals && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Flight / Transit Vital */}
              <div className="rounded-2xl glass-panel p-4 flex flex-col justify-between border-l-4 border-l-primary hover:border-primary/60 transition">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Plane className="h-3.5 w-3.5 text-primary" />
                    Transit Radar
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-bold",
                      vitals.flight.delayMinutes > 0
                        ? "bg-amber-500/15 text-amber-500 border border-amber-500/30"
                        : vitals.flight.status === "ON_SCHEDULE"
                          ? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30"
                          : "bg-primary/10 text-primary border border-primary/20",
                    )}
                  >
                    {vitals.flight.delayMinutes > 0
                      ? `+${vitals.flight.delayMinutes}m DELAY`
                      : vitals.flight.flightNumber
                        ? "ON SCHEDULE"
                        : "COMING SOON"}
                  </span>
                </div>
                <div className="my-2">
                  <p className="text-lg font-bold text-foreground">
                    {vitals.flight.flightNumber || "Coming Soon"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {vitals.flight.origin && vitals.flight.destination
                      ? `${vitals.flight.origin} → ${vitals.flight.destination}`
                      : `${activeTrip.travelMode || "Transit"} tracking · Integration in progress`}
                  </p>
                </div>
                <div className="pt-2 border-t border-border/50 flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">
                    {vitals.flight.gate ? `Gate ${vitals.flight.gate}` : "Live Gate Radar"}
                  </span>
                  <span className="text-xs font-medium text-primary">
                    Coming Soon
                  </span>
                </div>
              </div>

              {/* Weather Vital */}
              <div className="rounded-2xl glass-panel p-4 flex flex-col justify-between border-l-4 border-l-sky-500 hover:border-sky-500/60 transition">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <CloudRain className="h-3.5 w-3.5 text-sky-500" />
                    Weather Radar
                  </span>
                  <span className="rounded-full bg-sky-500/10 border border-sky-500/30 px-2 py-0.5 text-[10px] font-bold text-sky-500">
                    LIVE RADAR
                  </span>
                </div>
                <div className="my-2">
                  <p className="text-lg font-bold text-foreground flex items-center gap-2">
                    {vitals.weather.temperatureC}°C
                    <span className="text-xs font-normal text-muted-foreground">
                      ({vitals.weather.condition})
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {vitals.weather.rainProbabilityPercent}% Rain Risk · Wind {vitals.weather.windSpeedKmh} km/h
                  </p>
                </div>
                <div className="pt-2 border-t border-border/50 text-[11px] text-muted-foreground truncate">
                  Station: {vitals.weather.location}
                </div>
              </div>

              {/* Budget Vital */}
              <div className="rounded-2xl glass-panel p-4 flex flex-col justify-between border-l-4 border-l-emerald-500 hover:border-emerald-500/60 transition">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Wallet className="h-3.5 w-3.5 text-emerald-500" />
                    Budget Health
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-bold",
                      vitals.budget.status === "OVER_BUDGET"
                        ? "bg-destructive/15 text-destructive border border-destructive/30"
                        : vitals.budget.status === "WARNING"
                          ? "bg-amber-500/15 text-amber-500 border border-amber-500/30"
                          : "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30",
                    )}
                  >
                    {vitals.budget.pctUsed}% USED
                  </span>
                </div>
                <div className="my-2">
                  <p className="text-lg font-bold text-foreground">
                    ₹{vitals.budget.totalSpent.toLocaleString("en-IN")}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      / ₹{vitals.budget.budgetTotal.toLocaleString("en-IN")}
                    </span>
                  </p>
                  <Progress value={Math.min(100, vitals.budget.pctUsed)} className="h-1.5 mt-2" />
                </div>
                <div className="pt-2 border-t border-border/50 flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">
                    ₹{vitals.budget.remaining.toLocaleString("en-IN")} buffer
                  </span>
                  <Link to="/budget" className="text-primary hover:underline font-medium">
                    Ledger →
                  </Link>
                </div>
              </div>

              {/* Schedule Vital */}
              <div className="rounded-2xl glass-panel p-4 flex flex-col justify-between border-l-4 border-l-purple-500 hover:border-purple-500/60 transition">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-purple-500" />
                    Schedule Health
                  </span>
                  <span className="rounded-full bg-purple-500/10 border border-purple-500/30 px-2 py-0.5 text-[10px] font-bold text-purple-500">
                    {vitals.schedule.hasTimingConflict ? "CONFLICT" : "OPTIMAL"}
                  </span>
                </div>
                <div className="my-2">
                  <p className="text-lg font-bold text-foreground">
                    {vitals.schedule.totalDays} Days · {vitals.schedule.totalActivities} Stops
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {vitals.schedule.hasTimingConflict
                      ? "Arrival schedule conflict detected"
                      : "Balanced daily activity pacing"}
                  </p>
                </div>
                <div className="pt-2 border-t border-border/50 flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">Itinerary Sync</span>
                  <Link
                    to="/trips/$tripId"
                    params={{ tripId: activeTrip._id }}
                    className="text-primary hover:underline font-medium"
                  >
                    View Plan →
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* ── 3. Inline Quick Transit Input Drawer ── */}
          <AnimatePresence>
            {transitInputOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="rounded-2xl glass-panel p-5 border border-primary/30 bg-primary/5">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <h4 className="font-semibold text-sm flex items-center gap-2">
                        <Plane className="h-4 w-4 text-primary" />
                        Link Flight or Train Number for Live Radar
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Enter your flight number (e.g. 6E-204, AI-101, UK-850) or Indian Railways train number (e.g. 12618) to stream live delay, gate, and terminal radar.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <Input
                        value={transitRefValue}
                        onChange={(e) => setTransitRefValue(e.target.value)}
                        placeholder="e.g. 6E-204"
                        className="h-9 w-full sm:w-44 text-sm font-mono uppercase bg-background"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveTransitRef();
                        }}
                      />
                      <Button
                        size="sm"
                        onClick={saveTransitRef}
                        disabled={isSavingTransit || !transitRefValue.trim()}
                        className="h-9"
                      >
                        {isSavingTransit ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                        ) : (
                          <Check className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        Track
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setTransitInputOpen(false)}
                        className="h-9 text-muted-foreground"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── 4. Main Body: Intel Feed & Right Rail ── */}
          <div className="grid gap-6 lg:grid-cols-[1fr_330px]">
            {/* Left Column: Events & Actions */}
            <div className="space-y-5">
              {/* Filter Tabs */}
              <div className="flex flex-wrap items-center gap-1.5 border-b border-border/50 pb-3">
                <Button
                  variant={filter === "all" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setFilter("all")}
                  className="h-8 rounded-lg text-xs"
                >
                  All Intel ({rawEvents.length})
                </Button>
                <Button
                  variant={filter === "actionable" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setFilter("actionable")}
                  className={cn(
                    "h-8 rounded-lg text-xs relative",
                    actionableCount > 0 && filter !== "actionable" && "text-amber-500 font-semibold",
                  )}
                >
                  <Zap className="h-3 w-3 mr-1" />
                  Action Required
                  {actionableCount > 0 && (
                    <span className="ml-1.5 rounded-full bg-amber-500/20 px-1.5 py-0.2 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                      {actionableCount}
                    </span>
                  )}
                </Button>
                <Button
                  variant={filter === "weather" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setFilter("weather")}
                  className="h-8 rounded-lg text-xs"
                >
                  <CloudRain className="h-3 w-3 mr-1" />
                  Weather
                </Button>
                <Button
                  variant={filter === "transit" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setFilter("transit")}
                  className="h-8 rounded-lg text-xs"
                >
                  <Plane className="h-3 w-3 mr-1" />
                  Transit (Coming Soon)
                </Button>
                <Button
                  variant={filter === "budget" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setFilter("budget")}
                  className="h-8 rounded-lg text-xs"
                >
                  <Wallet className="h-3 w-3 mr-1" />
                  Budget
                </Button>
                <Button
                  variant={filter === "resolved" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setFilter("resolved")}
                  className="h-8 rounded-lg text-xs"
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Applied ({resolvedCount})
                </Button>
              </div>

              {/* Event Cards List */}
              {filteredEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl glass-panel p-12 text-center border-dashed">
                  <ShieldCheck className="h-10 w-10 text-emerald-500/40 mb-3" />
                  <p className="text-base font-semibold">No alerts in this category</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                    {filter === "actionable"
                      ? "All current operational conditions are nominal. No pending interventions required."
                      : "Trip Commander is actively monitoring background feeds and will notify you of any schedule or environmental shifts."}
                  </p>
                  {filter !== "all" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFilter("all")}
                      className="mt-4 h-8 text-xs"
                    >
                      View All Intel
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <AnimatePresence>
                    {filteredEvents.map((e, i) => {
                      const Icon = iconOf[e.kind] ?? Sparkles;
                      const isProcessing = processingId === e.id;
                      const toneRing =
                        e.severity === "bad"
                          ? "ring-destructive/50 bg-destructive/10 text-destructive"
                          : e.severity === "warn"
                            ? "ring-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : "ring-primary/40 bg-primary/10 text-primary";

                      return (
                        <motion.article
                          key={e.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -30, height: 0, marginBottom: 0 }}
                          transition={{ duration: 0.3, delay: i * 0.04 }}
                          className={cn(
                            "rounded-2xl glass-panel p-5 transition-all border",
                            e.isAccepted
                              ? "border-emerald-500/40 bg-emerald-500/5"
                              : e.severity === "bad"
                                ? "border-destructive/30 hover:border-destructive/60"
                                : e.severity === "warn"
                                  ? "border-amber-500/30 hover:border-amber-500/60"
                                  : "border-border/60 hover:border-primary/40",
                          )}
                        >
                          <div className="flex items-start gap-4">
                            {/* Left Icon Badge */}
                            <span
                              className={cn(
                                "grid h-11 w-11 shrink-0 place-items-center rounded-xl ring-2",
                                toneRing,
                              )}
                            >
                              <Icon className="h-5 w-5" />
                            </span>

                            {/* Main Content */}
                            <div className="min-w-0 flex-1">
                              {/* Header Meta */}
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-semibold text-base leading-snug">{e.title}</h3>

                                {e.dataType === "LIVE_VERIFIED" && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    LIVE
                                  </span>
                                )}

                                {e.dataType === "CACHED_VERIFIED" && (
                                  <span className="rounded-full bg-blue-500/10 border border-blue-500/25 px-2 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">
                                    VERIFIED CACHE
                                  </span>
                                )}

                                {e.dataType === "UNAVAILABLE" && (
                                  <span className="rounded-full bg-muted border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                    UNAVAILABLE
                                  </span>
                                )}

                                <span className="text-xs text-muted-foreground">{e.when}</span>

                                {e.source && (
                                  <span className="text-[10px] text-muted-foreground/80 bg-background/60 border border-border/40 px-1.5 py-0.5 rounded">
                                    {e.source}
                                  </span>
                                )}

                                {e.isAccepted && (
                                  <span className="ml-auto flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                    <Check className="h-3 w-3" /> Plan Applied
                                  </span>
                                )}
                              </div>

                              {/* Why & Action Columns */}
                              <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr]">
                                <div className="rounded-xl bg-background/50 p-3 border border-border/40">
                                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                    <Activity className="h-3 w-3" /> Telemetry & Context
                                  </p>
                                  <p className="mt-1 text-xs text-foreground leading-relaxed">{e.reason}</p>
                                </div>

                                {e.action && (
                                  <div className="rounded-xl bg-background/50 p-3 border border-border/40">
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-primary flex items-center gap-1">
                                      <Sparkles className="h-3 w-3" /> Advenza Recommendation
                                    </p>
                                    <p className="mt-1 text-xs text-foreground leading-relaxed">{e.action}</p>
                                  </div>
                                )}
                              </div>

                              {/* Net Effect Delta */}
                              {e.delta && (
                                <p className="mt-2.5 rounded-lg bg-primary/5 border border-primary/15 px-3 py-1.5 text-xs text-primary flex items-center gap-1.5">
                                  <span className="font-semibold">Net Effect:</span>
                                  {e.delta}
                                </p>
                              )}

                              {/* Interactive Action Bar */}
                              <div className="mt-3.5 flex flex-wrap items-center gap-2 pt-2 border-t border-border/40">
                                {e.isAccepted ? (
                                  <div className="flex flex-wrap items-center justify-between w-full gap-2">
                                    <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 font-medium">
                                      <CheckCircle2 className="h-4 w-4" />
                                      {e.actionTaken || "Intervention successfully applied to trip."}
                                    </p>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-8 text-xs text-muted-foreground hover:text-destructive"
                                      onClick={() => revertPlan(e.id)}
                                      disabled={isProcessing}
                                    >
                                      {isProcessing ? (
                                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <Undo2 className="mr-1 h-3.5 w-3.5" />
                                      )}
                                      Revert
                                    </Button>
                                  </div>
                                ) : e.actionable ? (
                                  <>
                                    <Button
                                      size="sm"
                                      className="h-8 text-xs shadow-xs"
                                      onClick={() => acceptPlan(e)}
                                      disabled={isProcessing}
                                    >
                                      {isProcessing ? (
                                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <Check className="mr-1 h-3.5 w-3.5" />
                                      )}
                                      {isProcessing
                                        ? "Applying Plan..."
                                        : e.actionLabel || "Apply Recommendation"}
                                    </Button>

                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-8 text-xs text-muted-foreground"
                                      onClick={() => {
                                        setDismissedLocal((prev) => new Set([...prev, e.id]));
                                      }}
                                    >
                                      Dismiss
                                    </Button>
                                  </>
                                ) : e.actionType === "INPUT_TRANSIT_REF" ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 text-xs border-primary/40 text-primary hover:bg-primary/10"
                                    onClick={() => {
                                      setTransitInputOpen(true);
                                    }}
                                  >
                                    <Plane className="mr-1 h-3.5 w-3.5" />
                                    Track Flight / Train Reference
                                  </Button>
                                ) : (
                                  <span className="text-[11px] text-muted-foreground flex items-center gap-1.5 py-1">
                                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-500/80" />
                                    Telemetry Monitored · No Action Required
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </motion.article>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* Right Column: Commander Copilot & Tools */}
            <aside className="space-y-6">
              {/* "Ask Commander" Quick Assistant */}
              <div className="rounded-2xl glass-panel p-5 border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card">
                <div className="flex items-center gap-2 text-primary">
                  <Sparkles className="h-4 w-4" />
                  <h4 className="font-semibold text-sm">Ask Commander</h4>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                  Give a natural language command to adjust schedules, shift timing, or rebalance budgets.
                </p>

                <div className="mt-3 flex items-center gap-1.5">
                  <Input
                    value={commandText}
                    onChange={(e) => setCommandText(e.target.value)}
                    placeholder="e.g. Add 1h afternoon coffee buffer..."
                    className="h-9 text-xs bg-background"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") executeInstruction();
                    }}
                  />
                  <Button
                    size="sm"
                    className="h-9 px-3 shrink-0"
                    onClick={() => executeInstruction()}
                    disabled={isExecutingCommand || !commandText.trim()}
                  >
                    {isExecutingCommand ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>

                {commandFeedback && (
                  <p className="mt-2 text-xs rounded-lg bg-primary/10 p-2 text-foreground border border-primary/20">
                    {commandFeedback}
                  </p>
                )}

                {/* Preset Chips */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <button
                    onClick={() =>
                      executeInstruction("Insert a 45-minute afternoon relaxation buffer on Day 1")
                    }
                    className="text-[10px] bg-background/80 hover:bg-primary/10 hover:text-primary border border-border/50 rounded-md px-2 py-1 transition text-left"
                  >
                    + 45m Day 1 Rest Buffer
                  </button>
                  <button
                    onClick={() =>
                      executeInstruction("Add indoor rainy backup activity to Day 2 afternoon")
                    }
                    className="text-[10px] bg-background/80 hover:bg-primary/10 hover:text-primary border border-border/50 rounded-md px-2 py-1 transition text-left"
                  >
                    + Day 2 Rain Backup
                  </button>
                  <button
                    onClick={() =>
                      executeInstruction("Allocate ₹3,000 emergency contingency reserve in budget")
                    }
                    className="text-[10px] bg-background/80 hover:bg-primary/10 hover:text-primary border border-border/50 rounded-md px-2 py-1 transition text-left"
                  >
                    + ₹3,000 Contingency Reserve
                  </button>
                </div>
              </div>

              {/* Mission Summary Card */}
              <div className="rounded-2xl glass-panel p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Mission Summary
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-background/50 p-3 border border-border/40">
                    <p className="text-2xl font-bold font-display">{rawEvents.length}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Monitored Alerts</p>
                  </div>
                  <div className="rounded-xl bg-background/50 p-3 border border-border/40">
                    <p className="text-2xl font-bold font-display text-emerald-600 dark:text-emerald-400">
                      {resolvedCount}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Applied Plans</p>
                  </div>
                </div>

                {vitals?.lastSync && (
                  <p className="mt-3 text-[10px] text-muted-foreground/80 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Last telemetry sync: {new Date(vitals.lastSync).toLocaleTimeString()}
                  </p>
                )}
              </div>


            </aside>
          </div>
        </div>
      )}

      {/* Radar Modal */}
      <TravelRadarModal
        isOpen={radarModalOpen}
        onOpenChange={setRadarModalOpen}
        activeTrip={activeTrip}
      />
    </AppShell>
  );
}
