import { osrmRoutingService } from "./osrm-routing.service.js";
import { flightProvider, resolveAirportCode } from "./providers/flight.provider.js";
import { airportLookupService } from "./airport-lookup.service.js";
import { weatherProvider } from "./providers/weather.provider.js";
import { logger } from "../../utils/logger.js";

/**
 * Universal City Name Sanitizer
 * Removes noise words, country suffixes, state names, and parenthetical codes
 * e.g., "SURAT, INDIA" -> "Surat", "Mumbai (BOM)" -> "Mumbai", "New Delhi, Delhi" -> "New Delhi"
 */
export function cleanCityName(str) {
  if (!str) return "";
  let clean = String(str).trim();
  // Strip trailing country name (e.g., ", India", ", IN")
  clean = clean.replace(/,\s*(india|in|ind|united states|usa|uk|uae)\s*$/i, "");
  // Strip parenthetical text (e.g., "(BOM)", "(CSMT)", "(IGI Airport)")
  clean = clean.replace(/\s*\([^)]*\)/g, "");
  // If comma separated (e.g. "Surat, Gujarat"), take the primary city part
  if (clean.includes(",")) {
    const parts = clean.split(",").map((p) => p.trim()).filter(Boolean);
    clean = parts[0] || clean;
  }
  // Trim and normalize whitespace
  clean = clean.replace(/\s+/g, " ").trim();
  // Title-case first letter of each word
  return clean
    .split(" ")
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ""))
    .join(" ");
}

/**
 * Verified Geolocation Catalog for Popular Tourist Destinations & Hill Stations
 * (Covers key destinations that may not possess a dedicated commercial primary airport)
 */
