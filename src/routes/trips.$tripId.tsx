import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { MapPin, Calendar, Users, Sun, Plane, Hotel, Utensils, Share2 } from "lucide-react";
import { budgetCategories } from "@/lib/mock-data";
import { inr } from "@/lib/utils";

export const Route = createFileRoute("/trips/$tripId")({ component: TripDetails });

function TripDetails() {
  const { tripId } = Route.useParams();
  const [trip, setTrip] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTrip() {
      try {
        const docSnap = await getDoc(doc(db, "trips", tripId));
        if (docSnap.exists()) {
          setTrip(docSnap.data());
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchTrip();
  }, [tripId]);

  if (loading) return (
    <AppShell>
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="font-display text-2xl text-muted-foreground animate-pulse">Loading your custom itinerary...</p>
      </div>
    </AppShell>
  );

  if (!trip) return <AppShell><div className="p-20 text-center">Trip not found.</div></AppShell>;

  return (
    <AppShell>
      <div className="relative h-72 overflow-hidden rounded-3xl">
        <img src="https://images.unsplash.com/photo-1772165075119-a427cb258651?fm=jpg&q=75&w=1400&auto=format&fit=crop" alt="Destination" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute bottom-6 left-6 right-6 text-white">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <Badge className="bg-white/20 text-white hover:bg-white/25">AI Generated</Badge>
              <h1 className="mt-3 font-display text-4xl md:text-5xl">{trip.title}</h1>
              <p className="mt-2 flex flex-wrap items-center gap-4 text-sm opacity-90">
                <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" />{trip.destination || "Destination"}</span>
                <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" />Custom Trip</span>
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm"><Share2 className="mr-1.5 h-4 w-4" />Share</Button>
              <Button size="sm" asChild><Link to="/itinerary">Open itinerary</Link></Button>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="mt-8">
        <TabsList className="rounded-xl">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="stays">Stays</TabsTrigger>
          <TabsTrigger value="budget">Budget</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <div className="rounded-2xl glass-panel p-6">
                <h3 className="font-semibold">Trip summary</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {trip.summary}
                </p>
                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-xl glass-tile p-4">
                    <Hotel className="h-4 w-4 text-muted-foreground" />
                    <p className="mt-2 text-xs text-muted-foreground">Budget Estimate</p>
                    <p className="text-sm font-semibold mt-1">{trip.budgetEstimate || "Varies based on live rates"}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl glass-panel p-6">
                <h3 className="font-semibold">Places you'll love</h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {[
                    { n: "Ambrai Ghat", t: "Golden hour · 15 min walk" },
                    { n: "Bagore-ki-Haveli", t: "Folk dance & museum · nightly" },
                    { n: "Sajjangarh Monsoon Palace", t: "Sunset viewpoint · short drive" },
                    { n: "Shilpgram craft village", t: "Artisan bazaar · guide included" },
                  ].map((p) => (
                    <div key={p.n} className="rounded-xl glass-tile p-4">
                      <p className="font-medium">{p.n}</p>
                      <p className="text-xs text-muted-foreground">{p.t}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-2xl glass-panel p-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Weather</h3>
                  <Sun className="h-4 w-4 text-warning" />
                </div>
                <p className="mt-3 font-display text-4xl">32°</p>
                <p className="text-xs text-muted-foreground">Clear · dry desert breeze</p>
                <div className="mt-4 grid grid-cols-5 gap-2 text-center text-xs">
                  {["Mon", "Tue", "Wed", "Thu", "Fri"].map((d, i) => (
                    <div key={d} className="rounded-lg border border-border/70 p-2">
                      <p className="text-muted-foreground">{d}</p>
                      <Sun className="mx-auto my-1 h-3.5 w-3.5 text-warning" />
                      <p className="font-medium">{31 + i}°</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl glass-panel p-6">
                <h3 className="font-semibold">Planning progress</h3>
                <div className="mt-4 space-y-3 text-sm">
                  {[["Flights", 100], ["Stays", 100], ["Activities", 65], ["Reservations", 40]].map(([k, v]) => (
                    <div key={k as string}>
                      <div className="flex justify-between text-xs"><span>{k}</span><span className="text-muted-foreground">{v}%</span></div>
                      <Progress value={v as number} className="mt-1 h-1.5" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="timeline" className="mt-6">
          <div className="rounded-2xl glass-panel p-6">
            {trip.days?.map((d: any) => (
              <div key={d.dayNumber} className="border-b border-border/60 py-6 first:pt-0 last:border-0 last:pb-0">
                <div className="flex items-baseline gap-3">
                  <span className="font-display text-3xl text-primary">Day {d.dayNumber}</span>
                  <span className="text-sm text-muted-foreground">{d.date || ""} · {d.title}</span>
                </div>
                <ul className="mt-4 space-y-3">
                  {d.activities?.map((i: any, idx: number) => (
                    <li key={idx} className="flex gap-4 rounded-xl glass-tile p-4">
                      <span className="w-14 shrink-0 text-sm font-semibold text-primary">{i.time}</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{i.description}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="stays" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2">
            {[
              { n: "Taj Lake Palace, Udaipur", t: "Jun 12 – 15 · Lake-view suite", p: "₹52,000" },
              { n: "Rambagh Palace, Jaipur", t: "Jun 15 – 18 · Historical suite", p: "₹45,000" },
            ].map((h) => (
              <div key={h.n} className="hover-lift rounded-2xl glass-panel p-6">
                <p className="text-sm text-muted-foreground">Confirmed</p>
                <p className="mt-1 text-lg font-semibold">{h.n}</p>
                <p className="mt-1 text-sm text-muted-foreground">{h.t}</p>
                <p className="mt-4 font-display text-2xl">{h.p}</p>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="budget" className="mt-6">
          <div className="rounded-2xl glass-panel p-6">
            <div className="space-y-4">
              {budgetCategories.map((b) => (
                <div key={b.name}>
                  <div className="flex justify-between text-sm"><span>{b.name}</span><span className="text-muted-foreground">{inr(b.spent)} / {inr(b.total)}</span></div>
                  <Progress value={(b.spent / b.total) * 100} className="mt-1.5 h-2" />
                </div>
              ))}
            </div>
            <Button asChild variant="outline" className="mt-6"><Link to="/budget">Full budget view</Link></Button>
          </div>
        </TabsContent>

        <TabsContent value="notes" className="mt-6">
          <div className="rounded-2xl glass-panel p-6">
            <p className="text-sm text-muted-foreground">Notes are private to your group.</p>
            <ul className="mt-4 space-y-3 text-sm">
              <li className="rounded-xl glass-tile p-4">Book Jag Mandir dinner 48h ahead — sunset slots fill fast.</li>
              <li className="rounded-xl glass-tile p-4">Priya's peanut allergy — flag at Ambrai and 1559 AD.</li>
              <li className="rounded-xl glass-tile p-4">Carry small INR notes for auto-rickshaws and Bagore-ki-Haveli entry.</li>
            </ul>
          </div>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
