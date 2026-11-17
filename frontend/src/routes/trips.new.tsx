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
  ChevronUp,
  Gem,
  Star,
  Info
} from "lucide-react";
import { cn, normalizeTimeTo24h, calculateInclusiveDays } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { fetchDestinationOverview, type DestinationOverview } from "@/services/tripService";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";

export const Route = createFileRoute("/trips/new")({ component: NewTrip });

const steps = [
  "Destination",
  "Destination Insights",
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

interface DisambiguationCandidate {
  id: string;
  destinationName: string;
  stateOrRegion: string;
  district?: string;
  country: string;
  fullName: string;
  coordinates?: { lat: number; lng: number };
  referenceInfo?: string;
}

interface BudgetFeasibilityData {
  isFeasible: boolean;
  budgetStatus: "FEASIBLE" | "EXCEEDS_BUDGET" | "NO_BUDGET_SET";
  totalEstimatedBudgetINR: number;
  userBudgetINR: number | null;
  shortfallAmountINR: number;
  surplusAmountINR: number;
  costDrivers: string[];
  actionableSavingsOptions: Array<{
    title: string;
    potentialSavingsINR: number;
    description: string;
    tradeoff: string;
  }>;
}

const ACCOMMODATION_OPTIONS = [
  {
    id: "OWN_HOME",
    title: "Own Home / Relative's Home",
    desc: "Staying with family, friends, or own residence (₹0 lodging expense)",
    icon: "🏡",
    isFree: true,
  },
  {
    id: "BUDGET",
    title: "Budget Accommodation",
    desc: "Hostels, homestays, and guesthouses (Economical)",
    icon: "🛏️",
    isFree: false,
  },
  {
    id: "HOTEL",
    title: "Hotel (Standard 3-4 Star)",
    desc: "Comfortable private room with standard amenities & breakfast",
    icon: "🏨",
    isFree: false,
  },
  {
    id: "RESORT",
    title: "Resort / Premium Stay",
    desc: "Luxury 5-star resort, heritage property, or boutique villa",
    icon: "✨",
    isFree: false,
  },
  {
    id: "AI_RECOMMENDED",
    title: "Let AI find the best option",
    desc: "AI selects optimal balance of location, comfort, and reviews",
    icon: "🤖",
    isFree: false,
  },
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
  const [disambiguationCandidates, setDisambiguationCandidates] = useState<DisambiguationCandidate[]>([]);
  const [isCheckingDisambiguation, setIsCheckingDisambiguation] = useState(false);
  const [disambiguationWarning, setDisambiguationWarning] = useState("");

  // ── Budget Feasibility State ───────────────────────────────────────────────
  const [budgetFeasibility, setBudgetFeasibility] = useState<BudgetFeasibilityData | null>(null);
  const [isCheckingBudgetFeasibility, setIsCheckingBudgetFeasibility] = useState(false);

  // ── Step 1: Destination Insights ───────────────────────────────────────────
  const [destinationOverview, setDestinationOverview] = useState<DestinationOverview | null>(null);
  const [isFetchingOverview, setIsFetchingOverview] = useState(false);
  const [durationMode, setDurationMode] = useState<"RECOMMENDED" | "CUSTOM">("RECOMMENDED");
  const [selectedDurationPlan, setSelectedDurationPlan] = useState<"min" | "recommended" | "extended">("recommended");
  const [selectedDaysCount, setSelectedDaysCount] = useState<number | null>(null);

  // Helper date utilities
  const getDefaultStartDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  };

  const addDaysToDate = (startDateStr: string, daysToAdd: number) => {
    if (!startDateStr) return "";
    const [y, m, d] = startDateStr.split("-").map(Number);
    if (!y || !m || !d) return "";
    const date = new Date(Date.UTC(y, m - 1, d));
    date.setUTCDate(date.getUTCDate() + daysToAdd);
    return date.toISOString().split("T")[0];
  };

  // ── Step 2: Dates & Travelers ──────────────────────────────────────────────
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

  // ── RailCore Indian Railways State ──────────────────────────────────────────
  const [railcoreData, setRailcoreData] = useState<any | null>(null);
  const [isFetchingTrains, setIsFetchingTrains] = useState(false);
  const [selectedTrain, setSelectedTrain] = useState<any | null>(null);
  const [selectedTrainClass, setSelectedTrainClass] = useState<string>("3A");

  const fetchLiveTrains = async (originParam?: string, destParam?: string, dateParam?: string, classParam?: string) => {
    const o = (originParam || originCity || "").trim();
    const d = (destParam || destination || "").trim();
    if (!o || !d) return;

    setIsFetchingTrains(true);
    try {
      const q = new URLSearchParams({
        origin: o,
        destination: d,
        date: dateParam || startDate || getDefaultStartDate(),
        passengers: travelers || "1",
        preferredClass: classParam || selectedTrainClass || "3A",
      });
      const res = await apiFetch(`/api/ai/trains?${q.toString()}`);
      if (res && res.status === "SUCCESS") {
        setRailcoreData(res);
        if (res.recommendedTrain && !selectedTrain) {
          handleSelectTrain(res.recommendedTrain, classParam || selectedTrainClass);
        }
      } else {
        setRailcoreData(res || null);
      }
    } catch (err) {
      console.warn("RailCore train fetch error:", err);
    } finally {
      setIsFetchingTrains(false);
    }
  };

  const handleSelectTrain = (train: any, classCode?: string) => {
    setSelectedTrain(train);
    const cls = classCode || selectedTrainClass || train.selectedClass || "3A";
    setSelectedTrainClass(cls);
    setTravelMode("Train");
    setDepartureHub(train.fromStationCode || train.fromStationName || "Station");
    setArrivalHub(train.toStationCode || train.toStationName || "Station");
    setTransitRef(`${train.trainNumber} - ${train.trainName} (${cls})`);
    if (train.departureTime) setDepartureTime(train.departureTime);
    if (train.arrivalTime) setArrivalTime(train.arrivalTime);
  };

  useEffect(() => {
    if (step === 4 && travelMode === "Train" && !railcoreData && !isFetchingTrains && (originCity || destination)) {
      fetchLiveTrains();
    }
  }, [step, travelMode]);

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
    if (step === 1) {
      if (isFetchingOverview) return false;
      if (!startDate || !endDate || endDate < startDate) return false;
      return true;
    }
    if (step === 2) return startDate && endDate && endDate >= startDate && parseInt(travelers) >= 1;
    if (step === 3) {
      if (budget === "") return false;
      const b = parseInt(budget);
      if (isNaN(b) || b < 100) return false; // Block 2 digit numbers
      return true;
    }
    return true; // Step 4 (Interests & Travel) and Step 5 (Review)
  };

  const checkDisambiguation = async (query: string): Promise<boolean> => {
    if (!query.trim() || query.trim().length < 2) return true;
    setIsCheckingDisambiguation(true);
    setDisambiguationWarning("");
    try {
      const res = await apiFetch(
        `/api/ai/destination-disambiguation?query=${encodeURIComponent(query.trim())}`
      );
      if (res && res.isAmbiguous && Array.isArray(res.candidates) && res.candidates.length > 1) {
        setDisambiguationCandidates(res.candidates);
        setDisambiguationWarning(
          `Multiple geographical locations match "${query.trim()}". Please select your exact destination below.`
        );
        setIsCheckingDisambiguation(false);
        return false;
      } else {
        setDisambiguationCandidates([]);
        setIsCheckingDisambiguation(false);
        return true;
      }
    } catch (err) {
      console.warn("Disambiguation check failed:", err);
      setIsCheckingDisambiguation(false);
      return true;
    }
  };

  const handleSelectCandidate = (candidate: DisambiguationCandidate) => {
    setDestination(candidate.fullName);
    setDisambiguationCandidates([]);
    setDisambiguationWarning("");
    setIsFetchingOverview(true);
    fetchDestinationOverview(candidate.fullName, interests)
      .then((data) => {
        setDestinationOverview(data);
        const recDays = data?.durationRecommendation?.recommendedDays || 5;
        if (durationMode === "RECOMMENDED") {
          const start = startDate || getDefaultStartDate();
          setStartDate(start);
          setSelectedDaysCount(recDays);
          setSelectedDurationPlan("recommended");
          const end = addDaysToDate(start, recDays - 1);
          setEndDate(end);
        } else {
          if (!startDate) setStartDate(getDefaultStartDate());
          if (!endDate && startDate) setEndDate(addDaysToDate(startDate, recDays - 1));
          if (!selectedDaysCount) setSelectedDaysCount(recDays);
        }
        setStep(1);
      })
      .catch((err) => {
        console.warn("Destination overview fetch failed:", err);
        setStep(1);
      })
      .finally(() => {
        setIsFetchingOverview(false);
      });
  };

  const fetchBudgetFeasibility = async (budgetVal?: string) => {
    const val = budgetVal !== undefined ? budgetVal : budget;
    const bNum = parseInt(val);
    if (isNaN(bNum) || bNum < 100 || !destination) return;
    setIsCheckingBudgetFeasibility(true);
    try {
      const res = await apiFetch("/api/ai/budget-feasibility", {
        method: "POST",
        body: JSON.stringify({
          destination: destination.trim(),
          origin: originCity.trim() || undefined,
          userBudget: bNum,
          durationDays: tripDays,
          travelers: parseInt(travelers) || 1,
          accommodationPreference: accommodation || "HOTEL",
        }),
      });
      if (res) {
        setBudgetFeasibility(res);
      }
    } catch (err) {
      console.warn("Budget feasibility check failed:", err);
    } finally {
      setIsCheckingBudgetFeasibility(false);
    }
  };

  const handleApplySavingsOption = (opt: any) => {
    const title = (opt.title || "").toLowerCase();
    if (title.includes("stay") || title.includes("hotel") || title.includes("hostel") || title.includes("accommodation")) {
      setAccommodation("BUDGET");
      fetchBudgetFeasibility(budget);
    } else if (title.includes("transport") || title.includes("train") || title.includes("bus") || title.includes("transit")) {
      setTravelMode("Train");
      fetchBudgetFeasibility(budget);
    } else if (title.includes("trim") || title.includes("day") || title.includes("duration")) {
      if (startDate && endDate && tripDays > 2) {
        const newEnd = addDaysToDate(startDate, tripDays - 2);
        setEndDate(newEnd);
        setTimeout(() => fetchBudgetFeasibility(budget), 100);
      }
    } else {
      setAccommodation("BUDGET");
      fetchBudgetFeasibility(budget);
    }
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

  const handleNext = async () => {
    if (!canProceed()) return;
    if (step === 0 && destination.trim()) {
      if (disambiguationCandidates.length > 0) {
        setDisambiguationWarning("Please select your intended destination from the options below to proceed.");
        return;
      }
      const isClear = await checkDisambiguation(destination);
      if (!isClear) {
        return; // Ambiguity detected, cards are now shown
      }
      setIsFetchingOverview(true);
      fetchDestinationOverview(destination.trim(), interests)
        .then((data) => {
          setDestinationOverview(data);
          const recDays = data?.durationRecommendation?.recommendedDays || 5;
          // Auto-populate dates only if user is in RECOMMENDED mode and hasn't explicitly set custom dates
          if (durationMode === "RECOMMENDED") {
            const start = startDate || getDefaultStartDate();
            setStartDate(start);
            setSelectedDaysCount(recDays);
            setSelectedDurationPlan("recommended");
            const end = addDaysToDate(start, recDays - 1);
            setEndDate(end);
          } else {
            if (!startDate) setStartDate(getDefaultStartDate());
            if (!endDate && startDate) setEndDate(addDaysToDate(startDate, recDays - 1));
            if (!selectedDaysCount) setSelectedDaysCount(recDays);
          }
        })
        .catch((err) => {
          console.warn("Destination overview fetch failed:", err);
        })
        .finally(() => {
          setIsFetchingOverview(false);
        });
    }
    if (step === 2 && minBudget === null && !isFetchingBudget) {
      fetchBudgetEstimate();
    }
    if (step === 3 && budget) {
      fetchBudgetFeasibility(budget);
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
          duration: tripDays,
          durationMode,
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

                {/* Accommodation Selection (Selectable Visual Cards) */}
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">Where would you prefer to stay?</Label>
                    <span className="text-[11px] text-muted-foreground">Selectable Choice</span>
                  </div>
                  <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                    {ACCOMMODATION_OPTIONS.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setAccommodation(t.id)}
                        className={cn(
                          "rounded-xl border p-3.5 text-left transition-all flex flex-col justify-between",
                          accommodation === t.id
                            ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/40"
                            : "border-border bg-background/80 hover:border-primary/40",
                        )}
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">{t.icon}</span>
                            <p className="font-semibold text-xs text-foreground">{t.title}</p>
                          </div>
                          <p className="mt-1 text-[11px] text-muted-foreground leading-normal">{t.desc}</p>
                        </div>
                        {t.isFree && (
                          <Badge variant="outline" className="mt-2 text-[10px] w-fit border-emerald-500/30 text-emerald-700 dark:text-emerald-300">
                            ₹0 Lodging Cost
                          </Badge>
                        )}
                      </button>
                    ))}
                  </div>
                  {accommodation === "OWN_HOME" && (
                    <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                      <span>🏡</span>
                      <span>
                        <strong>Zero Lodging Expense:</strong> Staying with family, relatives, or at your own home incurs ₹0 accommodation fees. Your budget will be reserved for travel, dining, and activities.
                      </span>
                    </div>
                  )}
                </div>

                {/* Primary Transportation Mode (Selectable Mode Buttons) */}
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">Preferred Mode of Travel</Label>
                    <span className="text-[11px] text-muted-foreground">{originCity || "Origin"} → {destination}</span>
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-2.5">
                    {MODES.map(({ id, icon: Icon, label }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          setTravelMode(id);
                          if (id === "Train") {
                            fetchLiveTrains();
                          }
                        }}
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

                  {/* RailCore Live Indian Railways Experience */}
                  {travelMode === "Train" && (
                    <div className="mt-3.5 rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Train className="h-4 w-4 text-primary" />
                          <span className="text-xs font-semibold text-foreground">
                            Live Indian Railways
                          </span>
                          <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[10px] font-medium py-0 h-4">
                            ● Live RailCore
                          </Badge>
                        </div>
                        <button
                          type="button"
                          onClick={() => fetchLiveTrains()}
                          disabled={isFetchingTrains}
                          className="text-[11px] font-medium text-primary hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className={cn("h-3 w-3", isFetchingTrains && "animate-spin")} />
                          {isFetchingTrains ? "Checking..." : "Refresh Trains"}
                        </button>
                      </div>

                      {railcoreData?.fromStation && railcoreData?.toStation && (
                        <p className="text-[11px] text-muted-foreground">
                          Route: <strong>{railcoreData.fromStation}</strong> → <strong>{railcoreData.toStation}</strong> on {startDate || "upcoming journey"} ({railcoreData.totalTrainsFound || 0} scheduled trains)
                        </p>
                      )}

                      {isFetchingTrains && (
                        <div className="py-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                          <RotateCcw className="h-3.5 w-3.5 animate-spin text-primary" />
                          Searching RailCore for live schedules, class-wise fares & seat availability...
                        </div>
                      )}

                      {!isFetchingTrains && railcoreData?.trains && railcoreData.trains.length > 0 && (
                        <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                          {railcoreData.trains.map((train: any) => {
                            const isTrainSelected = selectedTrain?.trainNumber === train.trainNumber;
                            const statusText = train.seatAvailability?.availabilityText || train.seatAvailability?.status || "Available";
                            const isWaitlist = /WL|WAITLIST/i.test(statusText);
                            const isAvail = /AVL|AVAILABLE/i.test(statusText);

                            return (
                              <div
                                key={train.trainNumber}
                                className={cn(
                                  "rounded-xl border p-3.5 transition-all text-left",
                                  isTrainSelected
                                    ? "border-primary bg-background shadow-sm ring-1 ring-primary/50"
                                    : "border-border/70 bg-background/80 hover:border-primary/40"
                                )}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-xs text-foreground">
                                        #{train.trainNumber} {train.trainName}
                                      </span>
                                      <Badge
                                        variant="outline"
                                        className={cn(
                                          "text-[10px] px-1.5 py-0 h-4 font-medium",
                                          isAvail
                                            ? "border-emerald-500/40 text-emerald-700 bg-emerald-500/10"
                                            : isWaitlist
                                            ? "border-amber-500/40 text-amber-700 bg-amber-500/10"
                                            : "border-blue-500/40 text-blue-700 bg-blue-500/10"
                                        )}
                                      >
                                        {statusText}
                                      </Badge>
                                    </div>
                                    <p className="mt-1 text-[11px] text-muted-foreground">
                                      {train.fromStationCode || train.fromStationName} ({train.departureTime}) → {train.toStationCode || train.toStationName} ({train.arrivalTime}) · {train.durationHours}h {train.distanceKm ? `(${train.distanceKm} km)` : ""}
                                    </p>
                                  </div>
                                  <Button
                                    size="sm"
                                    type="button"
                                    variant={isTrainSelected ? "default" : "outline"}
                                    className="h-7 text-xs px-2.5"
                                    onClick={() => handleSelectTrain(train, selectedTrainClass)}
                                  >
                                    {isTrainSelected ? "Selected" : "Select"}
                                  </Button>
                                </div>

                                {/* Class chips with live fares */}
                                <div className="mt-2.5 flex flex-wrap gap-1.5 pt-2 border-t border-border/40">
                                  {(train.fares && train.fares.length > 0 ? train.fares : (train.availableClasses || []).map((c: string) => ({ classCode: c, fareINR: 0 }))).map((f: any) => {
                                    const isClassActive = isTrainSelected && selectedTrainClass === f.classCode;
                                    return (
                                      <button
                                        key={f.classCode}
                                        type="button"
                                        onClick={() => handleSelectTrain(train, f.classCode)}
                                        className={cn(
                                          "rounded-lg border px-2 py-1 text-[11px] font-medium transition-all flex items-center gap-1 cursor-pointer",
                                          isClassActive
                                            ? "border-primary bg-primary text-primary-foreground shadow-xs"
                                            : "border-border/60 bg-muted/30 hover:border-primary/40 text-muted-foreground hover:text-foreground"
                                        )}
                                      >
                                        <span>{f.classCode}</span>
                                        {f.fareINR > 0 && <span className="opacity-80">₹{f.fareINR}</span>}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {!isFetchingTrains && (!railcoreData || railcoreData.status === "NO_DIRECT_TRAINS" || railcoreData.trains?.length === 0) && (
                        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-800 dark:text-amber-300">
                          <p className="font-medium">No direct scheduled train found between {originCity || "Origin"} and {destination}.</p>
                          <p className="text-[11px] opacity-80 mt-0.5">
                            Connecting train legs or regional road transfers can be used. Try searching with a nearby major railway junction.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {originCity && destination && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 flex items-center gap-3">
                    <Compass className="h-4 w-4 text-primary shrink-0" />
                    <p className="text-xs text-foreground/90">
                      Route: <strong className="text-primary">{originCity}</strong> → <strong className="text-primary">{destination}</strong>
                    </p>
                  </div>
                )}

                {/* Geolocation verification / disambiguation spinner */}
                {isCheckingDisambiguation && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 flex items-center gap-2.5 text-xs text-primary animate-pulse">
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent shrink-0" />
                    <span>Verifying coordinates & checking geographical disambiguation for "{destination}"...</span>
                  </div>
                )}

                {/* Disambiguation Dynamic Selectable Cards */}
                {disambiguationCandidates.length > 0 && (
                  <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-foreground">
                          Multiple locations match "{destination}"
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Please select your intended destination to continue:
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-2.5 sm:grid-cols-2">
                      {disambiguationCandidates.map((c) => (
                        <button
                          key={c.id || c.fullName}
                          type="button"
                          onClick={() => handleSelectCandidate(c)}
                          className="group rounded-xl border border-border/80 bg-card p-3 text-left hover:border-primary hover:bg-primary/5 hover:shadow-sm transition-all flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-xs text-foreground group-hover:text-primary">
                                {c.destinationName}
                              </span>
                              <Badge variant="outline" className="text-[10px] py-0">
                                {c.country}
                              </Badge>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-1">
                              {c.stateOrRegion ? `${c.stateOrRegion}, ` : ""}{c.country}
                              {c.district ? ` · ${c.district}` : ""}
                            </p>
                            {c.referenceInfo && (
                              <p className="text-[10px] text-muted-foreground/80 mt-1 italic">
                                {c.referenceInfo}
                              </p>
                            )}
                          </div>
                          <div className="mt-2 pt-2 border-t border-border/40 flex items-center justify-between text-[11px] text-primary font-medium">
                            <span>Select this location</span>
                            <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {disambiguationWarning && disambiguationCandidates.length === 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">{disambiguationWarning}</p>
                )}

                {!destination.trim() && (
                  <p className="text-xs text-destructive">Please enter a destination to continue.</p>
                )}
              </div>
            )}

            {/* ── Step 1: Destination Insights & Duration ── */}
            {step === 1 && (
              <div className="space-y-6">
                {isFetchingOverview ? (
                  <div className="rounded-2xl border border-primary/20 bg-primary/5 p-8 text-center space-y-3">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-3 border-primary border-t-transparent" />
                    <p className="text-sm font-semibold text-foreground">
                      Analyzing {destination}...
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Discovering authentic hidden gems, popular attractions, and calculating ideal exploration duration.
                    </p>
                  </div>
                ) : destinationOverview ? (
                  <div className="space-y-6">
                    {/* Destination Banner / Hero */}
                    <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card p-5 md:p-6 shadow-sm">
                      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-display text-2xl font-bold tracking-tight text-foreground">
                              {destinationOverview.destination}
                            </h3>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-xs",
                                destinationOverview.isUncertain
                                  ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                                  : "bg-primary/10 text-primary border-primary/20"
                              )}
                            >
                              {destinationOverview.isUncertain ? "Baseline Estimate" : "Verified Intelligence"}
                            </Badge>
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-2xl">
                            {destinationOverview.overview}
                          </p>
                        </div>
                        {destinationOverview.heroImage && (
                          <div className="shrink-0 h-24 w-36 overflow-hidden rounded-xl border border-border/60">
                            <img
                              src={destinationOverview.heroImage}
                              alt={destinationOverview.destination}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        )}
                      </div>

                      {/* Uncertainty Notice if applicable */}
                      {destinationOverview.isUncertain && (
                        <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
                          <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-semibold">Notice: </span>
                            <span>
                              {destinationOverview.uncertaintyReason ||
                                "Limited verified catalog data for this destination. Advenza provides conservative pacing recommendations without displaying unverified attraction counts or speculative hidden gems."}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Stats row - only when verified places exist */}
                      {destinationOverview.verifiedPlacesCount > 0 && (
                        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border/50 pt-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1 font-medium text-foreground">
                            <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                            {destinationOverview.durationRecommendation.popularAttractionsCount} Popular Spots
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400">
                            <Gem className="h-3.5 w-3.5 text-amber-500" />
                            {destinationOverview.durationRecommendation.hiddenGemsCount} Hidden Gems
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 text-primary" />
                            {destinationOverview.durationRecommendation.regions.length} Key Regions
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Duration Mode & Recommendations Section */}
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <Label className="text-sm font-semibold">Exploration Duration & Dates</Label>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {destinationOverview.isUncertain
                              ? "Select an Advenza baseline duration or choose your exact custom travel dates."
                              : `Tailored dynamically for ${destinationOverview.destination}. Select a recommendation or set custom dates.`}
                          </p>
                        </div>

                        {/* Mode Selector Toggle */}
                        <div className="inline-flex rounded-xl bg-muted/60 p-1 border border-border/60 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setDurationMode("RECOMMENDED");
                              const recDays = destinationOverview?.durationRecommendation?.recommendedDays || 5;
                              const start = startDate || getDefaultStartDate();
                              if (!startDate) setStartDate(start);
                              setSelectedDaysCount(recDays);
                              setSelectedDurationPlan("recommended");
                              setEndDate(addDaysToDate(start, recDays - 1));
                            }}
                            className={cn(
                              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                              durationMode === "RECOMMENDED"
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            <Sparkles className="h-3.5 w-3.5 text-primary" />
                            Recommended
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDurationMode("CUSTOM");
                              if (!startDate) setStartDate(getDefaultStartDate());
                              if (!endDate && startDate) {
                                setEndDate(addDaysToDate(startDate, (selectedDaysCount || 4) - 1));
                              }
                            }}
                            className={cn(
                              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                              durationMode === "CUSTOM"
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            <Calendar className="h-3.5 w-3.5 text-primary" />
                            Custom Dates
                          </button>
                        </div>
                      </div>

                      {/* MODE A: Recommended Duration */}
                      {durationMode === "RECOMMENDED" && (
                        <div className="space-y-4">
                          {/* Departure Start Date Picker */}
                          <div className="rounded-xl border border-border/60 bg-background/50 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Calendar className="h-4 w-4 text-primary shrink-0" />
                              <span>Trip Start Date (Departure):</span>
                            </div>
                            <Input
                              type="date"
                              value={startDate}
                              onChange={(e) => {
                                const newStart = e.target.value;
                                setStartDate(newStart);
                                if (selectedDaysCount && newStart) {
                                  setEndDate(addDaysToDate(newStart, selectedDaysCount - 1));
                                }
                              }}
                              className="h-9 w-full sm:w-44 rounded-lg text-xs"
                            />
                          </div>

                          <div className="grid gap-3 sm:grid-cols-3">
                            {/* Minimum */}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedDurationPlan("min");
                                const days = destinationOverview.durationRecommendation.minimumDays;
                                setSelectedDaysCount(days);
                                const start = startDate || getDefaultStartDate();
                                if (!startDate) setStartDate(start);
                                setEndDate(addDaysToDate(start, days - 1));
                              }}
                              className={cn(
                                "rounded-xl border p-4 text-left transition-all",
                                selectedDurationPlan === "min"
                                  ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/30"
                                  : "border-border bg-background/80 hover:border-primary/40",
                              )}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-muted-foreground">Minimum</span>
                                {selectedDurationPlan === "min" && <Check className="h-3.5 w-3.5 text-primary" />}
                              </div>
                              <p className="mt-1 text-lg font-bold text-foreground">
                                {destinationOverview.durationRecommendation.minRange}
                              </p>
                              <p className="mt-1 text-[11px] text-muted-foreground leading-normal">
                                Covers main highlights and anchor attractions at a brisk pace.
                              </p>
                            </button>

                            {/* Recommended */}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedDurationPlan("recommended");
                                const days = destinationOverview.durationRecommendation.recommendedDays;
                                setSelectedDaysCount(days);
                                const start = startDate || getDefaultStartDate();
                                if (!startDate) setStartDate(start);
                                setEndDate(addDaysToDate(start, days - 1));
                              }}
                              className={cn(
                                "relative rounded-xl border p-4 text-left transition-all",
                                selectedDurationPlan === "recommended"
                                  ? "border-primary bg-primary/15 shadow-sm ring-1 ring-primary/40"
                                  : "border-border bg-background/80 hover:border-primary/40",
                              )}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-primary">★ Recommended</span>
                                {selectedDurationPlan === "recommended" && <Check className="h-3.5 w-3.5 text-primary" />}
                              </div>
                              <p className="mt-1 text-lg font-bold text-foreground">
                                {destinationOverview.durationRecommendation.recommendedRange}
                              </p>
                              <p className="mt-1 text-[11px] text-muted-foreground leading-normal">
                                Ideal balance: key landmarks, scenic spots, dining, and authentic hidden gems.
                              </p>
                            </button>

                            {/* Extended */}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedDurationPlan("extended");
                                const days = destinationOverview.durationRecommendation.extendedDays;
                                setSelectedDaysCount(days);
                                const start = startDate || getDefaultStartDate();
                                if (!startDate) setStartDate(start);
                                setEndDate(addDaysToDate(start, days - 1));
                              }}
                              className={cn(
                                "rounded-xl border p-4 text-left transition-all",
                                selectedDurationPlan === "extended"
                                  ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/30"
                                  : "border-border bg-background/80 hover:border-primary/40",
                              )}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-muted-foreground">Extended</span>
                                {selectedDurationPlan === "extended" && <Check className="h-3.5 w-3.5 text-primary" />}
                              </div>
                              <p className="mt-1 text-lg font-bold text-foreground">
                                {destinationOverview.durationRecommendation.extendedRange}
                              </p>
                              <p className="mt-1 text-[11px] text-muted-foreground leading-normal">
                                Deep dive with regional day trips and unhurried local exploration.
                              </p>
                            </button>
                          </div>

                          {/* Scheduled dates preview banner */}
                          {startDate && endDate && (
                            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">
                                Scheduled Trip Window:
                              </span>
                              <span className="font-semibold text-foreground">
                                {startDate} → {endDate} ({selectedDaysCount || tripDays} days, {Math.max(0, (selectedDaysCount || tripDays) - 1)} nights)
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* MODE B: Custom Duration Selection */}
                      {durationMode === "CUSTOM" && (
                        <div className="space-y-3.5 rounded-2xl border border-primary/30 bg-card p-4 md:p-5 shadow-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                              <Calendar className="h-4 w-4 text-primary" />
                              Custom Travel Dates
                            </span>
                            <Badge variant="outline" className="text-[11px] border-primary/30 text-primary">
                              User Controlled Dates
                            </Badge>
                          </div>

                          <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                              <Label className="text-xs font-medium">Trip Start Date</Label>
                              <Input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="mt-1.5 h-11 rounded-xl text-xs font-medium"
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-medium">Trip End Date</Label>
                              <Input
                                type="date"
                                value={endDate}
                                min={startDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="mt-1.5 h-11 rounded-xl text-xs font-medium"
                              />
                            </div>
                          </div>

                          {/* Calculated Duration Display */}
                          {startDate && endDate && (
                            <div className="rounded-xl border border-border/70 bg-muted/30 p-3.5 flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Calculated Duration:</span>
                              <span className="font-semibold text-foreground text-sm">
                                {startDate === endDate
                                  ? "1 Calendar Day (Day Trip / 0 Nights)"
                                  : `${tripDays} Calendar Days (${Math.max(0, tripDays - 1)} Nights)`}
                              </span>
                            </div>
                          )}

                          {/* Date Range Validation Error */}
                          {startDate && endDate && endDate < startDate && (
                            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
                              <Info className="h-4 w-4 shrink-0" />
                              <span>End date cannot be earlier than start date.</span>
                            </div>
                          )}

                          {/* Pacing Feedback Warnings (Helpful, Non-blocking) */}
                          {startDate && endDate && endDate >= startDate && (
                            <>
                              {/* Shorter than recommended minimum */}
                              {tripDays < destinationOverview.durationRecommendation.minimumDays && (
                                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
                                  <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                  <div>
                                    <span className="font-semibold">Pacing Notice: </span>
                                    <span>
                                      Your selected duration of {tripDays} day{tripDays !== 1 ? "s" : ""} is shorter than the recommended minimum of {destinationOverview.durationRecommendation.minimumDays} days for {destinationOverview.destination}. Advenza will prioritize your top interests and must-see landmarks, skipping lower-priority stops so you are not rushed.
                                    </span>
                                  </div>
                                </div>
                              )}

                              {/* Longer than recommended extended */}
                              {tripDays > destinationOverview.durationRecommendation.extendedDays && (
                                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-xs text-foreground/90 flex items-start gap-2.5">
                                  <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                  <div>
                                    <span className="font-semibold text-primary">Extended Exploration: </span>
                                    <span>
                                      With {tripDays} days, Advenza will weave in authentic hidden gems, deeper neighborhood exploration, and suggested regional day trips without repeating activities.
                                    </span>
                                  </div>
                                </div>
                              )}

                              {/* Within ideal range */}
                              {tripDays >= destinationOverview.durationRecommendation.minimumDays &&
                                tripDays <= destinationOverview.durationRecommendation.extendedDays && (
                                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2.5">
                                    <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                                    <div>
                                      <span className="font-semibold">Optimal Duration: </span>
                                      <span>
                                        Your {tripDays}-day plan comfortably matches Advenza's recommended {destinationOverview.durationRecommendation.recommendedRange} exploration window.
                                      </span>
                                    </div>
                                  </div>
                                )}
                            </>
                          )}
                        </div>
                      )}

                      {/* Why Recommended Explanation */}
                      {destinationOverview.durationRecommendation.whyRecommended && (
                        <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-xs text-foreground/90 flex items-start gap-2.5">
                          <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          <div>
                            <span className="font-semibold text-primary">Why this duration: </span>
                            <span>{destinationOverview.durationRecommendation.whyRecommended}</span>
                          </div>
                        </div>
                      )}

                      {/* Interest Alignment Note */}
                      {destinationOverview.durationRecommendation.interestAlignmentNote && (
                        <div className="mt-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
                          <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-semibold">Interest Insight: </span>
                            <span>{destinationOverview.durationRecommendation.interestAlignmentNote}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Discovered Highlights: Popular vs Hidden Gems (only when highlights exist) */}
                    {(destinationOverview.durationRecommendation.popularHighlights.length > 0 ||
                      destinationOverview.durationRecommendation.hiddenGemHighlights.length > 0) && (
                      <div className="grid gap-4 md:grid-cols-2">
                        {/* Popular Highlights */}
                        {destinationOverview.durationRecommendation.popularHighlights.length > 0 && (
                          <div className="rounded-2xl border border-border/70 bg-card p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                                Popular Attractions
                              </h4>
                              <span className="text-[11px] text-muted-foreground">
                                {destinationOverview.durationRecommendation.popularHighlights.length} shown
                              </span>
                            </div>
                            <div className="space-y-2">
                              {destinationOverview.durationRecommendation.popularHighlights.map((p, idx) => (
                                <div key={idx} className="rounded-lg border border-border/50 bg-background/50 p-2.5 text-xs">
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium text-foreground">{p.name}</span>
                                    <Badge variant="secondary" className="text-[10px] py-0 px-1.5">{p.region}</Badge>
                                  </div>
                                  <p className="text-[11px] text-muted-foreground mt-0.5">{p.matchReason || p.category}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Hidden Gems Highlights */}
                        {destinationOverview.durationRecommendation.hiddenGemHighlights.length > 0 && (
                          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                                <Gem className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                                Authentic Hidden Gems
                              </h4>
                              <span className="text-[11px] text-amber-700/80 dark:text-amber-400">
                                {destinationOverview.durationRecommendation.hiddenGemHighlights.length} discovered
                              </span>
                            </div>
                            <div className="space-y-2">
                              {destinationOverview.durationRecommendation.hiddenGemHighlights.map((g, idx) => (
                                <div key={idx} className="rounded-lg border border-amber-500/20 bg-background/60 p-2.5 text-xs">
                                  <div className="flex items-center justify-between">
                                    <span className="font-semibold text-foreground flex items-center gap-1">
                                      <span>💎</span> {g.name}
                                    </span>
                                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-amber-500/30 text-amber-700 dark:text-amber-300">
                                      {g.region}
                                    </Badge>
                                  </div>
                                  {g.whySpecial && (
                                    <p className="text-[11px] text-amber-800 dark:text-amber-300/90 mt-1 italic">
                                      Why it's special: {g.whySpecial}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Geographic Regions & Day Trips */}
                    {(destinationOverview.durationRecommendation.regions.length > 0 ||
                      destinationOverview.durationRecommendation.dayTrips.length > 0) && (
                      <div className="rounded-xl border border-border/70 bg-muted/20 p-4 space-y-3 text-xs">
                        {destinationOverview.durationRecommendation.regions.length > 0 && (
                          <div>
                            <span className="font-semibold text-muted-foreground">Geographic Regions: </span>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {destinationOverview.durationRecommendation.regions.map((r, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {r}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {destinationOverview.durationRecommendation.dayTrips.length > 0 && (
                          <div className="pt-2 border-t border-border/40">
                            <span className="font-semibold text-muted-foreground">Suggested Day Trips: </span>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {destinationOverview.durationRecommendation.dayTrips.map((d, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">
                                  {d}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-border/70 bg-muted/20 p-6 text-center space-y-3">
                    <Compass className="h-8 w-8 text-primary mx-auto" />
                    <h3 className="text-sm font-semibold text-foreground">
                      Destination: {destination}
                    </h3>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto">
                      Click continue to set your preferred travel dates and travelers for this journey.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── Step 2: Dates & Travelers ── */}
            {step === 2 && (
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs font-medium">Start date</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        setDurationMode("CUSTOM");
                      }}
                      className="mt-1.5 h-12 rounded-xl"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium">End date</Label>
                    <Input
                      type="date"
                      value={endDate}
                      min={startDate}
                      onChange={(e) => {
                        setEndDate(e.target.value);
                        setDurationMode("CUSTOM");
                      }}
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
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Trip duration:</span>
                      <Badge variant="outline" className="text-[11px]">
                        {durationMode === "CUSTOM" ? "Custom Duration" : "Advenza Recommended"}
                      </Badge>
                    </div>
                    <span className="font-semibold text-foreground">
                      {startDate === endDate
                        ? "1 calendar day (Day Trip / 0 nights)"
                        : `${tripDays} calendar day${tripDays !== 1 ? "s" : ""} (${Math.max(0, tripDays - 1)} night${Math.max(0, tripDays - 1) !== 1 ? "s" : ""})`}
                    </span>
                  </div>
                )}
                {destinationOverview && startDate && endDate && endDate >= startDate && tripDays < destinationOverview.durationRecommendation.minimumDays && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
                    <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold">Pacing Notice: </span>
                      <span>
                        Your selected duration of {tripDays} day{tripDays !== 1 ? "s" : ""} is shorter than the recommended minimum of {destinationOverview.durationRecommendation.minimumDays} days for {destination}. Advenza will prioritize your top interests and must-see landmarks.
                      </span>
                    </div>
                  </div>
                )}
                {selectedDaysCount && durationMode === "RECOMMENDED" && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 flex items-center justify-between text-xs">
                    <span className="text-foreground/90">
                      Target duration recommended for {destination}: <strong>{selectedDaysCount} days</strong>
                    </span>
                    {startDate && (
                      <button
                        type="button"
                        onClick={() => {
                          setEndDate(addDaysToDate(startDate, selectedDaysCount - 1));
                        }}
                        className="text-primary hover:underline font-semibold"
                      >
                        Set end date ({selectedDaysCount} days)
                      </button>
                    )}
                  </div>
                )}
                {endDate && startDate && endDate < startDate && (
                  <p className="text-xs text-destructive">End date must be on or after start date.</p>
                )}
              </div>
            )}

            {/* ── Step 3: Budget ── */}
            {step === 3 && (
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
                      onChange={(e) => {
                        setBudget(e.target.value);
                        if (e.target.value && parseInt(e.target.value) >= 100) {
                          fetchBudgetFeasibility(e.target.value);
                        }
                      }}
                      onBlur={() => {
                        if (budget && parseInt(budget) >= 100) {
                          fetchBudgetFeasibility(budget);
                        }
                      }}
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

                {/* Arithmetic Budget Feasibility Analysis */}
                {isCheckingBudgetFeasibility && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 flex items-center gap-2 text-xs text-primary animate-pulse">
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent shrink-0" />
                    <span>Evaluating arithmetic feasibility, accommodation, and transport models...</span>
                  </div>
                )}

                {budgetFeasibility && budgetFeasibility.budgetStatus === "EXCEEDS_BUDGET" && (
                  <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 md:p-5 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/40 text-xs font-semibold">
                            Budget Feasibility Notice
                          </Badge>
                          <span className="text-xs text-amber-800 dark:text-amber-300 font-semibold">
                            Shortfall: ₹{budgetFeasibility.shortfallAmountINR.toLocaleString("en-IN")}
                          </span>
                        </div>
                        <p className="text-xs text-foreground/90 mt-1.5 leading-relaxed">
                          The realistic calculated total for this trip is <strong>₹{budgetFeasibility.totalEstimatedBudgetINR.toLocaleString("en-IN")}</strong>, which exceeds your planned budget of <strong>₹{budgetNum.toLocaleString("en-IN")}</strong>.
                        </p>
                      </div>
                    </div>

                    {/* Primary Cost Drivers */}
                    {budgetFeasibility.costDrivers && budgetFeasibility.costDrivers.length > 0 && (
                      <div>
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                          Primary Cost Drivers:
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {budgetFeasibility.costDrivers.map((driver, dIdx) => (
                            <Badge key={dIdx} variant="secondary" className="text-[11px]">
                              {driver}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actionable Savings Options */}
                    {budgetFeasibility.actionableSavingsOptions && budgetFeasibility.actionableSavingsOptions.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-amber-500/20">
                        <p className="text-xs font-semibold text-foreground">
                          3 Actionable Savings Options (Choose without sacrificing quality):
                        </p>
                        <div className="grid gap-2.5 sm:grid-cols-3">
                          {budgetFeasibility.actionableSavingsOptions.map((opt, oIdx) => (
                            <div
                              key={oIdx}
                              className="rounded-xl border border-border/80 bg-background/90 p-3 text-xs flex flex-col justify-between shadow-sm space-y-2"
                            >
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="font-semibold text-foreground">{opt.title}</span>
                                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                                    Save ₹{opt.potentialSavingsINR.toLocaleString("en-IN")}
                                  </span>
                                </div>
                                <p className="text-[11px] text-muted-foreground leading-normal">{opt.description}</p>
                                <p className="text-[10px] text-muted-foreground italic">Trade-off: {opt.tradeoff}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleApplySavingsOption(opt)}
                                className="mt-2 w-full rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 py-1.5 px-2.5 text-[11px] font-semibold transition-colors flex items-center justify-center gap-1 border border-emerald-500/20"
                              >
                                <span>✓</span> Apply this recommendation
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {budgetFeasibility && budgetFeasibility.budgetStatus === "FEASIBLE" && budgetNum >= 100 && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
                    <span className="font-semibold">✓ Budget Arithmetic Feasible</span>
                    <span>
                      Est. Total: ₹{budgetFeasibility.totalEstimatedBudgetINR.toLocaleString("en-IN")} (Surplus: ₹{budgetFeasibility.surplusAmountINR.toLocaleString("en-IN")})
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* ── Step 4: Interests, Pace & Travel Details ── */}
            {step === 4 && (
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

                {/* Accommodation Selection (Selectable Visual Cards) */}
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">Where would you prefer to stay?</Label>
                    <span className="text-[11px] text-muted-foreground">Selectable Choice</span>
                  </div>
                  <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                    {ACCOMMODATION_OPTIONS.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setAccommodation(t.id)}
                        className={cn(
                          "rounded-xl border p-3.5 text-left transition-all flex flex-col justify-between",
                          accommodation === t.id
                            ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/40"
                            : "border-border bg-background/80 hover:border-primary/40",
                        )}
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">{t.icon}</span>
                            <p className="font-semibold text-xs text-foreground">{t.title}</p>
                          </div>
                          <p className="mt-1 text-[11px] text-muted-foreground leading-normal">{t.desc}</p>
                        </div>
                        {t.isFree && (
                          <Badge variant="outline" className="mt-2 text-[10px] w-fit border-emerald-500/30 text-emerald-700 dark:text-emerald-300">
                            ₹0 Lodging Cost
                          </Badge>
                        )}
                      </button>
                    ))}
                  </div>
                  {accommodation === "OWN_HOME" && (
                    <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                      <span>🏡</span>
                      <span>
                        <strong>Zero Lodging Expense:</strong> Staying with family, relatives, or at your own home incurs ₹0 accommodation fees. Your budget will be reserved for travel, dining, and activities.
                      </span>
                    </div>
                  )}
                </div>

                {/* Primary Transportation Mode (Selectable Mode Buttons) */}
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">Preferred Mode of Travel</Label>
                    <span className="text-[11px] text-muted-foreground">{originCity || "Origin"} → {destination}</span>
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-2.5">
                    {MODES.map(({ id, icon: Icon, label }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          setTravelMode(id);
                          if (id === "Train") {
                            fetchLiveTrains();
                          }
                        }}
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

                  {/* RailCore Live Indian Railways Experience */}
                  {travelMode === "Train" && (
                    <div className="mt-3.5 rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Train className="h-4 w-4 text-primary" />
                          <span className="text-xs font-semibold text-foreground">
                            Live Indian Railways
                          </span>
                          <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[10px] font-medium py-0 h-4">
                            ● Live RailCore
                          </Badge>
                        </div>
                        <button
                          type="button"
                          onClick={() => fetchLiveTrains()}
                          disabled={isFetchingTrains}
                          className="text-[11px] font-medium text-primary hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className={cn("h-3 w-3", isFetchingTrains && "animate-spin")} />
                          {isFetchingTrains ? "Checking..." : "Refresh Trains"}
                        </button>
                      </div>

                      {railcoreData?.fromStation && railcoreData?.toStation && (
                        <p className="text-[11px] text-muted-foreground">
                          Route: <strong>{railcoreData.fromStation}</strong> → <strong>{railcoreData.toStation}</strong> on {startDate || "upcoming journey"} ({railcoreData.totalTrainsFound || 0} scheduled trains)
                        </p>
                      )}

                      {isFetchingTrains && (
                        <div className="py-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                          <RotateCcw className="h-3.5 w-3.5 animate-spin text-primary" />
                          Searching RailCore for live schedules, class-wise fares & seat availability...
                        </div>
                      )}

                      {!isFetchingTrains && railcoreData?.trains && railcoreData.trains.length > 0 && (
                        <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                          {railcoreData.trains.map((train: any) => {
                            const isTrainSelected = selectedTrain?.trainNumber === train.trainNumber;
                            const statusText = train.seatAvailability?.availabilityText || train.seatAvailability?.status || "Available";
                            const isWaitlist = /WL|WAITLIST/i.test(statusText);
                            const isAvail = /AVL|AVAILABLE/i.test(statusText);

                            return (
                              <div
                                key={train.trainNumber}
                                className={cn(
                                  "rounded-xl border p-3.5 transition-all text-left",
                                  isTrainSelected
                                    ? "border-primary bg-background shadow-sm ring-1 ring-primary/50"
                                    : "border-border/70 bg-background/80 hover:border-primary/40"
                                )}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-xs text-foreground">
                                        #{train.trainNumber} {train.trainName}
                                      </span>
                                      <Badge
                                        variant="outline"
                                        className={cn(
                                          "text-[10px] px-1.5 py-0 h-4 font-medium",
                                          isAvail
                                            ? "border-emerald-500/40 text-emerald-700 bg-emerald-500/10"
                                            : isWaitlist
                                            ? "border-amber-500/40 text-amber-700 bg-amber-500/10"
                                            : "border-blue-500/40 text-blue-700 bg-blue-500/10"
                                        )}
                                      >
                                        {statusText}
                                      </Badge>
                                    </div>
                                    <p className="mt-1 text-[11px] text-muted-foreground">
                                      {train.fromStationCode || train.fromStationName} ({train.departureTime}) → {train.toStationCode || train.toStationName} ({train.arrivalTime}) · {train.durationHours}h {train.distanceKm ? `(${train.distanceKm} km)` : ""}
                                    </p>
                                  </div>
                                  <Button
                                    size="sm"
                                    type="button"
                                    variant={isTrainSelected ? "default" : "outline"}
                                    className="h-7 text-xs px-2.5"
                                    onClick={() => handleSelectTrain(train, selectedTrainClass)}
                                  >
                                    {isTrainSelected ? "Selected" : "Select"}
                                  </Button>
                                </div>

                                {/* Class chips with live fares */}
                                <div className="mt-2.5 flex flex-wrap gap-1.5 pt-2 border-t border-border/40">
                                  {(train.fares && train.fares.length > 0 ? train.fares : (train.availableClasses || []).map((c: string) => ({ classCode: c, fareINR: 0 }))).map((f: any) => {
                                    const isClassActive = isTrainSelected && selectedTrainClass === f.classCode;
                                    return (
                                      <button
                                        key={f.classCode}
                                        type="button"
                                        onClick={() => handleSelectTrain(train, f.classCode)}
                                        className={cn(
                                          "rounded-lg border px-2 py-1 text-[11px] font-medium transition-all flex items-center gap-1 cursor-pointer",
                                          isClassActive
                                            ? "border-primary bg-primary text-primary-foreground shadow-xs"
                                            : "border-border/60 bg-muted/30 hover:border-primary/40 text-muted-foreground hover:text-foreground"
                                        )}
                                      >
                                        <span>{f.classCode}</span>
                                        {f.fareINR > 0 && <span className="opacity-80">₹{f.fareINR}</span>}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {!isFetchingTrains && (!railcoreData || railcoreData.status === "NO_DIRECT_TRAINS" || railcoreData.trains?.length === 0) && (
                        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-800 dark:text-amber-300">
                          <p className="font-medium">No direct scheduled train found between {originCity || "Origin"} and {destination}.</p>
                          <p className="text-[11px] opacity-80 mt-0.5">
                            Connecting train legs or regional road transfers can be used. Try searching with a nearby major railway junction.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
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

                      {/* Hotel Name & Timings */}
                      <div className="rounded-2xl border border-border/70 bg-muted/20 p-5 space-y-4">
                        <h3 className="text-sm font-semibold">Stay Timings & Custom Venue (Optional)</h3>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <Label className="text-xs">Hotel / Stay name (optional)</Label>
                            <Input
                              value={hotelName}
                              onChange={(e) => setHotelName(e.target.value)}
                              className="mt-1 h-9 rounded-lg text-xs"
                              placeholder={accommodation === "OWN_HOME" ? "e.g. Uncle's house / Family residence" : "e.g. Taj Fort Aguada / Radisson"}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Hotel area / address (optional)</Label>
                            <Input
                              value={hotelLocation}
                              onChange={(e) => setHotelLocation(e.target.value)}
                              className="mt-1 h-9 rounded-lg text-xs"
                              placeholder={destination ? `e.g. Central ${destination}` : "e.g. Candolim, North Goa"}
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

            {/* ── Step 5: Review ── */}
            {step === 5 && (
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
                      {transitRef && (
                        <p className="text-[11px] font-medium text-primary mt-1 flex items-center gap-1">
                          🚆 {transitRef}
                        </p>
                      )}
                      {travelMode === "Train" && (
                        <Badge variant="outline" className="mt-1 border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[10px] py-0 h-4">
                          ● Live RailCore IRCTC Verified
                        </Badge>
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

                {(accommodation || hotelName) && (
                  <div className="rounded-xl glass-tile p-4">
                    <p className="text-xs text-muted-foreground">Accommodation</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {accommodation === "OWN_HOME"
                        ? "Own Home / Relative's Home (₹0 Free Lodging)"
                        : accommodation
                        ? ACCOMMODATION_OPTIONS.find((a) => a.id === accommodation)?.title || accommodation
                        : hotelName}
                    </p>
                    {(hotelName || hotelLocation) && accommodation !== "OWN_HOME" && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {hotelName} {hotelLocation ? `(${hotelLocation})` : ""}
                      </p>
                    )}
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