const POPULAR_DESTINATIONS_GEO = {
  manali: { name: "Manali", lat: 32.2432, lon: 77.1892, railHub: "Chandigarh Junction (CDG) / Ambala" },
  ooty: { name: "Ooty (Udhagamandalam)", lat: 11.4102, lon: 76.695, railHub: "Coimbatore Junction (CBE) / Mettupalayam" },
  munnar: { name: "Munnar", lat: 10.0889, lon: 77.0595, railHub: "Aluva (AWY) / Ernakulam (ERS)" },
  hampi: { name: "Hampi", lat: 15.335, lon: 76.46, railHub: "Hosapete Junction (HPT)" },
  nainital: { name: "Nainital", lat: 29.3919, lon: 79.4542, railHub: "Kathgodam (KGM)" },
  mussoorie: { name: "Mussoorie", lat: 30.4598, lon: 78.0644, railHub: "Dehradun (DDN)" },
  rishikesh: { name: "Rishikesh", lat: 30.0869, lon: 78.2676, railHub: "Yog Nagari Rishikesh (YNRK)" },
  haridwar: { name: "Haridwar", lat: 29.9457, lon: 78.1642, railHub: "Haridwar Junction (HW)" },
  alibaug: { name: "Alibaug", lat: 18.6414, lon: 72.8722, railHub: "Panvel Junction (PNVL) / Ro-Pax Mandwa" },
  mahabaleshwar: { name: "Mahabaleshwar", lat: 17.9237, lon: 73.6586, railHub: "Pune Junction (PUNE) / Satara (STR)" },
  lonavala: { name: "Lonavala", lat: 18.7546, lon: 73.4062, railHub: "Lonavala (LNL)" },
  gokarna: { name: "Gokarna", lat: 14.5479, lon: 74.3188, railHub: "Gokarna Road (GOK) / Kumta" },
  kodaikanal: { name: "Kodaikanal", lat: 10.2381, lon: 77.4892, railHub: "Kodai Road (KQN) / Madurai (MDU)" },
  "mount abu": { name: "Mount Abu", lat: 24.5925, lon: 72.7156, railHub: "Abu Road (ABR)" },
  mathura: { name: "Mathura", lat: 27.4924, lon: 77.6737, railHub: "Mathura Junction (MTJ)" },
  ayodhya: { name: "Ayodhya", lat: 26.7922, lon: 82.1998, railHub: "Ayodhya Dham (AY) / Ayodhya Cantt" },
  puri: { name: "Puri", lat: 19.8135, lon: 85.8312, railHub: "Puri (PURI)" },
  rameswaram: { name: "Rameswaram", lat: 9.2876, lon: 79.3129, railHub: "Rameswaram (RMM)" },
  kanyakumari: { name: "Kanyakumari", lat: 8.0883, lon: 77.5385, railHub: "Kanniyakumari (CAPE)" },
  dharamsala: { name: "Dharamsala / McLeod Ganj", lat: 32.219, lon: 76.3234, railHub: "Pathankot Cantt (PTKC)" },
  coorg: { name: "Coorg (Madikeri)", lat: 12.4244, lon: 75.7382, railHub: "Mysuru Junction (MYS)" },
  wayanad: { name: "Wayanad", lat: 11.605, lon: 76.0828, railHub: "Kozhikode (CLT)" },
  dapoli: { name: "Dapoli", lat: 17.7593, lon: 73.1882, railHub: "Khed (KHED)" },
  daman: { name: "Daman", lat: 20.3974, lon: 72.8328, railHub: "Vapi (VAPI)" },
  diu: { name: "Diu", lat: 20.7144, lon: 70.9874, railHub: "Veraval (VRL)" },
  kasol: { name: "Kasol", lat: 32.01, lon: 77.315, railHub: "Chandigarh (CDG)" },
  spiti: { name: "Spiti Valley (Kaza)", lat: 32.2276, lon: 78.071, railHub: "Shimla / Chandigarh" },
  leh: { name: "Leh", lat: 34.1526, lon: 77.5771, railHub: "Jammu Tawi (JAT) / Transfer by air" },
  srinagar: { name: "Srinagar", lat: 34.0837, lon: 74.7973, railHub: "Jammu Tawi (JAT) / Udhampur" },
  goa: { name: "Goa", lat: 15.3808, lon: 73.8314, railHub: "Madgaon Junction (MAO) / Thivim" },
  surat: { name: "Surat", lat: 21.1959, lon: 72.8302, railHub: "Surat Junction (ST)" },
  vadodara: { name: "Vadodara", lat: 22.3072, lon: 73.1812, railHub: "Vadodara Junction (BRC)" },
  ahmedabad: { name: "Ahmedabad", lat: 23.0225, lon: 72.5714, railHub: "Ahmedabad Junction (ADI)" },
  mumbai: { name: "Mumbai", lat: 19.076, lon: 72.8777, railHub: "Mumbai Central (MMCT) / Bandra (BDTS) / CSMT" },
  delhi: { name: "Delhi", lat: 28.6139, lon: 77.209, railHub: "New Delhi (NDLS) / Hazrat Nizamuddin (NZM)" },
  "new delhi": { name: "New Delhi", lat: 28.6139, lon: 77.209, railHub: "New Delhi (NDLS)" },
  bangalore: { name: "Bengaluru", lat: 12.9716, lon: 77.5946, railHub: "KSR Bengaluru (SBC) / Yesvantpur (YPR)" },
  bengaluru: { name: "Bengaluru", lat: 12.9716, lon: 77.5946, railHub: "KSR Bengaluru (SBC) / Yesvantpur (YPR)" },
  chennai: { name: "Chennai", lat: 13.0827, lon: 80.2707, railHub: "Chennai Central (MAS) / Egmore (MS)" },
  kolkata: { name: "Kolkata", lat: 22.5726, lon: 88.3639, railHub: "Howrah Junction (HWH) / Sealdah (SDAH)" },
  hyderabad: { name: "Hyderabad", lat: 17.385, lon: 78.4867, railHub: "Secunderabad Junction (SC) / Kacheguda" },
  pune: { name: "Pune", lat: 18.5204, lon: 73.8567, railHub: "Pune Junction (PUNE)" },
  jaipur: { name: "Jaipur", lat: 26.9124, lon: 75.7873, railHub: "Jaipur Junction (JP)" },
  varanasi: { name: "Varanasi", lat: 25.3176, lon: 82.9739, railHub: "Varanasi Junction (BSB) / Banaras (BSBS)" },
  lucknow: { name: "Lucknow", lat: 26.8467, lon: 80.9462, railHub: "Lucknow Charbagh (LKO)" },
  agra: { name: "Agra", lat: 27.1767, lon: 78.0081, railHub: "Agra Cantt (AGC)" },
  amritsar: { name: "Amritsar", lat: 31.634, lon: 74.8723, railHub: "Amritsar Junction (ASR)" },
  chandigarh: { name: "Chandigarh", lat: 30.7333, lon: 76.7794, railHub: "Chandigarh Junction (CDG)" },
  bhopal: { name: "Bhopal", lat: 23.2599, lon: 77.4126, railHub: "Bhopal Junction (BPL) / Rani Kamlapati (RKMP)" },
  indore: { name: "Indore", lat: 22.7196, lon: 75.8577, railHub: "Indore Junction (INDB)" },
  nagpur: { name: "Nagpur", lat: 21.1458, lon: 79.0882, railHub: "Nagpur Junction (NGP)" },
  kochi: { name: "Kochi", lat: 9.9312, lon: 76.2673, railHub: "Ernakulam Junction (ERS)" },
  trivandrum: { name: "Thiruvananthapuram", lat: 8.5241, lon: 76.9366, railHub: "Thiruvananthapuram Central (TVC)" },
  thiruvananthapuram: { name: "Thiruvananthapuram", lat: 8.5241, lon: 76.9366, railHub: "Thiruvananthapuram Central (TVC)" },
  coimbatore: { name: "Coimbatore", lat: 11.0168, lon: 76.9558, railHub: "Coimbatore Junction (CBE)" },
  madurai: { name: "Madurai", lat: 9.9252, lon: 78.1198, railHub: "Madurai Junction (MDU)" },
  mysore: { name: "Mysuru", lat: 12.2958, lon: 76.6394, railHub: "Mysuru Junction (MYS)" },
  mysuru: { name: "Mysuru", lat: 12.2958, lon: 76.6394, railHub: "Mysuru Junction (MYS)" },
  jodhpur: { name: "Jodhpur", lat: 26.2389, lon: 73.0243, railHub: "Jodhpur Junction (JU)" },
  udaipur: { name: "Udaipur", lat: 24.5854, lon: 73.7125, railHub: "Udaipur City (UDZ)" },
  jaisalmer: { name: "Jaisalmer", lat: 26.9157, lon: 70.9083, railHub: "Jaisalmer (JSM)" },
  patna: { name: "Patna", lat: 25.5941, lon: 85.1376, railHub: "Patna Junction (PNBE)" },
  bhubaneswar: { name: "Bhubaneswar", lat: 20.2961, lon: 85.8245, railHub: "Bhubaneswar (BBS)" },
  guwahati: { name: "Guwahati", lat: 26.1445, lon: 91.7362, railHub: "Guwahati (GHY)" },
  dehradun: { name: "Dehradun", lat: 30.3165, lon: 78.0322, railHub: "Dehradun (DDN)" },
  shimla: { name: "Shimla", lat: 31.1048, lon: 77.1734, railHub: "Shimla (SML) / Kalka (KLK)" },
};

