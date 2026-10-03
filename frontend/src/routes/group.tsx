import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { AiBadge } from "@/components/ai/ai-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { UserPlus, Check, X, Loader2, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { queryKeys } from "@/lib/queryKeys";

export const Route = createFileRoute("/group")({ component: Group });

const COLORS = [
  "bg-primary text-primary-foreground",
  "bg-accent text-accent-foreground",
  "bg-secondary text-secondary-foreground",
  "bg-muted text-foreground",
  "bg-[oklch(0.55_0.15_250)] text-white",
];

type Member = { _id?: string; name?: string; initials?: string; role?: string; email?: string; userId?: string };
type VoteOption = { name: string; votes: number; voters?: string[] };
type Trip = {
  _id: string;
  title: string;
  destination?: string;
  members?: Member[];
  voteOptions?: VoteOption[];
  interests?: string[];
  style?: string;
  createdBy?: string;
  isOrganizer?: boolean;
  userRole?: string;
};

function Group() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSent, setInviteSent] = useState(false);
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);

  const { data: trips = [], isLoading: loading } = useQuery<Trip[]>({
    queryKey: queryKeys.trips(),
    queryFn: async () => {
      const data = await apiFetch("/api/trips");
      return Array.isArray(data) ? (data as Trip[]) : [];
    },
    enabled: !!user,
  });

  const tripData = (selectedTripId ? trips.find((t) => t._id === selectedTripId) : trips[0]) ?? null;
  const activeTripId = tripData?._id ?? null;

  const isOrganizer = Boolean(
    tripData?.isOrganizer ??
      (tripData?.createdBy && user?.uid && String(tripData.createdBy) === String(user.uid))
  );

  const rawMembers = tripData?.members || [];
  const confirmedMembers = rawMembers.filter((m) => m.role !== "Pending");
  const pendingMembers = rawMembers.filter((m) => m.role === "Pending");
  const members = isOrganizer ? rawMembers : confirmedMembers;
  const voteOptions = tripData?.voteOptions || [];
  const myVote = voteOptions.find((o) => o.voters?.includes(user?.uid || ""))?.name || null;
  const totalVotes = voteOptions.reduce((a: number, o) => a + (o.votes || 0), 0);

  const handleVote = async (optionName: string) => {
    if (!activeTripId) return;
    setSaving(true);
    try {
      const updated = await apiFetch(`/api/trips/${activeTripId}/vote`, {
        method: "POST",
        body: JSON.stringify({ optionName, uid: user?.uid }),
      });
      queryClient.setQueryData(queryKeys.trips(), (old: Trip[] = []) =>
        old.map((t) => (t._id === updated._id ? updated : t)),
      );
      queryClient.setQueryData(queryKeys.tripDetails(activeTripId), updated);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !activeTripId) return;
    setSaving(true);
    try {
      const updated = await apiFetch(`/api/trips/${activeTripId}/members`, {
        method: "POST",
        body: JSON.stringify({ email: inviteEmail }),
      });
      queryClient.setQueryData(queryKeys.trips(), (old: Trip[] = []) =>
        old.map((t) => (t._id === updated._id ? updated : t)),
      );
      queryClient.setQueryData(queryKeys.tripDetails(activeTripId), updated);
      setInviteEmail("");
      if (updated.inviteLink) setLastInviteLink(updated.inviteLink);
      setInviteSent(true);
      setTimeout(() => setInviteSent(false), 3000);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <AppShell title="Group consensus" subtitle="Loading...">
        <div className="grid gap-6 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse h-40 rounded-2xl glass-panel" />
          ))}
        </div>
      </AppShell>
    );

  return (
    <AppShell
      title="Group consensus"
      subtitle={
        tripData
          ? `${tripData.title} · ${tripData.destination || ""}`
          : "Coordinate with your travel companions"
      }
      actions={<AiBadge>Explainable AI</AiBadge>}
    >
      {/* Trip selector */}
      {trips.length > 1 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {trips.map((t) => (
            <button
              key={t._id}
              onClick={() => setSelectedTripId(t._id)}
              className={`rounded-xl border px-3 py-1.5 text-sm transition ${activeTripId === t._id ? "border-primary bg-primary/8 font-semibold" : "border-border hover:border-primary/40"}`}
            >
              {t.destination?.split(",")[0] || t.title}
            </button>
          ))}
        </div>
      )}

      {!activeTripId ? (
        <div className="rounded-2xl glass-panel p-12 text-center">
          <p className="text-muted-foreground">
            No trips found.{" "}
            <a href="/trips/new" className="text-primary underline">
              Create a trip first
            </a>
            .
          </p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Members */}
          <div className="rounded-2xl glass-panel p-6 lg:col-span-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Members</h3>
              <span className="text-xs text-muted-foreground">
                {confirmedMembers.length + (isOrganizer ? 1 : 0)} confirmed
                {isOrganizer && pendingMembers.length > 0 && ` · ${pendingMembers.length} pending`}
              </span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {/* Show organizer */}
              <div className="flex items-center gap-3 rounded-xl glass-tile p-4 border border-primary/20">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className={COLORS[0]}>
                    {isOrganizer
                      ? (user?.displayName || user?.email || "Y").slice(0, 2).toUpperCase()
                      : "OR"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {isOrganizer ? (user?.displayName || user?.email) : "Trip Organizer"}
                  </p>
                  <p className="text-xs text-primary font-medium">Organizer {isOrganizer ? "(You)" : ""}</p>
                </div>
              </div>

              {/* Other confirmed members */}
              {confirmedMembers.map((m, i) => {
                const isMe = Boolean(
                  (user?.uid && m.userId && String(m.userId) === String(user.uid)) ||
                  (user?.email && m.email && m.email.toLowerCase() === (user.email || "").toLowerCase())
                );
                return (
                  <div key={m._id || i} className="flex items-center gap-3 rounded-xl glass-tile p-4">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className={COLORS[(i + 1) % COLORS.length]}>
                        {m.initials || m.name?.slice(0, 2).toUpperCase() || "TR"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{isMe ? `${m.name} (You)` : m.name}</p>
                      <p className="text-xs text-muted-foreground">{m.role || "Member"}</p>
                    </div>
                  </div>
                );
              })}

              {/* Organizer-only: Pending members */}
              {isOrganizer &&
                pendingMembers.map((m, i) => (
                  <div key={m._id || i} className="flex items-center gap-3 rounded-xl bg-amber-500/5 border border-amber-500/20 p-4">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-amber-500/20 text-amber-600">
                        {m.initials || m.name?.slice(0, 2).toUpperCase() || "PI"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-xs">{m.email || m.name}</p>
                      <p className="text-[11px] text-amber-500 font-medium">Pending Invite</p>
                    </div>
                  </div>
                ))}
            </div>

            {isOrganizer && (
              <>
                <div className="mt-6 flex flex-col gap-2 sm:flex-row border-t border-border/60 pt-4">
                  <Input
                    placeholder="friend@email.com"
                    className="h-11 rounded-xl"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                  />
                  <Button className="h-11" onClick={handleInvite} disabled={saving}>
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                    ) : (
                      <UserPlus className="mr-1.5 h-4 w-4" />
                    )}
                    {inviteSent ? "Invite sent! ✓" : "Invite"}
                  </Button>
                </div>

                {/* WhatsApp share — appears after invite is sent */}
                {lastInviteLink && (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => {
                        const msg = encodeURIComponent(
                          `You've been invited to join "${tripData?.title || "a trip"}" on Advenza! Join here: ${lastInviteLink}`
                        );
                        window.open(`https://wa.me/?text=${msg}`, "_blank", "noopener,noreferrer");
                      }}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#25D366]/40 bg-[#25D366]/10 px-4 py-2.5 text-xs font-semibold text-[#25D366] transition hover:bg-[#25D366]/20 active:scale-[0.98]"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                      Share invite via WhatsApp
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Share Trip via WhatsApp — visible to all members */}
          <div className="rounded-2xl glass-panel p-5">
            <div className="flex items-center gap-2 mb-2">
              <Share2 className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">Share Trip</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-3">Share this trip with friends via WhatsApp.</p>
            <button
              type="button"
              onClick={() => {
                const tripUrl = `${window.location.origin}/group`;
                const msg = encodeURIComponent(
                  `Hey! Join me on "${tripData?.title || "our trip"}"${tripData?.destination ? ` to ${tripData.destination}` : ""} on Advenza — a smart AI travel companion. Check it out: ${tripUrl}`
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

          {/* Group Preferences */}
          <div className="rounded-2xl glass-panel p-6">
            <h3 className="font-semibold">Group preferences</h3>
            <div className="mt-4 space-y-3">
              {(tripData?.interests?.length ?? 0) > 0 ? (
                <div>
                  <p className="text-xs text-muted-foreground">Interests</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {tripData?.interests?.map((t: string) => (
                      <Badge key={t} variant="secondary" className="rounded-full">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No group preferences set yet.</p>
              )}
              {tripData?.style && (
                <div>
                  <p className="text-xs text-muted-foreground">Travel Style</p>
                  <Badge variant="secondary" className="mt-1.5 rounded-full">
                    {tripData.style}
                  </Badge>
                </div>
              )}
            </div>
          </div>

          {/* Voting */}
          {voteOptions.length > 0 && (
            <div className="rounded-2xl glass-panel p-6 lg:col-span-3">
              <h3 className="mb-4 font-semibold">Group vote</h3>
              <div className="grid gap-4 md:grid-cols-3">
                {voteOptions.map((o) => {
                  const pct = totalVotes > 0 ? Math.round((o.votes / totalVotes) * 100) : 0;
                  const isMyVote = myVote === o.name;
                  return (
                    <div
                      key={o.name}
                      className={cn(
                        "rounded-xl border p-5 transition",
                        isMyVote ? "border-accent bg-accent/5" : "glass-tile",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-semibold">{o.name}</p>
                        {isMyVote && <Check className="h-4 w-4 text-accent" />}
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {o.votes} votes · {pct}%
                        </span>
                        <Button
                          size="icon"
                          variant={isMyVote ? "default" : "ghost"}
                          className="h-7 w-7"
                          onClick={() => handleVote(o.name)}
                          disabled={saving}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
