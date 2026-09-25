import Trip from "../../models/Trip.js";
import { weatherProvider } from "../travel/providers/weather.provider.js";
import { flightProvider } from "../travel/providers/flight.provider.js";
import { transportProvider } from "../travel/providers/transport.provider.js";
import { travelCacheService } from "../travel/travel-cache.service.js";
import { evaluateTripEvents } from "../commanderRulesEngine.js";
import { analyzeTripBudget } from "../travelDataService.js";
import PriceWatch from "../../models/PriceWatch.js";
import { aiRouter } from "../ai/ai-router.service.js";
import { parseAIJson } from "../ai/ai-parser.js";
import { logger } from "../../utils/logger.js";

// Cache TTL: 10 minutes
const COMMANDER_CACHE_TTL = 10 * 60 * 1000;
const commanderMemoryCache = new Map();

export class CommanderService {
  /**
   * Strictly enrich rule-evaluated events with AI explanations without inventing data.
   */
  async enrichEventsWithAI(trip, verifiedEvents) {
    if (!verifiedEvents || verifiedEvents.length === 0) {
      return verifiedEvents;
    }

    const prompt = `You are Trip Commander, an AI travel manager assisting with a trip to ${trip.destination || trip.title}.

CRITICAL ANTI-HALLUCINATION INSTRUCTIONS:
1. You are NOT a source of live travel data.
2. You may ONLY make factual claims using the structured events provided below.
3. Do NOT invent flight delays, weather conditions, traffic conditions, hotel prices, cancellations, or transport disruptions.
4. If an event has dataType "UNAVAILABLE", explicitly state that the live data is unavailable without guessing.
5. If an event indicates rain or weather risk for a specific scheduled activity, explain the impact and suggest rearranging or moving that activity indoors.
6. Provide clear, empathetic, helpful guidance strictly grounded in the verified facts.

INPUT STRUCTURED EVENTS:
${JSON.stringify(verifiedEvents, null, 2)}

Return ONLY a valid JSON array of event objects matching this exact structure:
[
  {
    "id": "original_id",
    "when": "original_or_formatted_time",
    "kind": "delay|weather|budget|cancel|closure|traffic|group|ai",
    "alertType": "original_alertType",
    "title": "Clear concise title",
    "reason": "Truthful explanation strictly grounded in provided data",
    "action": "Practical recommendation for the traveler",
    "delta": "Impact summary",
    "severity": "info|warn|bad",
    "dataType": "LIVE_VERIFIED|CACHED_VERIFIED|ESTIMATED|AI_GENERATED|UNAVAILABLE",
    "source": "original_source",
    "updatedAt": "iso_timestamp"
  }
]`;

    try {
      const completion = await aiRouter.callAI({
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 2000,
      });

      const parsed = parseAIJson(completion.content);
      const enrichedList = Array.isArray(parsed) ? parsed : parsed.events || parsed.alerts;

      if (Array.isArray(enrichedList) && enrichedList.length > 0) {
        return enrichedList.map((item, idx) => {
          const original = verifiedEvents[idx] || {};
          return {
            ...item,
            id: item.id || original.id || `evt_${idx}`,
            alertType: original.alertType || item.alertType,
            dataType: original.dataType || item.dataType || "AI_GENERATED",
            source: original.source || item.source || "Advenza Verified Telemetry",
            updatedAt: original.updatedAt || new Date().toISOString(),
          };
        });
      }
      return verifiedEvents;
    } catch (err) {
      logger.warn(`[Commander] AI enrichment fallback to verified rules: ${err.message}`);
      return verifiedEvents;
    }
  }