/**
 * Known Waterway / Island Regions where maritime ferry transit is genuine.
 * Ferry must NEVER be recommended for mainland highway routes.
 */
const VERIFIED_WATERWAY_ZONES = [
  "andaman",
  "port blair",
  "havelock",
  "neil island",
  "swaraj dweep",
  "shaheed dweep",
  "lakshadweep",
  "agatti",
  "kavaratti",
  "elephanta",
  "mandwa",
  "alibaug",
  "ghogha",
  "hazira",
  "majuli",
  "vypeen",
  "fort kochi",
  "venice",
  "santorini",
  "mykonos",
  "bali",
  "gili",
];

/**
 * Determine if a route qualifies for a maritime ferry.
 */
function isFerryApplicable(origin, destination) {
  const o = String(origin || "").toLowerCase();
  const d = String(destination || "").toLowerCase();

  // Explicit maritime routes
  const isRoPaxMumbaiAlibaug =
    (o.includes("mumbai") && (d.includes("alibaug") || d.includes("mandwa"))) ||
    (d.includes("mumbai") && (o.includes("alibaug") || o.includes("mandwa")));

  const isGulfOfKhambhatRoPax =
    (o.includes("ghogha") && d.includes("hazira")) ||
    (d.includes("ghogha") && o.includes("hazira"));

  if (isRoPaxMumbaiAlibaug || isGulfOfKhambhatRoPax) return true;

  // Island to island or mainland to island where water transit is primary
  const oHasWater = VERIFIED_WATERWAY_ZONES.some((k) => o.includes(k));
  const dHasWater = VERIFIED_WATERWAY_ZONES.some((k) => d.includes(k));

  // Must not be ordinary mainland city (e.g. Surat is NOT a water ferry destination)
  return oHasWater && dHasWater;
}

/**
 * Calculate Great-Circle Geodesic Distance via Haversine Formula (km)
 */
function calculateHaversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Standard Indian Railways Telescopic Fare Structure (Approximate Indicative Ranges per km)
 */
export function calculateModelledTrainFares(distanceKm) {
  const d = Math.max(50, distanceKm);
  const baseSL = Math.round(Math.max(140, d * 0.48 + 40));
  const base3A = Math.round(Math.max(495, d * 1.35 + 90));
  const base2A = Math.round(Math.max(710, d * 1.95 + 130));
  const base1A = Math.round(Math.max(1200, d * 3.3 + 180));
  const baseCC = Math.round(Math.max(380, d * 1.15 + 75));
  const baseEC = Math.round(Math.max(720, d * 2.2 + 120));

  return {
    SL: { classCode: "SL", name: "Sleeper Class", fareINR: baseSL },
    "3A": { classCode: "3A", name: "AC 3 Tier", fareINR: base3A },
    "2A": { classCode: "2A", name: "AC 2 Tier", fareINR: base2A },
    "1A": { classCode: "1A", name: "AC First Class", fareINR: base1A },
    CC: { classCode: "CC", name: "AC Chair Car", fareINR: baseCC },
    EC: { classCode: "EC", name: "Executive Chair Car", fareINR: baseEC },
  };
}

/**
 * Provider-Agnostic Transport Research Service (V1)
 * Universal multi-modal intelligence for any route in India and worldwide.
 */
export class TransportResearchService {
  constructor() {
    this.name = "Transport Research Service (V1)";
    this.geoCache = new Map();
  }

