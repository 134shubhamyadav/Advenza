import { BaseFlightProvider } from "./base.provider.js";
import { apiClient } from "../../../utils/apiClient.js";
import { logger } from "../../../utils/logger.js";
import { env } from "../../../config/env.js";

// Standard Indian & International Airport IATA Catalog
export const AIRPORT_CODES = {
  mumbai: "BOM",
  bom: "BOM",
  delhi: "DEL",
  del: "DEL",
  "new delhi": "DEL",
  bangalore: "BLR",
  bengaluru: "BLR",
  blr: "BLR",
  goa: "GOI",
  goi: "GOI",
  dabolim: "GOI",
  mopa: "GOX",
  chennai: "MAA",
  maa: "MAA",
  kolkata: "CCU",
  ccu: "CCU",
  hyderabad: "HYD",
  hyd: "HYD",
  kochi: "COK",
  cochin: "COK",
  cok: "COK",
  jaipur: "JAI",
  jai: "JAI",
  ahmedabad: "AMD",
  amd: "AMD",
  srinagar: "SXR",
  sxr: "SXR",
  leh: "IXL",
  ixl: "IXL",
  dubai: "DXB",
  dxb: "DXB",
  singapore: "SIN",
  sin: "SIN",
  bangkok: "BKK",
  bkk: "BKK",
  london: "LHR",
  lhr: "LHR",
  paris: "CDG",
  cdg: "CDG",
  tokyo: "HND",
  hnd: "HND",
  newyork: "JFK",
  jfk: "JFK",
};

export function resolveAirportCode(str) {
  if (!str) return "BOM";
  const clean = str.trim().toLowerCase().split(",")[0].trim();
  if (clean.length === 3 && AIRPORT_CODES[clean]) return AIRPORT_CODES[clean];
  if (AIRPORT_CODES[clean]) return AIRPORT_CODES[clean];
  if (clean.length === 3) return clean.toUpperCase();
  return clean.slice(0, 3).toUpperCase();
}

export class FlightProvider extends BaseFlightProvider {
  constructor() {
    super("AmadeusAviationProvider");
    this.clientId = env.AMADEUS_CLIENT_ID || null;
    this.clientSecret = env.AMADEUS_CLIENT_SECRET || null;
    this.hostname = env.AMADEUS_HOSTNAME || "test.api.amadeus.com";
    this.cachedToken = null;
    this.tokenExpiresAt = 0;
  }

  /**
   * Check if credentials are fully configured.
   */
  isConfigured() {
    return Boolean(this.clientId && this.clientSecret);
  }

  /**
   * Check provider availability.
   */
  async checkAvailability() {
    if (!this.isConfigured()) {
      return {
        provider: "Amadeus Travel API",
        status: "NOT_CONFIGURED",
        isLive: false,
        message: "Amadeus credentials not configured (AMADEUS_CLIENT_ID / AMADEUS_CLIENT_SECRET).",
      };
    }

    try {
      const token = await this.getAmadeusToken();
      return {
        provider: "Amadeus Travel API",
        status: token ? "HEALTHY" : "DEGRADED",
        isLive: Boolean(token),
        message: token ? "Amadeus API connected and authenticated." : "Amadeus authentication failed.",
      };
    } catch (err) {
      return {
        provider: "Amadeus Travel API",
        status: "UNAVAILABLE",
        isLive: false,
        message: `Amadeus probe error: ${err.message}`,
      };
    }
  }

  /**
   * Authenticate with Amadeus Self-Service OAuth2 using apiClient with token caching.
   */
  async getAmadeusToken() {
    if (!this.isConfigured()) return null;
    if (this.cachedToken && Date.now() < this.tokenExpiresAt - 60000) {
      return this.cachedToken;
    }

    try {
      const url = `https://${this.hostname}/v1/security/oauth2/token`;
      const res = await apiClient.request(url, {
        method: "POST",
        provider: "AmadeusAuth",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: this.clientId,
          client_secret: this.clientSecret,
        }),
        timeoutMs: 6000,
        maxRetries: 2,
      });

      const data = await res.json();
      if (!data.access_token) {
        throw new Error("No access_token returned by Amadeus OAuth.");
      }

