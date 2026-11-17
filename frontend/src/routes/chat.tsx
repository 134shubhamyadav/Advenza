import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Sparkles, 
  Send, 
  Map, 
  Utensils, 
  Star, 
  MapPin, 
  Clock, 
  ExternalLink, 
  Navigation,
  Compass,
  ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { tripService, type TripSummary } from "@/services/tripService";
import { MarkdownMessage } from "@/components/markdown-message";

export const Route = createFileRoute("/chat")({ component: Chat });

const getDynamicStarterPrompts = (destination?: string) => {
  const dest = destination?.trim();
  if (dest) {
    return [
      { icon: Utensils, text: `Best local dining & authentic food in ${dest}` },
      { icon: Sparkles, text: `Secret hidden gems & scenic spots in ${dest}` },
      { icon: Map, text: `Must-visit cultural landmarks & highlights in ${dest}` },
      { icon: Compass, text: `Plan a 1-day exploration itinerary for ${dest}` },
    ];
  }
  return [
    { icon: Utensils, text: "Best local dining & authentic food recommendations" },
    { icon: Sparkles, text: "Discover offbeat hidden gems and authentic experiences" },
    { icon: Map, text: "Cultural landmarks and top sights for my journey" },
    { icon: Compass, text: "Plan a realistic day-wise sightseeing route" },
  ];
};

interface PlaceCard {
  name: string;
  region?: string;
  address?: string;
  cuisine?: string;
  category?: string;
  rating?: number;
  userRatingsCount?: number;
  whySpecial?: string;
  openingHours?: string;
  isOpenToday?: boolean;
  priceInfo?: {
    amount: string;
    isVerified: boolean;
  };
  confidence?: string;
  mapLink?: string;
  distanceFromHotel?: string;
}

interface DirectionsCard {
  origin?: string;
  destination?: string;
  distanceKm?: number;
  durationMins?: number;
  isFeasibleSameDay?: boolean;
  explanation?: string;
  trafficLevel?: string;
}

interface OpeningHoursCard {
  name?: string;
  openingHours?: string;
  isOpenToday?: boolean;
  reason?: string;
}

interface ChatMessage {
  role: "assistant" | "user";
  text: string;
  intent?: string;
  confidence?: string;
  format?: string;
  destination?: string;
  places?: PlaceCard[];
  directions?: DirectionsCard;
  openingInfo?: OpeningHoursCard;
  followUpSuggestions?: string[];
}

