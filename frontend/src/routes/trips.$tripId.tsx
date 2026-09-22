import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { MapPin, Calendar, Users, Plane, Share2, Wallet, Plus, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { inr, normalizeTimeTo24h } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/trips/$tripId")({ component: TripDetails });

const DESTINATION_IMAGES: Record<string, string> = {
  default:
    "https://images.unsplash.com/photo-1477587458883-47145ed94245?w=1200&q=75&auto=format&fit=crop",
  udaipur:
    "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=1200&q=75&auto=format&fit=crop",
  goa: "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=1200&q=75&auto=format&fit=crop",
  manali:
    "https://images.unsplash.com/photo-1486911278844-a81c5267e227?w=1200&q=75&auto=format&fit=crop",
  jaipur:
    "https://images.unsplash.com/photo-1477587458883-47145ed94245?w=1200&q=75&auto=format&fit=crop",
  ladakh:
    "https://images.unsplash.com/photo-1772165075119-a427cb258651?w=1200&q=75&auto=format&fit=crop",
  kerala:
    "https://images.unsplash.com/photo-1602301673827-9a5e0b5e7555?w=1200&q=75&auto=format&fit=crop",
};

const getImage = (dest?: string) => {
  if (!dest) return DESTINATION_IMAGES.default;
  const key = dest.toLowerCase().split(",")[0].trim();
  return DESTINATION_IMAGES[key] || DESTINATION_IMAGES.default;
};

type Expense = { category: string; amount: number; description?: string };
type Activity = { time: string; description: string };
type Day = { dayNumber: number; date?: string; title: string; activities?: Activity[] };
type Trip = {
  _id: string;
  title: string;
  destination?: string;
  summary?: string;
  budgetEstimate?: string;
  days?: Day[];
  expenses?: Expense[];
  members?: { name: string }[];
  createdBy?: string;
};

<<<<<<< HEAD
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
=======
import { useQuery, useQueryClient } from "@tanstack/react-query";
>>>>>>> 6cf8129f1b59a8dafea26d19fadc7d6e6c81c6f4
import { queryKeys } from "@/lib/queryKeys";

function TripDetails() {
  const { tripId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: trip = null, isLoading: loading } = useQuery({
    queryKey: queryKeys.tripDetails(tripId),
    queryFn: async () => {
      const data = await apiFetch(`/api/trips/${tripId}`);
      return data as Trip;
    },
    enabled: !!tripId,
  });

<<<<<<< HEAD
  const regenerateMutation = useMutation({
    mutationFn: async () => {
      return await apiFetch(`/api/ai/regenerate/${tripId}`, {
        method: "POST",
        body: JSON.stringify({}),
      });
    },
    onSuccess: (updatedTrip: Trip) => {
      toast.success("Itinerary refreshed with fresh AI suggestions!");
      queryClient.setQueryData(queryKeys.tripDetails(tripId), updatedTrip);
      queryClient.setQueryData(queryKeys.trips(), (old: any[] = []) =>
        old.map((t) => (t._id === tripId ? updatedTrip : t))
      );
    },
    onError: (err: any) => {
      console.error("Regenerate error:", err);
      toast.error(err.message || "Failed to regenerate itinerary");
    },
  });

=======
>>>>>>> 6cf8129f1b59a8dafea26d19fadc7d6e6c81c6f4
  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      await apiFetch(`/api/trips/${tripId}`, { method: "DELETE" });
      queryClient.setQueryData(queryKeys.trips(), (old: any[] = []) =>
        old.filter((t) => t._id !== tripId),
      );
      toast.success("Trip deleted successfully");
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to delete trip");
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  };

  const isOwner = user && trip && trip.createdBy === user.uid;

  if (loading)
    return (
      <AppShell>
        <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="font-display text-2xl text-muted-foreground animate-pulse">
            Loading your itinerary...
          </p>
        </div>
      </AppShell>
    );

  if (!trip)
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center rounded-2xl glass-panel p-16 text-center">
          <Plane className="h-12 w-12 text-muted-foreground/30" />
          <p className="mt-4 text-lg font-semibold">Trip not found</p>
          <p className="mt-2 text-sm text-muted-foreground">
            This trip may have been deleted or doesn't exist.
          </p>
          <Button className="mt-6" asChild>
            <Link to="/dashboard">
              <Plus className="mr-1.5 h-4 w-4" />
              Back to dashboard
            </Link>
          </Button>
        </div>
      </AppShell>
    );

  // Budget summary from real expenses
  const expensesByCategory = (trip.expenses ?? []).reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + e.amount;
    return acc;
  }, {});
  const totalSpent = Object.values(expensesByCategory).reduce((a, b) => a + b, 0);

  return (
    <AppShell>
      <div className="relative h-72 overflow-hidden rounded-3xl">
        <img
          src={getImage(trip.destination)}
          alt={trip.destination ?? trip.title}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute bottom-6 left-6 right-6 text-white">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <Badge className="bg-white/20 text-white hover:bg-white/25">AI Generated</Badge>
              <h1 className="mt-3 font-display text-4xl md:text-5xl">{trip.title}</h1>
              <p className="mt-2 flex flex-wrap items-center gap-4 text-sm opacity-90">
                {trip.destination && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" />
                    {trip.destination}
                  </span>
                )}
                {trip.days?.length ? (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    {trip.days.length} day{trip.days.length !== 1 ? "s" : ""}
                  </span>
                ) : null}
                {trip.members?.length ? (
                  <span className="flex items-center gap-1.5">
                    <Users className="h-4 w-4" />
                    {trip.members.length} traveler{trip.members.length !== 1 ? "s" : ""}
                  </span>
                ) : null}
              </p>
            </div>
            <div className="flex gap-2 items-center flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => regenerateMutation.mutate()}
                disabled={regenerateMutation.isPending}
                className="bg-white/10 text-white border-white/20 hover:bg-white/20 backdrop-blur-sm"
              >
                {regenerateMutation.isPending ? "Regenerating..." : "Regenerate AI"}
              </Button>
              {isOwner && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setIsDeleteDialogOpen(true)}
                  className="bg-red-500/20 text-red-500 border border-red-500/30 hover:bg-red-500/30 shrink-0"
                >
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  Delete
                </Button>
              )}
              <Button variant="secondary" size="sm">
                <Share2 className="mr-1.5 h-4 w-4" />
                Share
              </Button>
              <Button size="sm" asChild>
                <Link to="/itinerary" search={{ tripId: trip._id }}>Open itinerary</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="mt-8">
        <TabsList className="rounded-xl">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="budget">Budget</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <div className="rounded-2xl glass-panel p-6">
                <h3 className="font-semibold">Trip summary</h3>
                {trip.summary ? (
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {trip.summary}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-muted-foreground italic">
                    No summary generated yet.
                  </p>
                )}
                {trip.budgetEstimate && (
                  <div className="mt-6 grid gap-4 sm:grid-cols-3">
                    <div className="rounded-xl glass-tile p-4">
                      <Wallet className="h-4 w-4 text-muted-foreground" />
                      <p className="mt-2 text-xs text-muted-foreground">Budget Estimate</p>
                      <p className="text-sm font-semibold mt-1">{trip.budgetEstimate}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-2xl glass-panel p-6">
                <h3 className="font-semibold">Trip details</h3>
                <ul className="mt-4 space-y-3 text-sm">
                  {trip.destination && (
                    <li className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4 shrink-0 text-primary" />
                      {trip.destination}
                    </li>
                  )}
                  {trip.days?.length ? (
                    <li className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4 shrink-0 text-primary" />
                      {trip.days.length} day{trip.days.length !== 1 ? "s" : ""} planned
                    </li>
                  ) : null}
                  {trip.members?.length ? (
                    <li className="flex items-center gap-2 text-muted-foreground">
                      <Users className="h-4 w-4 shrink-0 text-primary" />
                      {trip.members.length} traveler{trip.members.length !== 1 ? "s" : ""}
                    </li>
                  ) : null}
                </ul>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="timeline" className="mt-6">
          <div className="rounded-2xl glass-panel p-6">
            {!trip.days?.length ? (
              <div className="py-10 text-center">
                <Calendar className="mx-auto h-10 w-10 text-muted-foreground/40" />
                <p className="mt-3 text-muted-foreground">No timeline available for this trip.</p>
              </div>
            ) : (
              trip.days.map((d) => (
                <div
                  key={d.dayNumber}
                  className="border-b border-border/60 py-6 first:pt-0 last:border-0 last:pb-0"
                >
                  <div className="flex items-baseline gap-3">
                    <span className="font-display text-3xl text-primary">Day {d.dayNumber}</span>
                    <span className="text-sm text-muted-foreground">
                      {d.date ? `${d.date} · ` : ""}
                      {d.title}
                    </span>
                  </div>
                  <ul className="mt-4 space-y-3">
                    {(d.activities ?? []).map((item, idx) => (
                      <li key={idx} className="flex gap-4 rounded-xl glass-tile p-4">
                        <span className="w-20 shrink-0 text-sm font-semibold text-primary whitespace-nowrap">
                          {normalizeTimeTo24h(item.time)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{item.description}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="budget" className="mt-6">
          <div className="rounded-2xl glass-panel p-6">
            {Object.keys(expensesByCategory).length === 0 ? (
              <div className="py-10 text-center">
                <Wallet className="mx-auto h-10 w-10 text-muted-foreground/40" />
                <p className="mt-3 text-muted-foreground">No expenses recorded yet.</p>
                <Button variant="outline" className="mt-4" asChild>
                  <Link to="/budget">Add expenses</Link>
                </Button>
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-baseline justify-between">
                  <p className="text-sm text-muted-foreground">Total spent</p>
                  <p className="font-display text-2xl">{inr(totalSpent)}</p>
                </div>
                <div className="space-y-4">
                  {Object.entries(expensesByCategory).map(([cat, spent]) => (
                    <div key={cat}>
                      <div className="flex justify-between text-sm">
                        <span>{cat}</span>
                        <span className="text-muted-foreground">{inr(spent)}</span>
                      </div>
                      <Progress
                        value={totalSpent > 0 ? (spent / totalSpent) * 100 : 0}
                        className="mt-1.5 h-2"
                      />
                    </div>
                  ))}
                </div>
                <Button asChild variant="outline" className="mt-6">
                  <Link to="/budget">Full budget view</Link>
                </Button>
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="notes" className="mt-6">
          <div className="rounded-2xl glass-panel p-6">
            <p className="text-sm text-muted-foreground">Notes are private to your group.</p>
            <div className="mt-6 flex flex-col items-center py-8 text-center">
              <p className="text-sm text-muted-foreground">
                No notes yet. Add notes to share with your group.
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={(open) => !open && setIsDeleteDialogOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this trip?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the trip and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteConfirm();
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
