import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Compass,
  Calendar,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  LogIn,
  UserPlus,
  HeartHandshake,
  ShieldCheck,
} from "lucide-react";

export const Route = createFileRoute("/invite/$token")({
  component: InvitePage,
});

interface GroupMember {
  name: string;
  role: string;
  userId?: string;
}

interface GroupOrganizer {
  name: string;
  role: string;
  userId?: string;
  email?: string;
}

interface TripPreview {
  _id: string;
  title: string;
  destination?: string;
  origin?: string;
  startDate?: string;
  endDate?: string;
  travelers?: number;
  style?: string;
  interests?: string[];
  memberCount?: number;
  confirmedCount?: number;
  organizer?: GroupOrganizer;
  confirmedMembers?: GroupMember[];
}

interface InvitationData {
  valid: boolean;
  token: string;
  trip: TripPreview;
  inviterName?: string;
  invitedEmail?: string;
  expiresAt?: string;
  message?: string;
  status?: string;
}

function InvitePage() {
  const params = useParams({ from: "/invite/$token" });
  const token = params.token;
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState(true);
  const [inviteData, setInviteData] = useState<InvitationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [joinedSuccess, setJoinedSuccess] = useState(false);

  // Save token in sessionStorage so login/signup can return here
  useEffect(() => {
    if (token) {
      sessionStorage.setItem("pending_invite_token", token);
    }
  }, [token]);

  // Fetch invitation details
  useEffect(() => {
    let isMounted = true;
    async function loadInvitation() {
      if (!token) return;
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetch(`/api/invitations/${token}`);
        if (isMounted) {
          setInviteData(data);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || "Failed to load invitation. Link may be invalid or expired.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    loadInvitation();
    return () => {
      isMounted = false;
    };
  }, [token]);

  const handleAccept = async () => {
    if (!token || !user) return;
    setAccepting(true);
    setError(null);
    try {
      const result = await apiFetch(`/api/invitations/${token}/accept`, {
        method: "POST",
        body: JSON.stringify({
          userName: user.displayName || user.email?.split("@")[0] || "Traveler",
          userEmail: user.email,
        }),
      });

      sessionStorage.removeItem("pending_invite_token");
      if (result?.tripId || inviteData?.trip?._id) {
        sessionStorage.setItem("last_joined_trip_id", result?.tripId || inviteData?.trip?._id);
      }
      setJoinedSuccess(true);

      // Invalidate trips queries so new trip shows up
      await queryClient.invalidateQueries({ queryKey: queryKeys.trips() });

      setTimeout(() => {
        navigate({ to: "/consensus" });
      }, 1200);
    } catch (err: any) {
      setError(err.message || "Failed to join group. Please try again.");
    } finally {
      setAccepting(false);
    }
  };

  const formattedDates = [inviteData?.trip?.startDate, inviteData?.trip?.endDate]
    .filter(Boolean)
    .join(" → ");

  const userEmailNorm = (user?.email || "").trim().toLowerCase();
  const invitedEmailNorm = (inviteData?.invitedEmail || "").trim().toLowerCase();
  const emailMismatch = Boolean(user && invitedEmailNorm && userEmailNorm !== invitedEmailNorm);

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 bg-background overflow-hidden">
      {/* Scenic Cinematic Ambient Background */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-40 top-16 h-[32rem] w-[32rem] rounded-full bg-[oklch(0.78_0.16_55)]/20 blur-3xl animate-blob" />
        <div
          className="absolute right-0 top-1/3 h-[36rem] w-[36rem] rounded-full bg-[oklch(0.68_0.14_165)]/20 blur-3xl animate-blob"
          style={{ animationDelay: "-6s" }}
        />
        <div
          className="absolute bottom-0 left-1/3 h-[30rem] w-[30rem] rounded-full bg-[oklch(0.55_0.16_265)]/25 blur-3xl animate-blob"
          style={{ animationDelay: "-10s" }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,transparent_15%,var(--background)_95%)]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="w-full max-w-lg rounded-3xl glass-panel p-6 sm:p-8 shadow-2xl border border-white/20"
      >
        {/* Brand Header */}
        <div className="flex justify-center mb-6">
          <BrandLogo />
        </div>

        {loading || authLoading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium text-muted-foreground">
              Validating group invitation…
            </p>
          </div>
        ) : error || !inviteData?.valid ? (
          /* Error State */
          <div className="text-center py-6 space-y-4">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-destructive/10 text-destructive border border-destructive/20 shadow-sm">
              <AlertCircle className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Invitation Not Available</h2>
              <p className="mt-1.5 text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                {error || inviteData?.message || "This invitation link is invalid, expired, or has already been used."}
              </p>
            </div>
            <div className="pt-4 flex flex-col sm:flex-row gap-2 justify-center">
              <Button variant="outline" className="rounded-xl text-xs h-10" asChild>
                <Link to="/dashboard">Go to Dashboard</Link>
              </Button>
              <Button className="rounded-xl text-xs h-10" asChild>
                <Link to="/consensus">Open Consensus</Link>
              </Button>
            </div>
          </div>
        ) : joinedSuccess ? (
          /* Success State */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-8 space-y-4"
          >
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 shadow-md">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">You've Joined the Group!</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Redirecting to Consensus decision engine…
              </p>
            </div>
          </motion.div>
        ) : (
          /* Valid Invitation Card */
          <div className="space-y-6">
            {/* Header / Subtitle */}
            <div className="text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/25 px-3 py-1 text-xs font-semibold text-primary mb-3">
                <Sparkles className="h-3 w-3" /> Group Consensus Invitation
              </span>
              <h2 className="text-xl font-bold leading-tight">
                {inviteData.inviterName || "A fellow traveler"} invited you to join
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Collaborate on travel plans and vote in Consensus
              </p>
            </div>

            {/* Trip Preview Box */}
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 space-y-3.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-base text-foreground">
                    {inviteData.trip.title}
                  </h3>
                  {inviteData.trip.destination && (
                    <p className="text-xs text-primary font-medium flex items-center gap-1 mt-0.5">
                      <Compass className="h-3.5 w-3.5" />
                      {inviteData.trip.destination}
                    </p>
                  )}
                </div>
                {inviteData.trip.style && (
                  <Badge variant="outline" className="rounded-full text-[10px] px-2.5 py-0.5 border-primary/30 text-primary">
                    {inviteData.trip.style}
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-primary/10 text-xs text-muted-foreground">
                {formattedDates && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-accent shrink-0" />
                    <span className="truncate">{formattedDates}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span>
                    {(inviteData.trip.confirmedCount ?? inviteData.trip.memberCount ?? inviteData.trip.travelers ?? 1)} Confirmed
                  </span>
                </div>
              </div>

              {/* Live Group Member Roster */}
              {(inviteData.trip.organizer || (inviteData.trip.confirmedMembers && inviteData.trip.confirmedMembers.length > 0)) && (
                <div className="pt-3 border-t border-primary/10">
                  <p className="text-[11px] font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                    Who's in this group
                  </p>
                  <div className="space-y-1.5">
                    {/* Organizer */}
                    {inviteData.trip.organizer && (
                      <div className="flex items-center justify-between gap-2 rounded-lg bg-primary/5 border border-primary/15 px-3 py-2">
                        <span className="text-xs font-semibold text-foreground truncate">
                          {inviteData.trip.organizer.name}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-primary shrink-0">
                          <ShieldCheck className="h-3 w-3" /> Organizer
                        </span>
                      </div>
                    )}
                    {/* Confirmed Members */}
                    {inviteData.trip.confirmedMembers?.map((m, idx) => (
                      <div
                        key={m.userId || idx}
                        className="flex items-center justify-between gap-2 rounded-lg bg-muted/30 border border-border/40 px-3 py-2"
                      >
                        <span className="text-xs font-medium text-foreground truncate">
                          {m.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0">Member</span>
                      </div>
                    ))}
                    {/* Empty state if only organizer exists */}
                    {(!inviteData.trip.confirmedMembers || inviteData.trip.confirmedMembers.length === 0) && inviteData.trip.organizer && (
                      <p className="text-[11px] text-muted-foreground italic px-1">
                        Be the first to join this group.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Group Interests */}
              {inviteData.trip.interests && inviteData.trip.interests.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {inviteData.trip.interests.slice(0, 4).map((interest) => (
                    <span
                      key={interest}
                      className="rounded-md bg-background/60 px-2 py-0.5 text-[10px] text-muted-foreground border border-border/50"
                    >
                      {interest}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Expiration Note */}
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
              <Clock className="h-3 w-3 text-amber-500" />
              <span>Personal invite link · Expires in 7 days</span>
            </div>

            {/* Action Buttons: Logged in vs Not logged in vs Email mismatch */}
            {user ? (
              emailMismatch ? (
                <div className="space-y-3 pt-2">
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-800 dark:text-amber-200 space-y-1.5">
                    <p className="font-semibold flex items-center gap-1.5">
                      <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
                      Different Email Account Detected
                    </p>
                    <p className="text-[11px] leading-relaxed text-muted-foreground">
                      This invite was sent to <strong className="text-foreground">{inviteData.invitedEmail}</strong>. You are currently logged in as <strong className="text-foreground">{user.email}</strong>.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      className="rounded-xl text-xs h-10 font-medium"
                      asChild
                    >
                      <Link to="/login" search={{ redirect: `/invite/${token}` }}>
                        Switch to {inviteData.invitedEmail}
                      </Link>
                    </Button>
                    <Button
                      id="accept-invite-btn"
                      onClick={handleAccept}
                      disabled={accepting}
                      className="rounded-xl text-xs h-10 font-semibold gap-1.5 bg-primary"
                    >
                      {accepting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Join Anyway"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 pt-2">
                  <div className="rounded-xl border border-border/60 bg-muted/20 px-3.5 py-2.5 text-xs flex items-center justify-between">
                    <span className="text-muted-foreground">Joining as:</span>
                    <span className="font-semibold text-foreground truncate max-w-[200px]">
                      {user.displayName || user.email}
                    </span>
                  </div>

                  <Button
                    id="accept-invite-btn"
                    onClick={handleAccept}
                    disabled={accepting}
                    className="w-full h-11 rounded-xl font-semibold gap-2 bg-gradient-to-r from-primary to-accent shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all text-sm"
                  >
                    {accepting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Joining Group…
                      </>
                    ) : (
                      <>
                        <HeartHandshake className="h-4 w-4" />
                        Join Group & Enter Consensus
                      </>
                    )}
                  </Button>
                </div>
              )
            ) : (
              <div className="space-y-2.5 pt-2">
                <p className="text-xs text-center text-muted-foreground mb-3">
                  Log in or create a free account to join this trip group.
                </p>
                <Button
                  className="w-full h-11 rounded-xl font-semibold gap-2 bg-gradient-to-r from-primary to-accent shadow-md text-sm"
                  asChild
                >
                  <Link to="/login" search={{ redirect: `/invite/${token}` }}>
                    <LogIn className="h-4 w-4" />
                    Log In to Join Group
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  className="w-full h-10 rounded-xl text-xs font-semibold gap-2"
                  asChild
                >
                  <Link to="/signup" search={{ redirect: `/invite/${token}` }}>
                    <UserPlus className="h-3.5 w-3.5" />
                    Create New Account
                  </Link>
                </Button>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}
