import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Check, ArrowRight, ArrowLeft, Plane, Train, Bus, Car, Ship } from "lucide-react";
import { cn, normalizeTimeTo24h } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { TimePicker } from "@/components/ui/time-picker";

export const Route = createFileRoute("/trips/new")({ component: NewTrip });

const steps = [
  "Destination",
  "Dates & travelers",
  "Budget",
  "Travel details",
  "Accommodation",
  "Preferences",
  "Review",
];

const MODES = [
  { id: "Flight", icon: Plane },
  { id: "Train", icon: Train },
  { id: "Bus", icon: Bus },
  { id: "Car", icon: Car },
  { id: "Ferry", icon: Ship },
];

function NewTrip() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ── Step 0: Destination ────────────────────────────────────────────────────
  const [destination, setDestination] = useState("");
  const [originCity, setOriginCity] = useState("");

  // ── Step 1: Dates & Travelers ──────────────────────────────────────────────
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [travelers, setTravelers] = useState<string>("1");

  // ── Step 2: Budget ─────────────────────────────────────────────────────────
  const [budget, setBudget] = useState<string>("");

  // ── Step 3: Travel Details ─────────────────────────────────────────────────
  const [travelMode, setTravelMode] = useState("");        // primary intercity mode
  const [departureHub, setDepartureHub] = useState("");    // airport / station / terminal (origin)
  const [arrivalHub, setArrivalHub] = useState("");        // airport / station / terminal (destination)
  const [transitRef, setTransitRef] = useState("");        // flight no / train name
  const [departureTime, setDepartureTime] = useState(""); // HH:MM
  const [arrivalTime, setArrivalTime] = useState("");     // HH:MM
  // Keep legacy multi-select for local transport
  const [transport, setTransport] = useState<string[]>([]);

  // ── Step 4: Accommodation ──────────────────────────────────────────────────
  const [accommodation, setAccommodation] = useState("");
  const [hotelName, setHotelName] = useState("");
  const [hotelLocation, setHotelLocation] = useState("");
  const [checkInTime, setCheckInTime] = useState("");
  const [checkOutTime, setCheckOutTime] = useState("");

  // ── Step 5: Preferences ────────────────────────────────────────────────────
  const [style, setStyle] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [special, setSpecial] = useState("");

  // ── Helpers ────────────────────────────────────────────────────────────────
  const toggle = (s: string, list: string[], set: (v: string[]) => void) =>
    set(list.includes(s) ? list.filter((x) => x !== s) : [...list, s]);

  const budgetNum = parseInt(budget) || 0;
  const tripDays = (() => {
    if (!startDate || !endDate) return 1;
    const diff = Math.ceil(
      (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000,
    );
    return Math.max(diff, 1);
  })();

  // ── Per-step validation ────────────────────────────────────────────────────
  const canProceed = () => {
    if (step === 0) return destination.trim().length > 0;
    if (step === 1) return startDate && endDate && endDate >= startDate && parseInt(travelers) >= 1;
    if (step === 2) return budget !== "" && parseInt(budget) >= 0;
    if (step === 3) return travelMode !== ""; // primary mode required
    if (step === 4) return hotelLocation.trim().length > 0; // hotel area required
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

      const tripData = await apiFetch("/api/ai/generate", {
        method: "POST",
        body: JSON.stringify({
          destination,
          origin: originCity,
          startDate,
          endDate,
          budget: parseInt(budget) || 0,
          travelers,
          // Travel detail fields
          travelMode,
          departureHub,
          arrivalHub,
          transitRef,
          departureTime,
          arrivalTime,
          transport: transport.length > 0 ? transport : [travelMode],
          // Accommodation detail fields
          accommodation,
          hotelName,
          hotelLocation,
          checkInTime,
          checkOutTime,
          // Preferences
          style,
          interests,
          special,
          createdBy: user?.uid || "guest",
        }),
      });

      nav({ to: `/trips/${tripData._id}` });
    } catch (err: any) {
      console.error("Trip generation error:", err);
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Labels for contextual fields ──────────────────────────────────────────
  const hubLabels: Record<string, { dep: string; arr: string; ref: string }> = {
    Flight: { dep: "Departure Airport", arr: "Arrival Airport", ref: "Flight Number (optional)" },
    Train:  { dep: "Boarding Station", arr: "Destination Station", ref: "Train Number / Name (optional)" },
    Bus:    { dep: "Boarding Point / Terminal", arr: "Drop-off Point / Terminal", ref: "Bus Operator / Route (optional)" },
    Car:    { dep: "Departure Location", arr: "Arrival Location", ref: "Via Route (optional)" },
    Ferry:  { dep: "Departure Port", arr: "Arrival Port", ref: "Ferry / Vessel Name (optional)" },
  };
  const hubs = travelMode ? hubLabels[travelMode] : null;

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
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs">Where from (Home city)</Label>
                    <Input
                      value={originCity}
                      onChange={(e) => setOriginCity(e.target.value)}
                      className="mt-1.5 h-12 rounded-xl text-base"
                      placeholder="e.g. Mumbai, Kalyan, Noida…"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Where to</Label>
                    <Input
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      className="mt-1.5 h-12 rounded-xl text-base"
                      placeholder="e.g. Hyderabad, Goa, Jaipur…"
                      autoFocus
                    />
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs text-muted-foreground">Popular picks</p>
                  <div className="flex flex-wrap gap-2">
                    {["Ladakh", "Varanasi", "Jaipur", "Kerala", "Goa", "Meghalaya", "Rishikesh", "Andaman"].map((c) => (
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
                    onChange={(e) => setTravelers(e.target.value)}
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

            {/* ── Step 2: Budget ── */}
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
              </div>
            )}

            {/* ── Step 3: Travel Details ── */}
            {step === 3 && (
              <div className="space-y-6">
                {/* Primary mode selector */}
                <div>
                  <Label className="text-xs">Primary travel mode to {destination || "destination"}</Label>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {MODES.map(({ id, icon: Icon }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setTravelMode(id)}
                        className={cn(
                          "flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition",
                          travelMode === id
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background hover:border-primary/40",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {id}
                      </button>
                    ))}
                  </div>
                  {!travelMode && (
                    <p className="mt-2 text-xs text-destructive">Select your primary travel mode to continue.</p>
                  )}
                </div>

                {/* Contextual fields */}
                {hubs && (
                  <div className="space-y-4 rounded-2xl border border-border/60 bg-muted/30 p-5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {travelMode} details <span className="normal-case font-normal">(all optional — helps the AI plan accurately)</span>
                    </p>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label className="text-xs">{hubs.dep}</Label>
                        <Input
                          value={departureHub}
                          onChange={(e) => setDepartureHub(e.target.value)}
                          className="mt-1.5 h-10 rounded-xl text-sm"
                          placeholder={
                            travelMode === "Flight" ? "e.g. CSMIA, BOM" :
                            travelMode === "Train" ? "e.g. Kalyan Jn, CSMT" :
                            travelMode === "Bus" ? "e.g. Borivali Bus Stand" :
                            travelMode === "Ferry" ? "e.g. Gateway of India" :
                            "e.g. Home address"
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-xs">{hubs.arr}</Label>
                        <Input
                          value={arrivalHub}
                          onChange={(e) => setArrivalHub(e.target.value)}
                          className="mt-1.5 h-10 rounded-xl text-sm"
                          placeholder={
                            travelMode === "Flight" ? "e.g. RGIA, HYD" :
                            travelMode === "Train" ? "e.g. Hyderabad Decan" :
                            travelMode === "Bus" ? "e.g. Majestic Bus Stand" :
                            travelMode === "Ferry" ? "e.g. Port Blair" :
                            "e.g. Hotel area"
                          }
                        />
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs">{hubs.ref}</Label>
                      <Input
                        value={transitRef}
                        onChange={(e) => setTransitRef(e.target.value)}
                        className="mt-1.5 h-10 rounded-xl text-sm"
                        placeholder={
                          travelMode === "Flight" ? "e.g. 6E-2415, AI-635" :
                          travelMode === "Train" ? "e.g. Shatabdi Express, 12701" :
                          travelMode === "Bus" ? "e.g. MSRTC, Orange Travels" : "optional"
                        }
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label className="text-xs">
                          {travelMode === "Car" ? "Planned departure time" : "Departure time"}
                        </Label>
                        <TimePicker
                          value={departureTime}
                          onChange={setDepartureTime}
                          className="mt-1.5"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">
                          {travelMode === "Car" ? "Expected arrival time" : "Arrival time"}
                        </Label>
                        <TimePicker
                          value={arrivalTime}
                          onChange={setArrivalTime}
                          className="mt-1.5"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Additional local transport for within-destination */}
                <div>
                  <Label className="text-xs">
                    Local transport at destination <span className="text-muted-foreground">(select all you plan to use)</span>
                  </Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {["Metro", "Auto Rickshaw", "Cab", "Bus", "Walking", "Rental bike"].map((c) => {
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
                </div>
              </div>
            )}

            {/* ── Step 4: Accommodation ── */}
            {step === 4 && (
              <div className="space-y-6">
                <div>
                  <Label className="text-xs">Accommodation type</Label>
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

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs">Hotel / Stay name <span className="text-muted-foreground">(optional)</span></Label>
                    <Input
                      value={hotelName}
                      onChange={(e) => setHotelName(e.target.value)}
                      className="mt-1.5 h-10 rounded-xl text-sm"
                      placeholder="e.g. Taj Banjara, OYO 12345, Airbnb…"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Hotel area / address <span className="text-destructive">*</span></Label>
                    <Input
                      value={hotelLocation}
                      onChange={(e) => setHotelLocation(e.target.value)}
                      className="mt-1.5 h-10 rounded-xl text-sm"
                      placeholder="e.g. Banjara Hills, near Charminar…"
                    />
                    {!hotelLocation.trim() && (
                      <p className="mt-1 text-xs text-destructive">Hotel area is required to plan nearby attractions.</p>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs">Expected check-in time <span className="text-muted-foreground">(optional)</span></Label>
                    <TimePicker
                      value={checkInTime}
                      onChange={setCheckInTime}
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Expected check-out time <span className="text-muted-foreground">(optional)</span></Label>
                    <TimePicker
                      value={checkOutTime}
                      onChange={setCheckOutTime}
                      className="mt-1.5"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 5: Preferences ── */}
            {step === 5 && (
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
                    Interests <span className="text-muted-foreground">(select any that apply)</span>
                  </Label>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[
                      "Food", "Nature", "History", "Nightlife", "Museums",
                      "Beaches", "Hiking", "Photography", "Wellness", "Adventure",
                      "Shopping", "Architecture",
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

            {/* ── Step 6: Review ── */}
            {step === 6 && (
              <div className="space-y-4">
                <div className="rounded-2xl glass-tile p-5">
                  <p className="text-xs text-muted-foreground">Route</p>
                  <p className="text-lg font-semibold">
                    {originCity || "—"} → {destination}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    ["Dates", `${startDate} → ${endDate}`],
                    ["Travelers", `${travelers} ${parseInt(travelers) === 1 ? "person" : "people"}`],
                    ["Budget", budget ? `₹${parseInt(budget).toLocaleString("en-IN")}` : "Not set"],
                    ["Travel mode", travelMode || "Not set"],
                    ...(departureTime || arrivalTime
                      ? [["Journey times", `${normalizeTimeTo24h(departureTime) || "?"} → ${normalizeTimeTo24h(arrivalTime) || "?"}`]]
                      : []),
                    ...(departureHub || arrivalHub
                      ? [["Hubs", `${departureHub || "?"} → ${arrivalHub || "?"}`]]
                      : []),
                    ...(transitRef ? [["Transit ref", transitRef]] : []),
                    ["Accommodation", accommodation || "Not set"],
                    ...(hotelName ? [["Hotel", hotelName]] : []),
                    ["Hotel area", hotelLocation || "Not set"],
                    ...(checkInTime ? [["Check-in", normalizeTimeTo24h(checkInTime)]] : []),
                    ...(checkOutTime ? [["Check-out", normalizeTimeTo24h(checkOutTime)]] : []),
                    ["Pace", style || "Not set"],
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
                  The AI will use your travel details above to create a realistic, fatigue-aware itinerary.
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
                {loading ? "✨ AI is planning your trip…" : "Generate with AI"}
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
