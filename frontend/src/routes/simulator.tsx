import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef, memo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { AppShell } from "@/components/app-shell";
import { AiBadge } from "@/components/ai/ai-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";
import { useAuth } from "@/context/AuthContext";
import {
  MapPin,
  Send,
  Sparkles,
  AlertTriangle,
  Compass,
  User,
  Trash2,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/simulator")({ component: PlanBChatPage });

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  proposedDays?: any[] | null;
  applied?: boolean;
};

type Activity = {
  time: string;
  description: string;
};

type DayPlan = {
  dayNumber: number;
  date?: string;
  title: string;
  activities: Activity[];
};

type TripSummary = {
  _id: string;
  title: string;
  destination?: string;
  startDate?: string;
  endDate?: string;
  days?: DayPlan[];
};

// ── Lightweight Markdown renderer ─────────────────────────────────────────────
const MarkdownRenderer = memo(function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];

  const flush = (key: number) => {
    if (!listItems.length) return;
    elements.push(
      <ul key={`ul-${key}`} className="list-none pl-0 my-2.5 space-y-1.5 text-foreground/90">
        {listItems.map((item, i) => (
          <li key={i} dangerouslySetInnerHTML={{ __html: inline(item) }} />
        ))}
      </ul>,
    );
    listItems = [];
  };

  const inline = (t: string) =>
    t
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/`(.*?)`/g, '<code class="bg-muted/80 px-1.5 py-0.5 rounded font-mono text-xs text-primary">$1</code>');

  lines.forEach((line, idx) => {
    const t = line.trim();
    if (!t) { flush(idx); return; }

    if (t.startsWith("### ")) {
      flush(idx);
      elements.push(<h5 key={idx} className="text-sm font-semibold mt-3 mb-1.5 text-foreground" dangerouslySetInnerHTML={{ __html: inline(t.slice(4)) }} />);
    } else if (t.startsWith("## ")) {
      flush(idx);
      elements.push(<h4 key={idx} className="text-base font-bold mt-4 mb-2 text-primary border-b border-border/40 pb-1" dangerouslySetInnerHTML={{ __html: inline(t.slice(3)) }} />);
    } else if (t.startsWith("**") && t.endsWith("**") && !t.slice(2, -2).includes("**")) {
      // Bold-only line → treat as a section label
      flush(idx);
      elements.push(<p key={idx} className="font-semibold mt-3 mb-1 text-foreground text-sm" dangerouslySetInnerHTML={{ __html: inline(t) }} />);
    } else if (t.startsWith("- ") || t.startsWith("* ") || t.startsWith("✅") || t.startsWith("💰") || t.startsWith("⏱")) {
      // Treat emoji bullets and standard list items identically
      const cleaned = t.startsWith("- ") || t.startsWith("* ") ? t.slice(2) : t;
      listItems.push(cleaned);
    } else {
      flush(idx);
      elements.push(<p key={idx} className="my-1.5 leading-relaxed text-foreground/85 text-sm" dangerouslySetInnerHTML={{ __html: inline(t) }} />);
    }
  });

  flush(lines.length);
  return <div className="space-y-0.5">{elements}</div>;
});