  /**
   * Get verified commander events for user's active trip.
   */
  async getEvents(userId, tripId) {
    const userTrips = await Trip.find({
      $or: [{ createdBy: userId }, { userId }, { "members.userId": userId }, { "members.email": userId }],
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!userTrips || userTrips.length === 0) {
      return [];
    }

    const activeTrip = tripId
      ? userTrips.find((t) => String(t._id) === String(tripId)) || userTrips[0]
      : userTrips[0];

    const cacheKey = `${userId}_${activeTrip._id}`;
    const cached = commanderMemoryCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < COMMANDER_CACHE_TTL) {
      return cached.events.map((e) => ({
        ...e,
        dataType: e.dataType === "LIVE_VERIFIED" ? "CACHED_VERIFIED" : e.dataType,
      }));
    }

    const destination = activeTrip.destination || activeTrip.title || "Goa";

    // 1. Check Itinerary Activities for time-specific weather conflicts
    const activityWeatherRisks = [];
    try {
      const days = activeTrip.itinerary?.days || (Array.isArray(activeTrip.itinerary) ? activeTrip.itinerary : []);
      for (const day of days.slice(0, 3)) { // Check up to first 3 days
        const activities = day.activities || [];
        for (const act of activities) {
          const actName = act.title || act.activity || act.description;
          if (act.time && actName) {
            const actWeather = await weatherProvider.getActivityWeather({
              location: destination,
              date: day.date || activeTrip.startDate,
              time: act.time,
            });

            if (actWeather?.isRisk) {
              activityWeatherRisks.push({
                ...actWeather,
                activityTitle: actName,
                activityTime: `${day.day ? `Day ${day.day}` : "Upcoming"}, ${act.time}`,
              });
            }
          }
        }
      }
    } catch (actErr) {
      logger.debug(`[Commander] Activity weather evaluation notice: ${actErr.message}`);
    }

    // 2. Fetch parallel verified facts
    const [weatherData, flightData, budgetData, activePriceWatches] = await Promise.all([
      weatherProvider.getCurrentWeather(destination),
      activeTrip.transitRef ? flightProvider.getFlightStatus({ flightNumber: activeTrip.transitRef }) : null,
      Promise.resolve(analyzeTripBudget(activeTrip)),
      PriceWatch.find({ userId, status: "active", lastAlertedAt: { $exists: true } })
        .sort({ lastAlertedAt: -1 })
        .limit(2)
        .lean()
        .catch(() => []),
    ]);

    // Format price watch alerts if any
    const priceWatchAlerts = (activePriceWatches || []).map((w) => ({
      type: w.type,
      title: w.type === "flight" ? `${w.origin} → ${w.destination} Flight` : `${w.destination} Hotel`,
      currentPrice: w.lastPrice,
      previousPrice: w.previousPrice,
      targetPrice: w.targetPrice,
      provider: w.provider,
      observedAt: w.lastAlertedAt,
    }));

    // 3. Pass verified facts into deterministic rules engine
    const ruleEvents = evaluateTripEvents({
      trip: activeTrip,
      weatherData,
      activityWeatherRisks,
      flightData,
      budgetData,
      priceWatchAlerts,
    });

    // 4. Enrich with strictly bounded AI reasoning
    const finalEvents = await this.enrichEventsWithAI(activeTrip, ruleEvents);

    // 5. Cache and return
    commanderMemoryCache.set(cacheKey, { events: finalEvents, timestamp: Date.now() });
    return finalEvents;
  }