  /**
   * Universal Geolocation & Hub Resolver
   * Resolves coordinates and major transit hub names for any city.
   */
  async resolveLocation(rawName) {
    const clean = cleanCityName(rawName);
    const key = clean.toLowerCase();

    if (this.geoCache.has(key)) {
      return this.geoCache.get(key);
    }

    // 1. Check verified popular destinations catalog
    if (POPULAR_DESTINATIONS_GEO[key]) {
      const hit = POPULAR_DESTINATIONS_GEO[key];
      const result = {
        name: hit.name,
        cleanName: clean,
        lat: hit.lat,
        lon: hit.lon,
        railHub: hit.railHub || `${clean} Railway Station`,
        airportCode: resolveAirportCode(clean),
      };
      this.geoCache.set(key, result);
      return result;
    }

    // 2. Check airport lookup master dataset (163 Indian operational airport cities)
    const airportMatches = airportLookupService.findAirportsByCity(clean);
    if (airportMatches && airportMatches.length > 0) {
      const ap = airportMatches[0];
      const result = {
        name: ap.served_city || clean,
        cleanName: clean,
        lat: ap.latitude,
        lon: ap.longitude,
        railHub: `${clean} Junction / Central`,
        airportCode: ap.iata_code || resolveAirportCode(clean),
      };
      this.geoCache.set(key, result);
      return result;
    }

    // 3. Dynamic worldwide geocoder fallback (Open-Meteo)
    try {
      const geo = await weatherProvider.geocode(clean);
      if (geo && geo.latitude != null && geo.longitude != null) {
        const result = {
          name: clean,
          cleanName: clean,
          lat: geo.latitude,
          lon: geo.longitude,
          railHub: `${clean} Railway Station`,
          airportCode: resolveAirportCode(clean),
        };
        this.geoCache.set(key, result);
        return result;
      }
    } catch (err) {
      logger.warn(`[TransportResearch] Geocoding lookup fallback for "${clean}": ${err.message}`);
    }

    // 4. Default metropolitan fallback if unresolvable
    const fallback = {
      name: clean || "Origin",
      cleanName: clean,
      lat: 19.076,
      lon: 72.8777,
      railHub: `${clean} Station`,
      airportCode: "BOM",
    };
    return fallback;
  }

  /**
   * Conduct multi-modal transport research between origin and destination.
   */
  async researchAllModes({
    origin,
    destination,
    travelDate = null,
    travelers = 1,
    preferredMode = null,
  }) {
    const rawOrigin = String(origin || "").trim();
    const rawDest = String(destination || "").trim();

    if (!rawDest) {
      throw new Error("Destination is required for transport research.");
    }

    const effectiveOrigin = rawOrigin || "Mumbai";
    const cleanOrigin = cleanCityName(effectiveOrigin);
    const cleanDest = cleanCityName(rawDest);

    // Resolve accurate geographic coordinates and transit hubs
    const [origGeo, destGeo] = await Promise.all([
      this.resolveLocation(cleanOrigin),
      this.resolveLocation(cleanDest),
    ]);

    // Calculate real geodesic distance
    const geodesicKm = calculateHaversineKm(
      origGeo.lat,
      origGeo.lon,
      destGeo.lat,
      destGeo.lon
    );

    // Query OSRM for live road routing (exact road km & free-flow driving duration)
    let osrmRoute = null;
    try {
      osrmRoute = await osrmRoutingService.calculateDrivingRoute({
        origin: { lat: origGeo.lat, lon: origGeo.lon },
        destination: { lat: destGeo.lat, lon: destGeo.lon },
      });
    } catch (osrmErr) {
      logger.warn(`[TransportResearch] OSRM query note: ${osrmErr.message}`);
    }

    // Calibrate realistic distances
    const roadKm = osrmRoute?.distanceKm || Math.round(Math.max(20, geodesicKm * 1.25));
    const railKm = Math.round(Math.max(20, geodesicKm * 1.28));
    const airKm = geodesicKm;

    // Concurrently evaluate genuine transport modes
    const [trainRes, flightRes, busRes, driveRes, ferryRes, localRes] = await Promise.all([
      this.estimateTrainRoute({
        origin: cleanOrigin,
        destination: cleanDest,
        origGeo,
        destGeo,
        travelDate,
        travelers,
        railKm,
        roadKm,
      }),
      this.estimateFlightRoute({
        origin: cleanOrigin,
        destination: cleanDest,
        origGeo,
        destGeo,
        travelDate,
        travelers,
        airKm,
        roadKm,
      }),
      this.estimateBusRoute({
        origin: cleanOrigin,
        destination: cleanDest,
        origGeo,
        destGeo,
        travelDate,
        travelers,
        roadKm,
      }),
      this.estimateDriveRoute({
        origin: cleanOrigin,
        destination: cleanDest,
        origGeo,
        destGeo,
        travelers,
        roadKm,
        osrmRoute,
      }),
      isFerryApplicable(cleanOrigin, cleanDest)
        ? this.estimateFerryRoute({
            origin: cleanOrigin,
            destination: cleanDest,
            travelers,
            geodesicKm,
          })
        : Promise.resolve(null),
      this.estimateLocalTransit({ destination: cleanDest, travelers }),
    ]);

    const modes = [trainRes, flightRes, busRes, driveRes, ferryRes].filter(Boolean);

    // Determine smart recommended best option based on realistic door-to-door transit time
    let bestOption = "Train";
    if (airKm > 800) {
      bestOption = "Flight";
    } else if (roadKm <= 160) {
      bestOption = "Drive";
    } else if (roadKm <= 350 && trainRes) {
      // Short-to-medium trunk corridors (e.g. Mumbai–Surat, Delhi–Jaipur) are fastest by Train
      bestOption = "Train";
    } else if (preferredMode) {
      const match = modes.find(
        (m) => m.transportType.toLowerCase() === preferredMode.toLowerCase()
      );
      if (match) bestOption = match.transportType;
    }

    return {
      origin: cleanOrigin,
      destination: cleanDest,
      distanceKm: roadKm,
      geodesicKm,
      railDistanceKm: railKm,
      roadDistanceKm: roadKm,
      airDistanceKm: airKm,
      recommendedModes: modes,
      localTransit: localRes,
      bestOption,
      summary: `Evaluated multi-modal travel options between ${cleanOrigin} and ${cleanDest} (~${roadKm} km road / ~${railKm} km rail).`,
      retrievedAt: new Date().toISOString(),
    };
  }