// ── Inline Apply / Keep card ───────────────────────────────────────────────────
function ProposedChangesCard({
  proposedDays,
  applied,
  updatingId,
  currentMsgId,
  onApply,
  onKeep,
}: {
  proposedDays: any[];
  applied?: boolean;
  updatingId: string | null;
  currentMsgId: string;
  onApply: (msgId: string, days: any[]) => void;
  onKeep: (msgId: string) => void;
}) {
  const isUpdating = updatingId === currentMsgId;
  const affectedDays = proposedDays.map((d) => `Day ${d.dayNumber}`).join(", ");

  if (applied) {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-xl bg-green-500/10 border border-green-500/20 px-4 py-2.5 text-xs text-green-600">
        <Check className="h-3.5 w-3.5 shrink-0" />
        Changes applied to {affectedDays}. View your Itinerary page to see the full update.
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 space-y-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-primary/70">
        Ready to update · {affectedDays} {proposedDays.length === 1 ? "will change" : "will change"}
      </p>
      <div className="flex gap-2">
        <Button
          size="sm"
          className="h-8 rounded-lg px-4 text-xs"
          disabled={isUpdating}
          onClick={() => onApply(currentMsgId, proposedDays)}
        >
          {isUpdating ? "Applying…" : "Apply Changes"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 rounded-lg px-4 text-xs"
          disabled={isUpdating}
          onClick={() => onKeep(currentMsgId)}
        >
          Keep Original
        </Button>
      </div>
    </div>
  );
}

// Helper to calculate the current day number of a trip based on today's date
const getDefaultSimulatedDay = (trip: TripSummary) => {
  if (!trip.startDate) return 1;
  try {
    const start = new Date(trip.startDate);
    const today = new Date();
    start.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - start.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
    if (diffDays >= 1 && diffDays <= (trip.days?.length ?? 1)) {
      return diffDays;
    }
  } catch (e) {
    console.error("Error calculating default simulated day:", e);
  }
  return 1;
};

// ── Main Page ─────────────────────────────────────────────────────────────────
function PlanBChatPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [simulatedDay, setSimulatedDay] = useState<number>(1);

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputVal, setInputVal] = useState("");
  const [loadingResponse, setLoadingResponse] = useState(false);
  const [error, setError] = useState("");

  const [applyingMsgId, setApplyingMsgId] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  const { data: trips = [], isLoading: loadingTrips } = useQuery({
    queryKey: queryKeys.trips(),
    queryFn: async () => {
      const data = await apiFetch("/api/trips");
      return Array.isArray(data) ? (data as TripSummary[]) : [];
    },
    enabled: !!user,
  });

  const selectedTrip = (selectedTripId ? trips.find((t) => t._id === selectedTripId) : trips[0]) ?? null;

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loadingResponse]);

  useEffect(() => {
    if (selectedTrip && messages.length === 0) {
      setSimulatedDay(getDefaultSimulatedDay(selectedTrip));
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content: `Hey! I'm your **Plan B assistant** for **${selectedTrip.title}** ✈️\n\nIf anything goes sideways during your trip to **${selectedTrip.destination || "your destination"}**, just tell me what happened in plain language — like texting a friend who knows the place.\n\nFor example:\n- *Our train is delayed by 2 hours*\n- *We missed Charminar this morning*\n- *It started raining heavily*\n- *The museum is closed today*\n- *We're too tired to carry on*\n\nI'll figure out the best recovery plan for you.`,
          timestamp: new Date(),
        },
      ]);
    }
  }, [selectedTrip?._id]);

  const selectTrip = (trip: TripSummary) => {
    setSelectedTripId(trip._id);
    setSimulatedDay(getDefaultSimulatedDay(trip));
    setError("");
    setApplyingMsgId(null);
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: `Hey! I'm your **Plan B assistant** for **${trip.title}** ✈️\n\nIf anything goes sideways during your trip to **${trip.destination || "your destination"}**, just tell me what happened in plain language — like texting a friend who knows the place.\n\nFor example:\n- *Our train is delayed by 2 hours*\n- *We missed Charminar this morning*\n- *It started raining heavily*\n- *The museum is closed today*\n- *We're too tired to carry on*\n\nI'll figure out the best recovery plan for you.`,
        timestamp: new Date(),
      },
    ]);
    setInputVal("");
  };

  const sendMessage = async (text: string) => {
    if (!selectedTrip || !text.trim() || loadingResponse) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: new Date(),
    };

    const next = [...messages, userMsg];
    setMessages(next);
    setInputVal("");
    setLoadingResponse(true);
    setError("");

    try {
      const payload = next
        .filter((m) => m.id !== "welcome")
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await apiFetch("/api/ai/planb", {
        method: "POST",
        body: JSON.stringify({
          tripId: selectedTrip._id,
          messages: payload,
          currentDay: simulatedDay,
        }),
      });

      const aiMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: res.reply,
        proposedDays:
          Array.isArray(res.proposedDays) && res.proposedDays.length > 0
            ? res.proposedDays
            : null,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      setError(err.message || "Failed to reach the assistant. Please try again.");
    } finally {
      setLoadingResponse(false);
    }
  };

  const applyChanges = async (msgId: string, proposedDays: any[]) => {
    if (!selectedTrip || !proposedDays.length) return;
    setApplyingMsgId(msgId);
    setError("");

    try {
      console.log("[Plan B] Applying days:", proposedDays.map((d) => d.dayNumber));
      const updated = await apiFetch(`/api/trips/${selectedTrip._id}/itinerary`, {
        method: "PUT",
        body: JSON.stringify({ days: proposedDays }),
      });
      console.log("[Plan B] Updated trip returned with", updated?.days?.length, "days");

      // Mark the message card as applied
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, applied: true } : m)),
      );

      // Sync query cache
      queryClient.setQueryData(queryKeys.trips(), (old: TripSummary[] = []) =>
        old.map((t) => (t._id === updated._id ? updated : t)),
      );
      queryClient.setQueryData(queryKeys.tripDetails(selectedTrip._id), updated);

      const affected = proposedDays.map((d) => `Day ${d.dayNumber}`).join(", ");
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `✅ Done! I've updated ${affected} in your itinerary. All other days are untouched. Head over to your **Itinerary** page to see the full updated plan.`,
          timestamp: new Date(),
        },
      ]);
    } catch (err: any) {
      console.error("[Plan B] Apply failed:", err.message);
      setError(
        err.message
          ? `Couldn't save changes: ${err.message}`
          : "Something went wrong saving the changes. Please try again.",
      );
    } finally {
      setApplyingMsgId(null);
    }
  };

  const keepOriginal = (msgId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, proposedDays: null } : m)),
    );
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "No problem — I've kept your original itinerary unchanged. Let me know if you want to try a different approach!",
        timestamp: new Date(),
      },
    ]);
  };

  const suggestions = [
    "Our train is delayed by 2 hours",
    "We missed a key attraction this morning",
    "It started raining heavily",
    "We're too tired to continue today",
    "The museum is closed today",
    "We arrived late and missed entry slots",
  ];

  return (
    <AppShell
      title="Plan B Assistant"
      subtitle="Describe what happened and get instant, personalised recovery suggestions."
      actions={<AiBadge>Live Contingency Chat</AiBadge>}
    >
      <div className="grid gap-6 lg:grid-cols-[260px_1fr] h-[calc(100vh-210px)] min-h-[500px]">

        {/* ── Trip Selector ── */}
        <div className="flex flex-col space-y-3 h-full overflow-y-auto pr-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Your Trips
          </p>
          {loadingTrips ? (
            [1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-muted/40" />
            ))
          ) : trips.length === 0 ? (
            <div className="rounded-2xl glass-panel p-6 text-center">
              <AlertTriangle className="mx-auto h-8 w-8 text-muted-foreground/40" />
              <p className="mt-3 text-sm text-muted-foreground">No trips found. Plan a trip first.</p>
            </div>
          ) : (
            trips.map((trip) => (
              <button
                key={trip._id}
                onClick={() => setSelectedTripId(trip._id)}
                className={cn(
                  "w-full rounded-2xl border p-4 text-left transition shrink-0",
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

        {/* ── Chat Panel ── */}
        <div className="flex flex-col h-full rounded-3xl glass-panel overflow-hidden border border-border/80 bg-background/20">
          {selectedTrip ? (
            <>
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border/60 bg-background/40 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/10">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm leading-none">Plan B — {selectedTrip.destination}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedTrip.days?.length ?? 0}-day itinerary · always in sync
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium text-muted-foreground hidden sm:inline">Simulated Day:</span>
                    <Select
                      value={String(simulatedDay)}
                      onValueChange={(val) => setSimulatedDay(Number(val))}
                    >
                      <SelectTrigger className="w-[85px] h-8 text-xs rounded-lg bg-background/50 border-border/80">
                        <SelectValue placeholder="Day 1" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedTrip.days?.map((d) => (
                          <SelectItem key={d.dayNumber} value={String(d.dayNumber)}>
                            Day {d.dayNumber}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => selectTrip(selectedTrip)}
                    title="Reset conversation"
                    className="h-8 w-8 rounded-lg p-0 text-muted-foreground hover:text-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                <AnimatePresence initial={false}>
                  {messages.map((msg) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "flex gap-3",
                        msg.role === "user"
                          ? "ml-auto flex-row-reverse max-w-[78%]"
                          : "mr-auto max-w-[88%]",
                      )}
                    >
                      {/* Avatar */}
                      <div
                        className={cn(
                          "grid h-8 w-8 shrink-0 place-items-center rounded-lg mt-0.5",
                          msg.role === "user"
                            ? "bg-accent text-accent-foreground"
                            : "bg-primary text-primary-foreground",
                        )}
                      >
                        {msg.role === "user"
                          ? <User className="h-4 w-4" />
                          : <Sparkles className="h-4 w-4" />}
                      </div>

                      {/* Bubble + optional apply card */}
                      <div className="flex-1 min-w-0">
                        <div
                          className={cn(
                            "rounded-2xl px-4 py-3 text-sm shadow-sm leading-relaxed",
                            msg.role === "user"
                              ? "bg-primary text-primary-foreground rounded-tr-none"
                              : "glass-tile border border-border/80 rounded-tl-none text-foreground/90",
                          )}
                        >
                          {msg.role === "assistant"
                            ? <MarkdownRenderer content={msg.content} />
                            : <p className="whitespace-pre-wrap">{msg.content}</p>}
                          <span
                            className={cn(
                              "block text-[10px] mt-1.5 text-right",
                              msg.role === "user"
                                ? "text-primary-foreground/70"
                                : "text-muted-foreground",
                            )}
                          >
                            {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>

                        {/* Inline Apply / Keep card — appears only on messages that have proposed days */}
                        {msg.role === "assistant" && msg.proposedDays && msg.proposedDays.length > 0 && (
                          <ProposedChangesCard
                            proposedDays={msg.proposedDays}
                            applied={msg.applied}
                            updatingId={applyingMsgId}
                            currentMsgId={msg.id}
                            onApply={applyChanges}
                            onKeep={keepOriginal}
                          />
                        )}
                      </div>
                    </motion.div>
                  ))}

                  {/* Typing indicator */}
                  {loadingResponse && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex gap-3 mr-auto max-w-[80%]"
                    >
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground mt-0.5">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <div className="rounded-2xl px-4 py-3.5 glass-tile border border-border/80 rounded-tl-none">
                        <div className="flex gap-1.5 items-center py-0.5">
                          <span className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                          <span className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                          <span className="h-2 w-2 rounded-full bg-primary animate-bounce" />
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1.5">
                          Thinking through your options…
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div ref={chatEndRef} />
              </div>

              {/* Input area */}
              <div className="border-t border-border/60 bg-background/30 px-5 py-4 space-y-3">
                {/* Suggestion pills — shown only before first user message */}
                {messages.length === 1 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Quick starts
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {suggestions.map((s, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => sendMessage(s)}
                          className="rounded-full border border-border bg-background/60 hover:bg-primary/5 hover:border-primary/40 px-3 py-1 text-xs text-foreground/80 transition whitespace-nowrap"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Error */}
                {error && (
                  <div className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {error}
                  </div>
                )}

                {/* Input */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    sendMessage(inputVal);
                  }}
                  className="flex gap-2"
                >
                  <Input
                    value={inputVal}
                    onChange={(e) => setInputVal(e.target.value)}
                    placeholder="Tell me what happened (e.g. 'We missed City Palace', 'Train delayed 2 hrs'…)"
                    className="h-11 rounded-xl text-sm"
                    disabled={loadingResponse}
                  />
                  <Button
                    type="submit"
                    disabled={loadingResponse || !inputVal.trim()}
                    className="h-11 rounded-xl px-4 flex items-center gap-1.5"
                  >
                    <Send className="h-4 w-4" />
                    <span>Send</span>
                  </Button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <Compass className="h-12 w-12 text-muted-foreground/25 animate-pulse" />
              <p className="mt-4 text-sm text-muted-foreground">
                Select a trip on the left to start your contingency chat.
              </p>
            </div>
          )}
        </div>

      </div>
    </AppShell>
  );
}
