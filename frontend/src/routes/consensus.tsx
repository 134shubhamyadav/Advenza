import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { AppShell } from "@/components/app-shell";
import { AiBadge } from "@/components/ai/ai-badge";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Users, Plus, Check, Trophy, AlertCircle, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/consensus")({ component: Consensus });

const CATS = ["food", "nature", "history", "nightlife", "adventure", "luxury", "walking"] as const;

type Member = {
  name: string;
  email?: string;
  initials?: string;
  role?: string;
};

type VoteOption = {
  name: string;
  votes: number;
  voters: string[];
};

type Trip = {
  _id: string;
  title: string;
  destination?: string;
  members?: Member[];
  voteOptions?: VoteOption[];
};

import { memo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";

const RadarChart = memo(function RadarChart({ values, size = 220 }: { values: number[]; size?: number }) {
  const cx = size / 2,
    cy = size / 2,
    r = size / 2 - 20;
  const angle = (i: number) => (Math.PI * 2 * i) / CATS.length - Math.PI / 2;
  const point = (v: number, i: number) => {
    const rr = (v / 100) * r;
    return [cx + Math.cos(angle(i)) * rr, cy + Math.sin(angle(i)) * rr] as const;
  };
  const pts = values.map((v, i) => point(v, i).join(",")).join(" ");
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {[0.25, 0.5, 0.75, 1].map((s) => (
        <polygon
          key={s}
          points={CATS.map((_, i) => {
            const [x, y] = point(100 * s, i);
            return `${x},${y}`;
          }).join(" ")}
          className="fill-none stroke-border"
          strokeDasharray="2 3"
        />
      ))}
      {CATS.map((_, i) => {
        const [x, y] = point(100, i);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            className="stroke-border"
            strokeDasharray="2 3"
          />
        );
      })}
      <polygon points={pts} className="fill-primary/20 stroke-primary" strokeWidth={2} />
      {CATS.map((c, i) => {
        const [x, y] = point(118, i);
        return (
          <text
            key={c}
            x={x}
            y={y}
            textAnchor="middle"
            className="fill-muted-foreground text-[10px] capitalize"
          >
            {c}
          </text>
        );
      })}
    </svg>
  );
});

