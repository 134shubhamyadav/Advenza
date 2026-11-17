import { logger } from "../../../utils/logger.js";
import { z } from "zod";

export const ACCOMMODATION_TYPES = {
  OWN_HOME: "OWN_HOME", // Own residence / relative's home: ₹0
  BUDGET: "BUDGET", // Hostels, homestays, guesthouses
  HOTEL: "HOTEL", // Standard 3-4 star hotel
  RESORT: "RESORT", // Luxury resort, 5-star, boutique heritage stay
  AI_RECOMMENDED: "AI_RECOMMENDED", // Best value balanced selection
};

export const AccommodationResultSchema = z.object({
  preference: z.string(),
  isFreeAccommodation: z.boolean(),
  costPerNightINR: z.number(),
  numberOfNights: z.number(),
  roomsNeeded: z.number(),
  totalAccommodationCostINR: z.number(),
  tierDescription: z.string(),
  suggestedAreas: z.array(z.string()).default([]),
  notes: z.string(),
});

export class AccommodationAgent {
  constructor() {
    this.name = "Accommodation Intelligence Agent";
  }

  /**
   * Evaluates accommodation costs and recommendations based on user preference, destination, and travelers.
   */
  async evaluate({
    destination,
    preference = ACCOMMODATION_TYPES.AI_RECOMMENDED,
    nights = 3,
    travelers = 1,
    customHotelName = null,
  }) {
    const rawDest = String(destination || "").trim();
    const effectiveNights = Math.max(1, Number(nights) || 1);
    const effectiveTravelers = Math.max(1, Number(travelers) || 1);
    const roomsNeeded = Math.ceil(effectiveTravelers / 2);

    const normPref = String(preference || "").toUpperCase().replace(/[\s-]/g, "_");
    logger.info(`[${this.name}] Calculating stay for "${rawDest}": ${normPref}, ${effectiveNights} nights, ${effectiveTravelers} pax (${roomsNeeded} rooms)`);

    // 1. Own Home / Relative's Home -> Guaranteed ₹0
    if (
      normPref.includes("OWN") ||
      normPref.includes("RELATIVE") ||
      normPref.includes("FAMILY") ||
      normPref.includes("HOME") ||
      normPref === ACCOMMODATION_TYPES.OWN_HOME
    ) {
      return AccommodationResultSchema.parse({
        preference: ACCOMMODATION_TYPES.OWN_HOME,
        isFreeAccommodation: true,
        costPerNightINR: 0,
        numberOfNights: effectiveNights,
        roomsNeeded: 0,
        totalAccommodationCostINR: 0,
        tierDescription: "Own Residence / Relative's Home (Zero commercial lodging expense)",
        suggestedAreas: ["Host Residence Area"],
        notes: "No accommodation expense charged as you are staying at your own place or with family/relatives.",
      });
    }

    // 2. Commercial lodging calculation based on tier
    let costPerNightPerRoom = 4000; // default mid-range
    let tierDesc = "Mid-range Hotel (3–4 Star)";
    let areas = ["Central City", "City Center"];

    if (normPref.includes("BUDGET") || normPref.includes("HOSTEL") || normPref.includes("GUESTHOUSE")) {
      costPerNightPerRoom = 1500;
      tierDesc = "Budget Stay / Backpackers Hostel / Verified Homestay";
      areas = ["Backpacker Hub", "Transit Corridor"];
    } else if (normPref.includes("RESORT") || normPref.includes("LUXURY") || normPref.includes("HERITAGE") || normPref.includes("5_STAR")) {
      costPerNightPerRoom = 11000;
      tierDesc = "Premium Resort / 5-Star Luxury / Heritage Palace";
      areas = ["Scenic Waterfront", "Historic Quarter", "Private Bay"];
    } else if (normPref.includes("HOTEL") || normPref.includes("MID")) {
      costPerNightPerRoom = 4200;
      tierDesc = "Standard 3–4 Star Comfort Hotel with Breakfast";
      areas = ["City Center", "Commercial Hub"];
    } else {
      // AI Recommended: Balanced value
      costPerNightPerRoom = 3800;
      tierDesc = "AI Value-Optimized Stay (High rating, centrally located)";
      areas = ["Accessible central district with dining"];
    }

    const totalCost = costPerNightPerRoom * effectiveNights * roomsNeeded;

    return AccommodationResultSchema.parse({
      preference: normPref,
      isFreeAccommodation: false,
      costPerNightINR: costPerNightPerRoom,
      numberOfNights: effectiveNights,
      roomsNeeded,
      totalAccommodationCostINR: totalCost,
      tierDescription: tierDesc,
      suggestedAreas: areas,
      notes: customHotelName
        ? `Staying at booked property: ${customHotelName}.`
        : `Calculated for ${roomsNeeded} room(s) over ${effectiveNights} night(s).`,
    });
  }
}

export const accommodationAgent = new AccommodationAgent();
