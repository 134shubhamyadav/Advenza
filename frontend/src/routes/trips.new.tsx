import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useMemo, useRef } from "react";
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
  Info,
  Radio,
  Bed,
  Wallet,
  Building2,
  Home,
  UtensilsCrossed,
  Mountain,
  Landmark,
  Camera,
  Waves,
  ShoppingBag,
  PartyPopper,
  Coffee,
  Palette,
  Trees,
  Store,
  Ticket,
  Users,
  Moon,
  Utensils,
  Zap,
  Scale,
  SunMedium,
  SlidersHorizontal,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { TripGenerationLoader } from "@/components/travel/trip-generation-loader";
import { cn, normalizeTimeTo24h, calculateInclusiveDays } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { fetchDestinationOverview, type DestinationOverview } from "@/services/tripService";
import { getLocalityInterests } from "@/lib/locality-interests";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";

export const Route = createFileRoute("/trips/new")({
  validateSearch: (search: Record<string, unknown>): { destination?: string } => ({
    destination:
      typeof search.destination === "string"
        ? search.destination
        : typeof search.dest === "string"
          ? search.dest
          : undefined,
  }),
  component: NewTrip,
});

const steps = [
  "Destination",
  "Destination Insights",
  "Dates & travelers",
  "Stay & Leaving Prices",
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

interface TravelPaceOption {
  id: "Relaxed" | "Balanced" | "Packed";
  label: string;
  tagline: string;
  desc: string;
  density: string;
  icon: any;
}

const TRAVEL_PACES: TravelPaceOption[] = [
  {
    id: "Relaxed",
    label: "Relaxed",
    tagline: "Unhurried & immersive",
    desc: "Fewer attractions per day. More free time and longer breaks. Focus on experiences rather than quantity.",
    density: "2–3 stops / day",
    icon: SunMedium,
  },
  {
    id: "Balanced",
    label: "Balanced",
    tagline: "Sightseeing & leisure in harmony",
    desc: "Mix of sightseeing, activities and relaxation. A reasonable number of attractions each day.",
    density: "3–4 stops / day",
    icon: Scale,
  },
  {
    id: "Packed",
    label: "Packed",
    tagline: "High coverage & maximum discovery",
    desc: "Explore more attractions. Efficient geographic grouping. Minimize unnecessary idle time without creating unrealistic schedules.",
    density: "4–6 stops / day",
    icon: Zap,
  },
];

const TRAVEL_INTERESTS = [
  { id: "Food & Local Cuisine", icon: UtensilsCrossed },
  { id: "Nature & Mountains", icon: Mountain },
  { id: "History & Heritage", icon: Landmark },
  { id: "Photography", icon: Camera },
  { id: "Beaches & Water Activities", icon: Waves },
  { id: "Adventure & Hiking", icon: Compass },
  { id: "Architecture", icon: Building2 },
  { id: "Shopping", icon: ShoppingBag },
  { id: "Nightlife & Entertainment", icon: PartyPopper },
  { id: "Cafes & Relaxation", icon: Coffee },
  { id: "Art & Culture", icon: Palette },
  { id: "Wellness & Spirituality", icon: Sparkles },
  { id: "Wildlife & Eco Tourism", icon: Trees },
  { id: "Local Markets & Street Experiences", icon: Store },
  { id: "Festivals & Events", icon: Ticket },
];

const EXPERIENCE_PREFERENCES = [
  {
    id: "Hidden Gems",
    label: "Hidden Gems",
    desc: "Off-the-beaten-path secrets, quiet spots & authentic local treasures.",
    icon: Gem,
  },
  {
    id: "Popular Must-Visit Attractions",
    label: "Popular Must-Visit Attractions",
    desc: "Iconic landmarks, world-famous sights & top-rated must-sees.",
    icon: Star,
  },
  {
    id: "Local Experiences",
    label: "Local Experiences",
    desc: "Everyday culture, neighbourhood walks & indigenous community encounters.",
    icon: Users,
  },
  {
    id: "Night Experiences",
    label: "Night Experiences",
    desc: "Illuminated monuments, night markets & vibrant evening strolls.",
    icon: Moon,
  },
  {
    id: "Photography Spots",
    label: "Photography Spots",
    desc: "Golden-hour viewpoints, architectural vistas & picture-perfect panoramas.",
    icon: Camera,
  },
  {
    id: "Food Experiences",
    label: "Food Experiences",
    desc: "Heritage eateries, authentic street food & regional culinary tastings.",
    icon: Utensils,
  },
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
    id: "HOTEL",
    title: "Hotel / Resort",
    desc: "Comfortable private room with standard amenities & breakfast",
    icon: "🏨",
    isFree: false,
  },
  {
    id: "RESORT",
    title: "Luxury Resort / Heritage",
    desc: "5-star resort, heritage property, or boutique villa",
    icon: "✨",
    isFree: false,
  },
  {
    id: "HOSTEL",
    title: "Hostel / Homestay",
    desc: "Backpackers hostels, verified homestays, and guesthouses",
    icon: "🛏️",
    isFree: false,
  },
  {
    id: "OWN_HOME",
    title: "Own Home",
    desc: "Staying at your own residence or vacation home (₹0 lodging)",
    icon: "🏡",
    isFree: true,
  },
  {
    id: "NATIVE_HOME",
    title: "Native Village / Hometown",
    desc: "Staying at your ancestral village or hometown (₹0 lodging)",
    icon: "🌾",
    isFree: true,
  },
  {
    id: "RELATIVES_HOME",
    title: "Relatives' Home",
    desc: "Staying with family, relatives, or close friends (₹0 lodging)",
    icon: "🤝",
    isFree: true,
  },
  {
    id: "OTHER",
    title: "Other Stay",
    desc: "Campsite, farmstay, caravan, or unique local stay",
    icon: "⛺",
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
  const search = Route.useSearch();
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
  const [destination, setDestination] = useState(search?.destination || "");
  const [originCity, setOriginCity] = useState("");
  const [disambiguationCandidates, setDisambiguationCandidates] = useState<DisambiguationCandidate[]>([]);
  const [isCheckingDisambiguation, setIsCheckingDisambiguation] = useState(false);
  const [disambiguationWarning, setDisambiguationWarning] = useState("");

  useEffect(() => {
    if (search?.destination && search.destination !== destination) {
      setDestination(search.destination);
    }
  }, [search?.destination]);

  // ── Transport Research & Leaving Prices State ─────────────────────────────
  const [transportResearchData, setTransportResearchData] = useState<any>(null);
  const [isFetchingTransport, setIsFetchingTransport] = useState(false);

  const fetchTransportResearch = async () => {
    if (!destination.trim()) return;
    setIsFetchingTransport(true);
    try {
      const res = await apiFetch(
        `/api/ai/transport/research?destination=${encodeURIComponent(destination.trim())}&origin=${encodeURIComponent(originCity.trim() || "Mumbai")}&travelers=${travelers || 1}&date=${startDate || ""}`
      );
      if (res && res.recommendedModes) {
        setTransportResearchData(res);
      }
    } catch (err) {
      console.warn("Transport research failed:", err);
    } finally {
      setIsFetchingTransport(false);
    }
  };

  const getStayEstimatedCost = (accType: string, nights: number, pax: number) => {
    const rooms = Math.ceil(Math.max(1, pax) / 2);
    const effNights = Math.max(1, nights);
    if (accType === "OWN_HOME" || accType === "NATIVE_HOME" || accType === "RELATIVES_HOME") {
      return { perNight: 0, total: 0, isFree: true, label: "₹0 (Free Personal Stay)" };
    }
    if (accType === "RESORT") {
      return { perNight: 11000, total: 11000 * effNights * rooms, isFree: false, label: "Luxury (₹11,000/nt)" };
    }
    if (accType === "HOSTEL") {
      return { perNight: 1500, total: 1500 * effNights * rooms, isFree: false, label: "Budget (₹1,500/nt)" };
    }
    if (accType === "OTHER") {
      return { perNight: 2500, total: 2500 * effNights * rooms, isFree: false, label: "Unique (₹2,500/nt)" };
    }
    return { perNight: 4200, total: 4200 * effNights * rooms, isFree: false, label: "Mid-Range (₹4,200/nt)" };
  };

  const getLeavingEstimatedCost = () => {
    const pax = parseInt(travelers) || 1;
    if (transportResearchData?.recommendedModes) {
      const active = transportResearchData.recommendedModes.find(
        (m: any) => m.transportType?.toLowerCase() === (travelMode || "Flight").toLowerCase()
      );
      if (active) {
        return active.totalGroupFareINR || (active.estimatedFareINR ? active.estimatedFareINR * 2 * pax : 3500 * pax);
      }
    }
    if (travelMode === "Train") return 1900 * pax;
    if (travelMode === "Bus") return 1500 * pax;
    if (travelMode === "Car") return 4500;
    return 7000 * pax;
  };

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
  const [travelMode, setTravelMode] = useState("Flight");        // primary intercity mode
  const [departureHub, setDepartureHub] = useState("");    // airport / station / terminal (origin)
  const [arrivalHub, setArrivalHub] = useState("");        // airport / station / terminal (destination)
  const [transitRef, setTransitRef] = useState("");        // flight no / train name
  const [outboundDepartureDate, setOutboundDepartureDate] = useState("");
  const [outboundArrivalDate, setOutboundArrivalDate] = useState("");
  const [departureTime, setDepartureTime] = useState(""); // HH:MM
  const [arrivalTime, setArrivalTime] = useState("");     // HH:MM
  const [outboundBooked, setOutboundBooked] = useState(false);

  // ── Return Journey ─────────────────────────────────────────────────────────
  const [hasReturnTravel, setHasReturnTravel] = useState(true);
  const [returnBooked, setReturnBooked] = useState(false);
  const [returnDate, setReturnDate] = useState("");
  const [returnArrivalDate, setReturnArrivalDate] = useState("");
  const [returnTime, setReturnTime] = useState("");
  const [returnArrivalTime, setReturnArrivalTime] = useState("");
  const [returnDepartureLocation, setReturnDepartureLocation] = useState("");
  const [returnArrivalLocation, setReturnArrivalLocation] = useState("");
  const [returnTransportType, setReturnTransportType] = useState("");
  const [returnTicketRef, setReturnTicketRef] = useState("");

  // ── Sync Travel Schedule Dates with Trip Dates (Single Source of Truth) ─────
  const prevStartDateRef = useRef<string>(startDate);
  const prevEndDateRef = useRef<string>(endDate);

  useEffect(() => {
    if (startDate) {
      const prevStart = prevStartDateRef.current;
      setOutboundDepartureDate(startDate);
      // Sync outbound arrival date if it was matching previous start date, empty, or earlier than new start date
      if (!outboundArrivalDate || outboundArrivalDate === prevStart || outboundArrivalDate < startDate) {
        setOutboundArrivalDate(startDate);
      }
      prevStartDateRef.current = startDate;
      if (!departureTime) {
        setDepartureTime(travelMode === "Flight" ? "08:00" : "06:30");
      }
    }
  }, [startDate]);

  useEffect(() => {
    if (endDate) {
      const prevEnd = prevEndDateRef.current;
      setReturnDate(endDate);
      // Sync return arrival date if it was matching previous end date, empty, or earlier than new end date
      if (!returnArrivalDate || returnArrivalDate === prevEnd || returnArrivalDate < endDate) {
        setReturnArrivalDate(endDate);
      }
      prevEndDateRef.current = endDate;
      if (!returnTime) {
        setReturnTime("16:30");
      }
    }
  }, [endDate]);

  // Keep legacy multi-select for local transport
  const [transport, setTransport] = useState<string[]>([]);

  // ── Step 4: Accommodation ──────────────────────────────────────────────────
  const [accommodation, setAccommodation] = useState("");
  const [hotelName, setHotelName] = useState("");
  const [hotelLocation, setHotelLocation] = useState("");
  const [checkInTime, setCheckInTime] = useState("");
  const [checkOutTime, setCheckOutTime] = useState("");

  // ── Step 5: Preferences ────────────────────────────────────────────────────
  const [travelPace, setTravelPace] = useState<"Relaxed" | "Balanced" | "Packed">("Balanced");
  const [style, setStyle] = useState("Balanced");
  const [interests, setInterests] = useState<string[]>([]);
  const [experiencePreferences, setExperiencePreferences] = useState<string[]>([]);
  const [special, setSpecial] = useState("");
  const [generationStatus, setGenerationStatus] = useState<"loading" | "success" | "error">("loading");
  const [generationProgress, setGenerationProgress] = useState<number | undefined>(undefined);

  const localityInterestsList = useMemo(() => {
    return getLocalityInterests(destination, destinationOverview);
  }, [destination, destinationOverview]);

  const handleSelectMode = (modeId: string) => {
    setTravelMode(modeId);
    const recModes = transportResearchData?.recommendedModes || [];

    if (modeId === "Train") {
      const trainMode = recModes.find((m: any) => m.transportType === "Train");
      const depH = trainMode?.departure?.hub || `${originCity || "Origin"} Railway Station`;
      const arrH = trainMode?.arrival?.hub || `${destination} Railway Station`;
      setDepartureHub(depH);
      setArrivalHub(arrH);
      setTransitRef("Express / Superfast Train");
      setReturnDepartureLocation(arrH);
      setReturnArrivalLocation(depH);
      setReturnTicketRef("Express / Superfast Train (Return)");
    } else if (modeId === "Flight") {
      const flightMode = recModes.find((m: any) => m.transportType === "Flight");
      const depH = flightMode?.departure?.hub || `${originCity || "Origin"} Airport`;
      const arrH = flightMode?.arrival?.hub || `${destination} Airport`;
      setDepartureHub(depH);
      setArrivalHub(arrH);
      setTransitRef("Scheduled Domestic Flight");
      setReturnDepartureLocation(arrH);
      setReturnArrivalLocation(depH);
      setReturnTicketRef("Domestic Flight (Return)");
      if (!departureTime) setDepartureTime("08:00");
      if (flightMode?.estimatedDurationMinutes) {
        const depHNum = 8, depM = 0;
        const totalM = depHNum * 60 + depM + flightMode.estimatedDurationMinutes;
        const arrHNum = Math.floor(totalM / 60) % 24;
        const arrMin = totalM % 60;
        setArrivalTime(`${String(arrHNum).padStart(2, "0")}:${String(arrMin).padStart(2, "0")}`);
      }
    } else if (modeId === "Bus") {
      const busMode = recModes.find((m: any) => m.transportType === "Bus");
      const depH = busMode?.departure?.hub || `${originCity || "Origin"} Bus Stand / ISBT`;
      const arrH = busMode?.arrival?.hub || `${destination} Bus Stand / Intercity Terminal`;
      setDepartureHub(depH);
      setArrivalHub(arrH);
      setTransitRef("Intercity AC Sleeper Bus");
      setReturnDepartureLocation(arrH);
      setReturnArrivalLocation(depH);
      setReturnTicketRef("Intercity AC Sleeper Bus (Return)");
      if (!departureTime) setDepartureTime("07:00");
    } else if (modeId === "Car") {
      const driveMode = recModes.find((m: any) => m.transportType === "Drive" || m.transportType === "Car");
      const depH = driveMode?.departure?.hub || `${originCity || "Origin"} (Self-drive / Private Cab)`;
      const arrH = driveMode?.arrival?.hub || `${destination} City Center`;
      setDepartureHub(depH);
      setArrivalHub(arrH);
      setTransitRef("Personal Vehicle / Private Taxi");
      setReturnDepartureLocation(`${destination} (Self-drive / Private Cab)`);
      setReturnArrivalLocation(`${originCity || "Origin"} City Center`);
      setReturnTicketRef("Personal Vehicle / Private Taxi (Return)");
      setOutboundBooked(false);
      setReturnBooked(false);
      if (!departureTime) setDepartureTime("06:30");
    } else if (modeId === "Ferry") {
      const ferryMode = recModes.find((m: any) => m.transportType === "Ferry");
      const depH = ferryMode?.departure?.hub || `${originCity || "Origin"} Passenger Ferry Terminal`;
      const arrH = ferryMode?.arrival?.hub || `${destination} Ferry Terminal / Pier`;
      setDepartureHub(depH);
      setArrivalHub(arrH);
      setTransitRef("Passenger Ferry / Catamaran");
      setReturnDepartureLocation(arrH);
      setReturnArrivalLocation(depH);
      setReturnTicketRef("Passenger Ferry (Return)");
    }
  };

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
    if (step === 3) return true; // Step 3: Stay & Leaving Prices
    if (step === 4) {
      if (budget === "") return false;
      const b = parseInt(budget);
      if (isNaN(b) || b < 100) return false;
      return true;
    }
    return true; // Step 5 (Interests) and Step 6 (Review)
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
      const stayingCost = getStayEstimatedCost(accommodation, tripDays, parseInt(travelers) || 1).total;
      const leavingCost = getLeavingEstimatedCost();
      const res = await apiFetch("/api/ai/budget-feasibility", {
        method: "POST",
        body: JSON.stringify({
          destination: destination.trim(),
          origin: originCity.trim() || undefined,
          userBudget: bNum,
          durationDays: tripDays,
          travelers: parseInt(travelers) || 1,
          accommodationPreference: accommodation || "HOTEL",
          transportCost: leavingCost,
          lastMileCost: Math.min(2500, Math.round(leavingCost * 0.15)),
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
      const stayingCost = getStayEstimatedCost(accommodation, tripDays, parseInt(travelers) || 1).total;
      const leavingCost = getLeavingEstimatedCost();
      const params = new URLSearchParams({
        destination: destination.trim(),
        startDate,
        endDate,
        travelers: travelers || "1",
        accommodation: accommodation || "HOTEL",
        travelMode: travelMode || "Flight",
        transportCost: String(leavingCost),
        stayCost: String(stayingCost),
        origin: originCity.trim() || "Mumbai",
      });
      const res = await apiFetch(`/api/ai/estimate-budget?${params.toString()}`);
      if (res && res.minimumBudget) {
        setMinBudget(res.minimumBudget);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsFetchingBudget(false);
    }
  };

  useEffect(() => {
    if (step === 4) {
      fetchBudgetEstimate();
      if (budget && parseInt(budget) >= 100) {
        fetchBudgetFeasibility(budget);
      }
    }
  }, [step, destination, startDate, endDate, travelers, accommodation, travelMode]);

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
    if (step === 2) {
      fetchTransportResearch();
    }
    if (step === 3) {
      fetchBudgetEstimate();
      if (budget) {
        fetchBudgetFeasibility(budget);
      }
    }
    if (step === 4 && budget) {
      fetchBudgetFeasibility(budget);
    }
    setStep((s) => s + 1);
  };

  const handleDraftTrip = async () => {
    let progressTimer: any = null;
    try {
      setLoading(true);
      setError("");
      setGenerationStatus("loading");
      setGenerationProgress(10);

      // Realistic stage-based progress tracking during AI generation
      progressTimer = setInterval(() => {
        setGenerationProgress((p) => {
          if (p === undefined) return 14;
          if (p < 28) return p + 2.5;
          if (p < 55) return p + 1.8;
          if (p < 82) return p + 1.1;
          if (p < 96) return p + 0.35;
          return p;
        });
      }, 250);

      const outboundLeg = {
        transportType: travelMode || "Flight",
        departureLocation: departureHub || originCity || "",
        arrivalLocation: arrivalHub || destination || "",
        departureDate: outboundDepartureDate || startDate || "",
        arrivalDate: outboundArrivalDate || outboundDepartureDate || startDate || "",
        departureTime: normalizeTimeTo24h(departureTime),
        arrivalTime: normalizeTimeTo24h(arrivalTime),
        transitRef: transitRef.trim(),
        booked: outboundBooked,
        status: (outboundBooked || (departureTime && arrivalTime) || transitRef) ? "CONFIRMED" : "ESTIMATED",
        durationSource: (departureTime && arrivalTime) ? "USER_SPECIFIED" : undefined,
      };

      const returnLeg = hasReturnTravel
        ? {
            transportType: returnTransportType || travelMode || "Flight",
            departureLocation: returnDepartureLocation || destination || "",
            arrivalLocation: returnArrivalLocation || originCity || "",
            departureDate: returnDate || endDate || "",
            arrivalDate: returnArrivalDate || returnDate || endDate || "",
            departureTime: normalizeTimeTo24h(returnTime),
            arrivalTime: normalizeTimeTo24h(returnArrivalTime),
            transitRef: returnTicketRef.trim(),
            booked: returnBooked,
            status: (returnBooked || (returnTime && returnArrivalTime) || returnTicketRef) ? "CONFIRMED" : "ESTIMATED",
            durationSource: (returnTime && returnArrivalTime) ? "USER_SPECIFIED" : undefined,
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
          style: travelPace || style || "Balanced",
          travelPace: travelPace || "Balanced",
          interests,
          experiencePreferences,
          special: special.trim() || undefined,
          createdBy: user?.uid || "guest",
        }),
      });

      if (progressTimer) clearInterval(progressTimer);

      queryClient.invalidateQueries({ queryKey: queryKeys.trips() });
      queryClient.setQueryData(queryKeys.tripDetails(tripData._id), tripData);

      // Trigger fluid 100% completion & green checkmark animation
      setGenerationStatus("success");
      setGenerationProgress(100);

      // Smooth settling and animated checkmark display before navigation
      setTimeout(() => {
        nav({ to: `/trips/${tripData._id}` });
      }, 1200);
    } catch (err: any) {
      if (progressTimer) clearInterval(progressTimer);
      console.error("Trip generation error:", err);
      setGenerationStatus("error");
      setError(err.message || "Something went wrong generating your itinerary. Please try again.");
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
                            <DatePicker
                              value={startDate}
                              onChange={(newStart) => {
                                setStartDate(newStart);
                                if (selectedDaysCount && newStart) {
                                  setEndDate(addDaysToDate(newStart, selectedDaysCount - 1));
                                }
                              }}
                              placeholder="Pick departure date"
                              className="w-full sm:w-48"
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
                              <DatePicker
                                value={startDate}
                                onChange={setStartDate}
                                placeholder="Select start date"
                                className="mt-1.5 h-11 rounded-xl"
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-medium">Trip End Date</Label>
                              <DatePicker
                                value={endDate}
                                onChange={setEndDate}
                                placeholder="Select end date"
                                className="mt-1.5 h-11 rounded-xl"
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
                    <DatePicker
                      value={startDate}
                      onChange={(newStart) => {
                        setStartDate(newStart);
                        setDurationMode("CUSTOM");
                      }}
                      placeholder="Start date"
                      className="mt-1.5 h-12 rounded-xl"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium">End date</Label>
                    <DatePicker
                      value={endDate}
                      onChange={(newEnd) => {
                        setEndDate(newEnd);
                        setDurationMode("CUSTOM");
                      }}
                      placeholder="End date"
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
            {/* ── Step 3: Stay & Leaving Prices ── */}
            {step === 3 && (
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-foreground">Choose Accommodation & Analyze Leaving Prices</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Select your stay option and evaluate departure travel costs before setting your total budget.
                      </p>
                    </div>
                    <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 text-xs">
                      Step 4 of 7
                    </Badge>
                  </div>
                </div>

                {/* ── Section 1: Choose Stay Option ── */}
                <div className="space-y-3 rounded-2xl border border-border/80 bg-background/60 p-4 md:p-5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Bed className="h-4 w-4 text-primary" /> 1. Where will you stay in {destination}?
                    </Label>
                    <span className="text-[11px] text-muted-foreground">Selectable Choice</span>
                  </div>

                  <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                    {ACCOMMODATION_OPTIONS.map((t) => {
                      const isSelected = accommodation === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setAccommodation(t.id)}
                          className={cn(
                            "rounded-xl border p-3.5 text-left transition-all flex flex-col justify-between cursor-pointer",
                            isSelected
                              ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/40"
                              : "border-border bg-background/80 hover:border-primary/40"
                          )}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-base">{t.icon}</span>
                              {t.isFree ? (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-emerald-500/40 text-emerald-700 bg-emerald-500/10 font-bold">
                                  ₹0 Free Stay
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-border/80 text-muted-foreground">
                                  Commercial
                                </Badge>
                              )}
                            </div>
                            <p className="font-semibold text-xs text-foreground mt-2">{t.title}</p>
                            <p className="mt-1 text-[11px] text-muted-foreground leading-normal">{t.desc}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Personal Stays Special Highlight */}
                  {(accommodation === "OWN_HOME" || accommodation === "NATIVE_HOME" || accommodation === "RELATIVES_HOME") && (
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-900 dark:text-emerald-200 flex items-start gap-2.5">
                      <span className="text-lg">🏡</span>
                      <div className="space-y-0.5">
                        <p className="font-bold text-emerald-950 dark:text-emerald-100">
                          Zero Lodging Expense Applied (Personal Stay)
                        </p>
                        <p className="text-[11px] opacity-90 leading-relaxed">
                          Staying at your own home, ancestral native village, or with relatives/friends incurs <strong>₹0 commercial accommodation expense</strong>. Your trip budget will be preserved entirely for transport, sightseeing, dining, and shopping.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Optional Stay Details */}
                  <div className="pt-2 grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label className="text-xs">Hotel / Residence name (optional)</Label>
                      <Input
                        value={hotelName}
                        onChange={(e) => setHotelName(e.target.value)}
                        className="mt-1 h-9 rounded-lg text-xs"
                        placeholder={
                          accommodation === "OWN_HOME" || accommodation === "RELATIVES_HOME" || accommodation === "NATIVE_HOME"
                            ? "e.g. Uncle's flat / Family residence"
                            : "e.g. Taj Fort Aguada / Radisson Blu"
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Locality / Area (optional)</Label>
                      <Input
                        value={hotelLocation}
                        onChange={(e) => setHotelLocation(e.target.value)}
                        className="mt-1 h-9 rounded-lg text-xs"
                        placeholder={destination ? `e.g. Central ${destination}` : "e.g. Near City Center"}
                      />
                    </div>
                  </div>
                </div>

                {/* ── Section 2: Analyze the Prices of Leaving ── */}
                {(() => {
                  const ActiveModeIcon =
                    travelMode === "Train"
                      ? Train
                      : travelMode === "Bus"
                      ? Bus
                      : travelMode === "Car"
                      ? Car
                      : travelMode === "Ferry"
                      ? Ship
                      : Plane;
                  const activeModeLabel =
                    travelMode === "Car"
                      ? "Drive / Road Trip"
                      : travelMode === "Flight"
                      ? "Flight"
                      : travelMode === "Train"
                      ? "Train"
                      : travelMode === "Bus"
                      ? "Bus"
                      : "Ferry";

                  const displayedModes: Array<{
                    id: string;
                    icon: any;
                    label: string;
                    modeData: any;
                  }> =
                    transportResearchData?.recommendedModes?.length > 0
                      ? transportResearchData.recommendedModes.map((m: any) => {
                          const type = m.transportType;
                          const icon =
                            type === "Train"
                              ? Train
                              : type === "Flight"
                              ? Plane
                              : type === "Bus"
                              ? Bus
                              : type === "Drive" || type === "Car"
                              ? Car
                              : Ship;
                          const label = type === "Drive" ? "Car / Drive" : type;
                          const id = type === "Drive" ? "Car" : type;
                          return { id, icon, label, modeData: m };
                        })
                      : [
                          { id: "Flight", icon: Plane, label: "Flight", modeData: null },
                          { id: "Train", icon: Train, label: "Train", modeData: null },
                          { id: "Bus", icon: Bus, label: "Bus", modeData: null },
                          { id: "Car", icon: Car, label: "Car / Drive", modeData: null },
                        ];

                  return (
                    <div className="space-y-4 rounded-2xl border border-border/80 bg-background/60 p-4 md:p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <ActiveModeIcon className="h-4 w-4 text-primary" /> 2. Preferred Travel Mode & Journey Schedule
                          </Label>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Route: <strong>{originCity || "Origin"}</strong> → <strong>{destination}</strong> (~{transportResearchData?.distanceKm || 280} km)
                            <span className="hidden sm:inline opacity-75"> · Select your preferred mode of transport</span>
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          type="button"
                          onClick={fetchTransportResearch}
                          disabled={isFetchingTransport}
                          className="h-7 text-xs text-primary"
                        >
                          <RotateCcw className={cn("h-3 w-3 mr-1", isFetchingTransport && "animate-spin")} />
                          {isFetchingTransport ? "Refreshing..." : "Refresh Durations"}
                        </Button>
                      </div>

                      {/* Multi-modal Price Comparison Cards (strictly genuine modes, no orphan cards) */}
                      <div
                        className={cn(
                          "grid gap-2.5 sm:grid-cols-2",
                          displayedModes.length >= 4 ? "lg:grid-cols-4" : displayedModes.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2"
                        )}
                      >
                        {displayedModes.map(({ id, icon: Icon, label, modeData }) => {
                          const isSelected = travelMode === id;
                          const estDur = modeData?.estimatedDurationHours
                            ? `${modeData.estimatedDurationHours}h`
                            : id === "Flight"
                            ? "≈ 1.1h"
                            : id === "Train"
                            ? "≈ 3.5h"
                            : id === "Bus"
                            ? "≈ 5.5h"
                            : "≈ 4h";

                          return (
                            <button
                              key={id}
                              type="button"
                              onClick={() => handleSelectMode(id)}
                              className={cn(
                                "rounded-xl border p-4 text-left transition-all flex flex-col gap-3 cursor-pointer",
                                isSelected
                                  ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/40"
                                  : "border-border bg-background/80 hover:border-primary/40"
                              )}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className={cn(
                                    "rounded-lg p-1.5",
                                    isSelected ? "bg-primary/15" : "bg-muted/60"
                                  )}>
                                    <Icon className={cn("h-4 w-4", isSelected ? "text-primary" : "text-muted-foreground")} />
                                  </div>
                                  <span className="font-semibold text-sm text-foreground">{label}</span>
                                </div>
                                {isSelected && (
                                  <div className="h-2 w-2 rounded-full bg-primary" />
                                )}
                              </div>
                              <Badge variant="outline" className={cn(
                                "text-[11px] h-5 py-0 w-fit font-medium",
                                isSelected ? "border-primary/40 text-primary bg-primary/5" : "border-border/60 text-muted-foreground"
                              )}>
                                {estDur} journey
                              </Badge>
                            </button>
                          );
                        })}
                      </div>

                      {/* Outbound & Return Journey Schedule Pickers */}
                      <div className="grid gap-4 md:grid-cols-2 pt-2 border-t border-border/40">
                        {/* Outbound Schedule */}
                        <div className="rounded-xl border border-border/70 bg-card p-3.5 space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-semibold text-primary uppercase tracking-wide flex items-center gap-1.5">
                              <ActiveModeIcon className="h-3.5 w-3.5" /> Outbound {activeModeLabel} Schedule
                            </Label>
                            <Badge variant="outline" className="text-[10px] py-0 h-4">
                              {travelMode === "Car" ? "Personal / Cab" : outboundBooked ? "Booked" : "Planned"}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-3 w-3 text-muted-foreground" /> Departure Date
                              </Label>
                              <div className="mt-1">
                                <DatePicker
                                  value={outboundDepartureDate || startDate}
                                  onChange={(d) => {
                                    setOutboundDepartureDate(d);
                                    if (d) setStartDate(d);
                                  }}
                                  placeholder="Departure Date"
                                />
                              </div>
                            </div>
                            <div>
                              <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3 text-muted-foreground" /> Departure Time
                              </Label>
                              <Input
                                type="time"
                                value={departureTime}
                                onChange={(e) => setDepartureTime(e.target.value)}
                                className="mt-1 h-9 rounded-xl text-xs font-mono"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-3 w-3 text-muted-foreground" /> Arrival Date
                              </Label>
                              <div className="mt-1">
                                <DatePicker
                                  value={outboundArrivalDate || outboundDepartureDate || startDate}
                                  onChange={(d) => setOutboundArrivalDate(d)}
                                  placeholder="Arrival Date"
                                />
                              </div>
                            </div>
                            <div>
                              <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3 text-muted-foreground" /> Arrival Time
                              </Label>
                              <Input
                                type="time"
                                value={arrivalTime}
                                onChange={(e) => setArrivalTime(e.target.value)}
                                className="mt-1 h-9 rounded-xl text-xs font-mono"
                              />
                            </div>
                          </div>

                          {/* Hubs & Identifier Inputs */}
                          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/40">
                            <div>
                              <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <Building2 className="h-3 w-3 text-muted-foreground" />
                                {travelMode === "Flight"
                                  ? "Departure Airport"
                                  : travelMode === "Train"
                                  ? "Departure Station"
                                  : travelMode === "Bus"
                                  ? "Boarding Terminal"
                                  : "Starting Location"}
                              </Label>
                              <Input
                                value={departureHub}
                                onChange={(e) => setDepartureHub(e.target.value)}
                                placeholder={
                                  travelMode === "Flight"
                                    ? "e.g. Mumbai (BOM)"
                                    : travelMode === "Train"
                                    ? "e.g. Mumbai Central (MMCT)"
                                    : "e.g. Mumbai"
                                }
                                className="mt-1 h-8 rounded-lg text-xs"
                              />
                            </div>
                            <div>
                              <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <Building2 className="h-3 w-3 text-muted-foreground" />
                                {travelMode === "Flight"
                                  ? "Arrival Airport"
                                  : travelMode === "Train"
                                  ? "Arrival Station"
                                  : travelMode === "Bus"
                                  ? "Drop Terminal"
                                  : "Destination Location"}
                              </Label>
                              <Input
                                value={arrivalHub}
                                onChange={(e) => setArrivalHub(e.target.value)}
                                placeholder={
                                  travelMode === "Flight"
                                    ? `e.g. ${destination} Airport`
                                    : travelMode === "Train"
                                    ? `e.g. ${destination} Junction`
                                    : `e.g. ${destination}`
                                }
                                className="mt-1 h-8 rounded-lg text-xs"
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-3 pt-1">
                            <div className="flex-1">
                              <Input
                                value={transitRef}
                                onChange={(e) => setTransitRef(e.target.value)}
                                placeholder={
                                  travelMode === "Flight"
                                    ? "Flight No (optional, e.g. 6E 213)"
                                    : travelMode === "Train"
                                    ? "Train No / Name (optional, e.g. 20901 Vande Bharat)"
                                    : travelMode === "Car"
                                    ? "Vehicle / Cab Model (optional, e.g. Innova / Swift)"
                                    : "Service name (optional)"
                                }
                                className="h-8 rounded-lg text-xs"
                              />
                            </div>
                            {travelMode !== "Car" && (
                              <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none whitespace-nowrap text-muted-foreground">
                                <input
                                  type="checkbox"
                                  checked={outboundBooked}
                                  onChange={(e) => setOutboundBooked(e.target.checked)}
                                  className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                                />
                                <span>Ticket Confirmed</span>
                              </label>
                            )}
                          </div>
                        </div>

                        {/* Return Schedule */}
                        <div className="rounded-xl border border-border/70 bg-card p-3.5 space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-semibold text-primary uppercase tracking-wide flex items-center gap-1.5">
                              <ActiveModeIcon className="h-3.5 w-3.5 text-primary" /> Return {activeModeLabel} Schedule
                            </Label>
                            <Badge variant="outline" className="text-[10px] py-0 h-4">
                              {travelMode === "Car" ? "Personal / Cab" : returnBooked ? "Booked" : "Planned"}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-3 w-3 text-muted-foreground" /> Return Date
                              </Label>
                              <div className="mt-1">
                                <DatePicker
                                  value={returnDate || endDate}
                                  onChange={(d) => {
                                    setReturnDate(d);
                                    if (d) setEndDate(d);
                                  }}
                                  placeholder="Return Date"
                                />
                              </div>
                            </div>
                            <div>
                              <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3 text-muted-foreground" /> Return Dep. Time
                              </Label>
                              <Input
                                type="time"
                                value={returnTime}
                                onChange={(e) => setReturnTime(e.target.value)}
                                className="mt-1 h-9 rounded-xl text-xs font-mono"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-3 w-3 text-muted-foreground" /> Return Arrival Date
                              </Label>
                              <div className="mt-1">
                                <DatePicker
                                  value={returnArrivalDate || returnDate || endDate}
                                  onChange={(d) => setReturnArrivalDate(d)}
                                  placeholder="Arrival Date"
                                />
                              </div>
                            </div>
                            <div>
                              <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3 text-muted-foreground" /> Return Arr. Time
                              </Label>
                              <Input
                                type="time"
                                value={returnArrivalTime}
                                onChange={(e) => setReturnArrivalTime(e.target.value)}
                                className="mt-1 h-9 rounded-xl text-xs font-mono"
                              />
                            </div>
                          </div>

                          {/* Hubs & Identifier Inputs */}
                          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/40">
                            <div>
                              <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <Building2 className="h-3 w-3 text-muted-foreground" />
                                {travelMode === "Flight"
                                  ? "Return Airport"
                                  : travelMode === "Train"
                                  ? "Return Station"
                                  : travelMode === "Bus"
                                  ? "Boarding Terminal"
                                  : "Start Location"}
                              </Label>
                              <Input
                                value={returnDepartureLocation}
                                onChange={(e) => setReturnDepartureLocation(e.target.value)}
                                placeholder={
                                  arrivalHub ||
                                  (travelMode === "Flight" ? `e.g. ${destination} Airport` : `e.g. ${destination}`)
                                }
                                className="mt-1 h-8 rounded-lg text-xs"
                              />
                            </div>
                            <div>
                              <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <Building2 className="h-3 w-3 text-muted-foreground" />
                                {travelMode === "Flight"
                                  ? "Arrival Airport"
                                  : travelMode === "Train"
                                  ? "Arrival Station"
                                  : travelMode === "Bus"
                                  ? "Drop Terminal"
                                  : "Final Location"}
                              </Label>
                              <Input
                                value={returnArrivalLocation}
                                onChange={(e) => setReturnArrivalLocation(e.target.value)}
                                placeholder={
                                  departureHub ||
                                  (travelMode === "Flight"
                                    ? `e.g. ${originCity || "Origin"} Airport`
                                    : `e.g. ${originCity || "Origin"}`)
                                }
                                className="mt-1 h-8 rounded-lg text-xs"
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-3 pt-1">
                            <div className="flex-1">
                              <Input
                                value={returnTicketRef}
                                onChange={(e) => setReturnTicketRef(e.target.value)}
                                placeholder={
                                  travelMode === "Flight"
                                    ? "Return Flight No (optional)"
                                    : travelMode === "Train"
                                    ? "Return Train No / Name (optional)"
                                    : travelMode === "Car"
                                    ? "Return Vehicle / Cab (optional)"
                                    : "Return Service name (optional)"
                                }
                                className="h-8 rounded-lg text-xs"
                              />
                            </div>
                            {travelMode !== "Car" && (
                              <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none whitespace-nowrap text-muted-foreground">
                                <input
                                  type="checkbox"
                                  checked={returnBooked}
                                  onChange={(e) => setReturnBooked(e.target.checked)}
                                  className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                                />
                                <span>Ticket Confirmed</span>
                              </label>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* ── Section 3: Pre-Budget Price Intelligence Strip ── */}
                <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold text-primary uppercase tracking-wider flex items-center gap-1">
                      <Wallet className="h-3.5 w-3.5" /> Calculated Pre-Trip Expenses ({travelers} pax · {tripDays} days)
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-4 text-xs text-foreground">
                      <span>
                        Leaving & Return Travel: <strong>₹{getLeavingEstimatedCost().toLocaleString("en-IN")}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Stay ({tripDays} nights): <strong>{getStayEstimatedCost(accommodation, tripDays, parseInt(travelers)).label}</strong>
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground">Estimated Baseline Cost</p>
                    <p className="text-base font-bold text-foreground">
                      ₹{(getLeavingEstimatedCost() + getStayEstimatedCost(accommodation, tripDays, parseInt(travelers)).total).toLocaleString("en-IN")}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ── Step 4: Budget ── */}
            {step === 4 && (
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
                                className="mt-2 w-full rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 py-1.5 px-2.5 text-[11px] font-semibold transition-colors flex items-center justify-center gap-1 border border-emerald-500/20 cursor-pointer"
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

            {/* ── Step 5: Interests & Pace ── */}
            {step === 5 && (
              <div className="space-y-8">
                {/* ── Section 1: Travel Pace ── */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <SlidersHorizontal className="h-4 w-4 text-primary" />
                    <Label className="text-sm font-semibold text-foreground">Travel Pace</Label>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">How do you want to experience your trip?</p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {TRAVEL_PACES.map(({ id, label, tagline, desc, density, icon: PaceIcon }) => {
                      const isSelected = travelPace === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => { setTravelPace(id); setStyle(id); }}
                          className={cn(
                            "rounded-2xl border p-4 text-left transition-all cursor-pointer space-y-2",
                            isSelected
                              ? "border-primary bg-primary/10 shadow-md ring-1 ring-primary/40"
                              : "border-border/70 bg-background/80 hover:border-primary/40 hover:bg-muted/30",
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className={cn(
                              "flex h-8 w-8 items-center justify-center rounded-xl",
                              isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                            )}>
                              <PaceIcon className="h-4 w-4" />
                            </div>
                            {isSelected && <Check className="h-4 w-4 text-primary" />}
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-foreground">{label}</p>
                            <p className="text-[11px] font-medium text-primary/80 mt-0.5">{tagline}</p>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                          <span className="inline-block text-[10px] font-semibold bg-muted/60 text-muted-foreground px-2 py-0.5 rounded-full border border-border/60">
                            {density}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ── Section 2: Travel Interests ── */}
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <Label className="text-sm font-semibold text-foreground">Travel Interests</Label>
                    </div>
                    {interests.length > 0 && (
                      <span className="text-[11px] font-semibold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full border border-primary/20 self-start sm:self-auto">
                        {interests.length} selected
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                    Select what you enjoy — the AI will personalize your entire itinerary around these. Pick as many as you like.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                    {TRAVEL_INTERESTS.map(({ id: interestId, icon: Icon }) => {
                      const isOn = interests.includes(interestId);
                      return (
                        <button
                          key={interestId}
                          type="button"
                          onClick={() => toggle(interestId, interests, setInterests)}
                          className={cn(
                            "relative rounded-xl border p-3 text-center transition-all cursor-pointer flex flex-col items-center gap-2 active:scale-95",
                            isOn
                              ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/30"
                              : "border-border/70 bg-background/80 hover:border-primary/40 hover:bg-muted/30",
                          )}
                        >
                          {isOn && (
                            <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                              <Check className="h-2.5 w-2.5" />
                            </span>
                          )}
                          <div className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-lg",
                            isOn ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                          )}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <p className={cn(
                            "text-[11px] font-medium leading-tight text-center",
                            isOn ? "text-foreground" : "text-muted-foreground"
                          )}>
                            {interestId}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ── Section 3: Experience Preferences ── */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Gem className="h-4 w-4 text-primary" />
                    <Label className="text-sm font-semibold text-foreground">Experience Preferences</Label>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                    What kind of experiences do you want the AI to prioritize? All optional.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {EXPERIENCE_PREFERENCES.map(({ id: prefId, label, desc, icon: Icon }) => {
                      const isOn = experiencePreferences.includes(prefId);
                      return (
                        <button
                          key={prefId}
                          type="button"
                          onClick={() => toggle(prefId, experiencePreferences, setExperiencePreferences)}
                          className={cn(
                            "rounded-xl border p-3.5 text-left transition-all cursor-pointer flex items-start gap-3 active:scale-[0.98]",
                            isOn
                              ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/30"
                              : "border-border/70 bg-background/80 hover:border-primary/40 hover:bg-muted/20",
                          )}
                        >
                          <div className={cn(
                            "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                            isOn ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                          )}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className={cn("text-xs font-semibold", isOn ? "text-foreground" : "text-foreground/80")}>{label}</p>
                              {isOn && <Check className="h-3 w-3 text-primary shrink-0" />}
                            </div>
                            <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">{desc}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ── Section 4: Locality & Experiential Highlights ── */}
                {localityInterestsList.length > 0 && (
                  <div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary" />
                        <Label className="text-sm font-semibold text-foreground">Local Highlights for {destination || "Destination"}</Label>
                      </div>
                      <span className="text-[11px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20 self-start sm:self-auto">
                        Destination-curated
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                      Specific local experiences, street food, and cultural highlights curated for your destination:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {localityInterestsList.map((c) => {
                        const on = interests.includes(c);
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => toggle(c, interests, setInterests)}
                            className={cn(
                              "rounded-full border px-3.5 py-1.5 text-xs sm:text-sm transition-all cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95",
                              on
                                ? "border-primary bg-primary text-primary-foreground font-semibold ring-2 ring-primary/30"
                                : "border-border/80 bg-background/80 hover:border-primary/50 hover:bg-muted/40 text-foreground",
                            )}
                          >
                            {on && <Check className="h-3 w-3" />}
                            {c}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── Section 5: Special Notes ── */}
                <div>
                  <Label className="text-xs font-medium text-foreground">Anything special or specific notes?</Label>
                  <Textarea
                    value={special}
                    onChange={(e) => setSpecial(e.target.value)}
                    className="mt-1.5 min-h-20 rounded-xl text-sm"
                    placeholder="e.g. Traveling with elderly parents, celebrating an anniversary, pure vegetarian food…"
                  />
                </div>
              </div>
            )}

            {/* ── Step 6: Review & Generate ── */}
            {step === 6 && (
              <div className="space-y-5">
                <div className="rounded-2xl glass-tile p-5 flex flex-wrap items-center justify-between gap-4 border border-primary/20 bg-primary/5">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Trip Route</p>
                    <p className="text-xl font-semibold tracking-tight text-foreground">
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
                    <p className="mt-1 text-sm font-semibold">{travelPace || style || "Balanced"} Pace</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {travelPace === "Relaxed" ? "2–3 stops / day" : travelPace === "Packed" ? "4–6 stops / day" : "3–4 stops / day"}
                    </p>
                  </div>

                  {/* Accommodation Summary */}
                  <div className="rounded-xl glass-tile p-4">
                    <p className="text-xs text-muted-foreground">Accommodation</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {accommodation === "OWN_HOME" || accommodation === "NATIVE_HOME" || accommodation === "RELATIVES_HOME" ? (
                        <span className="text-emerald-700 dark:text-emerald-300 font-bold">
                          {accommodation === "OWN_HOME" ? "Own Home" : accommodation === "NATIVE_HOME" ? "Native Village" : "Relatives' Home"} (₹0 Free Stay)
                        </span>
                      ) : accommodation ? (
                        ACCOMMODATION_OPTIONS.find((a) => a.id === accommodation)?.title || accommodation
                      ) : (
                        "AI Recommended"
                      )}
                    </p>
                    {hotelName && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {hotelName} {hotelLocation ? `(${hotelLocation})` : ""}
                      </p>
                    )}
                  </div>

                  {travelMode && (() => {
                    const OutboundIcon =
                      travelMode === "Train"
                        ? Train
                        : travelMode === "Bus"
                        ? Bus
                        : travelMode === "Car"
                        ? Car
                        : travelMode === "Ferry"
                        ? Ship
                        : Plane;
                    const outLabel = transitRef
                      ? (transitRef.toLowerCase().includes(travelMode.toLowerCase()) ? transitRef : `${transitRef} (${travelMode})`)
                      : travelMode;
                    return (
                      <div className="rounded-xl glass-tile p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted-foreground font-semibold flex items-center gap-1.5 uppercase tracking-wide">
                            <OutboundIcon className="h-3.5 w-3.5 text-primary" /> Outbound Travel
                          </p>
                          <Badge variant="outline" className="text-[10px] py-0 h-4">
                            {travelMode === "Car" ? "Personal / Cab" : outboundBooked ? "✓ Confirmed" : "≈ Estimated"}
                          </Badge>
                        </div>
                        <p className="text-sm font-semibold text-foreground">
                          {outLabel}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Route: <strong>{departureHub || originCity || "Origin"}</strong> → <strong>{arrivalHub || destination || "Destination"}</strong>
                        </p>
                        <div className="pt-1 text-[11px] font-mono text-muted-foreground border-t border-border/40">
                          <span>Dep: {outboundDepartureDate || startDate} {departureTime ? `@ ${departureTime}` : ""}</span>
                          <span className="mx-1.5">·</span>
                          <span>Arr: {outboundArrivalDate || outboundDepartureDate || startDate} {arrivalTime ? `@ ${arrivalTime}` : ""}</span>
                        </div>
                      </div>
                    );
                  })()}

                  {hasReturnTravel && (() => {
                    const effReturnMode = returnTransportType || travelMode || "Transit";
                    const ReturnIcon =
                      effReturnMode === "Train"
                        ? Train
                        : effReturnMode === "Bus"
                        ? Bus
                        : effReturnMode === "Car"
                        ? Car
                        : effReturnMode === "Ferry"
                        ? Ship
                        : Plane;
                    const retLabel = returnTicketRef
                      ? (returnTicketRef.toLowerCase().includes(effReturnMode.toLowerCase()) ? returnTicketRef : `${returnTicketRef} (${effReturnMode})`)
                      : `${effReturnMode} (Return)`;
                    return (
                      <div className="rounded-xl glass-tile p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted-foreground font-semibold flex items-center gap-1.5 uppercase tracking-wide">
                            <ReturnIcon className="h-3.5 w-3.5 text-primary" /> Return Travel
                          </p>
                          <Badge variant="outline" className="text-[10px] py-0 h-4">
                            {effReturnMode === "Car" ? "Personal / Cab" : returnBooked ? "✓ Confirmed" : "≈ Estimated"}
                          </Badge>
                        </div>
                        <p className="text-sm font-semibold text-foreground">
                          {retLabel}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Route: <strong>{returnDepartureLocation || destination || "Destination"}</strong> → <strong>{returnArrivalLocation || originCity || "Home"}</strong>
                        </p>
                        <div className="pt-1 text-[11px] font-mono text-muted-foreground border-t border-border/40">
                          <span>Dep: {returnDate || endDate} {returnTime ? `@ ${returnTime}` : ""}</span>
                          <span className="mx-1.5">·</span>
                          <span>Arr: {returnArrivalDate || returnDate || endDate} {returnArrivalTime ? `@ ${returnArrivalTime}` : ""}</span>
                        </div>
                      </div>
                    );
                  })()}

                  {interests.length > 0 && (
                    <div className="rounded-xl glass-tile p-4 sm:col-span-2">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Interests & Preferences</p>
                        <button
                          type="button"
                          onClick={() => setStep(5)}
                          className="text-[11px] text-primary font-medium hover:underline"
                        >
                          Edit Preferences
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {interests.map((i) => (
                          <Badge key={i} variant="secondary" className="text-[11px]">
                            {i}
                          </Badge>
                        ))}
                      </div>
                      {experiencePreferences.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-2 border-t border-border/40">
                          {experiencePreferences.map((p) => (
                            <Badge key={p} variant="outline" className="text-[11px] border-primary/30 text-primary bg-primary/5">
                              {p}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {interests.length === 0 && experiencePreferences.length > 0 && (
                    <div className="rounded-xl glass-tile p-4 sm:col-span-2">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Experience Preferences</p>
                        <button
                          type="button"
                          onClick={() => setStep(5)}
                          className="text-[11px] text-primary font-medium hover:underline"
                        >
                          Edit Preferences
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {experiencePreferences.map((p) => (
                          <Badge key={p} variant="outline" className="text-[11px] border-primary/30 text-primary bg-primary/5">
                            {p}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

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
                  <TripGenerationLoader
                    loading={loading}
                    origin={departureHub || originCity || "Your Origin"}
                    destination={arrivalHub || destination || "Destination"}
                    travelMode={travelMode || "Train"}
                    customProgress={generationProgress}
                    status={generationStatus}
                  />
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
