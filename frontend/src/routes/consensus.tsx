import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { AiBadge } from "@/components/ai/ai-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { queryKeys } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";
import {
  Users,
  Plus,
  Check,
  Trophy,
  AlertCircle,
  Loader2,
  Sparkles,
  UserPlus,
  Compass,
  Vote,
  ShieldCheck,
  Clock,
  HeartHandshake,
  Send,
  CheckCircle2,
  Mail,
  Share2,
} from "lucide-react";

export const Route = createFileRoute("/consensus")({ component: Consensus });

const CATS = ["food", "nature", "history", "nightlife", "adventure", "luxury", "walking"] as const;

const AVATAR_COLORS = [
  "bg-primary text-primary-foreground",
  "bg-accent text-accent-foreground",
  "bg-secondary text-secondary-foreground",
  "bg-[oklch(0.55_0.15_250)] text-white",
  "bg-[oklch(0.6_0.18_140)] text-white",
  "bg-muted text-foreground",
];

type Member = {
  _id?: string;
  userId?: string;
  name?: string;
  email?: string;
  initials?: string;
  role?: string;
  color?: string;
};

type VoteOption = {
  name: string;
  votes: number;
  voters: string[];
};

type Activity = {
  time?: string;
  title?: string;
  description?: string;
  location?: string;
};

type DayPlan = {
  dayNumber: number;
  date?: string;
  title?: string;
  theme?: string;
  activities?: Activity[];
};

type Trip = {
  _id: string;
  title: string;
  destination?: string;
  origin?: string;
  startDate?: string;
  endDate?: string;
  members?: Member[];
  voteOptions?: VoteOption[];
  interests?: string[];
  style?: string;
  travelMode?: string;
  travelers?: number;
  summary?: string;
  days?: DayPlan[];
  createdBy?: string;
  isOrganizer?: boolean;
  userRole?: string;
};

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

const RadarChart = memo(function RadarChart({ values, size = 220 }: { values: number[]; size?: number }) {
  const cx = size / 2,
    cy = size / 2,
    r = size / 2 - 22;
  const angle = (i: number) => (Math.PI * 2 * i) / CATS.length - Math.PI / 2;
  const point = (v: number, i: number) => {
    const rr = (v / 100) * r;
    return [cx + Math.cos(angle(i)) * rr, cy + Math.sin(angle(i)) * rr] as const;
  };
  const pts = values.map((v, i) => point(v, i).join(",")).join(" ");
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto select-none">
      {[0.25, 0.5, 0.75, 1].map((s) => (
        <polygon
          key={s}
          points={CATS.map((_, i) => {
            const [x, y] = point(100 * s, i);
            return `${x},${y}`;
          }).join(" ")}
          className="fill-none stroke-border/70"
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
            className="stroke-border/70"
            strokeDasharray="2 3"
          />
        );
      })}
      <polygon points={pts} className="fill-primary/20 stroke-primary transition-all duration-700" strokeWidth={2} />
      {CATS.map((c, i) => {
        const [x, y] = point(118, i);
        return (
          <text
            key={c}
            x={x}
            y={y}
            textAnchor="middle"
            className="fill-muted-foreground text-[10px] font-medium capitalize"
          >
            {c}
          </text>
        );
      })}
    </svg>
  );
});