function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      text: "Hello! I'm Advenza, your intelligent travel companion. I provide verified restaurant recommendations, authentic hidden gems, route distances, and time-aware local guidance for destinations worldwide.\n\nAsk me anything about your destination or active journey!",
    },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [selectedTripId, setSelectedTripId] = useState<string>("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch user's saved trips for optional context linking
  const { data: userTrips = [] } = useQuery({
    queryKey: ["user-trips-chat"],
    queryFn: () => tripService.getTrips().catch(() => []),
  });

  const activeTrip = userTrips.find((t: TripSummary) => t._id === selectedTripId);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  const send = async (text: string) => {
    if (!text.trim() || typing) return;
    const userMsg: ChatMessage = { role: "user", text };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setTyping(true);

    try {
      const data = await apiFetch("/api/ai/chat", {
        method: "POST",
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.text })),
          tripId: selectedTripId || undefined,
          destination: activeTrip?.destination || undefined,
          hotelLocation: activeTrip?.hotelLocation || activeTrip?.hotelName || undefined,
        }),
      });

      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: data.reply || "",
          intent: data.intent,
          confidence: data.confidence,
          format: data.format,
          destination: data.destination,
          places: data.places,
          directions: data.directions,
          openingInfo: data.openingInfo,
          followUpSuggestions: data.followUpSuggestions,
        },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: "I'm having trouble connecting to the travel intelligence service right now. Please verify the backend is running.",
        },
      ]);
    } finally {
      setTyping(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-4xl flex-col">
        {/* Header Bar with Trip Context Linking */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-foreground text-sm">Advenza Travel Intelligence</p>
                <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                  Grounded & Time-Aware
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Verified Google Places · Opening Hours · Anti-Hallucination Routing
              </p>
            </div>
          </div>

          {/* Context Selector: Link to Active Trip */}
          {userTrips.length > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Active Trip:</span>
              <select
                value={selectedTripId}
                onChange={(e) => setSelectedTripId(e.target.value)}
                className="h-8 rounded-lg border border-border/70 bg-background px-2.5 text-xs text-foreground outline-none"
              >
                <option value="">General Exploration (No Trip Linked)</option>
                {userTrips.map((t: TripSummary) => (
                  <option key={t._id} value={t._id}>
                    {t.destination} ({t.title || `${t.days?.length || 1} days`})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Message Thread Scroll Area */}
        <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto py-5 pr-1">
          {messages.map((m, i) => (
            <div key={i} className={cn("flex flex-col gap-2", m.role === "user" ? "items-end" : "items-start")}>
              <div className={cn("flex gap-3 max-w-[92%]", m.role === "user" ? "justify-end" : "")}>
                {m.role === "assistant" && (
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm mt-0.5">
                    <Sparkles className="h-3.5 w-3.5" />
                  </span>
                )}

                <div className="space-y-3 flex-1 min-w-0">
                  {/* Text Bubble */}
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm",
                      m.role === "user"
                        ? "bg-primary text-primary-foreground ml-auto whitespace-pre-wrap"
                        : "glass-panel text-foreground"
                    )}
                  >
                    {m.role === "assistant" ? (
                      <MarkdownMessage content={m.text} />
                    ) : (
                      m.text
                    )}
                  </div>

                  {/* Structured Recommendation Cards */}
                  {m.places && m.places.length > 0 && (
                    <div className="grid gap-3 sm:grid-cols-2 pt-1">
                      {m.places.map((place, pIdx) => (
                        <div
                          key={pIdx}
                          className="rounded-xl border border-border/70 bg-card p-3.5 text-xs space-y-2.5 shadow-sm hover:border-primary/40 transition-all"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="font-semibold text-foreground text-sm leading-tight">
                                {place.name}
                              </h4>
                              <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                <MapPin className="h-3 w-3 text-primary shrink-0" />
                                <span>{place.region}</span>
                              </p>
                            </div>
                            {place.rating && (
                              <Badge variant="secondary" className="text-[10px] shrink-0 flex items-center gap-0.5 font-medium">
                                <Star className="h-2.5 w-2.5 text-amber-500 fill-amber-500" />
                                {place.rating}
                                {place.userRatingsCount ? ` (${place.userRatingsCount > 1000 ? `${(place.userRatingsCount / 1000).toFixed(1)}k` : place.userRatingsCount})` : ""}
                              </Badge>
                            )}
                          </div>

                          {place.whySpecial && (
                            <p className="text-[11px] text-muted-foreground/90 italic border-l-2 border-primary/40 pl-2">
                              "{place.whySpecial}"
                            </p>
                          )}

                          <div className="space-y-1 pt-1 border-t border-border/40 text-[11px]">
                            {place.cuisine && (
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <Utensils className="h-3 w-3 text-primary shrink-0" />
                                <span className="font-medium text-foreground">{place.cuisine}</span>
                              </div>
                            )}

                            {place.openingHours && (
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <Clock className="h-3 w-3 text-emerald-500 shrink-0" />
                                <span>{place.openingHours}</span>
                              </div>
                            )}

                            {place.priceInfo && (
                              <div className="flex items-center justify-between text-muted-foreground pt-0.5">
                                <span>Budget: <strong className="text-foreground">{place.priceInfo.amount}</strong></span>
                                {place.priceInfo.isVerified ? (
                                  <Badge variant="outline" className="text-[9px] py-0 px-1 border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                                    Verified
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[9px] py-0 px-1 text-muted-foreground">
                                    Estimate
                                  </Badge>
                                )}
                              </div>
                            )}

                            {place.distanceFromHotel && (
                              <div className="flex items-center gap-1.5 text-primary font-medium pt-0.5">
                                <Navigation className="h-3 w-3 shrink-0" />
                                <span>{place.distanceFromHotel}</span>
                              </div>
                            )}
                          </div>

                          {place.mapLink && (
                            <a
                              href={place.mapLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline pt-1"
                            >
                              <span>View on Google Maps</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Route & Directions Card */}
                  {m.directions && (
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground flex items-center gap-1.5">
                          <Navigation className="h-3.5 w-3.5 text-primary" />
                          Route & Distance Intelligence
                        </span>
                        {m.directions.distanceKm && (
                          <Badge variant="secondary" className="text-[10px]">
                            {m.directions.distanceKm} km
                          </Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground text-[11px]">
                        <strong>{m.directions.origin}</strong> → <strong>{m.directions.destination}</strong>
                      </p>
                      {m.directions.explanation && (
                        <p className="text-foreground/90 text-xs font-medium">
                          {m.directions.explanation}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Venue Opening Hours Card */}
                  {m.openingInfo && (
                    <div className="rounded-xl border border-border/70 bg-card p-3 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-primary" />
                          {m.openingInfo.name}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px]",
                            m.openingInfo.isOpenToday
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                              : "bg-destructive/10 text-destructive border-destructive/30"
                          )}
                        >
                          {m.openingInfo.isOpenToday ? "Open Today" : "Closed Today"}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground text-[11px]">
                        Operating Hours: <strong>{m.openingInfo.openingHours}</strong>
                      </p>
                    </div>
                  )}

                  {/* Contextual Follow-Up Quick Action Chips */}
                  {m.followUpSuggestions && m.followUpSuggestions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {m.followUpSuggestions.map((s, sIdx) => (
                        <button
                          key={sIdx}
                          type="button"
                          onClick={() => send(s)}
                          disabled={typing}
                          className="rounded-full border border-primary/20 bg-primary/5 hover:bg-primary/10 hover:border-primary/40 px-3 py-1 text-[11px] font-medium text-foreground transition-all flex items-center gap-1"
                        >
                          <span>{s}</span>
                          <ArrowRight className="h-2.5 w-2.5 text-primary" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Typing Indicator */}
          {typing && (
            <div className="flex gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <div className="rounded-2xl glass-panel px-4 py-3">
                <div className="flex gap-1.5 items-center">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="h-2 w-2 animate-bounce rounded-full bg-primary/60"
                      style={{ animationDelay: `${i * 140}ms` }}
                    />
                  ))}
                  <span className="text-[11px] text-muted-foreground ml-2">Retrieving verified travel facts...</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Starter Prompts (shown when only initial greeting is in thread) */}
        {messages.length <= 1 && (
          <div className="mb-3 grid grid-cols-2 gap-2">
            {getDynamicStarterPrompts(activeTrip?.destination).map((p) => (
              <button
                key={p.text}
                onClick={() => send(p.text)}
                disabled={typing}
                className="flex items-center gap-2 rounded-xl glass-panel px-3 py-2.5 text-left text-xs hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50 transition-all"
              >
                <p.icon className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="truncate">{p.text}</span>
              </button>
            ))}
          </div>
        )}

        {/* Chat Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-center gap-2 rounded-2xl glass-panel p-2 shadow-soft mt-1"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about places, non-veg lunch, hidden gems, distance, hours…"
            disabled={typing}
            className="flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
          />
          <Button
            type="submit"
            size="icon"
            className="rounded-xl h-10 w-10 shrink-0"
            disabled={typing || !input.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </AppShell>
  );
}