  /**
   * Train Journey Research & Dynamic Departure Schedules
   * Calibrated against realistic Indian Railways speeds and telescopic fares.
   */
  async estimateTrainRoute({
    origin,
    destination,
    origGeo = null,
    destGeo = null,
    travelDate = null,
    travelers = 1,
    railKm = null,
  }) {
    let dKm = railKm;
    if (!dKm || !origGeo || !destGeo) {
      const cleanO = cleanCityName(origin);
      const cleanD = cleanCityName(destination);
      const [oG, dG] = await Promise.all([
        origGeo || this.resolveLocation(cleanO),
        destGeo || this.resolveLocation(cleanD),
      ]);
      origGeo = oG;
      destGeo = dG;
      const geoKm = calculateHaversineKm(origGeo.lat, origGeo.lon, destGeo.lat, destGeo.lon);
      dKm = Math.round(Math.max(40, geoKm * 1.28));
    }

    // Realistic average commercial speed based on corridor profile
    let avgSpeedKmH = 65;
    if (dKm <= 300) {
      // Fast day corridor (Shatabdi/Vande Bharat/Intercity average)
      avgSpeedKmH = 78;
    } else if (dKm <= 800) {
      avgSpeedKmH = 65;
    } else {
      avgSpeedKmH = 62;
    }

    const durationHours = Math.round((dKm / avgSpeedKmH) * 10) / 10;
    const durationMinutes = Math.round(durationHours * 60);

    const originHub = origGeo?.railHub || `${origin} Junction`;
    const destHub = destGeo?.railHub || `${destination} Junction`;

    const fares = calculateModelledTrainFares(dKm);
    const selectedClass = dKm <= 350 ? "CC" : "3A";
    const oneWayFare = fares[selectedClass]?.fareINR || 650;
    const roundTripPerPerson = oneWayFare * 2;
    const totalGroupFare = roundTripPerPerson * Math.max(1, travelers);

    // Generate 3-4 realistic train departures with authentic timing
    const sampleDepartures = this.generateSampleTrains({
      origin,
      destination,
      originHub,
      destHub,
      durationMinutes,
      durationHours,
      dKm,
      fares,
    });

    return {
      origin,
      destination,
      travelDate: travelDate || null,
      transportType: "Train",
      route: `${originHub} → ${destHub}`,
      departure: { hub: originHub, timeDescription: "Frequent daily departures (Vande Bharat / Express)" },
      arrival: { hub: destHub, timeDescription: "Arrival based on journey duration" },
      estimatedDurationMinutes: durationMinutes,
      estimatedDurationHours: durationHours,
      distanceKm: dKm,
      fareRangeINR: {
        min: fares.SL.fareINR,
        max: fares["1A"].fareINR,
        currency: "INR",
      },
      estimatedFareINR: oneWayFare,
      roundTripFareINR: roundTripPerPerson,
      totalGroupFareINR: totalGroupFare,
      operator: "Indian Railways (Vande Bharat / Shatabdi / Superfast / Mail)",
      availableClasses: [
        { code: "CC", label: "AC Chair Car", fareINR: fares.CC.fareINR },
        { code: "EC", label: "Exec Chair Car", fareINR: fares.EC.fareINR },
        { code: "3A", label: "AC 3-Tier", fareINR: fares["3A"].fareINR },
        { code: "2A", label: "AC 2-Tier", fareINR: fares["2A"].fareINR },
        { code: "1A", label: "AC 1st Class", fareINR: fares["1A"].fareINR },
        { code: "SL", label: "Sleeper Class", fareINR: fares.SL.fareINR },
      ],
      sampleDepartures,
      sourceName: "Indian Railways Standard Telescopic Fare Structure",
      sourceUrl: "https://www.indianrail.gov.in",
      retrievedAt: new Date().toISOString(),
      verificationStatus: "ESTIMATED",
      priceClassification: "modelled estimate",
      limitations: "Indicative fare range based on official telescopic distance formula. Exact seats, tatkal, and live delays vary by booking date.",
    };
  }

