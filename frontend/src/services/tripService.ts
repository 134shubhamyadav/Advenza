import { apiFetch } from "../lib/api";

export interface TripActivity {
  time: string;
  description: string;
  type?: string;
  meta?: string;
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
  name: string;
  email?: string;
  role?: string;
  initials?: string;
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

export interface TripSummary {
  _id: string;
  title: string;
  destination?: string;
  summary?: string;
  budgetEstimate?: string;
  budgetBreakdown?: BudgetBreakdown;
  heroImage?: HeroImage;
  budgetTotal?: number;
  travelers?: number;
  startDate?: string;
  endDate?: string;
  days?: TripDay[];
  expenses?: TripExpense[];
  members?: TripMember[];
  voteOptions?: TripVoteOption[];
  createdBy?: string;
}

export const tripService = {
  /**
   * Fetch all trips for the authenticated user
   */
  async getTrips(): Promise<TripSummary[]> {
    return apiFetch("/api/trips");
  },

  /**
   * Fetch a single trip by ID
   */
  async getTripById(tripId: string): Promise<TripSummary> {
    return apiFetch(`/api/trips/${tripId}`);
  },

  /**
   * Update a trip (e.g. title, destination, dates)
   */
  async updateTrip(tripId: string, updates: Partial<TripSummary>): Promise<TripSummary> {
    return apiFetch(`/api/trips/${tripId}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
  },

  /**
   * Fetch destination image
   */
  async getDestinationImage(destination: string): Promise<HeroImage> {
    return apiFetch(`/api/media/destination-image?destination=${encodeURIComponent(destination)}`);
  },

  /**
   * Delete a trip by ID
   */
  async deleteTrip(tripId: string): Promise<{ message: string }> {
    return apiFetch(`/api/trips/${tripId}`, { method: "DELETE" });
  },

  /**
   * Add an expense to a trip
   */
  async addExpense(
    tripId: string,
    expense: { name: string; amount: number; category?: string; date?: string }
  ): Promise<TripSummary> {
    return apiFetch(`/api/trips/${tripId}/expenses`, {
      method: "POST",
      body: JSON.stringify(expense),
    });
  },

  /**
   * Invite a member to a trip
   */
  async inviteMember(tripId: string, email: string, name?: string): Promise<TripSummary> {
    return apiFetch(`/api/trips/${tripId}/members`, {
      method: "POST",
      body: JSON.stringify({ email, name }),
    });
  },

  /**
   * Cast a vote for a trip option
   */
  async castVote(tripId: string, optionName: string, uid?: string): Promise<TripSummary> {
    return apiFetch(`/api/trips/${tripId}/vote`, {
      method: "POST",
      body: JSON.stringify({ optionName, uid }),
    });
  },

  /**
   * Smart-patch itinerary days
   */
  async updateItineraryDays(tripId: string, days: TripDay[]): Promise<TripSummary> {
    return apiFetch(`/api/trips/${tripId}/itinerary`, {
      method: "PUT",
      body: JSON.stringify({ days }),
    });
  },
};