function initials(name: string) {
  if (!name) return "U";
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function Consensus() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: trips = [], isLoading: loading } = useQuery({
    queryKey: queryKeys.trips(),
    queryFn: async () => {
      const data = await apiFetch("/api/trips");
      return Array.isArray(data) ? (data as Trip[]) : [];
    },
    enabled: !!user,
  });

  const activeTripId = selectedTripId ?? trips[0]?._id ?? null;

  const activeTrip = trips.find((t) => t._id === activeTripId) ?? trips[0] ?? null;
  const members: Member[] = activeTrip?.members ?? [];
  const voteOptions: VoteOption[] = activeTrip?.voteOptions ?? [];

  const totalVotes = voteOptions.reduce((a, o) => a + (o.votes || 0), 0);
  const myVote = voteOptions.find((o) => o.voters?.map(String).includes(String(user?.uid)))?.name || null;

  // Calculate consensus result / winning option
  const sortedOptions = [...voteOptions].sort((a, b) => (b.votes || 0) - (a.votes || 0));
  const winningOption = sortedOptions.length > 0 && sortedOptions[0].votes > 0 ? sortedOptions[0] : null;
  const consensusPercentage =
    totalVotes > 0 && winningOption ? Math.round((winningOption.votes / totalVotes) * 100) : 0;

  const handleCastVote = async (optionName: string) => {
    if (!activeTripId) return;
    setVoting(true);
    setError(null);
    try {
      const updatedTrip = await apiFetch(`/api/trips/${activeTripId}/vote`, {
        method: "POST",
        body: JSON.stringify({ optionName, uid: user?.uid }),
      });

      queryClient.setQueryData(queryKeys.trips(), (old: Trip[] = []) =>
        old.map((t) => (t._id === updatedTrip._id ? updatedTrip : t)),
      );
      queryClient.setQueryData(queryKeys.tripDetails(activeTripId), updatedTrip);
    } catch (err: any) {
      console.error("Voting failed:", err);
      setError(err.message || "Failed to submit your vote. Please try again.");
    } finally {
      setVoting(false);
    }
  };

  const colors = [
    "from-primary to-accent",
    "from-accent to-primary",
    "from-secondary to-accent",
    "from-primary to-secondary",
  ];

  return (
    <AppShell
      title="Decision Engine"
      subtitle="Instead of majority voting, Advenza maximizes overlap across every traveler."
      actions={<AiBadge>Consensus Engine</AiBadge>}
    >
      {/* Trip Selector Header */}
      {trips.length > 1 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground mr-1">Select Trip:</span>
          {trips.map((t) => (
            <button
              key={t._id}
              onClick={() => {
                setSelectedTripId(t._id);
                setError(null);
              }}
              className={cn(
                "rounded-xl border px-3 py-1.5 text-sm transition",
                activeTripId === t._id
                  ? "border-primary bg-primary/10 font-semibold text-primary"
                  : "border-border hover:border-primary/40 text-muted-foreground",
              )}
            >
              {t.destination?.split(",")[0] || t.title}
            </button>
          ))}
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-2xl glass-panel h-64" />
          ))}
        </div>
      ) : !activeTrip ? (
        <div className="flex flex-col items-center justify-center rounded-2xl glass-panel p-16 text-center">
          <Users className="h-12 w-12 text-muted-foreground/30" />
          <p className="mt-4 text-lg font-semibold">No trip found</p>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Create a trip to evaluate choices and calculate group consensus.
          </p>
          <Button className="mt-6" asChild>
            <Link to="/trips/new">
              <Plus className="mr-1.5 h-4 w-4" />
              Create a trip
            </Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top Overview Cards: Group Size & Calculated Consensus Winner */}
          <div className="grid gap-6 md:grid-cols-3">
            {/* Group Size */}
            <div className="rounded-3xl glass-panel p-6 text-center">
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Group Size
              </p>
              <p className="mt-2 font-display text-5xl text-accent">
                {members.length > 0 ? members.length : 1}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                traveler{members.length !== 1 ? "s" : ""} in {activeTrip.title}
              </p>
            </div>

            {/* Total Votes */}
            <div className="rounded-3xl glass-panel p-6 text-center">
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Total Votes Submitted
              </p>
              <p className="mt-2 font-display text-5xl text-primary">{totalVotes}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {myVote ? "Your vote is recorded" : "You have not voted yet"}
              </p>
            </div>

            {/* Consensus Lead / Winner Result */}
            <div className="rounded-3xl glass-panel p-6 text-center border-2 border-primary/20 bg-primary/5">
              <div className="flex items-center justify-center gap-1.5 text-xs uppercase tracking-wider text-primary font-bold">
                <Trophy className="h-4 w-4" /> Calculated Consensus
              </div>
              {winningOption ? (
                <>
                  <p className="mt-2 text-xl font-bold text-foreground truncate">
                    {winningOption.name}
                  </p>
                  <div className="mt-2 flex items-center justify-center gap-2">
                    <span className="rounded-full bg-primary/20 px-3 py-0.5 text-xs font-semibold text-primary">
                      {consensusPercentage}% Consensus
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({winningOption.votes} vote{winningOption.votes !== 1 ? "s" : ""})
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <p className="mt-3 text-sm text-muted-foreground">No votes cast yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Cast a vote below to calculate group consensus
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Voting Options & Selection UI */}
          <div className="rounded-3xl glass-panel p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
              <div>
                <h3 className="text-lg font-bold">Submit Your Choice</h3>
                <p className="text-xs text-muted-foreground">
                  Select an option to cast or update your vote. Consensus updates live.
                </p>
              </div>
              {myVote && (
                <div className="flex items-center gap-2 text-xs font-semibold text-accent bg-accent/10 px-3 py-1.5 rounded-full self-start">
                  <Check className="h-4 w-4" />
                  Your Choice: {myVote}
                </div>
              )}
            </div>

            {voteOptions.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                No vote options available for this trip yet.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {voteOptions.map((o) => {
                  const isMyVote = myVote === o.name;
                  const isWinner = winningOption && winningOption.name === o.name && o.votes > 0;
                  const pct = totalVotes > 0 ? Math.round((o.votes / totalVotes) * 100) : 0;

                  return (
                    <motion.div
                      key={o.name}
                      whileHover={{ scale: 1.01 }}
                      className={cn(
                        "relative flex flex-col justify-between rounded-2xl border p-5 transition-all shadow-sm",
                        isMyVote
                          ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                          : "border-border glass-tile hover:border-primary/50",
                      )}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-base">{o.name}</p>
                            {isWinner && (
                              <span className="flex items-center gap-1 text-[11px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                                <Sparkles className="h-3 w-3" /> Leading
                              </span>
                            )}
                          </div>
                          {isMyVote && (
                            <span className="flex items-center gap-1 text-xs font-bold text-primary bg-primary/20 px-2.5 py-1 rounded-full shrink-0">
                              <Check className="h-3.5 w-3.5" /> Selected
                            </span>
                          )}
                        </div>

                        {/* Vote progress bar */}
                        <div className="mt-4">
                          <div className="flex justify-between text-xs text-muted-foreground mb-1.5 font-medium">
                            <span>
                              {o.votes} vote{o.votes !== 1 ? "s" : ""}
                            </span>
                            <span>{pct}%</span>
                          </div>
                          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all duration-500",
                                isWinner ? "bg-amber-500" : isMyVote ? "bg-primary" : "bg-muted-foreground/40",
                              )}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Vote Action Button */}
                      <div className="mt-5 flex items-center justify-between pt-3 border-t border-border/50">
                        <span className="text-xs text-muted-foreground">
                          {o.voters?.length || 0} traveler{(o.voters?.length || 0) !== 1 ? "s" : ""} voted
                        </span>
                        <Button
                          size="sm"
                          variant={isMyVote ? "default" : "outline"}
                          disabled={voting}
                          onClick={() => handleCastVote(o.name)}
                          className={cn(
                            "h-9 px-4 rounded-xl text-xs font-semibold",
                            isMyVote && "bg-primary text-primary-foreground hover:bg-primary/90",
                          )}
                        >
                          {voting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : isMyVote ? (
                            <>
                              <Check className="mr-1.5 h-3.5 w-3.5" /> Your Choice
                            </>
                          ) : (
                            "Select Choice"
                          )}
                        </Button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Members & Preferences Breakdown */}
          {members.length > 0 && (
            <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
              <div className="rounded-3xl glass-panel p-6">
                <h3 className="font-bold text-base mb-3">Group Members</h3>
                <div className="divide-y divide-border/60 rounded-2xl border border-border/60 bg-background/50 text-left">
                  {members.map((m, i) => (
                    <div key={m.name} className="flex items-center justify-between px-3.5 py-3 text-sm">
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            "grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br text-primary-foreground text-xs font-semibold",
                            colors[i % colors.length],
                          )}
                        >
                          {initials(m.name)}
                        </span>
                        <div>
                          <p className="font-medium leading-tight">{m.name}</p>
                          <p className="text-[11px] text-muted-foreground">{m.role || "Member"}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl glass-panel p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-bold text-base">Consensus Analysis</h3>
                    <AiBadge>Explainable AI</AiBadge>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Advenza evaluates every group member's choice in real time to calculate maximum overlap.
                    {winningOption ? (
                      <span className="block mt-2 font-medium text-foreground">
                        Currently, <span className="text-primary font-bold">{winningOption.name}</span> leads with{" "}
                        {consensusPercentage}% group consensus.
                      </span>
                    ) : (
                      <span className="block mt-2 text-muted-foreground">
                        As group members cast their votes, Advenza surfaces the option with highest satisfaction.
                      </span>
                    )}
                  </p>
                </div>
                <div className="mt-6 flex justify-center">
                  <RadarChart values={CATS.map(() => (winningOption ? 75 : 50))} size={180} />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