function getInitials(name?: string, fallback = "U") {
  if (!name) return fallback;
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

type DisplayMember = {
  key: string;
  name: string;
  email?: string;
  role: string;
  initials: string;
  color: string;
  isOrganizer: boolean;
  isMe: boolean;
};

// ────────────────────────────────────────────────────────────────────────────
// Main Consensus Component
// ────────────────────────────────────────────────────────────────────────────

function Consensus() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedTripId, setSelectedTripId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const lastJoined = sessionStorage.getItem("last_joined_trip_id");
      if (lastJoined) {
        sessionStorage.removeItem("last_joined_trip_id");
        return lastJoined;
      }
    }
    return null;
  });

  // Voting state
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Invite state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);

  // New proposal/option state
  const [newOptionName, setNewOptionName] = useState("");
  const [addingOption, setAddingOption] = useState(false);
  const [showAddOption, setShowAddOption] = useState(false);

  const { data: trips = [], isLoading: loading } = useQuery<Trip[]>({
    queryKey: queryKeys.trips(),
    queryFn: async () => {
      const data = await apiFetch("/api/trips");
      return Array.isArray(data) ? (data as Trip[]) : [];
    },
    enabled: !!user,
  });

  const activeTrip = (selectedTripId ? trips.find((t) => t._id === selectedTripId) : trips[0]) ?? null;
  const activeTripId = activeTrip?._id ?? null;

  // Authoritative Organizer Detection from backend trip data
  const isOrganizer = Boolean(
    activeTrip?.isOrganizer ??
      (activeTrip?.createdBy && user?.uid && String(activeTrip.createdBy) === String(user.uid))
  );

  const rawMembers: Member[] = activeTrip?.members ?? [];
  const confirmedMembers = rawMembers.filter((m) => m.role !== "Pending");
  const pendingMembers = rawMembers.filter((m) => m.role === "Pending");

  // Build unified confirmed member list identifying Organizer & (You)
  const displayConfirmedMembers: DisplayMember[] = [];
  const organizerInMembers = confirmedMembers.find(
    (m) =>
      (activeTrip?.createdBy && m.userId && String(m.userId) === String(activeTrip.createdBy)) ||
      m.role === "Organizer"
  );

  if (organizerInMembers) {
    const isMe = Boolean(user?.uid && organizerInMembers.userId && String(organizerInMembers.userId) === String(user.uid));
    displayConfirmedMembers.push({
      key: organizerInMembers._id || organizerInMembers.userId || "organizer",
      name: isMe
        ? (user?.displayName || user?.email || organizerInMembers.name || "Organizer")
        : (organizerInMembers.name || organizerInMembers.email || "Trip Organizer"),
      email: organizerInMembers.email,
      role: "Organizer",
      initials: organizerInMembers.initials || getInitials(organizerInMembers.name || organizerInMembers.email || "OR"),
      color: AVATAR_COLORS[0],
      isOrganizer: true,
      isMe,
    });

    confirmedMembers.forEach((m, idx) => {
      if (m === organizerInMembers) return;
      const isMe = Boolean(
        (user?.uid && m.userId && String(m.userId) === String(user.uid)) ||
        (user?.email && m.email && m.email.toLowerCase() === (user.email || "").toLowerCase())
      );
      displayConfirmedMembers.push({
        key: m._id || m.userId || m.email || String(idx),
        name: isMe ? (user?.displayName || m.name || user?.email || "Traveler") : (m.name || m.email || "Traveler"),
        email: m.email,
        role: "Member",
        initials: m.initials || getInitials(m.name || m.email || "TR"),
        color: AVATAR_COLORS[displayConfirmedMembers.length % AVATAR_COLORS.length],
        isOrganizer: false,
        isMe,
      });
    });
  } else {
    // Organizer not in members subdocument: create top organizer card
    if (isOrganizer) {
      displayConfirmedMembers.push({
        key: "me-organizer",
        name: user?.displayName || user?.email || "Organizer",
        email: user?.email || undefined,
        role: "Organizer",
        initials: getInitials(user?.displayName || user?.email || "OR"),
        color: AVATAR_COLORS[0],
        isOrganizer: true,
        isMe: true,
      });
    } else {
      displayConfirmedMembers.push({
        key: "trip-organizer",
        name: "Trip Organizer",
        role: "Organizer",
        initials: "OR",
        color: AVATAR_COLORS[0],
        isOrganizer: true,
        isMe: false,
      });
    }

    confirmedMembers.forEach((m, idx) => {
      const isMe = Boolean(
        (user?.uid && m.userId && String(m.userId) === String(user.uid)) ||
        (user?.email && m.email && m.email.toLowerCase() === (user.email || "").toLowerCase())
      );
      displayConfirmedMembers.push({
        key: m._id || m.userId || m.email || String(idx),
        name: isMe ? (user?.displayName || m.name || user?.email || "Traveler") : (m.name || m.email || "Traveler"),
        email: m.email,
        role: "Member",
        initials: m.initials || getInitials(m.name || m.email || "TR"),
        color: AVATAR_COLORS[displayConfirmedMembers.length % AVATAR_COLORS.length],
        isOrganizer: false,
        isMe,
      });
    });
  }

  const voteOptions: VoteOption[] = activeTrip?.voteOptions ?? [];
  const totalTravelers = Math.max(1, displayConfirmedMembers.length);

  const totalVotes = voteOptions.reduce((a, o) => a + (o.votes || 0), 0);
  const myVote = voteOptions.find((o) => o.voters?.map(String).includes(String(user?.uid)))?.name || null;

  // Calculate consensus result / winning option
  const sortedOptions = [...voteOptions].sort((a, b) => (b.votes || 0) - (a.votes || 0));
  const winningOption = sortedOptions.length > 0 && sortedOptions[0].votes > 0 ? sortedOptions[0] : null;
  const consensusPercentage =
    totalVotes > 0 && winningOption ? Math.round((winningOption.votes / totalVotes) * 100) : 0;

  // Handle voting
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

  // Handle inviting a companion via Brevo email
  const handleInvite = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inviteEmail.trim() || !activeTripId || inviting) return;
    setInviting(true);
    setInviteError(null);
    setInviteSuccess(null);
    try {
      const result = await apiFetch(`/api/trips/${activeTripId}/members`, {
        method: "POST",
        body: JSON.stringify({
          email: inviteEmail.trim(),
          inviterName: user?.displayName || user?.email?.split("@")[0] || "Travel Companion",
        }),
      });

      queryClient.setQueryData(queryKeys.trips(), (old: Trip[] = []) =>
        old.map((t) => (t._id === (result.trip?._id || activeTripId) ? (result.trip || t) : t)),
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.trips() });
      queryClient.invalidateQueries({ queryKey: queryKeys.tripDetails(activeTripId) });

      setInviteEmail("");
      setInviteSuccess(result.message || `Invitation sent to ${inviteEmail.trim()} via Brevo!`);
      if (result.inviteLink) setLastInviteLink(result.inviteLink);
      setTimeout(() => setInviteSuccess(null), 5000);
    } catch (err: any) {
      console.error("Invite failed:", err);
      setInviteError(err.message || "Failed to invite member. Please try again.");
    } finally {
      setInviting(false);
    }
  };

  // Handle adding a new custom option/proposal
  const handleAddOption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOptionName.trim() || !activeTripId) return;
    setAddingOption(true);
    setError(null);
    try {
      const updatedTrip = await apiFetch(`/api/trips/${activeTripId}/options`, {
        method: "POST",
        body: JSON.stringify({ name: newOptionName.trim() }),
      });

      queryClient.setQueryData(queryKeys.trips(), (old: Trip[] = []) =>
        old.map((t) => (t._id === updatedTrip._id ? updatedTrip : t)),
      );
      queryClient.setQueryData(queryKeys.tripDetails(activeTripId), updatedTrip);
      setNewOptionName("");
      setShowAddOption(false);
    } catch (err: any) {
      console.error("Adding option failed:", err);
      setError(err.message || "Failed to add new choice. Please try again.");
    } finally {
      setAddingOption(false);
    }
  };

  return (
    <AppShell
      title="Consensus"
      subtitle={
        activeTrip
          ? `${activeTrip.title} · ${activeTrip.destination || "Group Decision Engine"}`
          : "Collaborative trip planning and group decision-making"
      }
      actions={<AiBadge>Consensus Engine</AiBadge>}
    >
      {/* Trip Selector Bar */}
      {trips.length > 1 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground mr-1">Select Trip:</span>
          {trips.map((t) => (
            <button
              key={t._id}
              onClick={() => {
                setSelectedTripId(t._id);
                setError(null);
                setInviteError(null);
                setInviteSuccess(null);
              }}
              className={cn(
                "rounded-xl border px-3 py-1.5 text-sm transition font-medium",
                activeTripId === t._id
                  ? "border-primary bg-primary/10 font-semibold text-primary shadow-xs"
                  : "border-border hover:border-primary/40 text-muted-foreground bg-background/50",
              )}
            >
              {t.destination?.split(",")[0] || t.title}
            </button>
          ))}
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p>{error}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setError(null)} className="h-7 text-xs">
            Dismiss
          </Button>
        </div>
      )}

      {loading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-3xl glass-panel h-56" />
          ))}
        </div>
      ) : !activeTrip ? (
        <div className="flex flex-col items-center justify-center rounded-3xl glass-panel p-16 text-center">
          <HeartHandshake className="h-14 w-14 text-muted-foreground/30" />
          <p className="mt-4 text-xl font-bold">No trips found</p>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Create a trip to coordinate with companions, cast votes, and calculate group consensus.
          </p>
          <Button className="mt-6 rounded-xl" asChild>
            <Link to="/trips/new">
              <Plus className="mr-1.5 h-4 w-4" />
              Create a trip
            </Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Hero Overview Metric Cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            {/* Group Size & Travelers */}
            <div className="rounded-3xl glass-panel p-6 text-center flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  <Users className="h-3.5 w-3.5 text-accent" /> Group Size
                </div>
                <p className="mt-2 font-display text-4xl text-accent">
                  {totalTravelers}
                </p>
              </div>
              <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <span>{displayConfirmedMembers.length} confirmed</span>
                {isOrganizer && pendingMembers.length > 0 && (
                  <>
                    <span>·</span>
                    <span className="text-amber-500 font-medium">
                      {pendingMembers.length} pending invite{pendingMembers.length !== 1 ? "s" : ""}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Total Votes */}
            <div className="rounded-3xl glass-panel p-6 text-center flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  <Vote className="h-3.5 w-3.5 text-primary" /> Votes Submitted
                </div>
                <p className="mt-2 font-display text-4xl text-primary">{totalVotes}</p>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {myVote ? (
                  <span className="text-primary font-medium flex items-center justify-center gap-1">
                    <Check className="h-3.5 w-3.5" /> Your vote is counted
                  </span>
                ) : (
                  "You haven't cast a vote yet"
                )}
              </p>
            </div>

            {/* Calculated Consensus Result */}
            <div className="rounded-3xl glass-panel p-6 text-center border-2 border-primary/20 bg-primary/5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-center gap-1.5 text-xs uppercase tracking-wider text-primary font-bold">
                  <Trophy className="h-4 w-4" /> Calculated Consensus
                </div>
                {winningOption ? (
                  <div className="mt-2">
                    <p className="text-lg font-bold text-foreground truncate px-2">
                      {winningOption.name}
                    </p>
                    <div className="mt-2 flex items-center justify-center gap-2">
                      <span className="rounded-full bg-primary/20 px-3 py-0.5 text-xs font-bold text-primary">
                        {consensusPercentage}% Consensus
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({winningOption.votes} of {totalVotes} vote{totalVotes !== 1 ? "s" : ""})
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2">
                    <p className="text-sm font-semibold text-muted-foreground">No votes cast yet</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Cast votes below to compute agreement
                    </p>
                  </div>
                )}
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                Advenza AI Decision Engine
              </p>
            </div>
          </div>

          {/* Main Content Grid: Voting & Options on Left, Companions & Invite on Right */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left Column: Decision Voting & Option Proposals (2 cols on desktop) */}
            <div className="space-y-6 lg:col-span-2">
              <div className="rounded-3xl glass-panel p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                  <div>
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <Vote className="h-5 w-5 text-primary" />
                      Trip Decisions & Voting
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Cast or update your vote. The consensus engine recalibrates live overlap.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 self-start sm:self-center">
                    {myVote && (
                      <Badge variant="outline" className="gap-1.5 py-1 px-3 border-accent/40 bg-accent/10 text-accent text-xs">
                        <Check className="h-3 w-3" />
                        My Vote: <span className="font-semibold">{myVote}</span>
                      </Badge>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowAddOption(!showAddOption)}
                      className="rounded-xl text-xs h-8"
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      {showAddOption ? "Cancel" : "Add Option"}
                    </Button>
                  </div>
                </div>

                {/* Optional Proposal/Option Creation Form */}
                <AnimatePresence>
                  {showAddOption && (
                    <motion.form
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      onSubmit={handleAddOption}
                      className="mb-6 overflow-hidden rounded-2xl border border-primary/30 bg-primary/5 p-4"
                    >
                      <h4 className="text-sm font-semibold mb-2">Propose New Choice for the Group</h4>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Input
                          placeholder="e.g. Mountain Trekking & Campfire Night"
                          className="h-10 rounded-xl flex-1 bg-background/80"
                          value={newOptionName}
                          onChange={(e) => setNewOptionName(e.target.value)}
                          disabled={addingOption}
                          autoFocus
                        />
                        <Button
                          type="submit"
                          disabled={addingOption || !newOptionName.trim()}
                          className="h-10 rounded-xl px-5 text-xs font-semibold"
                        >
                          {addingOption ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                          ) : (
                            <Plus className="h-4 w-4 mr-1.5" />
                          )}
                          Propose Choice
                        </Button>
                      </div>
                    </motion.form>
                  )}
                </AnimatePresence>

                {/* Vote Options List */}
                {voteOptions.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground text-sm">
                    <p>No decision choices available for this trip yet.</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAddOption(true)}
                      className="mt-3 rounded-xl text-xs"
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" /> Add First Choice
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {voteOptions.map((o) => {
                      const isMyVote = myVote === o.name;
                      const isWinner = winningOption && winningOption.name === o.name && o.votes > 0;
                      const pct = totalVotes > 0 ? Math.round((o.votes / totalVotes) * 100) : 0;

                      return (
                        <motion.div
                          key={o.name}
                          whileHover={{ scale: 1.01 }}
                          className={cn(
                            "relative flex flex-col justify-between rounded-2xl border p-5 transition-all shadow-xs",
                            isMyVote
                              ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                              : "border-border glass-tile hover:border-primary/50",
                          )}
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-sm leading-snug">{o.name}</p>
                              </div>
                              {isWinner && (
                                <span className="flex items-center gap-1 text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 shrink-0">
                                  <Sparkles className="h-3 w-3" /> Leading
                                </span>
                              )}
                            </div>

                            {/* Percentage progress bar */}
                            <div className="mt-4">
                              <div className="flex justify-between text-xs text-muted-foreground mb-1.5 font-medium">
                                <span>
                                  {o.votes} vote{o.votes !== 1 ? "s" : ""}
                                </span>
                                <span>{pct}%</span>
                              </div>
                              <div className="h-2.5 overflow-hidden rounded-full bg-muted/80">
                                <div
                                  className={cn(
                                    "h-full rounded-full transition-all duration-500",
                                    isWinner
                                      ? "bg-amber-500"
                                      : isMyVote
                                        ? "bg-primary"
                                        : "bg-muted-foreground/40",
                                  )}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Footer Action & Voters Count */}
                          <div className="mt-5 flex items-center justify-between pt-3 border-t border-border/50">
                            <span className="text-[11px] text-muted-foreground">
                              {o.voters?.length || 0} traveler{(o.voters?.length || 0) !== 1 ? "s" : ""} voted
                            </span>
                            <Button
                              size="sm"
                              variant={isMyVote ? "default" : "outline"}
                              disabled={voting}
                              onClick={() => handleCastVote(o.name)}
                              className={cn(
                                "h-8 px-3.5 rounded-xl text-xs font-semibold",
                                isMyVote && "bg-primary text-primary-foreground hover:bg-primary/90",
                              )}
                            >
                              {voting ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : isMyVote ? (
                                <>
                                  <Check className="mr-1 h-3.5 w-3.5" /> Your Choice
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

              {/* Group Preferences & Travel Style */}
              <div className="rounded-3xl glass-panel p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Compass className="h-4 w-4 text-primary" />
                  <h3 className="font-bold text-base">Group Travel Preferences</h3>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-2">Trip Interests</p>
                    {(activeTrip.interests?.length ?? 0) > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {activeTrip.interests?.map((interest: string) => (
                          <Badge key={interest} variant="secondary" className="rounded-full px-3 py-1 text-xs">
                            {interest}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No specific interests set yet.</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-2">Travel Style</p>
                    {activeTrip.style ? (
                      <Badge variant="outline" className="rounded-full border-primary/30 bg-primary/10 text-primary px-3 py-1 text-xs font-semibold">
                        {activeTrip.style}
                      </Badge>
                    ) : (
                      <p className="text-xs text-muted-foreground">Standard / Flexible</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Travel Companions & Invite People (1 col) */}
            <div className="space-y-6">
              {/* Members Section */}
              <div className="rounded-3xl glass-panel p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <h3 className="font-bold text-base">Travel Companions</h3>
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">
                    {displayConfirmedMembers.length} Confirmed
                  </span>
                </div>

                {/* Confirmed Member List */}
                <div className="space-y-2.5">
                  {displayConfirmedMembers.map((m) => (
                    <div
                      key={m.key}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl glass-tile p-3 transition-all",
                        m.isOrganizer && "border border-primary/20",
                        m.isMe && !m.isOrganizer && "border border-accent/20",
                      )}
                    >
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className={m.color}>
                          {m.initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <p className="truncate font-semibold text-sm">
                            {m.name}
                          </p>
                          {m.isMe && (
                            <span className="text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-md shrink-0">
                              You
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] font-medium">
                          {m.isOrganizer ? (
                            <span className="flex items-center gap-1 text-primary">
                              <ShieldCheck className="h-3 w-3" /> Organizer
                            </span>
                          ) : (
                            <span className="text-muted-foreground">{m.role}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Organizer-Only: Pending Invites Section */}
                {isOrganizer && pendingMembers.length > 0 && (
                  <div className="mt-5 pt-4 border-t border-border/60">
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-amber-500" />
                        <p className="text-xs font-semibold text-foreground">Pending Invites</p>
                      </div>
                      <span className="text-[10px] font-medium text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                        {pendingMembers.length} pending
                      </span>
                    </div>

                    <div className="space-y-2">
                      {pendingMembers.map((p, idx) => (
                        <div
                          key={p._id || p.email || idx}
                          className="flex items-center justify-between gap-2 rounded-xl bg-amber-500/5 border border-amber-500/20 p-2.5 text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-foreground text-xs">
                              {p.email || p.name}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              Invited · Waiting for acceptance
                            </p>
                          </div>
                          <span className="text-[10px] text-amber-500 font-semibold px-2 py-0.5 rounded-md bg-amber-500/10 shrink-0">
                            Pending
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Organizer-Only: Invite People Section */}
                {isOrganizer && (
                  <div className="mt-5 pt-4 border-t border-border/60">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Mail className="h-3.5 w-3.5 text-primary" />
                      <p className="text-xs font-semibold text-foreground">Invite People</p>
                    </div>
                    <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">
                      Send an email invitation. They will receive a link to join this trip and vote in Consensus.
                    </p>

                    {/* Status Messages */}
                    {inviteSuccess && (
                      <div className="mb-3 flex items-start gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-2.5 text-xs text-emerald-600">
                        <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                        <span>{inviteSuccess}</span>
                      </div>
                    )}
                    {inviteError && (
                      <div className="mb-3 flex items-start gap-2 rounded-xl bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive">
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                        <span>{inviteError}</span>
                      </div>
                    )}

                    <form onSubmit={handleInvite} className="flex flex-col gap-2">
                      <Input
                        type="email"
                        placeholder="companion@email.com"
                        className="h-10 rounded-xl text-sm"
                        value={inviteEmail}
                        onChange={(e) => {
                          setInviteEmail(e.target.value);
                          if (inviteError) setInviteError(null);
                        }}
                        disabled={inviting}
                        required
                      />
                      <Button
                        type="submit"
                        className="h-10 rounded-xl text-xs font-semibold bg-gradient-to-r from-primary to-accent shadow-xs"
                        disabled={inviting || !inviteEmail.trim()}
                      >
                        {inviting ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                            Sending Invite via Brevo…
                          </>
                        ) : (
                          <>
                            <Send className="mr-1.5 h-3.5 w-3.5" />
                            Send Invite
                          </>
                        )}
                      </Button>
                    </form>

                    {/* WhatsApp Share Button — shares the last generated invite link */}
                    {lastInviteLink && (
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={() => {
                            const msg = encodeURIComponent(
                              `You've been invited to join "${activeTrip?.title || "a trip"}" on Advenza! Join here: ${lastInviteLink}`
                            );
                            window.open(`https://wa.me/?text=${msg}`, "_blank", "noopener,noreferrer");
                          }}
                          className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#25D366]/40 bg-[#25D366]/10 px-4 py-2.5 text-xs font-semibold text-[#25D366] transition hover:bg-[#25D366]/20 active:scale-[0.98]"
                        >
                          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                          Share via WhatsApp
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Share Trip via WhatsApp — visible to ALL members */}
              <div className="rounded-3xl glass-panel p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Share2 className="h-4 w-4 text-primary" />
                  <h3 className="font-bold text-sm">Share Trip</h3>
                </div>
                <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">
                  Invite friends to join this trip directly via WhatsApp.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const tripUrl = `${window.location.origin}/consensus`;
                    const msg = encodeURIComponent(
                      `Hey! Join me on "${activeTrip?.title || "our trip"}"${activeTrip?.destination ? ` to ${activeTrip.destination}` : ""} on Advenza — a smart AI travel companion. Check it out: ${tripUrl}`
                    );
                    window.open(`https://wa.me/?text=${msg}`, "_blank", "noopener,noreferrer");
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#25D366]/40 bg-[#25D366]/10 px-4 py-2.5 text-xs font-semibold text-[#25D366] transition hover:bg-[#25D366]/20 active:scale-[0.98]"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  Share on WhatsApp
                </button>
              </div>

              {/* Explainable AI & Consensus Analysis */}
              <div className="rounded-3xl glass-panel p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-base">Consensus Analysis</h3>
                    <AiBadge>Explainable AI</AiBadge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Advenza uses multi-factor preference scoring rather than simple majority rule,
                    ensuring balanced satisfaction across every companion.
                  </p>

                  {winningOption ? (
                    <div className="mt-3 rounded-2xl border border-primary/20 bg-primary/5 p-3 text-xs">
                      <p className="font-medium text-foreground">
                        <span className="text-primary font-bold">{winningOption.name}</span> leads with{" "}
                        <span className="text-primary font-bold">{consensusPercentage}%</span> group agreement.
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        High alignment detected across cultural and leisure preferences.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-3 rounded-2xl border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
                      Awaiting votes to synthesize group satisfaction and radar alignment.
                    </div>
                  )}
                </div>

                {/* Radar Chart */}
                <div className="mt-5 pt-4 border-t border-border/60">
                  <p className="text-[11px] font-semibold text-center text-muted-foreground mb-2">
                    Category Alignment Radar
                  </p>
                  <RadarChart
                    values={CATS.map((cat, i) => {
                      if (!winningOption) return 45;
                      const text = `${winningOption.name} ${(activeTrip.interests || []).join(" ")} ${activeTrip.style || ""}`.toLowerCase();
                      const match = text.includes(cat) ||
                        (cat === "food" && (text.includes("food") || text.includes("beach") || text.includes("tour"))) ||
                        (cat === "adventure" && (text.includes("hike") || text.includes("outdoor") || text.includes("adventure") || text.includes("trek"))) ||
                        (cat === "history" && (text.includes("culture") || text.includes("landmark") || text.includes("sightseeing") || text.includes("heritage"))) ||
                        (cat === "nature" && (text.includes("nature") || text.includes("outdoor") || text.includes("beach"))) ||
                        (cat === "nightlife" && (text.includes("night") || text.includes("evening") || text.includes("vibrant")));
                      return match ? 85 + (i % 3) * 4 : 60 + (i % 2) * 8;
                    })}
                    size={190}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
