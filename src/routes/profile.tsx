import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "../context/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { destinations } from "@/lib/mock-data";
import { Award, Globe, Plane, Camera, Moon } from "lucide-react";

export const Route = createFileRoute("/profile")({ component: Profile });

function Profile() {
  const { user } = useAuth();
  const nav = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      nav({ to: "/" });
    } catch (err) {
      console.error("Failed to log out", err);
    }
  };

  return (
    <AppShell>
      <div className="rounded-3xl glass-panel p-8">
        <div className="flex flex-col items-start gap-6 md:flex-row md:items-center">
          <Avatar className="h-24 w-24 shadow-soft">
            {user?.photoURL ? (
              <img src={user.photoURL} alt={user.displayName || "User"} className="h-full w-full rounded-full object-cover" />
            ) : (
              <AvatarFallback className="bg-primary text-2xl text-primary-foreground">
                {user?.displayName ? user.displayName.substring(0, 2).toUpperCase() : "ME"}
              </AvatarFallback>
            )}
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted-foreground">Traveler since 2022 · Gold status</p>
            <h1 className="mt-1 font-display text-4xl">{user?.displayName || "Adventurer"}</h1>
            <p className="mt-2 text-sm text-muted-foreground">Bengaluru, India · Slow traveler, food-first, always chasing the monsoon.</p>
          </div>
          <div className="flex gap-2 mt-4 md:mt-0">
            <Button variant="outline">Edit profile</Button>
            <Button variant="destructive" onClick={handleLogout}>Log out</Button>
          </div>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-4">
          {[
            { l: "Countries", v: "14", i: Globe },
            { l: "Trips", v: "23", i: Plane },
            { l: "Photos", v: "1,240", i: Camera },
            { l: "Awards", v: "6", i: Award },
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
          <TabsTrigger value="saved">Saved trips</TabsTrigger>
          <TabsTrigger value="achievements">Achievements</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="preferences" className="mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl glass-panel p-6">
              <h3 className="font-semibold">Personal information</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div><Label className="text-xs">First name</Label><Input className="mt-1.5" defaultValue={user?.displayName?.split(" ")[0] || ""} /></div>
                <div><Label className="text-xs">Last name</Label><Input className="mt-1.5" defaultValue={user?.displayName?.split(" ").slice(1).join(" ") || ""} /></div>
                <div className="sm:col-span-2"><Label className="text-xs">Email</Label><Input className="mt-1.5" defaultValue={user?.email || ""} readOnly /></div>
                <div><Label className="text-xs">Home city</Label><Input className="mt-1.5" defaultValue="Bengaluru" /></div>
                <div><Label className="text-xs">Currency</Label><Input className="mt-1.5" defaultValue="INR" /></div>

              </div>
            </div>
            <div className="rounded-2xl glass-panel p-6">
              <h3 className="font-semibold">Travel style</h3>
              <div className="mt-4 flex flex-wrap gap-2">
                {["Slow", "Foodie", "Culture", "Nature", "Photography", "Wellness", "Off-grid"].map((t) => (
                  <Badge key={t} variant="secondary" className="rounded-full">{t}</Badge>
                ))}
              </div>
              <h4 className="mt-6 text-sm font-semibold">Dietary</h4>
              <div className="mt-2 flex flex-wrap gap-2">
                {["Pescatarian", "No shellfish"].map((t) => (
                  <Badge key={t} className="rounded-full bg-accent/15 text-accent-foreground border border-accent/30">{t}</Badge>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="saved" className="mt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {destinations.map((d) => (
              <div key={d.id} className="hover-lift overflow-hidden rounded-2xl glass-panel">
                <div className="aspect-[4/3]"><img loading="lazy" src={d.image} alt={d.name} className="h-full w-full object-cover" /></div>
                <div className="p-4">
                  <p className="font-semibold">{d.name}</p>
                  <p className="text-xs text-muted-foreground">Saved · {d.country}</p>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="achievements" className="mt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { n: "Continent hopper", d: "Traveled to 4 continents", c: "bg-primary/10 text-primary" },
              { n: "Slow traveler", d: "5+ trips over 10 days", c: "bg-accent/10 text-accent" },
              { n: "Foodie", d: "50+ restaurants logged", c: "bg-warning/15 text-warning-foreground" },
              { n: "Group organizer", d: "Planned 6 group trips", c: "bg-secondary/40 text-foreground" },
              { n: "Bargain hunter", d: "Saved ₹2.5L+ with alerts", c: "bg-success/15 text-success-foreground" },
              { n: "Explorer", d: "Off the beaten path × 12", c: "bg-primary/10 text-primary" },
            ].map((a) => (
              <div key={a.n} className="rounded-2xl glass-panel p-5">
                <span className={`grid h-11 w-11 place-items-center rounded-xl ${a.c}`}><Award className="h-5 w-5" /></span>
                <p className="mt-4 font-semibold">{a.n}</p>
                <p className="mt-1 text-xs text-muted-foreground">{a.d}</p>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <div className="max-w-xl rounded-2xl glass-panel p-6">
            {[
              { l: "Dark mode", d: "Reduce glare after sunset.", icon: Moon },
              { l: "Trip reminders", d: "Get pings before departure and check-ins." },
              { l: "Price alerts", d: "Notify me when flights or stays drop." },
              { l: "Weekly digest", d: "A gentle Sunday roundup of your trips." },
            ].map((s) => (
              <div key={s.l} className="flex items-center justify-between border-b border-border/60 py-4 last:border-0">
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
