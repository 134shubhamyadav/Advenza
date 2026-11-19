import { apiFetch } from "../lib/api";
import type { DestinationOverview, TripSummary } from "../types/trip";

export * from "../types/trip";

export async function fetchDestinationOverview(
  destination: string,
  interests: string[] = []
): Promise<DestinationOverview> {
  const params = new URLSearchParams({ destination });
  if (interests.length > 0) params.set("interests", interests.join(","));
  return apiFetch(`/api/ai/destination-overview?${params.toString()}`);
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
   * Delete a trip
   */
  async deleteTrip(tripId: string): Promise<{ message: string }> {
    return apiFetch(`/api/trips/${tripId}`, {
      method: "DELETE",
    });
  },

  /**
   * Add expense to a trip
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
   * Vote on an option
   */
  async voteOption(tripId: string, optionIndex: number): Promise<TripSummary> {
    return apiFetch(`/api/trips/${tripId}/vote`, {
      method: "POST",
      body: JSON.stringify({ optionIndex }),
    });
  },

  /**
   * Invite member
   */
  async inviteMember(
    tripId: string,
    member: { name: string; email: string; role?: string }
  ): Promise<TripSummary> {
    return apiFetch(`/api/trips/${tripId}/invite`, {
      method: "POST",
      body: JSON.stringify(member),
    });
  },

  /**
   * Download offline PDF/itinerary bundle
   */
  async downloadOffline(tripId: string): Promise<Blob> {
    const res = await fetch(`/api/trips/${tripId}/offline`);
    if (!res.ok) throw new Error("Offline download failed");
    return res.blob();
  },
};