  /**
   * Accept a commander event action and mutate the trip itinerary in MongoDB.
   * Prevents duplicates, checks ownership, applies the change, and persists state.
   */
  async acceptEvent(userId, eventId, options = {}) {
    if (!eventId) {
      throw new Error("Event ID is required to accept a commander plan.");
    }

    // 1. Identify Trip by ID or query user trips
    let trip = null;

    // Check if eventId encodes the tripId: evt_<tripId>_<type>...
    const parts = eventId.split("_");
    if (parts.length >= 3 && parts[0] === "evt") {
      const candidateTripId = parts[1];
      if (candidateTripId.match(/^[0-9a-fA-F]{24}$/)) {
        trip = await Trip.findOne({
          _id: candidateTripId,
          $or: [{ createdBy: userId }, { userId }, { "members.userId": userId }, { "members.email": userId }],
        });
      }
    }

    if (!trip && options.tripId) {
      trip = await Trip.findOne({
        _id: options.tripId,
        $or: [{ createdBy: userId }, { userId }, { "members.userId": userId }, { "members.email": userId }],
      });
    }

    if (!trip) {
      // Fallback: user's most recent active trip
      trip = await Trip.findOne({
        $or: [{ createdBy: userId }, { userId }, { "members.userId": userId }, { "members.email": userId }],
      }).sort({ createdAt: -1 });
    }

    if (!trip) {
      throw new Error("Trip not found or unauthorized for this user.");
    }

    // 2. Prevent duplicate acceptance
    if (!Array.isArray(trip.acceptedCommanderEvents)) {
      trip.acceptedCommanderEvents = [];
    }

    const alreadyAccepted = trip.acceptedCommanderEvents.some((e) => e.eventId === eventId);
    if (alreadyAccepted) {
      return {
        success: true,
        alreadyAccepted: true,
        message: "This commander recommendation has already been accepted and applied.",
        eventId,
        tripId: trip._id,
        trip,
      };
    }

    // 3. Mutate Itinerary / Budget based on Event Type
    let actionTaken = "Commander recommendation applied";

    if (eventId.includes("act_weather")) {
      // Impacted weather activity: reschedule or mark indoor alternative
      if (Array.isArray(trip.days) && trip.days.length > 0) {
        let modified = false;
        for (const day of trip.days) {
          if (Array.isArray(day.activities) && day.activities.length > 0) {
            for (const act of day.activities) {
              if (!act.description.includes("[Weather Protected]")) {
                act.description = `[Weather Protected / Indoor Alternative] ${act.description}`;
                modified = true;
                break;
              }
            }
          }
          if (modified) break;
        }
      }
      actionTaken = "Updated outdoor activity with weather-protected indoor alternative.";
    } else if (eventId.includes("weather_rain")) {
      // General rain risk: append indoor alternative buffer activity
      if (Array.isArray(trip.days) && trip.days.length > 0) {
        const firstDay = trip.days[0];
        if (!Array.isArray(firstDay.activities)) firstDay.activities = [];
        firstDay.activities.push({
          time: "15:00",
          description: "Indoor Museum / Cultural Cafe Excursion [Commander Rainy Weather Buffer]",
        });
      }
      actionTaken = "Added afternoon indoor alternative buffer to itinerary.";
    } else if (eventId.includes("flight_delay")) {
      // Flight delay: add airport buffer activity and adjust schedule
      if (Array.isArray(trip.days) && trip.days.length > 0) {
        const firstDay = trip.days[0];
        if (!Array.isArray(firstDay.activities)) firstDay.activities = [];
        firstDay.activities.unshift({
          time: "Arrival",
          description: "Transit & Luggage Buffer Window [Delayed Flight Arrival Adjusted]",
        });
      }
      actionTaken = "Inserted arrival transit buffer to account for flight delay.";
    } else if (eventId.includes("budget_over") || eventId.includes("budget_warn")) {
      // Budget alert: adjust contingency allocation in budgetBreakdown
      if (!trip.budgetBreakdown) {
        trip.budgetBreakdown = { currency: "INR", categories: [] };
      }
      if (!Array.isArray(trip.budgetBreakdown.categories)) {
        trip.budgetBreakdown.categories = [];
      }

      const existingContingency = trip.budgetBreakdown.categories.find(
        (c) => c.category === "contingency" || c.category === "buffer"
      );

      if (existingContingency) {
        existingContingency.amount = (existingContingency.amount || 0) + 3000;
      } else {
        trip.budgetBreakdown.categories.push({
          category: "contingency",
          label: "Emergency Buffer",
          description: "Contingency reserve allocated by Trip Commander",
          amount: 5000,
          type: "ESTIMATED",
        });
      }
      actionTaken = "Reallocated emergency contingency budget reserve.";
    } else {
      actionTaken = "Acknowledged and logged Commander event.";
    }

    // 4. Record accepted event
    trip.acceptedCommanderEvents.push({
      eventId,
      acceptedAt: new Date(),
      actionTaken,
    });

    // 5. Persist to MongoDB
    trip.markModified("days");
    trip.markModified("acceptedCommanderEvents");
    trip.markModified("budgetBreakdown");
    await trip.save();

    // 6. Invalidate cached events so next query re-evaluates cleanly
    const cacheKey = `${userId}_${trip._id}`;
    commanderMemoryCache.delete(cacheKey);

    logger.info(`[CommanderService] User ${userId} accepted event ${eventId} on trip ${trip._id}: ${actionTaken}`);

    return {
      success: true,
      alreadyAccepted: false,
      message: actionTaken,
      eventId,
      tripId: trip._id,
      trip,
    };
  }
}

export const commanderService = new CommanderService();
export default commanderService;