      this.cachedToken = data.access_token;
      this.tokenExpiresAt = Date.now() + (data.expires_in || 1799) * 1000;
      logger.info("[FlightProvider] Successfully acquired Amadeus OAuth token.");
      return this.cachedToken;
    } catch (err) {
      logger.warn(`[FlightProvider] Amadeus Auth failed: ${err.message}`);
      return null;
    }
  }

  /**
   * Search Flights.
   * If credentials are missing, returns structured NOT_CONFIGURED state without fabricating fake data.
   */
  async searchFlights({
    origin,
    destination,
    departureDate,
    returnDate = null,
    passengers = 1,
    cabin = "ECONOMY",
  }) {
    const origCode = resolveAirportCode(origin);
    const destCode = resolveAirportCode(destination);
    const dateStr = departureDate || new Date(Date.now() + 86400000 * 3).toISOString().split("T")[0];

    // If not configured, strictly report NOT_CONFIGURED
    if (!this.isConfigured()) {
      return {
        provider: "Amadeus Travel API",
        configured: false,
        status: "NOT_CONFIGURED",
        isLive: false,
        message: "Amadeus Travel API is not configured. Set AMADEUS_CLIENT_ID and AMADEUS_CLIENT_SECRET in .env to activate live flight search.",
        lastUpdated: new Date().toISOString(),
        currency: "INR",
        results: [],
      };
    }

    const token = await this.getAmadeusToken();
    if (!token) {
      return {
        provider: "Amadeus Travel API",
        configured: true,
        status: "UNAVAILABLE",
        isLive: false,
        message: "Unable to authenticate with Amadeus Travel API. Check credentials or network connectivity.",
        lastUpdated: new Date().toISOString(),
        currency: "INR",
        results: [],
      };
    }

    try {
      let amadeusUrl = `https://${this.hostname}/v2/shopping/flight-offers?originLocationCode=${origCode}&destinationLocationCode=${destCode}&departureDate=${dateStr}&adults=${passengers}&travelClass=${cabin}&currencyCode=INR&max=15`;
      if (returnDate) {
        amadeusUrl += `&returnDate=${returnDate}`;
      }

      const res = await apiClient.request(amadeusUrl, {
        provider: "AmadeusFlightOffers",
        headers: { Authorization: `Bearer ${token}` },
        timeoutMs: 10000,
        maxRetries: 2,
      });

      const data = await res.json();
      if (!Array.isArray(data.data) || data.data.length === 0) {
        return {
          provider: "Amadeus Travel API",
          configured: true,
          status: "LIVE",
          isLive: true,
          lastUpdated: new Date().toISOString(),
          currency: "INR",
          results: [],
          message: `No commercial flights found between ${origCode} and ${destCode} for ${dateStr}.`,
        };
      }

      const results = data.data.map((offer, idx) => {
        const itinerary = offer.itineraries?.[0];
        const segment = itinerary?.segments?.[0];
        const lastSegment = itinerary?.segments?.[itinerary.segments.length - 1];
        const priceTotal = Math.round(parseFloat(offer.price?.total || "0"));

        return {
          provider: "Amadeus Travel API",
          offerId: offer.id || `ama_${idx}`,
          airline: segment?.carrierCode || "Commercial Airline",
          airlineCode: segment?.carrierCode || "XX",
          flightNumber: `${segment?.carrierCode || "XX"}-${segment?.number || "100"}`,
          origin: segment?.departure?.iataCode || origCode,
          destination: lastSegment?.arrival?.iataCode || destCode,
          departureTime: segment?.departure?.at || `${dateStr}T08:00:00`,
          arrivalTime: lastSegment?.arrival?.at || `${dateStr}T10:15:00`,
          duration: (itinerary?.duration || "PT2H15M").replace("PT", "").toLowerCase(),
          stops: (itinerary?.segments?.length || 1) - 1,
          price: priceTotal,
          currency: offer.price?.currency || "INR",
          refundable: Boolean(offer.pricingOptions?.refundableFare),
          baggage: "Checked Baggage Included per airline fare class",
          isLive: true,
          lastUpdated: new Date().toISOString(),
        };
      });

      return {
        provider: "Amadeus Travel API",
        configured: true,
        status: "LIVE",
        isLive: true,
        lastUpdated: new Date().toISOString(),
        currency: "INR",
        results,
      };
    } catch (err) {
      logger.error(`[FlightProvider] Live Amadeus query failed: ${err.message}`);
      return {
        provider: "Amadeus Travel API",
        configured: true,
        status: "UNAVAILABLE",
        isLive: false,
        message: `Amadeus search error: ${err.message}`,
        lastUpdated: new Date().toISOString(),
        currency: "INR",
        results: [],
      };
    }
  }
}

export const flightProvider = new FlightProvider();
export default flightProvider;
