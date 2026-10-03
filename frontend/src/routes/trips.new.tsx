import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  Check, 
  ArrowRight, 
  ArrowLeft, 
  Plane, 
  Train, 
  Bus, 
  Car, 
  Ship, 
  RotateCcw,
  Clock,
  Compass,
  Sparkles,
  MapPin,
  Calendar,
  ShieldCheck,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { cn, normalizeTimeTo24h, calculateInclusiveDays } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";

export const Route = createFileRoute("/trips/new")({ component: NewTrip });

const steps = [
  "Destination",
  "Dates & travelers",
  "Budget",
  "Interests & pace",
  "Review",
];

const MODES = [
  { id: "Flight", icon: Plane, label: "Flight" },
  { id: "Train", icon: Train, label: "Train" },
  { id: "Bus", icon: Bus, label: "Bus" },
  { id: "Car", icon: Car, label: "Car / Drive" },
  { id: "Ferry", icon: Ship, label: "Ferry" },
];

const LOADING_MESSAGES = [
  "Calculating journey & travel times...",
  "Checking destination usable exploration windows...",
  "Aligning activities with your interests...",
  "Structuring realistic daily timing...",
  "Finalizing your personalized plan...",
];

function NewTrip() {
  const nav = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingStepIndex, setLoadingStepIndex] = useState(0);
  const [error, setError] = useState("");
  const [minBudget, setMinBudget] = useState<number | null>(null);
  const [isFetchingBudget, setIsFetchingBudget] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // ── Step 0: Destination ────────────────────────────────────────────────────
  const [destination, setDestination] = useState("");
  const [originCity, setOriginCity] = useState("");

  // ── Step 1: Dates & Travelers ──────────────────────────────────────────────
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [travelers, setTravelers] = useState<string>("1");

  // ── Step 2: Budget ─────────────────────────────────────────────────────────
  const [budget, setBudget] = useState<string>("");

  // ── Step 3: Outbound Travel Details ────────────────────────────────────────
  const [travelMode, setTravelMode] = useState("");        // primary intercity mode
  const [departureHub, setDepartureHub] = useState("");    // airport / station / terminal (origin)
  const [arrivalHub, setArrivalHub] = useState("");        // airport / station / terminal (destination)
  const [transitRef, setTransitRef] = useState("");        // flight no / train name
  const [departureTime, setDepartureTime] = useState(""); // HH:MM
  const [arrivalTime, setArrivalTime] = useState("");     // HH:MM
  const [outboundBooked, setOutboundBooked] = useState(false);

  // ── Return Journey ─────────────────────────────────────────────────────────
  const [hasReturnTravel, setHasReturnTravel] = useState(false);
  const [returnBooked, setReturnBooked] = useState(false);
  const [returnDate, setReturnDate] = useState("");
  const [returnTime, setReturnTime] = useState("");
  const [returnArrivalTime, setReturnArrivalTime] = useState("");
  const [returnDepartureLocation, setReturnDepartureLocation] = useState("");
  const [returnArrivalLocation, setReturnArrivalLocation] = useState("");
  const [returnTransportType, setReturnTransportType] = useState("");
  const [returnTicketRef, setReturnTicketRef] = useState("");

  // Keep legacy multi-select for local transport
  const [transport, setTransport] = useState<string[]>([]);

  // ── Step 4: Accommodation ──────────────────────────────────────────────────
  const [accommodation, setAccommodation] = useState("");
  const [hotelName, setHotelName] = useState("");
  const [hotelLocation, setHotelLocation] = useState("");
  const [checkInTime, setCheckInTime] = useState("");
  const [checkOutTime, setCheckOutTime] = useState("");

  // ── Step 5: Preferences ────────────────────────────────────────────────────
  const [style, setStyle] = useState("Balanced");
  const [interests, setInterests] = useState<string[]>([]);
  const [special, setSpecial] = useState("");

  // Cycle loading messages smoothly
  useEffect(() => {
    if (!loading) {
      setLoadingStepIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setLoadingStepIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 2400);
    return () => clearInterval(interval);
  }, [loading]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const toggle = (s: string, list: string[], set: (v: string[]) => void) =>
    set(list.includes(s) ? list.filter((x) => x !== s) : [...list, s]);

  const budgetNum = parseInt(budget) || 0;
  const tripDays = calculateInclusiveDays(startDate, endDate);

  // ── Per-step validation ────────────────────────────────────────────────────
  const canProceed = () => {
    if (step === 0) return destination.trim().length > 0;
    if (step === 1) return startDate && endDate && endDate >= startDate && parseInt(travelers) >= 1;
    if (step === 2) {
      if (budget === "") return false;
      const b = parseInt(budget);
      if (isNaN(b) || b < 100) return false; // Block 2 digit numbers
      return true;
    }
    return true; // Step 3 (Interests & Travel) has optional fields
  };

  const fetchBudgetEstimate = async () => {
    if (!destination || !startDate || !endDate) return;
    setIsFetchingBudget(true);
    try {
      const res = await apiFetch(
        `/api/ai/estimate-budget?destination=${encodeURIComponent(destination)}&startDate=${startDate}&endDate=${endDate}&travelers=${travelers}`
      );
      if (res && res.minimumBudget) {
        setMinBudget(res.minimumBudget);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsFetchingBudget(false);
    }
  };

  const handleNext = () => {
    if (!canProceed()) return;
    if (step === 1 && minBudget === null && !isFetchingBudget) {
      fetchBudgetEstimate();
    }
    setStep((s) => s + 1);
  };

  const handleDraftTrip = async () => {
    try {
      setLoading(true);
      setError("");

      const outboundLeg = {
        transportType: travelMode || "Flight",
        departureLocation: departureHub || originCity || "",
        arrivalLocation: arrivalHub || destination || "",
        departureDate: startDate || "",
        departureTime: normalizeTimeTo24h(departureTime),
        arrivalTime: normalizeTimeTo24h(arrivalTime),
        transitRef: transitRef || "",
        booked: outboundBooked,
        status: outboundBooked ? "CONFIRMED" : "ESTIMATED",
      };

      const returnLeg = hasReturnTravel
        ? {
            transportType: returnTransportType || travelMode || "Flight",
            departureLocation: returnDepartureLocation || arrivalHub || destination || "",
            arrivalLocation: returnArrivalLocation || departureHub || originCity || "",
            departureDate: returnDate || endDate || "",
            departureTime: normalizeTimeTo24h(returnTime),
            arrivalTime: normalizeTimeTo24h(returnArrivalTime),
            transitRef: returnTicketRef || "",
            booked: returnBooked,
            status: returnBooked ? "CONFIRMED" : "ESTIMATED",
          }
        : { booked: false };

      const tripData = await apiFetch("/api/ai/generate", {
        method: "POST",
        body: JSON.stringify({
          destination: destination.trim(),
          origin: originCity.trim(),
          startDate,
          endDate,
          budget: parseInt(budget) || 0,
          travelers: parseInt(travelers) || 1,
          // Travel detail fields (flat + structured)
          travelMode: travelMode || undefined,
          departureHub: departureHub || undefined,
          arrivalHub: arrivalHub || undefined,
          transitRef: transitRef || undefined,
          departureTime: normalizeTimeTo24h(departureTime) || undefined,
          arrivalTime: normalizeTimeTo24h(arrivalTime) || undefined,
          transport: transport.length > 0 ? transport : travelMode ? [travelMode] : [],
          outboundJourney: outboundLeg,
          returnJourney: returnLeg,
          // Accommodation detail fields
          accommodation: accommodation || undefined,
          hotelName: hotelName.trim() || undefined,
          hotelLocation: hotelLocation.trim() || undefined,
          checkInTime: normalizeTimeTo24h(checkInTime) || undefined,
          checkOutTime: normalizeTimeTo24h(checkOutTime) || undefined,
          // Preferences
          style: style || "Balanced",
          interests,
          special: special.trim() || undefined,
          createdBy: user?.uid || "guest",
        }),
      });

      queryClient.invalidateQueries({ queryKey: queryKeys.trips() });
      queryClient.setQueryData(queryKeys.tripDetails(tripData._id), tripData);

      nav({ to: `/trips/${tripData._id}` });
    } catch (err: any) {
      console.error("Trip generation error:", err);
      setError(err.message || "Something went wrong generating your itinerary. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Labels for contextual fields ──────────────────────────────────────────
  const hubLabels: Record<string, { dep: string; arr: string; ref: string }> = {
    Flight: { dep: "Departure Airport / Code", arr: "Arrival Airport / Code", ref: "Flight Number (e.g. 6E 241)" },
    Train: { dep: "Boarding Station / Code", arr: "Arrival Station / Code", ref: "Train Number / Name (e.g. 12009 Shatabdi)" },
    Bus: { dep: "Boarding Point / Terminal", arr: "Drop-off Point / Terminal", ref: "Bus Operator (e.g. Zingbus / KSRTC)" },
    Car: { dep: "Departure Starting Point", arr: "Destination Drop Point", ref: "Route / Highway (e.g. NH 48)" },
    Ferry: { dep: "Departure Port / Terminal", arr: "Arrival Port / Terminal", ref: "Vessel Name / Line" },
  };
  const hubs = travelMode ? hubLabels[travelMode] : null;
  const returnHubs = returnTransportType ? hubLabels[returnTransportType] : hubs;

  return (
    <AppShell title="Plan a new trip" subtitle="A few quick answers and Advenza drafts a realistic, travel-aware itinerary.">
      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        {/* Steps rail */}
        <ol className="hidden lg:block">
          {steps.map((s, i) => (
            <li key={s} className="flex items-center gap-3 py-2">
              <span
                className={cn(
                  "grid h-7 w-7 place-items-center rounded-full text-xs font-semibold transition-all",
                  i < step
                    ? "bg-accent text-accent-foreground"
                    : i === step
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span
                className={cn("text-sm", i === step ? "font-semibold text-foreground" : "text-muted-foreground")}
              >
                {s}
              </span>
            </li>
          ))}
        </ol>

        <div className="rounded-3xl glass-panel p-6 md:p-10 transition-all">
          <div className="mb-1 text-xs font-medium text-muted-foreground">
            Step {step + 1} of {steps.length}
          </div>
          <h2 className="font-display text-3xl md:text-4xl">{steps[step]}</h2>

          <div className="mt-8 min-h-[280px]">

            {/* ── Step 0: Destination & Origin ── */}
            {step === 0 && (
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs font-medium">Where from (Home city)</Label>
                    <div className="relative mt-1.5">
                      <Input
                        value={originCity}
                        onChange={(e) => setOriginCity(e.target.value)}
                        className="h-12 rounded-xl text-base pl-3"
                        placeholder="e.g. Mumbai, Delhi, Bengaluru…"
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Used to compute realistic travel times to your destination.
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Where to (Destination)</Label>
                    <div className="relative mt-1.5">
                      <Input
                        value={destination}
                        onChange={(e) => setDestination(e.target.value)}
                        className="h-12 rounded-xl text-base pl-3 font-medium"
                        placeholder="e.g. Goa, Jaipur, Manali, Ladakh…"
                        autoFocus
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Your primary vacation or exploration destination.
                    </p>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs text-muted-foreground font-medium">Popular destinations</p>
                  <div className="flex flex-wrap gap-2">
                    {["Ladakh", "Varanasi", "Jaipur", "Kerala", "Goa", "Meghalaya", "Rishikesh", "Andaman"].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setDestination(c)}
                        className={cn(
                          "rounded-full border px-3.5 py-1.5 text-sm transition-all",
                          destination === c
                            ? "border-primary bg-primary text-primary-foreground shadow-sm font-medium"
                            : "border-border bg-background/80 hover:border-primary/40",
                        )}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                {originCity && destination && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 flex items-center gap-3">
                    <Compass className="h-4 w-4 text-primary shrink-0" />
                    <p className="text-xs text-foreground/90">
                      Route: <strong className="text-primary">{originCity}</strong> → <strong className="text-primary">{destination}</strong>
                    </p>
                  </div>
                )}

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
                    <Label className="text-xs font-medium">Start date</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="mt-1.5 h-12 rounded-xl"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium">End date</Label>
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
                  <Label className="text-xs font-medium">Number of travelers</Label>
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
                    className="mt-1.5 h-12 w-36 rounded-xl"
                    min={1}
                    max={99}
                    placeholder="1"
                  />
                </div>
                {startDate && endDate && (
                  <div className="rounded-xl border border-border/70 bg-muted/30 p-3.5 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Calendar trip duration:</span>
                    <span className="font-semibold text-foreground">{tripDays} calendar day{tripDays !== 1 ? "s" : ""}</span>
                  </div>
                )}
                {endDate && startDate && endDate < startDate && (
                  <p className="text-xs text-destructive">End date must be on or after start date.</p>
                )}
              </div>
            )}

            {/* ── Step 2: Budget ── */}
            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <Label className="text-xs font-medium">Total budget (₹ INR)</Label>
                  {isFetchingBudget ? (
                    <p className="mt-1 text-xs text-muted-foreground animate-pulse">Calculating live minimum budget for {destination}...</p>
                  ) : minBudget !== null && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Estimated minimum for {travelers} traveler(s) over {tripDays} day(s): <strong>₹{minBudget.toLocaleString("en-IN")}</strong>
                    </p>
                  )}
                  
                  <div className="mt-2 flex items-center gap-3">
                    <span className="text-xl font-semibold text-muted-foreground">₹</span>
                    <Input
                      id="budget-input"
                      type="number"
                      inputMode="numeric"
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                      className="h-12 rounded-xl text-base"
                      min={100}
                      placeholder={minBudget ? `e.g. ${minBudget}` : "e.g. 50000"}
                    />
                  </div>
                  {budget !== "" && budgetNum >= 0 && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      ~₹{Math.round(budgetNum / tripDays).toLocaleString("en-IN")} per day
                      over {tripDays} day{tripDays !== 1 ? "s" : ""}
                    </p>
                  )}
                  {budget !== "" && budgetNum < 100 && (
                     <p className="mt-1 text-xs text-destructive">Budget must be at least ₹100. Be realistic!</p>
                  )}
                  {budget !== "" && minBudget !== null && budgetNum < minBudget * 0.7 && budgetNum >= 100 && (
                     <p className="mt-1 text-xs text-amber-500">Warning: Your budget is significantly lower than the estimated minimum. AI will optimize for budget options.</p>
                  )}
                </div>
              </div>
            )}

            {/* ── Step 3: Interests, Pace & Travel Details ── */}
            {step === 3 && (
              <div className="space-y-6">
                <div>
                  <Label className="text-xs font-medium">Trip pace / style</Label>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    {[
                      { id: "Slow", desc: "1–2 anchor spots a day, lots of wandering & rest." },
                      { id: "Balanced", desc: "2–3 activities, buffer time to explore & dine." },
                      { id: "Packed", desc: "Every hour planned, maximum coverage." },
                    ].map(({ id, desc }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setStyle(id)}
                        className={cn(
                          "rounded-xl border p-4 text-left transition-all",
                          style === id
                            ? "border-primary bg-primary/10 shadow-sm"
                            : "border-border bg-background/80 hover:border-primary/40",
                        )}
                      >
                        <p className="font-semibold text-sm">{id}</p>
                        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-medium">
                    Interests <span className="text-muted-foreground">(select any that apply)</span>
                  </Label>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[
                      "Food", "Nature", "History", "Nightlife", "Museums",
                      "Beaches", "Hiking", "Photography", "Wellness", "Adventure",
                      "Shopping", "Architecture", "Culture", "Cafes",
                    ].map((c) => {
                      const on = interests.includes(c);
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => toggle(c, interests, setInterests)}
                          className={cn(
                            "rounded-full border px-3.5 py-1.5 text-sm transition-all",
                            on
                              ? "border-primary bg-primary text-primary-foreground font-medium shadow-sm"
                              : "border-border bg-background/80 hover:border-primary/40",
                          )}
                        >
                          {c}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-medium">Anything special or specific notes?</Label>
                  <Textarea
                    value={special}
                    onChange={(e) => setSpecial(e.target.value)}
                    className="mt-1.5 min-h-20 rounded-xl text-sm"
                    placeholder="e.g. Traveling with elderly parents, celebrating an anniversary, pure vegetarian food…"
                  />
                </div>

                {/* Advanced Travel & Accommodation Section */}
                <div className="pt-4 border-t border-border/50">
                  <button 
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)} 
                    className="flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
                  >
                    {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    {showAdvanced ? "Hide Travel & Accommodation Details" : "Add Travel & Accommodation Details (Optional)"}
                  </button>
                  <p className="text-xs text-muted-foreground mt-1">
                    Provide your transport or hotel timings if known, or leave blank to let Advenza calculate the best estimates.
                  </p>

                  {showAdvanced && (
                    <div className="mt-6 space-y-6">
                      {/* Outbound Travel Details */}
                      <div className="rounded-2xl border border-border/70 bg-muted/20 p-5 space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold flex items-center gap-2">
                            <Plane className="h-4 w-4 text-primary" /> Outbound Journey ({originCity || "Origin"} → {destination})
                          </h3>
                          <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={outboundBooked}
                              onChange={(e) => setOutboundBooked(e.target.checked)}
                              className="rounded border-border"
                            />
                            <span>Booked / Confirmed</span>
                          </label>
                        </div>

                        <div>
                          <Label className="text-xs font-medium">How are you travelling to {destination}?</Label>
                          <div className="mt-2 flex flex-wrap gap-2.5">
                            {MODES.map(({ id, icon: Icon, label }) => (
                              <button
                                key={id}
                                type="button"
                                onClick={() => setTravelMode(id)}
                                className={cn(
                                  "flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-medium transition-all",
                                  travelMode === id
                                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                                    : "border-border bg-background/80 hover:border-primary/40",
                                )}
                              >
                                <Icon className="h-3.5 w-3.5" />
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {hubs && (
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                              <Label className="text-xs">{hubs.dep}</Label>
                              <Input
                                value={departureHub}
                                onChange={(e) => setDepartureHub(e.target.value)}
                                className="mt-1 h-9 rounded-lg text-xs"
                                placeholder={originCity ? `e.g. ${originCity} Hub` : "e.g. BOM / CSMT"}
                              />
                            </div>
                            <div>
                              <Label className="text-xs">{hubs.arr}</Label>
                              <Input
                                value={arrivalHub}
                                onChange={(e) => setArrivalHub(e.target.value)}
                                className="mt-1 h-9 rounded-lg text-xs"
                                placeholder={`e.g. ${destination} Hub`}
                              />
                            </div>
                          </div>
                        )}

                        <div className="grid gap-4 sm:grid-cols-3">
                          <div>
                            <Label className="text-xs">Departure time (optional)</Label>
                            <Input
                              type="time"
                              value={departureTime}
                              onChange={(e) => setDepartureTime(e.target.value)}
                              className="mt-1 h-9 rounded-lg text-xs"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Arrival time (optional)</Label>
                            <Input
                              type="time"
                              value={arrivalTime}
                              onChange={(e) => setArrivalTime(e.target.value)}
                              className="mt-1 h-9 rounded-lg text-xs"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">{hubs ? hubs.ref : "Transit Name / Number"}</Label>
                            <Input
                              value={transitRef}
                              onChange={(e) => setTransitRef(e.target.value)}
                              className="mt-1 h-9 rounded-lg text-xs"
                              placeholder="e.g. AI-804 / Shatabdi"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Return Travel Details */}
                      <div className="rounded-2xl border border-border/70 bg-muted/20 p-5 space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold flex items-center gap-2">
                            <RotateCcw className="h-4 w-4 text-primary" /> Return Journey ({destination} → {originCity || "Home"})
                          </h3>
                          <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={hasReturnTravel}
                              onChange={(e) => setHasReturnTravel(e.target.checked)}
                              className="rounded border-border"
                            />
                            <span>Specify return travel</span>
                          </label>
                        </div>

                        {hasReturnTravel && (
                          <div className="space-y-4 pt-2 border-t border-border/50">
                            <div>
                              <Label className="text-xs font-medium">Return transport mode</Label>
                              <div className="mt-2 flex flex-wrap gap-2.5">
                                {MODES.map(({ id, icon: Icon, label }) => (
                                  <button
                                    key={id}
                                    type="button"
                                    onClick={() => setReturnTransportType(id)}
                                    className={cn(
                                      "flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-medium transition-all",
                                      (returnTransportType || travelMode) === id
                                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                                        : "border-border bg-background/80 hover:border-primary/40",
                                    )}
                                  >
                                    <Icon className="h-3.5 w-3.5" />
                                    {label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                              <div>
                                <Label className="text-xs">{returnHubs?.dep || "Departure location at destination"}</Label>
                                <Input
                                  value={returnDepartureLocation}
                                  onChange={(e) => setReturnDepartureLocation(e.target.value)}
                                  className="mt-1 h-9 rounded-lg text-xs"
                                  placeholder={arrivalHub || `e.g. ${destination} Station`}
                                />
                              </div>
                              <div>
                                <Label className="text-xs">{returnHubs?.arr || "Arrival location at home"}</Label>
                                <Input
                                  value={returnArrivalLocation}
                                  onChange={(e) => setReturnArrivalLocation(e.target.value)}
                                  className="mt-1 h-9 rounded-lg text-xs"
                                  placeholder={departureHub || (originCity ? `e.g. ${originCity}` : "Home city")}
                                />
                              </div>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-3">
                              <div>
                                <Label className="text-xs">Return departure time</Label>
                                <Input
                                  type="time"
                                  value={returnTime}
                                  onChange={(e) => setReturnTime(e.target.value)}
                                  className="mt-1 h-9 rounded-lg text-xs"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Return transit reference</Label>
                                <Input
                                  value={returnTicketRef}
                                  onChange={(e) => setReturnTicketRef(e.target.value)}
                                  className="mt-1 h-9 rounded-lg text-xs"
                                  placeholder="Flight # / Train name"
                                />
                              </div>
                              <div className="flex items-end pb-1.5">
                                <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={returnBooked}
                                    onChange={(e) => setReturnBooked(e.target.checked)}
                                    className="rounded border-border"
                                  />
                                  <span>Return is Confirmed / Booked</span>
                                </label>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Accommodation Details */}
                      <div className="rounded-2xl border border-border/70 bg-muted/20 p-5 space-y-4">
                        <h3 className="text-sm font-semibold">Accommodation Details</h3>
                        <div>
                          <Label className="text-xs font-medium">Accommodation tier</Label>
                          <div className="mt-2 grid gap-3 sm:grid-cols-3">
                            {[
                              { id: "Economy", desc: "Hostels & budget stays" },
                              { id: "Comfort", desc: "Boutique stays & 3-4 star" },
                              { id: "Luxury", desc: "5-star resorts & luxury villas" },
                            ].map((t) => (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => setAccommodation(t.id)}
                                className={cn(
                                  "rounded-xl border p-3.5 text-left transition-all",
                                  accommodation === t.id
                                    ? "border-primary bg-primary/10 shadow-sm"
                                    : "border-border bg-background/80 hover:border-primary/40",
                                )}
                              >
                                <p className="font-semibold text-xs">{t.id}</p>
                                <p className="mt-0.5 text-[11px] text-muted-foreground">{t.desc}</p>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <Label className="text-xs">Hotel / Stay name (optional)</Label>
                            <Input
                              value={hotelName}
                              onChange={(e) => setHotelName(e.target.value)}
                              className="mt-1 h-9 rounded-lg text-xs"
                              placeholder="e.g. Taj Fort Aguada"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Hotel area / address (optional)</Label>
                            <Input
                              value={hotelLocation}
                              onChange={(e) => setHotelLocation(e.target.value)}
                              className="mt-1 h-9 rounded-lg text-xs"
                              placeholder="e.g. Candolim, North Goa"
                            />
                          </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <Label className="text-xs">Expected Check-in time</Label>
                            <Input
                              type="time"
                              value={checkInTime}
                              onChange={(e) => setCheckInTime(e.target.value)}
                              className="mt-1 h-9 rounded-lg text-xs"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Expected Check-out time</Label>
                            <Input
                              type="time"
                              value={checkOutTime}
                              onChange={(e) => setCheckOutTime(e.target.value)}
                              className="mt-1 h-9 rounded-lg text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Step 4: Review ── */}
            {step === 4 && (
              <div className="space-y-5">
                <div className="rounded-2xl glass-tile p-5 flex flex-wrap items-center justify-between gap-4 border border-primary/20 bg-primary/5">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Trip Route</p>
                    <p className="text-xl font-display font-bold text-foreground">
                      {originCity ? `${originCity} (Home)` : "Your Location"} → {destination}
                    </p>
                  </div>
                  <Badge variant="outline" className="bg-background/80 text-primary border-primary/30">
                    <Sparkles className="mr-1 h-3 w-3" /> Travel-Aware AI
                  </Badge>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-xl glass-tile p-4">
                    <p className="text-xs text-muted-foreground">Dates</p>
                    <p className="mt-1 text-sm font-semibold">{startDate} → {endDate}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{tripDays} calendar day{tripDays !== 1 ? "s" : ""}</p>
                  </div>

                  <div className="rounded-xl glass-tile p-4">
                    <p className="text-xs text-muted-foreground">Travelers & Budget</p>
                    <p className="mt-1 text-sm font-semibold">
                      {travelers} traveler{parseInt(travelers) !== 1 ? "s" : ""} · {budget ? `₹${parseInt(budget).toLocaleString("en-IN")}` : "Flexible"}
                    </p>
                  </div>

                  <div className="rounded-xl glass-tile p-4">
                    <p className="text-xs text-muted-foreground">Pace & Style</p>
                    <p className="mt-1 text-sm font-semibold">{style || "Balanced"} Pace</p>
                  </div>

                  {travelMode && (
                    <div className="rounded-xl glass-tile p-4">
                      <p className="text-xs text-muted-foreground">Outbound Travel</p>
                      <p className="mt-1 text-sm font-semibold flex items-center gap-1.5">
                        {travelMode} {departureTime ? `@ ${departureTime}` : ""}
                        <Badge variant="outline" className="text-[10px] py-0 h-4">
                          {outboundBooked ? "✓ Confirmed" : "≈ Estimated"}
                        </Badge>
                      </p>
                      {(departureHub || arrivalHub) && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {departureHub || originCity} → {arrivalHub || destination}
                        </p>
                      )}
                    </div>
                  )}

                  {hasReturnTravel && (
                    <div className="rounded-xl glass-tile p-4">
                      <p className="text-xs text-muted-foreground">Return Travel</p>
                      <p className="mt-1 text-sm font-semibold flex items-center gap-1.5">
                        {returnTransportType || travelMode || "Transport"} {returnTime ? `@ ${returnTime}` : ""}
                        <Badge variant="outline" className="text-[10px] py-0 h-4">
                          {returnBooked ? "✓ Confirmed" : "≈ Estimated"}
                        </Badge>
                      </p>
                    </div>
                  )}

                  {interests.length > 0 && (
                    <div className="rounded-xl glass-tile p-4 sm:col-span-2">
                      <p className="text-xs text-muted-foreground">Selected Interests</p>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {interests.map((i) => (
                          <Badge key={i} variant="secondary" className="text-[11px]">
                            {i}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {hotelName && (
                  <div className="rounded-xl glass-tile p-4">
                    <p className="text-xs text-muted-foreground">Accommodation</p>
                    <p className="mt-1 text-sm font-medium">{hotelName} {hotelLocation ? `(${hotelLocation})` : ""}</p>
                  </div>
                )}

                {special && (
                  <div className="rounded-xl glass-tile p-4">
                    <p className="text-xs text-muted-foreground">Special Requests</p>
                    <p className="mt-1 text-sm text-muted-foreground">{special}</p>
                  </div>
                )}

                {error && (
                  <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive">
                    {error}
                  </div>
                )}

                {loading ? (
                  <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6 text-center space-y-3">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-3 border-primary border-t-transparent" />
                    <p className="text-sm font-semibold text-foreground animate-pulse">
                      {LOADING_MESSAGES[loadingStepIndex]}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Advenza is computing travel hours, hotel settling buffers, and tailoring every day to your pace.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-border/70 bg-muted/20 p-3.5 flex items-center gap-2.5 text-xs text-muted-foreground">
                    <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                    <span>
                      Advenza will compute accurate journey times, protect your usable destination windows, and prevent scheduling during travel.
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-10 flex items-center justify-between border-t border-border/40 pt-6">
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
              <Button onClick={handleDraftTrip} disabled={loading} className="gap-2 shadow-md">
                {loading ? (
                  <>
                    <Sparkles className="h-4 w-4 animate-spin text-primary-foreground" />
                    Generating Itinerary...
                  </>
                ) : (
                  <>
                    Generate with AI
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
