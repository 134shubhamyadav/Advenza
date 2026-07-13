import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Check, ArrowRight, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/trips/new")({ component: NewTrip });

const steps = ["Destination", "Dates & travelers", "Budget", "Style", "Preferences", "Review"];

function NewTrip() {
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [interests, setInterests] = useState<string[]>(["Food", "Nature"]);
  const [style, setStyle] = useState("Balanced");
  const [budget, setBudget] = useState([180000]);

  const toggle = (s: string, list: string[], set: (v: string[]) => void) =>
    set(list.includes(s) ? list.filter((x) => x !== s) : [...list, s]);

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
                <div><Label className="text-xs">Where to</Label><Input className="mt-1.5 h-12 rounded-xl text-base" placeholder="Udaipur, India" defaultValue="Udaipur, India" /></div>
                <div className="flex flex-wrap gap-2">
                  {["Ladakh", "Varanasi", "Jaipur", "Kerala", "Goa", "Meghalaya", "Rishikesh", "Andaman"].map((c) => (
                    <button key={c} type="button" className="rounded-full border border-border bg-background px-3 py-1.5 text-sm hover:border-primary/40">{c}</button>
                  ))}
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><Label className="text-xs">Start date</Label><Input type="date" className="mt-1.5 h-12 rounded-xl" defaultValue="2026-06-12" /></div>
                  <div><Label className="text-xs">End date</Label><Input type="date" className="mt-1.5 h-12 rounded-xl" defaultValue="2026-06-19" /></div>
                </div>
                <div><Label className="text-xs">Travelers</Label><Input type="number" className="mt-1.5 h-12 rounded-xl" defaultValue={2} /></div>
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
                  {["Economy", "Comfort", "Luxury"].map((t) => (
                    <button key={t} className="rounded-xl border border-border bg-background p-4 text-left hover:border-primary/40">
                      <p className="font-semibold">{t}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Hostels & street food • Boutique stays • 5-star & private</p>
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
                  {["Flights", "Train", "Rental car", "Ferry", "Walking"].map((c) => (
                    <button key={c} type="button" className="rounded-full border border-border bg-background px-3 py-1.5 text-sm hover:border-primary/40">{c}</button>
                  ))}
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
                      <button key={c} type="button" className="rounded-full border border-border bg-background px-3 py-1.5 text-sm hover:border-primary/40">{c}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Anything special?</Label>
                  <Textarea className="mt-1.5 min-h-24 rounded-xl" placeholder="Celebrating an anniversary, dietary needs, must-see spots…" />
                </div>
              </div>
            )}
            {step === 5 && (
              <div className="space-y-4">
                <div className="rounded-2xl glass-tile p-5">
                  <p className="text-xs text-muted-foreground">Destination</p>
                  <p className="text-lg font-semibold">Udaipur, India</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  {[["Dates", "Jun 12 – 19"], ["Travelers", "2"], ["Budget", `₹${budget[0].toLocaleString("en-IN")}`], ["Style", style], ["Interests", interests.join(", ")], ["Stays", "Boutique"]].map(([k, v]) => (
                    <div key={k} className="rounded-xl glass-tile p-4">
                      <p className="text-xs text-muted-foreground">{k}</p>
                      <p className="mt-1 text-sm font-medium">{v}</p>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">Aventra will draft a full itinerary in about 20 seconds.</p>
              </div>
            )}
          </div>

          <div className="mt-10 flex items-center justify-between">
            <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
              <ArrowLeft className="mr-1 h-4 w-4" />Back
            </Button>
            {step < steps.length - 1 ? (
              <Button onClick={() => setStep((s) => s + 1)}>Continue<ArrowRight className="ml-1 h-4 w-4" /></Button>
            ) : (
              <Button onClick={() => nav({ to: "/trips/santorini" })}>Draft my trip<ArrowRight className="ml-1 h-4 w-4" /></Button>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
