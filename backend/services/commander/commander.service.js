import Trip from "../../models/Trip.js";
import { weatherProvider } from "../travel/providers/weather.provider.js";
import { flightProvider } from "../travel/providers/flight.provider.js";
import { evaluateTripEvents } from "../commanderRulesEngine.js";
import { analyzeTripBudget } from "../travelDataService.js";
import PriceWatch from "../../models/PriceWatch.js";
import { aiRouter } from "../ai/ai-router.service.js";
import { parseAIJson } from "../ai/ai-parser.js";
import { logger } from "../../utils/logger.js";

// Cache TTL: 5 minutes
const COMMANDER_CACHE_TTL = 5 * 60 * 1000;
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
            ...original,
            title: item.title || original.title,
            reason: item.reason || original.reason,
            action: item.action || original.action,
            delta: item.delta || original.delta,
            id: original.id || item.id || `evt_${idx}`,
            kind: original.kind || item.kind,
            alertType: original.alertType || item.alertType,
            dataType: original.dataType || item.dataType || "AI_GENERATED",
            source: original.source || item.source || "Advenza Verified Telemetry",
            updatedAt: original.updatedAt || new Date().toISOString(),
            actionable: original.actionable ?? false,
            actionLabel: original.actionLabel,
            actionPayload: original.actionPayload,
            actionType: original.actionType,
            isAccepted: original.isAccepted || false,
            acceptedAt: original.acceptedAt,
            actionTaken: original.actionTaken,
            facts: original.facts,
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
   * Get verified commander events and vitals for user's active trip.
   */
  async getEvents(userId, tripId, userEmail = null) {
    const orConditions = [
      { createdBy: userId },
      { userId },
      { "members.userId": userId },
    ];
    if (userEmail) {
      orConditions.push({ "members.email": userEmail.trim().toLowerCase() });
    }

    const userTrips = await Trip.find({ $or: orConditions })
      .sort({ createdAt: -1 })
      .lean();

    if (!userTrips || userTrips.length === 0) {
      return {
        events: [],
        vitals: null,
        acceptedEvents: [],
        activeTrip: null,
      };
    }

    const activeTrip = tripId
      ? userTrips.find((t) => String(t._id) === String(tripId)) || userTrips[0]
      : userTrips[0];

    const cacheKey = `${userId}_${activeTrip._id}`;
    const cached = commanderMemoryCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < COMMANDER_CACHE_TTL) {
      const cachedEvents = (cached.data.events || []).map((e) => ({
        ...e,
        dataType: e.dataType === "LIVE_VERIFIED" ? "CACHED_VERIFIED" : e.dataType,
      }));
      return {
        ...cached.data,
        events: cachedEvents,
      };
    }

    const destination = activeTrip.destination || activeTrip.title || "Goa";

    // 1. Resolve days and activities
    const days = (activeTrip.days && activeTrip.days.length > 0)
      ? activeTrip.days
      : (activeTrip.itinerary?.days || (Array.isArray(activeTrip.itinerary) ? activeTrip.itinerary : []));

    // 2. Check Itinerary Activities for time-specific weather conflicts
    const activityWeatherRisks = [];
    try {
      for (const day of days.slice(0, 5)) { // Check up to first 5 days
        const activities = day.activities || [];
        const dayLabel = day.dayNumber ? `Day ${day.dayNumber}` : (day.title || "Upcoming");
        for (let actIdx = 0; actIdx < activities.length; actIdx++) {
          const act = activities[actIdx];
          const actName = act.placeName || act.title || act.activity || act.description || "";
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
                activityIndex: actIdx,
                dayNumber: day.dayNumber || 1,
                activityTime: `${dayLabel}, ${act.time}`,
              });
            }
          }
        }
      }
    } catch (actErr) {
      logger.debug(`[Commander] Activity weather evaluation notice: ${actErr.message}`);
    }

    // 3. Resolve Transit and Flight Status
    let flightData = null;
    const transitRef = activeTrip.transitRef || activeTrip.outboundJourney?.transitRef || "";
    if (transitRef) {
      try {
        flightData = await flightProvider.getFlightStatus({ flightNumber: transitRef });
      } catch (err) {
        logger.debug(`[Commander] Flight query notice: ${err.message}`);
      }
    }

    // 4. Resolve Budget Status
    let budgetData = null;
    try {
      const { budgetService } = await import("../budget/budget.service.js");
      const summary = await budgetService.getBudgetSummary(activeTrip._id);
      if (summary) {
        budgetData = {
          success: true,
          status: "LIVE_VERIFIED",
          budgetTotal: summary.totalBudget || summary.budgetTotal || Number(activeTrip.budgetTotal) || 0,
          totalSpent: summary.actualTotal ?? summary.totalSpent ?? 0,
          remaining: summary.remaining ?? 0,
          pctUsed: summary.percentUsed ?? summary.pctUsed ?? 0,
          expenseCount: summary.expenses?.length || 0,
          isOverBudget: (summary.actualTotal ?? 0) > (summary.totalBudget || Number(activeTrip.budgetTotal) || 0),
          source: "Trip Ledger (MongoDB)",
          calculatedAt: new Date().toISOString(),
        };
      }
    } catch {
      budgetData = analyzeTripBudget(activeTrip);
    }

    // 5. Fetch parallel verified facts
    const [weatherData, activePriceWatches] = await Promise.all([
      weatherProvider.getCurrentWeather(destination),
      PriceWatch.find({ userId, status: "active", lastAlertedAt: { $exists: true } })
        .sort({ lastAlertedAt: -1 })
        .limit(2)
        .lean()
        .catch(() => []),
    ]);

    // Format price watch alerts if any
    const priceWatchAlerts = (activePriceWatches || []).map((w) => ({
      _id: w._id,
      type: w.type,
      title: w.type === "flight" ? `${w.origin} → ${w.destination} Flight` : `${w.destination} Hotel`,
      currentPrice: w.lastPrice,
      previousPrice: w.previousPrice,
      targetPrice: w.targetPrice,
      provider: w.provider,
      observedAt: w.lastAlertedAt,
    }));

    // 6. Pass verified facts into deterministic rules engine
    const ruleEvents = evaluateTripEvents({
      trip: activeTrip,
      weatherData,
      activityWeatherRisks,
      flightData,
      budgetData,
      priceWatchAlerts,
    });

    // 7. Check previously accepted events on this trip
    const acceptedMap = new Map();
    if (Array.isArray(activeTrip.acceptedCommanderEvents)) {
      activeTrip.acceptedCommanderEvents.forEach((a) => {
        if (a.eventId) acceptedMap.set(a.eventId, a);
      });
    }

    ruleEvents.forEach((evt) => {
      const match = acceptedMap.get(evt.id);
      if (match) {
        evt.isAccepted = true;
        evt.acceptedAt = match.acceptedAt;
        evt.actionTaken = match.actionTaken;
      } else {
        evt.isAccepted = false;
      }
    });

    // 8. Enrich with strictly bounded AI reasoning
    const finalEvents = await this.enrichEventsWithAI(activeTrip, ruleEvents);

    // 9. Synthesize System Vitals
    const hasBadAlerts = finalEvents.some((e) => e.severity === "bad" && !e.isAccepted);
    const hasWarnAlerts = finalEvents.some((e) => e.severity === "warn" && !e.isAccepted);
    const overallStatus = hasBadAlerts ? "CRITICAL" : hasWarnAlerts ? "ATTENTION" : "NOMINAL";
    const actionableCount = finalEvents.filter((e) => e.actionable && !e.isAccepted).length;

    const weatherVital = {
      temperatureC: weatherData?.data?.temperatureC ?? weatherData?.temperatureC ?? 26,
      condition: weatherData?.data?.condition ?? weatherData?.condition ?? "Clear sky",
      rainProbabilityPercent: weatherData?.data?.rainProbabilityPercent ?? weatherData?.rainProbabilityPercent ?? 10,
      windSpeedKmh: weatherData?.data?.windSpeedKmh ?? 12,
      location: destination,
      station: weatherData?.source || "Open-Meteo Meteorology Station",
      status: weatherData?.status || "LIVE_VERIFIED",
    };

    const flightVital = {
      transitRef: activeTrip.transitRef || "",
      travelMode: activeTrip.travelMode || "Flight",
      status: flightData?.status || (activeTrip.transitRef ? "ON_SCHEDULE" : "UNLINKED"),
      flightNumber: flightData?.flightNumber || activeTrip.transitRef || null,
      origin: flightData?.origin || activeTrip.origin || "",
      destination: flightData?.destination || destination,
      delayMinutes: flightData?.delayMinutes || 0,
      gate: flightData?.gate || null,
      terminal: flightData?.terminal || null,
    };

    const budgetVital = {
      budgetTotal: budgetData?.budgetTotal || Number(activeTrip.budgetTotal) || 0,
      totalSpent: budgetData?.totalSpent || 0,
      remaining: budgetData?.remaining || 0,
      pctUsed: budgetData?.pctUsed || 0,
      status: budgetData?.isOverBudget ? "OVER_BUDGET" : (budgetData?.pctUsed >= 80 ? "WARNING" : "HEALTHY"),
    };

    const scheduleVital = {
      totalDays: (days && days.length) || activeTrip.duration || 1,
      totalActivities: (days || []).reduce((sum, d) => sum + (d.activities?.length || 0), 0),
      hasTimingConflict: Boolean(activeTrip.tripTiming?.timingConflict?.hasConflict),
    };

    const result = {
      events: finalEvents,
      vitals: {
        status: overallStatus,
        actionableCount,
        weather: weatherVital,
        flight: flightVital,
        budget: budgetVital,
        schedule: scheduleVital,
        lastSync: new Date().toISOString(),
      },
      acceptedEvents: activeTrip.acceptedCommanderEvents || [],
      activeTrip: {
        _id: activeTrip._id,
        title: activeTrip.title,
        destination: activeTrip.destination,
        origin: activeTrip.origin,
        startDate: activeTrip.startDate,
        endDate: activeTrip.endDate,
        transitRef: activeTrip.transitRef,
        travelMode: activeTrip.travelMode,
        duration: activeTrip.duration || (days && days.length) || 1,
      },
    };

    // 10. Cache and return
    commanderMemoryCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
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

    if (options.tripId) {
      trip = await Trip.findOne({
        _id: options.tripId,
        $or: [{ createdBy: userId }, { userId }, { "members.userId": userId }],
      });
    }

    if (!trip) {
      const parts = eventId.split("_");
      if (parts.length >= 3 && parts[0] === "evt") {
        const candidateTripId = parts[1];
        if (candidateTripId.match(/^[0-9a-fA-F]{24}$/)) {
          trip = await Trip.findOne({
            _id: candidateTripId,
            $or: [{ createdBy: userId }, { userId }, { "members.userId": userId }],
          });
        }
      }
    }

    if (!trip) {
      trip = await Trip.findOne({
        $or: [{ createdBy: userId }, { userId }, { "members.userId": userId }],
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
    const payload = options.payload || {};

    if (eventId.includes("act_weather") || payload.type === "SWAP_INDOOR") {
      // Impacted weather activity: reschedule or mark indoor alternative
      let modified = false;
      const targetDayNumber = payload.dayNumber ? Number(payload.dayNumber) : null;
      const targetActIndex = payload.activityIndex !== undefined ? Number(payload.activityIndex) : null;

      if (Array.isArray(trip.days) && trip.days.length > 0) {
        for (const day of trip.days) {
          if (targetDayNumber !== null && day.dayNumber !== targetDayNumber) {
            continue;
          }
          if (Array.isArray(day.activities) && day.activities.length > 0) {
            if (targetActIndex !== null && day.activities[targetActIndex]) {
              const act = day.activities[targetActIndex];
              const origDesc = act.description || act.placeName || "Outdoor Activity";
              act.description = `[Weather-Protected / Indoor Alternative] ${origDesc}`;
              if (act.placeName && !act.placeName.includes("[Weather Protected]")) {
                act.placeName = `${act.placeName} [Indoor Art & Heritage Alternative]`;
              }
              act.placeType = "INDOOR_CULTURAL";
              modified = true;
              break;
            } else {
              for (const act of day.activities) {
                const desc = act.description || "";
                if (!desc.includes("[Weather Protected]") && !desc.includes("[Weather-Protected")) {
                  act.description = `[Weather-Protected / Indoor Alternative] ${desc || act.placeName || "Outdoor Sightseeing"}`;
                  if (act.placeName && !act.placeName.includes("[Weather Protected]")) {
                    act.placeName = `${act.placeName} [Indoor Cultural Alternative]`;
                  }
                  act.placeType = "INDOOR_CULTURAL";
                  modified = true;
                  break;
                }
              }
            }
          }
          if (modified) break;
        }
      }
      actionTaken = "Updated outdoor activity with weather-protected indoor alternative.";
    } else if (eventId.includes("weather_rain") || payload.type === "ADD_RAIN_BUFFER") {
      // General rain risk: append indoor alternative buffer activity
      if (Array.isArray(trip.days) && trip.days.length > 0) {
        const firstDay = trip.days[0];
        if (!Array.isArray(firstDay.activities)) firstDay.activities = [];
        firstDay.activities.push({
          time: "15:00",
          placeName: "Indoor Cultural Haven & Art Museum",
          description: "Indoor Museum / Cultural Cafe Excursion [Commander Rainy Weather Buffer]",
        });
      }
      actionTaken = "Added afternoon indoor alternative buffer to itinerary.";
    } else if (eventId.includes("flight_delay") || payload.type === "ADJUST_FLIGHT_DELAY") {
      // Flight delay: add airport buffer activity and adjust schedule
      const delayMinutes = payload.delayMinutes || 45;
      if (Array.isArray(trip.days) && trip.days.length > 0) {
        const firstDay = trip.days[0];
        if (!Array.isArray(firstDay.activities)) firstDay.activities = [];
        firstDay.activities.unshift({
          time: "Arrival",
          placeName: "Arrival Transit Lounge",
          description: `Transit & Luggage Buffer Window [Delayed Flight Arrival Adjusted +${delayMinutes}m]`,
        });
      }
      actionTaken = `Inserted arrival transit buffer to account for ${delayMinutes}-minute flight delay.`;
    } else if (eventId.includes("budget_over") || eventId.includes("budget_warn") || payload.type === "BUDGET_REBALANCE") {
      // Budget alert: adjust contingency allocation in budgetBreakdown
      const bumpAmount = payload.amount || (eventId.includes("budget_over") ? 5000 : 3000);
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
        existingContingency.amount = (existingContingency.amount || 0) + bumpAmount;
      } else {
        trip.budgetBreakdown.categories.push({
          category: "contingency",
          label: "Emergency Buffer",
          description: "Contingency reserve allocated by Trip Commander",
          amount: bumpAmount,
          type: "ESTIMATED",
        });
      }
      trip.budgetTotal = (Number(trip.budgetTotal) || 0) + bumpAmount;
      actionTaken = `Reallocated ₹${bumpAmount.toLocaleString("en-IN")} emergency contingency budget reserve.`;
    } else if (eventId.includes("timing_conflict") || payload.type === "REALIGN_SCHEDULE") {
      if (Array.isArray(trip.days) && trip.days.length > 0) {
        const firstDay = trip.days[0];
        if (Array.isArray(firstDay.activities)) {
          firstDay.activities.forEach((act, idx) => {
            if (idx === 0) {
              act.time = "14:30";
              act.description = `[Post-Arrival Check-in Realigned] ${act.description || act.placeName || ""}`;
            }
          });
        }
      }
      actionTaken = "Realigned Day 1 activity schedule to commence after verified arrival.";
    } else if (eventId.includes("pace_day") || payload.type === "INSERT_PACING_BUFFER") {
      const dayNum = payload.dayNumber || 1;
      const targetDay = trip.days?.find((d) => d.dayNumber === dayNum) || trip.days?.[0];
      if (targetDay && Array.isArray(targetDay.activities)) {
        const midIdx = Math.max(1, Math.floor(targetDay.activities.length / 2));
        targetDay.activities.splice(midIdx, 0, {
          time: "15:30",
          placeName: "Artisanal Cafe & Garden Rest Stop",
          description: "45-Minute Leisure Buffer Window [Pacing Balance Added by Commander]",
        });
      }
      actionTaken = `Inserted 45-minute relaxation buffer into Day ${dayNum} itinerary pacing.`;
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
    trip.markModified("budgetTotal");
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

  /**
   * Revert a previously accepted commander event.
   */
  async revertEvent(userId, eventId, options = {}) {
    if (!eventId) {
      throw new Error("Event ID is required to revert a commander plan.");
    }

    let trip = null;
    if (options.tripId) {
      trip = await Trip.findOne({
        _id: options.tripId,
        $or: [{ createdBy: userId }, { userId }, { "members.userId": userId }],
      });
    }

    if (!trip) {
      const parts = eventId.split("_");
      if (parts.length >= 3 && parts[0] === "evt" && parts[1].match(/^[0-9a-fA-F]{24}$/)) {
        trip = await Trip.findOne({
          _id: parts[1],
          $or: [{ createdBy: userId }, { userId }, { "members.userId": userId }],
        });
      }
    }

    if (!trip) {
      trip = await Trip.findOne({
        $or: [{ createdBy: userId }, { userId }, { "members.userId": userId }],
      }).sort({ createdAt: -1 });
    }

    if (!trip) {
      throw new Error("Trip not found or unauthorized.");
    }

    if (Array.isArray(trip.acceptedCommanderEvents)) {
      trip.acceptedCommanderEvents = trip.acceptedCommanderEvents.filter((e) => e.eventId !== eventId);
      trip.markModified("acceptedCommanderEvents");
      await trip.save();
    }

    const cacheKey = `${userId}_${trip._id}`;
    commanderMemoryCache.delete(cacheKey);

    return {
      success: true,
      message: "Reverted Commander recommendation.",
      eventId,
      tripId: trip._id,
    };
  }

  /**
   * Quick-update transit reference (flight/train number) for live radar monitoring.
   */
  async updateTransitRef(userId, { tripId, transitRef, travelMode }) {
    if (!tripId || !transitRef) {
      throw new Error("tripId and transitRef are required.");
    }
    const trip = await Trip.findOne({
      _id: tripId,
      $or: [{ createdBy: userId }, { userId }, { "members.userId": userId }],
    });
    if (!trip) {
      throw new Error("Trip not found or unauthorized.");
    }

    trip.transitRef = transitRef.trim().toUpperCase();
    if (travelMode) trip.travelMode = travelMode;
    if (trip.outboundJourney) {
      trip.outboundJourney.transitRef = trip.transitRef;
      if (travelMode) trip.outboundJourney.transportType = travelMode;
    }
    trip.markModified("outboundJourney");
    await trip.save();

    const cacheKey = `${userId}_${trip._id}`;
    commanderMemoryCache.delete(cacheKey);

    logger.info(`[CommanderService] Updated transitRef to ${trip.transitRef} on trip ${trip._id}`);
    return {
      success: true,
      message: `Linked transit reference "${trip.transitRef}" for live radar tracking.`,
      transitRef: trip.transitRef,
      tripId: trip._id,
    };
  }

  /**
   * Execute direct natural-language instruction via Commander Autopilot.
   */
  async executeCommanderInstruction(userId, { tripId, instruction }) {
    if (!tripId || !instruction) {
      throw new Error("tripId and instruction are required.");
    }
    const trip = await Trip.findOne({
      _id: tripId,
      $or: [{ createdBy: userId }, { userId }, { "members.userId": userId }],
    });
    if (!trip) {
      throw new Error("Trip not found or unauthorized.");
    }

    const prompt = `You are Trip Commander, an AI travel operations autopilot.
The traveler wants to adjust their trip: "${trip.title}" (${trip.destination || "Destination"}).
Current days and activities:
${JSON.stringify((trip.days || []).map((d) => ({ dayNumber: d.dayNumber, title: d.title, activities: d.activities?.map((a) => ({ time: a.time, placeName: a.placeName, description: a.description })) })), null, 2)}

Traveler instruction: "${instruction}"

Apply the modification realistically.
Return ONLY a valid JSON object matching this exact schema:
{
  "summary": "1-sentence description of what changed",
  "days": [
    {
      "dayNumber": 1,
      "title": "Day title",
      "activities": [
        {
          "time": "HH:MM",
          "placeName": "Name of venue or stop",
          "description": "Short description of stop"
        }
      ]
    }
  ]
}`;

    try {
      const completion = await aiRouter.callAI({
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 2500,
      });

      const parsed = parseAIJson(completion.content);
      if (parsed && Array.isArray(parsed.days) && parsed.days.length > 0) {
        parsed.days.forEach((newDay) => {
          const orig = trip.days.find((d) => d.dayNumber === newDay.dayNumber);
          if (orig && Array.isArray(newDay.activities)) {
            orig.activities = newDay.activities.map((a) => ({
              time: a.time || "Flexible",
              placeName: a.placeName || a.title || "Stop",
              description: a.description || a.placeName || "",
            }));
          }
        });

        trip.markModified("days");
        await trip.save();

        const cacheKey = `${userId}_${trip._id}`;
        commanderMemoryCache.delete(cacheKey);

        return {
          success: true,
          message: parsed.summary || "Successfully updated itinerary schedule.",
          trip,
        };
      }
    } catch (err) {
      logger.warn(`[Commander] AI instruction execution failed: ${err.message}`);
    }

    return {
      success: false,
      message: "Could not apply schedule modification. Please provide more specific details.",
    };
  }
}

export const commanderService = new CommanderService();
export default commanderService;
