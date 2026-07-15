import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "../context/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { apiFetch } from "@/lib/api";
import { Award, Globe, Plane, Camera, Moon, Plus } from "lucide-react";

export const Route = createFileRoute("/profile")({ component: Profile });

type Trip = { _id: string; title: string; destination?: string };

function Profile() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripsLoading, setTripsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setTripsLoading(false);
      return;
    }
    apiFetch("/api/trips")
      .then((data) => setTrips(Array.isArray(data) ? data : []))
      .catch(() => setTrips([]))
      .finally(() => setTripsLoading(false));
  }, [user]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      nav({ to: "/" });
    } catch (err) {
      console.error("Failed to log out", err);
    }
  };

  const uniqueDestinations = new Set(
    trips.map((t) => t.destination?.split(",")[0]).filter(Boolean),
  );

  return (
    <AppShell>
      <div className="rounded-3xl glass-panel p-8">
        <div className="flex flex-col items-start gap-6 md:flex-row md:items-center">
          <Avatar className="h-24 w-24 shadow-soft">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || "User"}
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              <AvatarFallback className="bg-primary text-2xl text-primary-foreground">
                {user?.displayName ? user.displayName.substring(0, 2).toUpperCase() : "ME"}
              </AvatarFallback>
            )}
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted-foreground">
              {user?.metadata?.creationTime
                ? `Member since ${new Date(user.metadata.creationTime).getFullYear()}`
                : "Aventra member"}
            </p>
            <h1 className="mt-1 font-display text-4xl">
              {user?.displayName || user?.email?.split("@")[0] || "Adventurer"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{user?.email}</p>
          </div>
          <div className="flex gap-2 mt-4 md:mt-0">
            <Button variant="outline">Edit profile</Button>
            <Button variant="destructive" onClick={handleLogout}>
              Log out
            </Button>
          </div>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-4">
          {[
            { l: "Trips planned", v: tripsLoading ? "…" : trips.length.toString(), i: Plane },
            {
              l: "Destinations",
              v: tripsLoading ? "…" : uniqueDestinations.size.toString(),
              i: Globe,
            },
            { l: "Photos", v: "—", i: Camera },
            { l: "Achievements", v: "—", i: Award },
          ].map((s) => (
            <div key={s.l} className="rounded-2xl glass-tile p-4">
              <s.i className="h-4 w-4 text-muted-foreground" />
              <p className="mt-2 font-display text-2xl">{s.v}</p>
              <p className="text-xs text-muted-foreground">{s.l}</p>
            </div>
          ))}
        </div>
      </div>

      <Tabs defaultValue="preferences" className="mt-8">
        <TabsList className="rounded-xl">
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="trips">My trips</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="preferences" className="mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl glass-panel p-6">
              <h3 className="font-semibold">Personal information</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-xs">First name</Label>
                  <Input className="mt-1.5" defaultValue={user?.displayName?.split(" ")[0] || ""} />
                </div>
                <div>
                  <Label className="text-xs">Last name</Label>
                  <Input
                    className="mt-1.5"
                    defaultValue={user?.displayName?.split(" ").slice(1).join(" ") || ""}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">Email</Label>
                  <Input className="mt-1.5" defaultValue={user?.email || ""} readOnly />
                </div>
                <div>
                  <Label className="text-xs">Home city</Label>
                  <Input className="mt-1.5" placeholder="Enter your city" />
                </div>
                <div>
                  <Label className="text-xs">Currency</Label>
                  <Input className="mt-1.5" defaultValue="INR" />
                </div>
              </div>
            </div>
            <div className="rounded-2xl glass-panel p-6">
              <h3 className="font-semibold">Travel style</h3>
              <p className="mt-3 text-sm text-muted-foreground">
                Travel style preferences coming soon — Aventra will use these to personalize your
                itineraries and packing lists.
              </p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="trips" className="mt-6">
          {tripsLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-2xl glass-panel h-32" />
              ))}
            </div>
          ) : trips.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl glass-panel p-16 text-center">
              <Plane className="h-12 w-12 text-muted-foreground/30" />
              <p className="mt-4 text-lg font-semibold">No trips yet</p>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                Your planned trips will appear here.
              </p>
              <Button className="mt-6" asChild>
                <Link to="/trips/new">
                  <Plus className="mr-1.5 h-4 w-4" />
                  Plan a trip
                </Link>
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {trips.map((t) => (
                <Link
                  key={t._id}
                  to="/trips/$tripId"
                  params={{ tripId: t._id }}
                  className="hover-lift rounded-2xl glass-panel p-5 block"
                >
                  <p className="text-xs text-muted-foreground">{t.destination ?? "Trip"}</p>
                  <p className="mt-1 font-semibold">{t.title}</p>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <div className="max-w-xl rounded-2xl glass-panel p-6">
            {[
              { l: "Dark mode", d: "Reduce glare after sunset.", icon: Moon },
              { l: "Trip reminders", d: "Get pings before departure and check-ins." },
              { l: "Price alerts", d: "Notify me when flights or stays drop." },
              { l: "Weekly digest", d: "A gentle Sunday roundup of your trips." },
            ].map((s) => (
              <div
                key={s.l}
                className="flex items-center justify-between border-b border-border/60 py-4 last:border-0"
              >
                <div>
                  <p className="font-medium">{s.l}</p>
                  <p className="text-xs text-muted-foreground">{s.d}</p>
                </div>
                <Switch defaultChecked={s.l !== "Dark mode"} />
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
