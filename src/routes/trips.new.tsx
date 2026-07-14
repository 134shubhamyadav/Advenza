import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Check, ArrowRight, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";

export const Route = createFileRoute("/trips/new")({ component: NewTrip });

const steps = ["Destination", "Dates & travelers", "Budget", "Style", "Preferences", "Review"];

function NewTrip() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [destination, setDestination] = useState("Udaipur, India");
  const [startDate, setStartDate] = useState("2026-06-12");
  const [endDate, setEndDate] = useState("2026-06-19");
  const [travelers, setTravelers] = useState(2);
  const [budget, setBudget] = useState([180000]);
  const [style, setStyle] = useState("Balanced");
  const [interests, setInterests] = useState<string[]>(["Food", "Nature"]);
  const [transport, setTransport] = useState<string[]>(["Flights"]);
  const [accommodation, setAccommodation] = useState("Boutique");
  const [special, setSpecial] = useState("");

  const toggle = (s: string, list: string[], set: (v: string[]) => void) =>
    set(list.includes(s) ? list.filter((x) => x !== s) : [...list, s]);

  const handleDraftTrip = async () => {
    try {
      setLoading(true);
      setError("");

      const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

      // Call OpenAI-powered backend endpoint (authenticated)
      const tripData = await apiFetch('/api/ai/generate', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination,
          startDate,
          endDate,
          budget: budget[0],
          style,
          interests,
          accommodation,
          transport,
          special,
          createdBy: user?.uid || "guest",
        }),
      });

      // Navigate to the real trip page with the MongoDB _id
      nav({ to: `/trips/${tripData._id}` });
    } catch (err: any) {
      console.error(err);
      setError(`Failed to generate trip: ${err.message || err.toString()}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell title="Plan a new trip" subtitle="A few quick answers and Aventra drafts the rest.">
      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        {/* Steps rail */}
        <ol className="hidden lg:block">
          {steps.map((s, i) => (
            <li key={s} className="flex items-center gap-3 py-2">
              <span className={cn("grid h-7 w-7 place-items-center rounded-full text-xs font-semibold",
                i < step ? "bg-accent text-accent-foreground" : i === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className={cn("text-sm", i === step ? "font-semibold" : "text-muted-foreground")}>{s}</span>
            </li>
          ))}
        </ol>

        <div className="rounded-3xl glass-panel p-6 md:p-10">
          <div className="mb-1 text-xs font-medium text-muted-foreground">Step {step + 1} of {steps.length}</div>
          <h2 className="font-display text-3xl md:text-4xl">{steps[step]}</h2>

          <div className="mt-8 min-h-[280px]">
            {step === 0 && (
              <div className="space-y-5">
                <div><Label className="text-xs">Where to</Label><Input value={destination} onChange={(e) => setDestination(e.target.value)} className="mt-1.5 h-12 rounded-xl text-base" placeholder="Udaipur, India" /></div>
                <div className="flex flex-wrap gap-2">
                  {["Ladakh", "Varanasi", "Jaipur", "Kerala", "Goa", "Meghalaya", "Rishikesh", "Andaman"].map((c) => (
                    <button key={c} type="button" onClick={() => setDestination(c)} className={cn("rounded-full border px-3 py-1.5 text-sm transition", destination === c ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:border-primary/40")}>{c}</button>
                  ))}
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><Label className="text-xs">Start date</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1.5 h-12 rounded-xl" /></div>
                  <div><Label className="text-xs">End date</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1.5 h-12 rounded-xl" /></div>
                </div>
                <div><Label className="text-xs">Travelers</Label><Input type="number" value={travelers} onChange={(e) => setTravelers(parseInt(e.target.value) || 1)} className="mt-1.5 h-12 rounded-xl" min={1} /></div>
              </div>
            )}
            {step === 2 && (
              <div>
                <Label className="text-xs">Total budget</Label>
                <div className="mt-6">
                  <Slider value={budget} onValueChange={setBudget} min={40000} max={800000} step={5000} />
                  <div className="mt-4 flex items-baseline justify-between">
                    <p className="font-display text-4xl">₹{budget[0].toLocaleString("en-IN")}</p>
                    <p className="text-sm text-muted-foreground">~₹{Math.round(budget[0] / 7).toLocaleString("en-IN")}/day</p>
                  </div>
                </div>
                <div className="mt-8 grid gap-3 sm:grid-cols-3">
                  {[
                    { id: "Economy", desc: "Hostels & street food" },
                    { id: "Comfort", desc: "Boutique stays & casual dining" },
                    { id: "Luxury", desc: "5-star & private villas" },
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setAccommodation(t.id)}
                      className={cn(
                        "rounded-xl border p-4 text-left transition",
                        accommodation === t.id
                          ? "border-primary bg-primary/5"
                          : "border-border bg-background hover:border-primary/40"
                      )}
                    >
                      <p className="font-semibold">{t.id}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {step === 3 && (
              <div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {["Slow", "Balanced", "Packed"].map((t) => (
                    <button key={t} onClick={() => setStyle(t)} className={cn("rounded-xl border p-5 text-left transition",
                      style === t ? "border-primary bg-primary/5" : "border-border bg-background hover:border-primary/40")}>
                      <p className="font-semibold">{t}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{t === "Slow" ? "One thing a day, lots of wandering." : t === "Balanced" ? "2–3 anchor activities, room to explore." : "Every hour planned, maximum coverage."}</p>
                    </button>
                  ))}
                </div>
                <p className="mt-8 text-xs text-muted-foreground">Transportation</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {["Flights", "Train", "Rental car", "Ferry", "Walking"].map((c) => {
                    const on = transport.includes(c);
                    return (
                      <button key={c} type="button" onClick={() => toggle(c, transport, setTransport)}
                        className={cn("rounded-full border px-3 py-1.5 text-sm transition",
                          on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:border-primary/40")}>{c}</button>
                    );
                  })}
                </div>
              </div>
            )}
            {step === 4 && (
              <div className="space-y-5">
                <div>
                  <Label className="text-xs">Interests</Label>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {["Food", "Nature", "History", "Nightlife", "Museums", "Beaches", "Hiking", "Photography", "Wellness"].map((c) => {
                      const on = interests.includes(c);
                      return (
                        <button key={c} type="button" onClick={() => toggle(c, interests, setInterests)}
                          className={cn("rounded-full border px-3 py-1.5 text-sm transition",
                            on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:border-primary/40")}>{c}</button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Accommodation</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {["Hotel", "Boutique", "Villa", "Airbnb", "Hostel"].map((c) => (
                      <button key={c} type="button" onClick={() => setAccommodation(c)} className={cn("rounded-full border px-3 py-1.5 text-sm transition", accommodation === c ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:border-primary/40")}>{c}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Anything special?</Label>
                  <Textarea value={special} onChange={(e) => setSpecial(e.target.value)} className="mt-1.5 min-h-24 rounded-xl" placeholder="Celebrating an anniversary, dietary needs, must-see spots…" />
                </div>
              </div>
            )}
            {step === 5 && (
              <div className="space-y-4">
                <div className="rounded-2xl glass-tile p-5">
                  <p className="text-xs text-muted-foreground">Destination</p>
                  <p className="text-lg font-semibold">{destination}</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  {[["Dates", `${startDate} to ${endDate}`], ["Travelers", travelers], ["Budget", `₹${budget[0].toLocaleString("en-IN")}`], ["Style", style], ["Interests", interests.join(", ")], ["Stays", accommodation]].map(([k, v]) => (
                    <div key={k} className="rounded-xl glass-tile p-4">
                      <p className="text-xs text-muted-foreground">{k}</p>
                      <p className="mt-1 text-sm font-medium">{v}</p>
                    </div>
                  ))}
                </div>
                <div className="rounded-2xl glass-tile p-5">
                  <p className="text-xs text-muted-foreground">Destination</p>
                  <p className="text-lg font-semibold">{destination}</p>
                </div>

                {error && <div className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
                
                <p className="text-sm text-muted-foreground">Aventra will draft a sample itinerary based on your destination.</p>
              </div>
            )}
          </div>

          <div className="mt-10 flex items-center justify-between">
            <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || loading}>
              <ArrowLeft className="mr-1 h-4 w-4" />Back
            </Button>
            {step < steps.length - 1 ? (
              <Button onClick={() => setStep((s) => s + 1)}>Continue<ArrowRight className="ml-1 h-4 w-4" /></Button>
            ) : (
              <Button onClick={handleDraftTrip} disabled={loading}>
                {loading ? "✨ AI is drafting your trip..." : "Generate with AI"}<ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
