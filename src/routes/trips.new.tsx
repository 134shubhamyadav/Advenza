import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

  // ── All fields start empty / unset ─────────────────────────────────────────
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [travelers, setTravelers] = useState<string>("1");
  const [budget, setBudget] = useState<string>("");
  const [style, setStyle] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [transport, setTransport] = useState<string[]>([]);
  const [accommodation, setAccommodation] = useState("");
  const [special, setSpecial] = useState("");

  const toggle = (s: string, list: string[], set: (v: string[]) => void) =>
    set(list.includes(s) ? list.filter((x) => x !== s) : [...list, s]);

  // ── Per-step validation ────────────────────────────────────────────────────
  const canProceed = () => {
    if (step === 0) return destination.trim().length > 0;
    if (step === 1) return startDate && endDate && endDate >= startDate && parseInt(travelers) >= 1;
    if (step === 2) return budget !== "" && parseInt(budget) >= 0;
    if (step === 3) return style !== "" && transport.length > 0;
    return true;
  };

  const handleNext = () => {
    if (!canProceed()) return;
    setStep((s) => s + 1);
  };

  const handleDraftTrip = async () => {
    try {
      setLoading(true);
      setError("");

      // apiFetch uses Vite's proxy to reach the backend — no CORS, no hardcoded URLs.
      const tripData = await apiFetch("/api/ai/generate", {
        method: "POST",
        body: JSON.stringify({
          destination,
          startDate,
          endDate,
          budget: parseInt(budget) || 0,
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
      console.error("Trip generation error:", err);
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const budgetNum = parseInt(budget) || 0;
  const tripDays = (() => {
    if (!startDate || !endDate) return 1;
    const diff = Math.ceil(
      (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000,
    );
    return Math.max(diff, 1);
  })();

  return (
    <AppShell title="Plan a new trip" subtitle="A few quick answers and Aventra drafts the rest.">
      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        {/* Steps rail */}
        <ol className="hidden lg:block">
          {steps.map((s, i) => (
            <li key={s} className="flex items-center gap-3 py-2">
              <span
                className={cn(
                  "grid h-7 w-7 place-items-center rounded-full text-xs font-semibold",
                  i < step
                    ? "bg-accent text-accent-foreground"
                    : i === step
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span
                className={cn("text-sm", i === step ? "font-semibold" : "text-muted-foreground")}
              >
                {s}
              </span>
            </li>
          ))}
        </ol>

        <div className="rounded-3xl glass-panel p-6 md:p-10">
          <div className="mb-1 text-xs font-medium text-muted-foreground">
            Step {step + 1} of {steps.length}
          </div>
          <h2 className="font-display text-3xl md:text-4xl">{steps[step]}</h2>

          <div className="mt-8 min-h-[280px]">

            {/* ── Step 0: Destination ── */}
            {step === 0 && (
              <div className="space-y-5">
                <div>
                  <Label className="text-xs">Where to</Label>
                  <Input
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="mt-1.5 h-12 rounded-xl text-base"
                    placeholder="e.g. Varanasi, India"
                    autoFocus
                  />
                </div>
                {/* Quick-pick chips — clicking sets the field but doesn't pre-fill */}
                <div>
                  <p className="mb-2 text-xs text-muted-foreground">Popular picks</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      "Ladakh",
                      "Varanasi",
                      "Jaipur",
                      "Kerala",
                      "Goa",
                      "Meghalaya",
                      "Rishikesh",
                      "Andaman",
                    ].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setDestination(c)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-sm transition",
                          destination === c
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background hover:border-primary/40",
                        )}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
                {!destination.trim() && (
                  <p className="text-xs text-destructive">Please enter a destination to continue.</p>
                )}
              </div>
            )}

            {/* ── Step 1: Dates & Travelers ── */}
            {step === 1 && (
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs">Start date</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="mt-1.5 h-12 rounded-xl"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">End date</Label>
                    <Input
                      type="date"
                      value={endDate}
                      min={startDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="mt-1.5 h-12 rounded-xl"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Number of travelers</Label>
                  <Input
                    id="travelers-input"
                    type="number"
                    inputMode="numeric"
                    value={travelers}
                    onChange={(e) => {
                      const v = e.target.value;
                      setTravelers(v);
                    }}
                    onBlur={() => {
                      const n = parseInt(travelers);
                      setTravelers(isNaN(n) || n < 1 ? "1" : String(n));
                    }}
                    className="mt-1.5 h-12 w-32 rounded-xl"
                    min={1}
                    max={99}
                    placeholder="1"
                  />
                </div>
                {endDate && startDate && endDate < startDate && (
                  <p className="text-xs text-destructive">End date must be after start date.</p>
                )}
              </div>
            )}

            {/* ── Step 2: Budget & Accommodation ── */}
            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <Label className="text-xs">Total budget (₹ INR)</Label>
                  <div className="mt-1.5 flex items-center gap-3">
                    <span className="text-xl font-semibold text-muted-foreground">₹</span>
                    <Input
                      id="budget-input"
                      type="number"
                      inputMode="numeric"
                      value={budget}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "" || parseInt(v) >= 0) setBudget(v);
                      }}
                      onBlur={() => {
                        if (budget === "" || parseInt(budget) < 0) setBudget("0");
                      }}
                      className="h-12 rounded-xl text-base"
                      min={0}
                      placeholder="e.g. 50000"
                    />
                  </div>
                  {budget !== "" && budgetNum >= 0 && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      ~₹{Math.round(budgetNum / tripDays).toLocaleString("en-IN")} per day
                      over {tripDays} day{tripDays !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>

                <div>
                  <Label className="text-xs">Accommodation preference</Label>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
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
                            : "border-border bg-background hover:border-primary/40",
                        )}
                      >
                        <p className="font-semibold">{t.id}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{t.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 3: Style & Transport ── */}
            {step === 3 && (
              <div className="space-y-6">
                <div>
                  <Label className="text-xs">Trip pace</Label>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    {["Slow", "Balanced", "Packed"].map((t) => (
                      <button
                        key={t}
                        onClick={() => setStyle(t)}
                        className={cn(
                          "rounded-xl border p-5 text-left transition",
                          style === t
                            ? "border-primary bg-primary/5"
                            : "border-border bg-background hover:border-primary/40",
                        )}
                      >
                        <p className="font-semibold">{t}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t === "Slow"
                            ? "One thing a day, lots of wandering."
                            : t === "Balanced"
                              ? "2–3 anchor activities, room to explore."
                              : "Every hour planned, maximum coverage."}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-xs">
                    Transportation <span className="text-muted-foreground">(select all that apply)</span>
                  </Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {["Flights", "Train", "Rental car", "Ferry", "Walking", "Bus"].map((c) => {
                      const on = transport.includes(c);
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => toggle(c, transport, setTransport)}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-sm transition",
                            on
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-background hover:border-primary/40",
                          )}
                        >
                          {c}
                        </button>
                      );
                    })}
                  </div>
                  {transport.length === 0 && (
                    <p className="mt-2 text-xs text-destructive">Select at least one transport mode.</p>
                  )}
                </div>
              </div>
            )}

            {/* ── Step 4: Interests & Special Requests ── */}
            {step === 4 && (
              <div className="space-y-5">
                <div>
                  <Label className="text-xs">
                    Interests <span className="text-muted-foreground">(select any that apply)</span>
                  </Label>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[
                      "Food",
                      "Nature",
                      "History",
                      "Nightlife",
                      "Museums",
                      "Beaches",
                      "Hiking",
                      "Photography",
                      "Wellness",
                      "Adventure",
                      "Shopping",
                      "Architecture",
                    ].map((c) => {
                      const on = interests.includes(c);
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => toggle(c, interests, setInterests)}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-sm transition",
                            on
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-background hover:border-primary/40",
                          )}
                        >
                          {c}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <Label className="text-xs">
                    Accommodation <span className="text-muted-foreground">(override if needed)</span>
                  </Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {["Hotel", "Boutique", "Villa", "Airbnb", "Hostel"].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setAccommodation(c)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-sm transition",
                          accommodation === c
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background hover:border-primary/40",
                        )}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Anything special?</Label>
                  <Textarea
                    value={special}
                    onChange={(e) => setSpecial(e.target.value)}
                    className="mt-1.5 min-h-24 rounded-xl"
                    placeholder="Celebrating an anniversary, dietary needs, must-see spots…"
                  />
                </div>
              </div>
            )}

            {/* ── Step 5: Review ── */}
            {step === 5 && (
              <div className="space-y-4">
                <div className="rounded-2xl glass-tile p-5">
                  <p className="text-xs text-muted-foreground">Destination</p>
                  <p className="text-lg font-semibold">{destination}</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    ["Dates", `${startDate} → ${endDate}`],
                    ["Travelers", `${travelers} ${parseInt(travelers) === 1 ? "person" : "people"}`],
                    ["Budget", budget ? `₹${parseInt(budget).toLocaleString("en-IN")}` : "Not set"],
                    ["Pace", style || "Not set"],
                    ["Transport", transport.length ? transport.join(", ") : "Not set"],
                    ["Accommodation", accommodation || "Not set"],
                    ["Interests", interests.length ? interests.join(", ") : "None selected"],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-xl glass-tile p-4">
                      <p className="text-xs text-muted-foreground">{k}</p>
                      <p className="mt-1 text-sm font-medium">{v}</p>
                    </div>
                  ))}
                </div>

                {special && (
                  <div className="rounded-xl glass-tile p-4">
                    <p className="text-xs text-muted-foreground">Special requests</p>
                    <p className="mt-1 text-sm">{special}</p>
                  </div>
                )}

                {error && (
                  <div className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                  </div>
                )}

                <p className="text-sm text-muted-foreground">
                  The AI will strictly follow your selections above to generate your itinerary.
                </p>
              </div>
            )}
          </div>

          <div className="mt-10 flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0 || loading}
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
            {step < steps.length - 1 ? (
              <Button onClick={handleNext} disabled={!canProceed()}>
                Continue
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleDraftTrip} disabled={loading}>
                {loading ? "✨ AI is drafting your trip..." : "Generate with AI"}
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
