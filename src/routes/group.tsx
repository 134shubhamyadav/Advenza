import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { UserPlus, Check, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export const Route = createFileRoute("/group")({ component: Group });

const COLORS = [
  "bg-primary text-primary-foreground",
  "bg-accent text-accent-foreground",
  "bg-secondary text-secondary-foreground",
  "bg-muted text-foreground",
  "bg-[oklch(0.55_0.15_250)] text-white",
];

function Group() {
  const { user } = useAuth();
  const [trips, setTrips] = useState<any[]>([]);
  const [activeTripId, setActiveTripId] = useState<string | null>(null);
  const [tripData, setTripData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSent, setInviteSent] = useState(false);

  useEffect(() => {
    if (!user) return;
    apiFetch('/api/trips')
      .then(data => {
        const list = Array.isArray(data) ? data : [];
        setTrips(list);
        if (list.length > 0) {
          setActiveTripId(list[0]._id);
          setTripData(list[0]);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  const members = tripData?.members || [];
  const voteOptions = tripData?.voteOptions || [];
  const myVote = voteOptions.find((o: any) => o.voters?.includes(user?.uid))?.name || null;
  const totalVotes = voteOptions.reduce((a: number, o: any) => a + (o.votes || 0), 0);

  const handleVote = async (optionName: string) => {
    if (!activeTripId) return;
    setSaving(true);
    try {
      const updated = await apiFetch(`/api/trips/${activeTripId}/vote`, {
        method: 'POST',
        body: JSON.stringify({ optionName, uid: user?.uid }),
      });
      setTripData(updated);
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
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail }),
      });
      setTripData(updated);
      setInviteEmail("");
      setInviteSent(true);
      setTimeout(() => setInviteSent(false), 3000);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <AppShell title="Group planning" subtitle="Loading...">
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="animate-pulse h-40 rounded-2xl glass-panel" />)}
      </div>
    </AppShell>
  );

  const destination = tripData?.destination || "Your trip";

  return (
    <AppShell title="Group planning" subtitle={`${destination} · ${members.length || 1} travelers`}>
      {/* Trip selector */}
      {trips.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {trips.map(t => (
            <button
              key={t._id}
              onClick={() => { setActiveTripId(t._id); setTripData(t); }}
              className={`rounded-xl border px-3 py-1.5 text-sm transition ${activeTripId === t._id ? "border-primary bg-primary/8 font-semibold" : "border-border hover:border-primary/40"}`}
            >
              {t.destination?.split(",")[0] || t.title}
            </button>
          ))}
        </div>
      )}

      {!activeTripId ? (
        <div className="rounded-2xl glass-panel p-12 text-center">
          <p className="text-muted-foreground">No trips found. <a href="/trips/new" className="text-primary underline">Create a trip first</a>.</p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Members */}
          <div className="rounded-2xl glass-panel p-6 lg:col-span-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Members</h3>
              <span className="text-xs text-muted-foreground">
                {members.filter((m: any) => m.role !== 'Pending').length} confirmed · {members.filter((m: any) => m.role === 'Pending').length} pending
              </span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {/* Show organizer first */}
              <div className="flex items-center gap-3 rounded-xl glass-tile p-4">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className={COLORS[0]}>
                    {(user?.displayName || user?.email || "Y").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{user?.displayName || user?.email}</p>
                  <p className="text-xs text-muted-foreground">Organizer</p>
                </div>
              </div>
              {members.map((m: any, i: number) => (
                <div key={m._id || i} className="flex items-center gap-3 rounded-xl glass-tile p-4">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className={COLORS[(i + 1) % COLORS.length]}>{m.initials || m.name?.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{m.name}</p>
                    <p className="text-xs text-muted-foreground">{m.role}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <Input
                placeholder="friend@email.com"
                className="h-11 rounded-xl"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleInvite()}
              />
              <Button className="h-11" onClick={handleInvite} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <UserPlus className="mr-1.5 h-4 w-4" />}
                {inviteSent ? "Invite sent! ✓" : "Invite"}
              </Button>
            </div>
          </div>

          {/* Group Preferences */}
          <div className="rounded-2xl glass-panel p-6">
            <h3 className="font-semibold">Group preferences</h3>
            <div className="mt-4 space-y-3">
              {tripData?.interests?.length > 0 ? (
                <div>
                  <p className="text-xs text-muted-foreground">Interests</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {tripData.interests.map((t: string) => <Badge key={t} variant="secondary" className="rounded-full">{t}</Badge>)}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No group preferences set yet.</p>
              )}
              {tripData?.style && (
                <div>
                  <p className="text-xs text-muted-foreground">Travel Style</p>
                  <Badge variant="secondary" className="mt-1.5 rounded-full">{tripData.style}</Badge>
                </div>
              )}
            </div>
          </div>

          {/* Voting */}
          {voteOptions.length > 0 && (
            <div className="rounded-2xl glass-panel p-6 lg:col-span-3">
              <h3 className="mb-4 font-semibold">Group vote</h3>
              <div className="grid gap-4 md:grid-cols-3">
                {voteOptions.map((o: any) => {
                  const pct = totalVotes > 0 ? Math.round((o.votes / totalVotes) * 100) : 0;
                  const isMyVote = myVote === o.name;
                  return (
                    <div key={o.name} className={cn("rounded-xl border p-5 transition", isMyVote ? "border-accent bg-accent/5" : "glass-tile")}>
                      <div className="flex items-center justify-between">
                        <p className="font-semibold">{o.name}</p>
                        {isMyVote && <Check className="h-4 w-4 text-accent" />}
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{o.votes} votes · {pct}%</span>
                        <Button size="icon" variant={isMyVote ? "default" : "ghost"} className="h-7 w-7" onClick={() => handleVote(o.name)} disabled={saving}>
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
