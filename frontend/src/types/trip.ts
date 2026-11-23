export type PlaceType =
  | "POPULAR_ATTRACTION"
  | "HIDDEN_GEM"
  | "CONFIRMED_HIDDEN_GEM"
  | "POTENTIAL_HIDDEN_GEM"
  | string;

export type GemConfidence =
  | "CONFIRMED_HIDDEN_GEM"
  | "POTENTIAL_HIDDEN_GEM"
  | "POPULAR_ATTRACTION"
  | "UNCLASSIFIED"
  | string;

export type DataClassification =
  | "LIVE_VERIFIED"
  | "CURATED_VERIFIED"
  | "INDICATIVE_ESTIMATE"
  | "SCHEDULED_VERIFIED"
  | "UNAVAILABLE"
  | string;

export interface TripActivity {
  time: string;
  description: string;
  type?: string;
  meta?: string;
  interestTags?: string[];
  placeName?: string;
  placeCategory?: string;
  placeSubcategory?: string;
  address?: string;
  coordinates?: { lat?: number | null; lng?: number | null };
  openingHours?: string;
  verificationStatus?: string;
  suggestedDuration?: string;
  distanceFromPrevious?: string;
  mapLink?: string;
  matchReason?: string;
  isFutureScheduleUnconfirmed?: boolean;
  // Hidden gem & place metadata
  placeType?: PlaceType;
  gemConfidence?: GemConfidence;
  isPlaceHiddenGem?: boolean;
  whySpecial?: string;
  region?: string;
  // Inter-stop transit & provenance
  startLocation?: string;
  travelDistanceKm?: number | null;
  travelDurationMinutes?: number | null;
  travelMode?: string;
  departureTime?: string;
  arrivalTime?: string;
  dataClassification?: DataClassification;
}

export interface DestinationOverviewHighlight {
  name: string;
  category: string;
  region: string;
  matchReason?: string;
  whySpecial?: string;
  gemConfidence?: string;
}

export interface DestinationDurationRecommendation {
  minimumDays: number;
  recommendedDays: number;
  extendedDays: number;
  minRange: string;
  recommendedRange: string;
  extendedRange: string;
  whyRecommended: string;
  popularAttractionsCount: number;
  hiddenGemsCount: number;
  regions: string[];
  dayTrips: string[];
  popularHighlights: DestinationOverviewHighlight[];
  hiddenGemHighlights: DestinationOverviewHighlight[];
  interestAlignmentNote: string | null;
}

export interface DestinationOverview {
  destination: string;
  heroImage: string | null;
  overview: string;
  durationRecommendation: DestinationDurationRecommendation;
  verifiedPlacesCount: number;
  dataConfidence: "VERIFIED" | "LIVE_DISCOVERED" | "PARTIAL_EVIDENCE" | "UNCERTAIN_BASELINE" | string;
  isUncertain?: boolean;
  uncertaintyReason?: string | null;
}

export interface TripDay {
  dayNumber: number;
  date?: string;
  title: string;
  activities: TripActivity[];
}

export interface TripExpense {
  name: string;
  amount: number;
  category?: string;
  date?: string;
}

export interface TripMember {
  _id?: string;
  userId?: string;
  name: string;
  email?: string;
  role?: string;
  initials?: string;
  color?: string;
  joinedAt?: string;
}

export interface TripVoteOption {
  name: string;
  votes: number;
  voters: string[];
}

export interface BudgetCategoryItem {
  category: string;
  label: string;
  description?: string;
  amount: number;
  type?: "ESTIMATED" | "LIVE_PRICE" | "ACTUAL" | "PROJECTED" | string;
}

export interface BudgetBreakdown {
  currency?: string;
  travelers?: number;
  nights?: number;
  categories: BudgetCategoryItem[];
}

export interface HeroImage {
  url: string;
  destination?: string;
  source?: string;
  photographer?: string;
  photographerUrl?: string;
  attributionUrl?: string;
  fetchedAt?: string;
}

export interface JourneyLeg {
  transportType?: string;
  departureLocation?: string;
  arrivalLocation?: string;
  departureDate?: string;
  departureTime?: string;
  arrivalDate?: string;
  arrivalTime?: string;
  durationMinutes?: number | null;
  durationSource?: string;
  transitRef?: string;
  status?: string;
  booked?: boolean;
  ticketRef?: string;
  railwayTimeline?: any;
  stops?: any[];
  dataClassification?: DataClassification;
  // Legacy support fields:
  date?: string;
  time?: string;
}

export interface DayTimingConstraints {
  arrivalDay?: boolean;
  returnDay?: boolean;
  requiresHotelCheckIn?: boolean;
  travelDay?: boolean;
}

export interface DayTimingWindow {
  date?: string;
  status?: string; // "TRAVEL_OUTBOUND" | "ARRIVAL_DAY" | "FULL_DESTINATION_DAY" | "RETURN_DAY" | "TRAVEL_RETURN" | "UNAVAILABLE"
  usableStartDateTime?: string;
  usableEndDateTime?: string;
  availableHours?: number;
  reason?: string;
  constraints?: DayTimingConstraints;
}

export interface TimingConflict {
  hasConflict?: boolean;
  message?: string;
  recommendedDays?: number;
  suggestedEndDate?: string;
}

export interface TripTiming {
  timingConflict?: TimingConflict;
  homeCityDepartureDateTime?: string;
  destinationArrivalDateTime?: string;
  sightseeingStartDate?: string;
  sightseeingEndDate?: string;
  returnDepartureDateTime?: string;
  homeCityArrivalDateTime?: string;
  outbound?: {
    durationMinutes?: number | null;
    isOvernight?: boolean;
    travelDaysCount?: number;
    arrivalDateTime?: string;
  };
  destination?: {
    usableStartDateTime?: string;
    usableEndDateTime?: string;
    totalUsableHours?: number | null;
    days?: DayTimingWindow[];
  };
  return?: {
    durationMinutes?: number | null;
    isOvernight?: boolean;
    travelDaysCount?: number;
    departureDateTime?: string;
  };
}

export interface TripWeather {
  temp?: number;
  condition?: string;
  icon?: string;
  humidity?: number;
  rainChance?: number;
  windSpeed?: number;
  uv?: number;
  note?: string;
}

export interface TripSummary {
  _id: string;
  title: string;
  origin?: string;
  destination?: string;
  summary?: string;
  budgetEstimate?: string;
  budgetBreakdown?: BudgetBreakdown;
  heroImage?: HeroImage;
  budgetTotal?: number;
  travelers?: number;
  startDate?: string;
  endDate?: string;
  duration?: number;
  durationMode?: "RECOMMENDED" | "CUSTOM";
  style?: string;
  interests?: string[];
  travelMode?: string;
  departureHub?: string;
  arrivalHub?: string;
  transitRef?: string;
  departureTime?: string;
  arrivalTime?: string;
  outboundJourney?: JourneyLeg;
  returnJourney?: JourneyLeg;
  tripTiming?: TripTiming;
  weather?: TripWeather;
  hotelName?: string;
  hotelLocation?: string;
  checkInTime?: string;
  checkOutTime?: string;
  days?: TripDay[];
  expenses?: TripExpense[];
  members?: TripMember[];
  voteOptions?: TripVoteOption[];
  createdBy?: string;
}
