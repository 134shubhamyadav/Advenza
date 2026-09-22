import { apiFetch } from "../lib/api";

export interface TripSummary {
  _id: string;
  title: string;
  destination?: string;
  startDate?: string;
  endDate?: string;
  budgetTotal?: number;
  days?: any[];
  expenses?: any[];
  members?: any[];
  voteOptions?: any[];
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
  async updateItineraryDays(tripId: string, days: any[]): Promise<TripSummary> {
    return apiFetch(`/api/trips/${tripId}/itinerary`, {
      method: "PUT",
      body: JSON.stringify({ days }),
    });
  },
};