  /**
   * Helper to generate realistic sample train schedules
   */
  generateSampleTrains({ origin, destination, originHub, destHub, durationMinutes, dKm, fares }) {
    const durH = Math.floor(durationMinutes / 60);
    const durM = durationMinutes % 60;
    const durStr = `${durH}h ${durM > 0 ? `${durM}m` : ""}`.trim();

    const addTime = (startH, startM, addMins) => {
      const total = startH * 60 + startM + addMins;
      const endH = Math.floor(total / 60) % 24;
      const endM = total % 60;
      return `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
    };

    const trains = [];

    // 1. Morning Vande Bharat / Superfast
    trains.push({
      trainNumber: "20901",
      trainName: `${origin} - ${destination} Vande Bharat Express`,
      departureTime: "06:00",
      arrivalTime: addTime(6, 0, Math.max(90, Math.round(durationMinutes * 0.88))),
      duration: durStr,
      durationMinutes: Math.round(durationMinutes * 0.88),
      departureHub: originHub,
      arrivalHub: destHub,
      primaryClass: "CC",
      fareINR: fares.CC.fareINR,
      tag: "Fastest / Premium",
    });

    // 2. Midday Shatabdi / Intercity Superfast
    trains.push({
      trainNumber: "12009",
      trainName: `${origin} - ${destination} Shatabdi / Superfast Express`,
      departureTime: "11:45",
      arrivalTime: addTime(11, 45, durationMinutes),
      duration: durStr,
      durationMinutes,
      departureHub: originHub,
      arrivalHub: destHub,
      primaryClass: dKm <= 350 ? "CC" : "3A",
      fareINR: dKm <= 350 ? fares.CC.fareINR : fares["3A"].fareINR,
      tag: "Popular Day Express",
    });

    // 3. Evening Express / Tejas
    trains.push({
      trainNumber: "12951",
      trainName: `${origin} - ${destination} Tejas / Intercity Express`,
      departureTime: "17:15",
      arrivalTime: addTime(17, 15, durationMinutes),
      duration: durStr,
      durationMinutes,
      departureHub: originHub,
      arrivalHub: destHub,
      primaryClass: "3A",
      fareINR: fares["3A"].fareINR,
      tag: "Evening Express",
    });

    // 4. Overnight Mail / Express (if distance is practical for overnight)
    if (dKm >= 220) {
      trains.push({
        trainNumber: "12925",
        trainName: `${origin} - ${destination} Overnight Superfast Mail`,
        departureTime: "22:30",
        arrivalTime: addTime(22, 30, Math.round(durationMinutes * 1.1)),
        duration: `${Math.floor((durationMinutes * 1.1) / 60)}h ${Math.round((durationMinutes * 1.1) % 60)}m`,
        durationMinutes: Math.round(durationMinutes * 1.1),
        departureHub: originHub,
        arrivalHub: destHub,
        primaryClass: "SL",
        fareINR: fares.SL.fareINR,
        tag: "Budget Overnight Sleeper",
      });
    }

    return trains;
  }

  /**
   * Flight Journey Research
   * Realistic air time and door-to-door transit advice.
   */
  async estimateFlightRoute({
    origin,
    destination,
    origGeo = null,
    destGeo = null,
    travelDate = null,
    travelers = 1,
    airKm = null,
    roadKm = null,
  }) {
    let dKm = airKm;
    if (!dKm || !origGeo || !destGeo) {
      const cleanO = cleanCityName(origin);
      const cleanD = cleanCityName(destination);
      const [oG, dG] = await Promise.all([
        origGeo || this.resolveLocation(cleanO),
        destGeo || this.resolveLocation(cleanD),
      ]);
      origGeo = oG;
      destGeo = dG;
      dKm = calculateHaversineKm(origGeo.lat, origGeo.lon, destGeo.lat, destGeo.lon);
    }
    const oCode = origGeo?.airportCode || resolveAirportCode(origin);
    const dCode = destGeo?.airportCode || resolveAirportCode(destination);

    // If journey is under 120 km, commercial non-stop flights are unavailable
    if (dKm < 120) return null;

    // Realistic air block time (taxi + climb + cruise + descent + approach)
    // Cruise speed ~650 km/h; ground taxi/maneuver overhead ~30 mins (0.5h)
    const airTimeHours = Math.round((dKm / 650 + 0.5) * 10) / 10;
    const durationMinutes = Math.round(airTimeHours * 60);

    // Domestic flight pricing heuristic (economy class)
    const baseOneWayFare = Math.max(2600, Math.round(dKm * 3.6 + 1100));
    const roundTripPerPerson = baseOneWayFare * 2;
    const totalGroupFare = roundTripPerPerson * Math.max(1, travelers);

    const isShortCorridor = roadKm <= 320;
    const transitAdvice = isShortCorridor
      ? `On this ~${roadKm} km corridor, high-speed train or expressway drive is faster door-to-door than airport security and terminal procedures.`
      : "Daily scheduled direct and connecting domestic flights.";

    return {
      origin,
      destination,
      travelDate: travelDate || null,
      transportType: "Flight",
      route: `${origin} (${oCode || "Airport"}) → ${destination} (${dCode || "Airport"})`,
      departure: {
        hub: `${origin} Airport (${oCode || "Origin Airport"})`,
        timeDescription: "Scheduled domestic departures",
      },
      arrival: {
        hub: `${destination} Airport (${dCode || "Destination Airport"})`,
        timeDescription: "Arrival at terminal",
      },
      estimatedDurationMinutes: durationMinutes,
      estimatedDurationHours: airTimeHours,
      distanceKm: dKm,
      isShortCorridor,
      transitAdvice,
      fareRangeINR: {
        min: Math.round(baseOneWayFare * 0.85),
        max: Math.round(baseOneWayFare * 1.5),
        currency: "INR",
      },
      estimatedFareINR: baseOneWayFare,
      roundTripFareINR: roundTripPerPerson,
      totalGroupFareINR: totalGroupFare,
      operator: "Major Domestic Airlines (IndiGo, Air India, Akasa, SpiceJet)",
      sourceName: "Aviation GDS / Domestic Flight Index",
      sourceUrl: "https://www.amadeus.com",
      retrievedAt: new Date().toISOString(),
      verificationStatus: "ESTIMATED",
      priceClassification: "modelled estimate",
      limitations: "Fares fluctuate dynamically based on departure date, fuel surcharges, and baggage limits.",
    };
  }

  /**
   * Bus Journey Research (intercity AC / sleeper / state transport)
   */
  async estimateBusRoute({
    origin,
    destination,
    travelDate = null,
    travelers = 1,
    roadKm = null,
  }) {
    let dKm = roadKm;
    if (!dKm) {
      const cleanO = cleanCityName(origin);
      const cleanD = cleanCityName(destination);
      const [oG, dG] = await Promise.all([
        this.resolveLocation(cleanO),
        this.resolveLocation(cleanD),
      ]);
      const geoKm = calculateHaversineKm(oG.lat, oG.lon, dG.lat, dG.lon);
      dKm = Math.round(Math.max(30, geoKm * 1.25));
    }
    // Exclude buses only for ultra-long corridors exceeding 2200 km or trans-oceanic routes
    if (dKm > 2200) return null;

    // Average highway speed ~52 km/h plus scheduled rest/meal breaks
    const restBreakHours = dKm > 800 ? 2.0 : dKm > 300 ? 1.0 : dKm > 150 ? 0.5 : 0.2;
    const avgSpeedKmH = dKm > 600 ? 55 : 50;
    const durationHours = Math.round((dKm / avgSpeedKmH + restBreakHours) * 10) / 10;
    const durationMinutes = Math.round(durationHours * 60);

    const baseFare = Math.round(Math.max(300, dKm * 1.55));
    const roundTripPerPerson = baseFare * 2;
    const totalGroupFare = roundTripPerPerson * Math.max(1, travelers);

    return {
      origin,
      destination,
      travelDate: travelDate || null,
      transportType: "Bus",
      route: `${origin} Intercity Bus Hub → ${destination} Central Bus Station`,
      departure: { hub: `${origin} Intercity Bus Stand / Private Hub`, timeDescription: "Frequent daily and overnight departures" },
      arrival: { hub: `${destination} Central Bus Station`, timeDescription: "Arrival at terminal" },
      estimatedDurationMinutes: durationMinutes,
      estimatedDurationHours: durationHours,
      distanceKm: dKm,
      fareRangeINR: {
        min: Math.round(baseFare * 0.8),
        max: Math.round(baseFare * 1.4),
        currency: "INR",
      },
      estimatedFareINR: baseFare,
      roundTripFareINR: roundTripPerPerson,
      totalGroupFareINR: totalGroupFare,
      operator: "Intercity Bus Operators (MSRTC, GSRTC, KSRTC, Zingbus, IntrCity SmartBus)",
      sourceName: "Intercity Road Transit Schedule Index",
      sourceUrl: "https://www.redbus.in",
      retrievedAt: new Date().toISOString(),
      verificationStatus: "ESTIMATED",
      priceClassification: "modelled estimate",
      limitations: "Travel duration depends on highway conditions, ghat sections, toll plaza congestion, and weather.",
    };
  }

  /**
   * Road Trip / Drive Journey Research (OSRM-powered)
   */
  async estimateDriveRoute({
    origin,
    destination,
    travelers = 1,
    roadKm = null,
    osrmRoute = null,
  }) {
    let dKm = roadKm;
    if (!dKm) {
      const cleanO = cleanCityName(origin);
      const cleanD = cleanCityName(destination);
      const [oG, dG] = await Promise.all([
        this.resolveLocation(cleanO),
        this.resolveLocation(cleanD),
      ]);
      const geoKm = calculateHaversineKm(oG.lat, oG.lon, dG.lat, dG.lon);
      dKm = Math.round(Math.max(30, geoKm * 1.25));
    }

    let durationHours;
    let durationMinutes;

    if (osrmRoute && osrmRoute.durationMins > 0) {
      durationMinutes = osrmRoute.durationMins;
      durationHours = osrmRoute.durationHours;
    } else {
      const avgSpeedKmH = 65; // National Highway / Expressway average
      durationHours = Math.round((dKm / avgSpeedKmH) * 10) / 10;
      durationMinutes = Math.round(durationHours * 60);
    }

    // Fuel calculation: standard sedan/SUV at 14 km/L, petrol/diesel @ ~₹102/L
    const fuelCostINR = osrmRoute?.fuelCostINR || Math.round((dKm / 14) * 102);
    // Tolls: national highway average ~₹2.10/km for journeys > 50 km
    const estimatedTollsINR =
      osrmRoute?.estimatedTollsINR !== undefined
        ? osrmRoute.estimatedTollsINR
        : dKm > 50
        ? Math.round(dKm * 2.1)
        : 0;

    const oneWayTotal = fuelCostINR + estimatedTollsINR;
    const roundTripTotal = oneWayTotal * 2;

    return {
      origin,
      destination,
      transportType: "Drive",
      route: `${origin} → ${destination} via National Highway Corridor`,
      departure: { hub: `${origin} (Self-drive / Private Cab)`, timeDescription: "Flexible departure at your schedule" },
      arrival: { hub: `${destination} City Center`, timeDescription: "Direct destination arrival" },
      estimatedDurationMinutes: durationMinutes,
      estimatedDurationHours: durationHours,
      distanceKm: dKm,
      fuelCostINR,
      estimatedTollsINR,
      fareRangeINR: {
        min: fuelCostINR,
        max: oneWayTotal,
        currency: "INR",
      },
      estimatedFareINR: oneWayTotal,
      roundTripFareINR: roundTripTotal,
      totalGroupFareINR: roundTripTotal, // Drive cost is vehicle-level, shared by the whole group
      operator: "Personal Vehicle / Private Taxi (Self-Drive / Chauffeur)",
      sourceName: "Project-OSRM Highway Geometry & National Highway Toll Index",
      sourceUrl: "http://router.project-osrm.org",
      retrievedAt: new Date().toISOString(),
      verificationStatus: "ESTIMATED",
      priceClassification: "modelled estimate",
      limitations: "Fuel calculated assuming 14 km/L at ₹102/L. Tolls estimated from FASTag average highway rates.",
    };
  }

  /**
   * Ferry Transit Research (Only triggered for verified waterway/island routes)
   */
  async estimateFerryRoute({ origin, destination, travelers = 1, geodesicKm }) {
    const dKm = geodesicKm || 30;
    const avgSpeedKnots = 20; // ~37 km/h
    const durationHours = Math.max(0.8, Math.round((dKm / 37) * 10) / 10);
    const durationMinutes = Math.round(durationHours * 60);

    const baseFare = Math.max(350, Math.round(dKm * 14 + 150));
    const roundTripPerPerson = baseFare * 2;
    const totalGroupFare = roundTripPerPerson * Math.max(1, travelers);

    return {
      origin,
      destination,
      transportType: "Ferry",
      route: `${origin} Ferry Terminal → ${destination} Jetty`,
      departure: { hub: `${origin} Ferry Terminal`, timeDescription: "Scheduled catamaran / Ro-Pax departures" },
      arrival: { hub: `${destination} Jetty`, timeDescription: "Direct coastal arrival" },
      estimatedDurationMinutes: durationMinutes,
      estimatedDurationHours: durationHours,
      distanceKm: dKm,
      fareRangeINR: {
        min: baseFare,
        max: Math.round(baseFare * 1.5),
        currency: "INR",
      },
      estimatedFareINR: baseFare,
      roundTripFareINR: roundTripPerPerson,
      totalGroupFareINR: totalGroupFare,
      operator: "Coastal Ferry / Ro-Pax Passenger Service",
      sourceName: "Maritime Transit Index",
      retrievedAt: new Date().toISOString(),
      verificationStatus: "ESTIMATED",
      priceClassification: "modelled estimate",
      limitations: "Ferry services are subject to monsoon sea conditions and coast guard advisories.",
    };
  }

  /**
   * Destination Local Transit Research
   */
  async estimateLocalTransit({ destination, days = 3, travelers = 1 }) {
    const dailyPerPersonINR = 450;
    const totalLocalINR = dailyPerPersonINR * Math.max(1, days) * Math.max(1, travelers);

    return {
      destination,
      dailyPerPersonINR,
      totalEstimateINR: totalLocalINR,
      recommendedModes: [
        "Metro / Rapid Rail (where available)",
        "Prepaid Taxi / App Cabs (Uber / Ola)",
        "Auto Rickshaws",
      ],
      priceClassification: "modelled estimate",
      sourceName: "Urban Transit & Local Transport Fare Catalog",
      limitations: "Peak-hour cab surge pricing, waiting fees, and detour tolls are variable.",
    };
  }
}

export const transportResearchService = new TransportResearchService();
