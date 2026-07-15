import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AppShell } from "@/components/app-shell";
import { AiBadge } from "@/components/ai/ai-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import {
  MapPin,
  Clock,
  CloudRain,
  Send,
  Sparkles,
  AlertTriangle,
  Lightbulb,
  Calendar,
  Compass,
  ArrowRight,
  Shield,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/simulator")({ component: PlanBPage });

type Alternative = {
  name: string;
  why: string;
  cost: string;
  how: string;
};

type BackupPlan = {
  scenario: string;
  backupPlan: string;
  alternatives: Alternative[];
  rearrangement: string;
  practicalTip: string;
};

type TripSummary = {
  _id: string;
  title: string;
  destination?: string;
  startDate?: string;
  endDate?: string;
};

function PlanBPage() {
  const [trips, setTrips] = useState<TripSummary[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<TripSummary | null>(null);
  const [loadingTrips, setLoadingTrips] = useState(true);
  const [customInput, setCustomInput] = useState("");
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<BackupPlan | null>(null);
  const [error, setError] = useState("");
  
  const resultsRef = useRef<HTMLDivElement>(null);

  // Load user's trips on mount
  useEffect(() => {
    apiFetch("/api/trips")
      .then((data: TripSummary[]) => {
        setTrips(data);
        if (data.length > 0) {
          setSelectedTrip(data[0]);
        }
      })
      .catch(() => setError("Could not load your trips."))
      .finally(() => setLoadingTrips(false));
  }, []);

  const handleSelectTrip = (trip: TripSummary) => {
    setSelectedTrip(trip);
    setCurrentPlan(null);
    setCustomInput("");
    setError("");
  };

  const handleAskPlanB = async (question: string) => {
    if (!selectedTrip) return;
    try {
      setLoadingPlan(true);
      setError("");
      setCurrentPlan(null);

      const data = await apiFetch("/api/ai/planb", {
        method: "POST",
        body: JSON.stringify({
          tripId: selectedTrip._id,
          question,
        }),
      });

      setCurrentPlan(data);
      
      // Smooth scroll to results
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (err: any) {
      setError(err.message || "Failed to generate contingency plan. Please try again.");
    } finally {
      setLoadingPlan(false);
    }
  };

  const handleSubmitCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInput.trim()) return;
    handleAskPlanB(customInput);
  };

  // Pre-configured intelligent backup query prompts
  const suggestions = [
    {
      label: "Missed a destination",
      query: "I missed a planned destination/attraction in my itinerary. Which nearby place should I visit instead?",
      icon: <MapPin className="h-4 w-4" />,
    },
    {
      label: "Arriving late",
      query: "I am arriving late at my location. How should the remaining itinerary be rearranged?",
      icon: <Clock className="h-4 w-4" />,
    },
    {
      label: "Attraction closed",
      query: "One of the planned attractions is closed today. What is the best alternative nearby?",
      icon: <HelpCircle className="h-4 w-4" />,
    },
    {
      label: "Bad weather",
      query: "The weather has turned bad (heavy rain/excessive heat). Which indoor activities should replace the outdoor ones?",
      icon: <CloudRain className="h-4 w-4" />,
    },
    {
      label: "Transport delayed",
      query: "My train or flight is delayed. Which bookings or activities should be rescheduled?",
      icon: <Compass className="h-4 w-4" />,
    },
    {
      label: "Not enough time",
      query: "I don't have enough time to visit everything planned. Which attractions can be skipped without affecting the overall experience?",
      icon: <Calendar className="h-4 w-4" />,
    },
  ];

  return (
    <AppShell
      title="Plan B Contingency Assistant"
      subtitle="Intelligent, dynamic AI-powered backup recommendations when your travel plans hit a bump."
      actions={<AiBadge>AI Contingency Agent</AiBadge>}
    >
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        
        {/* ── Left panel: Trip Selector ── */}
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Select Active Trip
          </p>
          {loadingTrips ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-muted/40" />
              ))}
            </div>
          ) : trips.length === 0 ? (
            <div className="rounded-2xl glass-panel p-6 text-center">
              <AlertTriangle className="mx-auto h-8 w-8 text-muted-foreground/40" />
              <p className="mt-3 text-sm text-muted-foreground">
                No trips found. Create a trip first.
              </p>
            </div>
          ) : (
            trips.map((trip) => (
              <button
                key={trip._id}
                onClick={() => handleSelectTrip(trip)}
                className={cn(
                  "w-full rounded-2xl border p-4 text-left transition",
                  selectedTrip?._id === trip._id
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border bg-background hover:border-primary/40",
                )}
              >
                <p className="text-sm font-semibold leading-tight">{trip.title}</p>
                {trip.destination && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {trip.destination}
                  </p>
                )}
              </button>
            ))
          )}
        </div>

        {/* ── Right panel: AI Contingency Assistant ── */}
        <div className="space-y-6">
          {selectedTrip ? (
            <>
              {/* Trip Context Card */}
              <div className="rounded-2xl border border-primary/10 bg-primary/5 p-5">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <span className="font-semibold text-sm">Contingency Planner Active</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Analyzing itinerary for <strong className="text-foreground">{selectedTrip.title}</strong> ({selectedTrip.destination}).
                </p>
              </div>

              {/* Chat-style Assistant Header */}
              <div className="rounded-3xl glass-panel p-6 md:p-8">
                <div className="flex items-start gap-4">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/20">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-display text-xl font-semibold">Aventra Plan B Agent</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Tell me what went wrong or choose a scenario below. I will analyze your travel mode, timings, and itinerary to build a real-time adjustment.
                    </p>
                  </div>
                </div>

                {/* Instant Contingency Prompts */}
                <div className="mt-8">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    Choose a contingency scenario
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {suggestions.map((s, index) => (
                      <button
                        key={index}
                        onClick={() => handleAskPlanB(s.query)}
                        disabled={loadingPlan}
                        className="flex items-start gap-3 rounded-xl border border-border bg-background/50 p-4 text-left text-sm transition hover:border-primary/40 hover:bg-primary/5 disabled:opacity-55"
                      >
                        <span className="mt-0.5 text-primary">{s.icon}</span>
                        <span className="font-medium text-foreground/80">{s.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Contingency Input */}
                <form onSubmit={handleSubmitCustom} className="mt-8 border-t border-border/60 pt-6">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    Or describe a custom situation
                  </p>
                  <div className="flex gap-2">
                    <Input
                      value={customInput}
                      onChange={(e) => setCustomInput(e.target.value)}
                      placeholder="e.g. We missed our 2:00 PM train to Jaipur, what should we do?"
                      className="h-12 rounded-xl text-sm"
                      disabled={loadingPlan}
                    />
                    <Button type="submit" disabled={loadingPlan || !customInput.trim()} className="h-12 w-12 shrink-0 rounded-xl p-0">
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </form>
              </div>

              {/* Loading State */}
              <AnimatePresence>
                {loadingPlan && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center rounded-3xl glass-panel py-16 text-center"
                  >
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    <p className="mt-4 font-display text-lg font-medium">Formulating Contingency Plan B...</p>
                    <p className="mt-1 text-sm text-muted-foreground max-w-xs">
                      Consulting local spots, transport details, and shifting schedule timelines...
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Error messages */}
              {error && (
                <div className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive">
                  {error}
                </div>
              )}

              {/* Results View */}
              <AnimatePresence>
                {currentPlan && (
                  <motion.div
                    ref={resultsRef}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    <div className="rounded-3xl glass-panel p-6 md:p-8 space-y-6">
                      
                      {/* Scenario Trigger & Immediate Action */}
                      <div className="border-b border-border/60 pb-6">
                        <div className="flex items-start gap-3">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                            <Compass className="h-4.5 w-4.5" />
                          </span>
                          <div>
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              AI Contingency Recommendation
                            </span>
                            <h4 className="font-display text-lg font-semibold mt-1">
                              {currentPlan.scenario}
                            </h4>
                          </div>
                        </div>
                        
                        <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
                          <p className="text-xs font-bold uppercase tracking-wider text-primary">
                            Immediate Action Step
                          </p>
                          <p className="mt-1 text-sm leading-relaxed font-medium">
                            {currentPlan.backupPlan}
                          </p>
                        </div>
                      </div>

                      {/* Alternate Recommendations */}
                      {currentPlan.alternatives?.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                            Smart Nearby Alternatives
                          </p>
                          <div className="grid gap-4 sm:grid-cols-2">
                            {currentPlan.alternatives.map((alt, index) => (
                              <div key={index} className="rounded-2xl glass-tile p-5 flex flex-col justify-between">
                                <div>
                                  <div className="flex items-start justify-between gap-2">
                                    <h5 className="font-semibold text-sm">{alt.name}</h5>
                                    <span className="shrink-0 rounded-full bg-accent/20 px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
                                      {alt.cost}
                                    </span>
                                  </div>
                                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                                    {alt.why}
                                  </p>
                                </div>
                                <div className="mt-4 pt-3 border-t border-border/40 text-xs text-primary flex items-center gap-1">
                                  <ArrowRight className="h-3 w-3 shrink-0" />
                                  <span>{alt.how}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Itinerary Adjustment Section */}
                      <div className="rounded-2xl border border-border bg-background/40 p-5">
                        <div className="flex items-center gap-2 mb-2">
                          <Calendar className="h-4.5 w-4.5 text-muted-foreground" />
                          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Rearranging Timings & Schedule
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed text-foreground/80">
                          {currentPlan.rearrangement}
                        </p>
                      </div>

                      {/* Practical Tip */}
                      <div className="flex items-start gap-3 rounded-2xl bg-amber-500/5 border border-amber-500/20 p-5">
                        <Lightbulb className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-xs font-semibold uppercase tracking-wider text-amber-500">
                            Aventra Expert Tip
                          </span>
                          <p className="mt-1 text-sm leading-relaxed text-foreground/80">
                            {currentPlan.practicalTip}
                          </p>
                        </div>
                      </div>

                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-3xl glass-panel py-20 text-center">
              <Compass className="h-12 w-12 text-muted-foreground/30 animate-pulse" />
              <p className="mt-4 text-sm text-muted-foreground">
                Please select a trip from the left sidebar to activate the AI Contingency Agent.
              </p>
            </div>
          )}
        </div>

      </div>
    </AppShell>
  );
}
