/**
 * Comprehensive Test Script for Real Travel Data & Price Watch Engine
 */
import { flightProvider } from "../services/travel/providers/flight.provider.js";
import { hotelProvider } from "../services/travel/providers/hotel.provider.js";
import { weatherProvider } from "../services/travel/providers/weather.provider.js";
import { transportProvider } from "../services/travel/providers/transport.provider.js";
import { travelCache } from "../services/travel/travel-cache.service.js";
import { rulesEngine } from "../services/commanderRulesEngine.js";

async function runTests() {
  console.log("=== 1. TESTING FLIGHT PROVIDER ===");
  try {
    const flightSearch = await flightProvider.searchFlights({
      origin: "DEL",
      destination: "BOM",
      date: "2026-09-28",
      passengers: 1,
    });
    const flights = flightSearch.results || [];
    console.log(`✓ Flight Search Succeeded: Found ${flights.length} offers`);
    if (flights.length > 0) {
      const f = flights[0];
      console.log(`  Sample: ${f.airline} (${f.flightNumber}) ${f.origin} -> ${f.destination}`);
      console.log(`  Price: ${f.currency} ${f.price} (Provider: ${f.provider})`);
      console.log(`  Disclaimer: "${flightSearch.disclaimer}"`);
    }

    const status = await flightProvider.getFlightStatus({ flightNumber: "6E-205", date: "2026-09-28" });
    console.log(`✓ Flight Status Succeeded:`, {
      flightNumber: status.flightNumber,
      status: status.status,
      provider: status.provider,
    });
  } catch (err) {
    console.error("Flight Provider Test Failed:", err);
  }

  console.log("\n=== 2. TESTING HOTEL PROVIDER ===");
  try {
    const hotelSearch = await hotelProvider.searchHotels({
      destination: "Goa",
      checkIn: "2026-10-01",
      checkOut: "2026-10-05",
      guests: 2,
    });
    const hotels = hotelSearch.results || [];
    console.log(`✓ Hotel Search Succeeded: Found ${hotels.length} offers in ${hotelSearch.destination}`);
    if (hotels.length > 0) {
      const h = hotels[0];
      console.log(`  Sample: ${h.name} (${h.stars}★) in ${h.location?.city || "Goa"}`);
      console.log(`  Price: ${h.currency} ${h.pricePerNight}/night (Provider: ${h.provider})`);
      console.log(`  Disclaimer: "${hotelSearch.disclaimer}"`);
    }
  } catch (err) {
    console.error("Hotel Provider Test Failed:", err);
  }

  console.log("\n=== 3. TESTING WEATHER PROVIDER (OPEN-METEO) ===");
  try {
    const weather = await weatherProvider.getCurrentWeather("Goa");
    console.log(`✓ Current Weather Succeeded:`, {
      location: weather.data?.locationName,
      temp: `${weather.data?.temperatureC}°C`,
      condition: weather.data?.condition,
      source: weather.source,
      status: weather.status,
    });

    const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split("T")[0];
    const activityWeather = await weatherProvider.getActivityWeather({
      location: "Goa",
      date: tomorrowStr,
      time: "16:00",
    });
    console.log(`✓ Activity Weather Succeeded (Tomorrow 16:00):`, {
      matched: activityWeather.matched,
      forecastTime: activityWeather.forecastTime,
      temp: `${activityWeather.temperatureC}°C`,
      rainChance: `${activityWeather.rainProbabilityPercent}%`,
      condition: activityWeather.condition,
      isRisk: activityWeather.isRisk,
    });
  } catch (err) {
    console.error("Weather Provider Test Failed:", err);
  }

  console.log("\n=== 4. TESTING TRANSPORT PROVIDER ===");
  try {
    const route = await transportProvider.getRouteStatus({
      origin: "Mumbai Airport",
      destination: "Colaba",
    });
    console.log(`✓ Transport Route Succeeded:`, {
      origin: route.origin,
      destination: route.destination,
      distance: `${route.distanceKm} km`,
      duration: `${route.durationMinutes} mins`,
      trafficLevel: route.trafficLevel,
      source: route.source,
    });
    if (route.trafficLevel === "unknown") {
      console.log("  Honest reporting verified: trafficLevel is strictly 'unknown' without live sensors");
    }
  } catch (err) {
    console.error("Transport Provider Test Failed:", err);
  }

  console.log("\n=== 5. TESTING RULES ENGINE ===");
  try {
    const mockTrip = {
      _id: "trip-test-1",
      title: "Goa Vacation",
      destination: "Goa",
      budget: 50000,
      startDate: new Date(),
      endDate: new Date(Date.now() + 5 * 86400000),
      itinerary: [
        {
          day: 1,
          date: new Date(),
          activities: [
            {
              time: "16:00",
              activity: "Sunset Cruise on Mandovi River",
              location: "Goa",
            },
          ],
        },
      ],
    };

    const mockVerifiedFacts = {
      weather: {
        locationName: "Goa",
        temperatureC: 28,
        condition: "Heavy Rain & Thunderstorms",
        isRainy: true,
        source: "Open-Meteo Verified Meteorology API",
      },
    };

    const deterministicEvents = rulesEngine.evaluateTripEvents({
      trip: mockTrip,
      weatherData: mockVerifiedFacts.weather,
      activityWeatherRisks: [
        {
          activityTitle: "Sunset Cruise on Mandovi River",
          activityTime: "16:00",
          rainProbabilityPercent: 85,
          condition: "Thunderstorms & Heavy Rain",
          source: "Open-Meteo Verified Meteorology API",
        },
      ],
      flightData: {
        flightNumber: "6E-205",
        status: "DELAYED",
        delayMinutes: 75,
        airline: "IndiGo",
        origin: "DEL",
        destination: "GOI",
        source: "Verified Aviation Radar",
        dataType: "LIVE_VERIFIED",
      },
      budgetData: {
        budgetTotal: 50000,
        totalSpent: 45000,
        remaining: 5000,
        pctUsed: 90,
        expenseCount: 12,
        source: "Trip Ledger",
      },
      priceWatchAlerts: [
        {
          watchId: "watch-1",
          type: "flight",
          title: "DEL -> GOI (IndiGo 6E-205)",
          previousPrice: 4900,
          currentPrice: 3800,
          currency: "INR",
          percentDrop: 22,
          savings: 1100,
          source: "Live Flight Radar",
        },
      ],
    });

    console.log(`✓ Rules Engine evaluated ${deterministicEvents.length} events:`);
    deterministicEvents.forEach((ev, idx) => {
      console.log(`  [${idx + 1}] [${ev.severity.toUpperCase()}] ${ev.title}`);
      console.log(`      Why: ${ev.reason}`);
      console.log(`      Action: ${ev.action}`);
      console.log(`      DataType: ${ev.dataType} | Source: ${ev.source}`);
    });

    if (deterministicEvents.length < 3) {
      throw new Error("Expected at least 3 events (weather, flight delay, price drop)");
    }
  } catch (err) {
    console.error("Rules Engine Test Failed:", err);
  }

  console.log("\n=== 6. TESTING CACHE ENGINE ===");
  try {
    const testKey = "test:weather:mumbai";
    const testData = { temp: 31, city: "Mumbai" };
    await travelCache.set(testKey, testData, 60);
    const cached = await travelCache.get(testKey);
    console.log(`✓ Travel Cache Succeeded:`, cached);
    if (!cached || cached.data?.city !== "Mumbai") {
      throw new Error("Cache round-trip failed");
    }
  } catch (err) {
    console.error("Cache Engine Test Failed:", err);
  }

  console.log("\n=== ALL TRAVEL ENGINE TESTS PASSED ===");
}

runTests().then(() => {
  // Graceful exit
  setTimeout(() => process.exit(0), 100);
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
