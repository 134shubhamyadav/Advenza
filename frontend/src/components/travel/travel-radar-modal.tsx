import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Plane,
  Building2,
  Bell,
  Search,
  CloudSun,
  Clock,
  ArrowRight,
  TrendingDown,
  Trash2,
  Pause,
  Play,
  Loader2,
  ExternalLink,
  ShieldCheck,
  Info,
  Check,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

interface TravelRadarModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  activeTrip?: any;
}

export function TravelRadarModal({ isOpen, onOpenChange, activeTrip }: TravelRadarModalProps) {
  const [activeTab, setActiveTab] = useState("flights");

  // Flight search states
  const [flightOrigin, setFlightOrigin] = useState("BOM");
  const [flightDestination, setFlightDestination] = useState("GOI");
  const [flightDate, setFlightDate] = useState("");
  const [flightPassengers, setFlightPassengers] = useState(1);
  const [searchingFlights, setSearchingFlights] = useState(false);
  const [flightResults, setFlightResults] = useState<any[]>([]);
  const [flightProviderName, setFlightProviderName] = useState("");
  const [flightConfigured, setFlightConfigured] = useState<boolean>(true);
  const [flightMessage, setFlightMessage] = useState<string>("");

  // Hotel search states
  const [hotelDestination, setHotelDestination] = useState("Goa");
  const [hotelCheckIn, setHotelCheckIn] = useState("");
  const [hotelCheckOut, setHotelCheckOut] = useState("");
  const [hotelGuests, setHotelGuests] = useState(2);
  const [searchingHotels, setSearchingHotels] = useState(false);
  const [hotelResults, setHotelResults] = useState<any[]>([]);
  const [hotelProviderName, setHotelProviderName] = useState("");
  const [hotelConfigured, setHotelConfigured] = useState<boolean>(true);
  const [hotelDisclaimer, setHotelDisclaimer] = useState<string>("");

  // Price Watch states
  const [watches, setWatches] = useState<any[]>([]);
  const [loadingWatches, setLoadingWatches] = useState(false);

  // Watch Creator state
  const [watchTargetModalOpen, setWatchTargetModalOpen] = useState(false);
  const [watchItemToTrack, setWatchItemToTrack] = useState<any>(null);
  const [targetPriceInput, setTargetPriceInput] = useState<number>(5000);
  const [alertCondition, setAlertCondition] = useState<"below_target" | "percentage_drop" | "any_drop">("below_target");
  const [creatingWatch, setCreatingWatch] = useState(false);

  useEffect(() => {
    if (activeTrip) {
      if (activeTrip.destination) {
        setFlightDestination(activeTrip.destination.split(",")[0].trim());
        setHotelDestination(activeTrip.destination.split(",")[0].trim());
      }
      if (activeTrip.departureHub) {
        setFlightOrigin(activeTrip.departureHub);
      }
      if (activeTrip.startDate) {
        const d = new Date(activeTrip.startDate).toISOString().split("T")[0];
        setFlightDate(d);
        setHotelCheckIn(d);
      }
      if (activeTrip.endDate) {
        const d = new Date(activeTrip.endDate).toISOString().split("T")[0];
        setHotelCheckOut(d);
      }
    }
  }, [activeTrip]);

  // Fetch user price watches
  const fetchWatches = async () => {
    setLoadingWatches(true);
    try {
      const res: any = await apiFetch("/api/travel/watches");
      if (res.watches) {
        setWatches(res.watches);
      }
    } catch (err) {
      console.warn("Error fetching price watches:", err);
    } finally {
      setLoadingWatches(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchWatches();
    }
  }, [isOpen]);

  const handleSearchFlights = async () => {
    setSearchingFlights(true);
    try {
      const q = new URLSearchParams({
        origin: flightOrigin,
        destination: flightDestination,
        departureDate: flightDate || new Date().toISOString().split("T")[0],
        passengers: String(flightPassengers),
      });

      const res: any = await apiFetch(`/api/travel/flights/search?${q.toString()}`);
      if (res.status === "NOT_CONFIGURED" || res.configured === false) {
        setFlightConfigured(false);
        setFlightMessage(res.message || "Amadeus Flight API is not configured. Set AMADEUS_CLIENT_ID and AMADEUS_CLIENT_SECRET in backend .env to activate live flight radar.");
        setFlightResults([]);
        setFlightProviderName(res.provider || "Amadeus Travel API");
        toast.info("Flight integration is not configured with external credentials.");
      } else if (res.results) {
        setFlightConfigured(true);
        setFlightMessage("");
        setFlightResults(res.results);
        setFlightProviderName(res.provider || "Aviation Radar");
        toast.success(`Found ${res.results.length} verified flight offers`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to search flights");
    } finally {
      setSearchingFlights(false);
    }
  };

  const handleSearchHotels = async () => {
    setSearchingHotels(true);
    try {
      const q = new URLSearchParams({
        destination: hotelDestination,
        checkIn: hotelCheckIn,
        checkOut: hotelCheckOut,
        guests: String(hotelGuests),
      });

      const res: any = await apiFetch(`/api/travel/hotels/search?${q.toString()}`);
      if (res.status === "NOT_CONFIGURED" || res.configured === false) {
        setHotelConfigured(false);
        setHotelDisclaimer(res.disclaimer || "Live hotel provider not configured. Stays shown are curated static recommendations, not live pricing.");
      } else {
        setHotelConfigured(true);
        setHotelDisclaimer("");
      }

      if (res.results) {
        setHotelResults(res.results);
        setHotelProviderName(res.provider || "Curated Stays");
        toast.success(`Loaded ${res.results.length} accommodations`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to search hotels");
    } finally {
      setSearchingHotels(false);
    }
  };

  const openWatchCreator = (item: any, type: "flight" | "hotel") => {
    setWatchItemToTrack({ ...item, watchType: type });
    // Default target price to 10% below current price
    const currentPrice = item.price || 5000;
    setTargetPriceInput(Math.round(currentPrice * 0.9));
    setWatchTargetModalOpen(true);
  };

  const handleSavePriceWatch = async () => {
    if (!watchItemToTrack) return;
    setCreatingWatch(true);

    try {
      const payload: any = {
        tripId: activeTrip?._id || null,
        type: watchItemToTrack.watchType,
        destination: watchItemToTrack.destination || hotelDestination,
        targetPrice: Number(targetPriceInput),
        alertCondition,
      };

      if (watchItemToTrack.watchType === "flight") {
        payload.origin = watchItemToTrack.origin || flightOrigin;
        payload.departureDate = flightDate;
        payload.passengers = flightPassengers;
      } else {
        payload.hotelName = watchItemToTrack.name;
        payload.checkIn = hotelCheckIn;
        payload.checkOut = hotelCheckOut;
        payload.guests = hotelGuests;
      }

      await apiFetch("/api/travel/watches", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      toast.success("Price watch activated! Advenza will monitor fares in the background.");
      setWatchTargetModalOpen(false);
      fetchWatches();
    } catch (err: any) {
      toast.error(err.message || "Failed to create price watch");
    } finally {
      setCreatingWatch(false);
    }
  };

  const handleToggleWatchStatus = async (watch: any) => {
    const newStatus = watch.status === "active" ? "paused" : "active";
    try {
      await apiFetch(`/api/travel/watches/${watch._id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      toast.info(`Watch ${newStatus === "active" ? "resumed" : "paused"}`);
      fetchWatches();
    } catch (e: any) {
      toast.error("Failed to update watch");
    }
  };

  const handleDeleteWatch = async (id: string) => {
    try {
      await apiFetch(`/api/travel/watches/${id}`, { method: "DELETE" });
      toast.success("Watch cancelled");
      fetchWatches();
    } catch (e: any) {
      toast.error("Failed to delete watch");
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[760px] max-h-[92vh] overflow-y-auto">
          <DialogHeader className="border-b border-border/40 pb-3">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <ShieldCheck className="h-5 w-5 text-emerald-500" />
              Verified Travel Radar & Price Watcher
            </DialogTitle>
            <DialogDescription className="text-xs">
              Real-time flight timetables, verified stay rates, and automated price monitoring without AI hallucinations.
            </DialogDescription>
          </DialogHeader>

          {/* Tab Selector */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="flights" className="flex items-center gap-1.5 text-xs">
                <Plane className="h-3.5 w-3.5" />
                Flights
              </TabsTrigger>
              <TabsTrigger value="hotels" className="flex items-center gap-1.5 text-xs">
                <Building2 className="h-3.5 w-3.5" />
                Stays & Hotels
              </TabsTrigger>
              <TabsTrigger value="watches" className="flex items-center gap-1.5 text-xs">
                <Bell className="h-3.5 w-3.5" />
                My Watches ({watches.length})
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: FLIGHT SEARCH */}
            <TabsContent value="flights" className="space-y-4 pt-3">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 p-3 rounded-xl border border-border/60 bg-muted/20">
                <div>
                  <Label className="text-[11px] text-muted-foreground uppercase font-semibold">Origin (IATA)</Label>
                  <Input
                    value={flightOrigin}
                    onChange={(e) => setFlightOrigin(e.target.value.toUpperCase())}
                    placeholder="e.g. BOM"
                    className="h-8 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground uppercase font-semibold">Destination (IATA)</Label>
                  <Input
                    value={flightDestination}
                    onChange={(e) => setFlightDestination(e.target.value.toUpperCase())}
                    placeholder="e.g. GOI"
                    className="h-8 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground uppercase font-semibold">Departure Date</Label>
                  <Input
                    type="date"
                    value={flightDate}
                    onChange={(e) => setFlightDate(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={handleSearchFlights}
                    disabled={searchingFlights}
                    className="w-full h-8 text-xs font-semibold gap-1.5"
                  >
                    {searchingFlights ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                    Search
                  </Button>
                </div>
              </div>

              {/* Not Configured Alert */}
              {!flightConfigured && (
                <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs flex items-start gap-2.5">
                  <Info className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block text-xs">External Flight API Not Configured</span>
                    <span className="text-[11px] opacity-90">{flightMessage}</span>
                  </div>
                </div>
              )}

              {/* Flight Results */}
              {flightResults.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                    <span>Source: {flightProviderName}</span>
                    <span className="text-[10px] text-amber-500/90 font-medium">
                      Prices and availability subject to change before booking
                    </span>
                  </div>
                  <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                    {flightResults.map((f, idx) => (
                      <div
                        key={f.offerId || idx}
                        className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 rounded-xl border border-border/50 bg-card hover:bg-muted/30 transition-all gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex flex-col items-center justify-center font-bold text-xs text-primary">
                            <span>{f.airlineCode}</span>
                          </div>
                          <div>
                            <div className="font-semibold text-sm flex items-center gap-2">
                              {f.airline}
                              <Badge variant="outline" className="text-[10px] font-mono">
                                {f.flightNumber}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                              <span>{f.departureTime.split("T")[1]?.slice(0, 5) || "08:00"}</span>
                              <ArrowRight className="h-3 w-3" />
                              <span>{f.arrivalTime.split("T")[1]?.slice(0, 5) || "10:15"}</span>
                              <span>· {f.duration}</span>
                              <span>· {f.stops === 0 ? "Non-stop" : `${f.stops} stop`}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0">
                          <div className="text-right">
                            <div className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                              ₹{f.price.toLocaleString("en-IN")}
                            </div>
                            <div className="text-[10px] text-muted-foreground">{f.baggage || "Per adult"}</div>
                          </div>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openWatchCreator(f, "flight")}
                            className="h-8 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10"
                          >
                            <Bell className="h-3 w-3" />
                            Watch
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* TAB 2: HOTEL SEARCH */}
            <TabsContent value="hotels" className="space-y-4 pt-3">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 p-3 rounded-xl border border-border/60 bg-muted/20">
                <div>
                  <Label className="text-[11px] text-muted-foreground uppercase font-semibold">Destination City</Label>
                  <Input
                    value={hotelDestination}
                    onChange={(e) => setHotelDestination(e.target.value)}
                    placeholder="e.g. Goa"
                    className="h-8 text-xs font-semibold"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground uppercase font-semibold">Check-In</Label>
                  <Input
                    type="date"
                    value={hotelCheckIn}
                    onChange={(e) => setHotelCheckIn(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground uppercase font-semibold">Check-Out</Label>
                  <Input
                    type="date"
                    value={hotelCheckOut}
                    onChange={(e) => setHotelCheckOut(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={handleSearchHotels}
                    disabled={searchingHotels}
                    className="w-full h-8 text-xs font-semibold gap-1.5"
                  >
                    {searchingHotels ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                    Search
                  </Button>
                </div>
              </div>

              {/* Hotel Provider Notice */}
              {!hotelConfigured && hotelResults.length > 0 && (
                <div className="p-3 rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs flex items-center gap-2">
                  <Info className="h-4 w-4 shrink-0" />
                  <span className="text-[11px] font-medium">{hotelDisclaimer}</span>
                </div>
              )}

              {/* Hotel Results */}
              {hotelResults.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                    <span>Source: {hotelProviderName}</span>
                    <span className="text-[10px] text-amber-500/90 font-medium">
                      Prices may change before booking
                    </span>
                  </div>
                  <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                    {hotelResults.map((h, idx) => (
                      <div
                        key={h.hotelId || idx}
                        className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 rounded-xl border border-border/50 bg-card hover:bg-muted/30 transition-all gap-3"
                      >
                        <div>
                          <div className="font-semibold text-sm flex items-center gap-2">
                            {h.name}
                            <Badge variant="secondary" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/30">
                              ⭐ {h.rating}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">{h.location} · {h.roomType}</div>
                          {h.amenities && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {h.amenities.slice(0, 3).map((a: string) => (
                                <span key={a} className="text-[10px] bg-muted/60 px-1.5 py-0.5 rounded text-muted-foreground">
                                  {a}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0">
                          <div className="text-right">
                            <div className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                              ₹{h.price.toLocaleString("en-IN")}
                            </div>
                            <div className="text-[10px] text-muted-foreground">Total estimate</div>
                          </div>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openWatchCreator(h, "hotel")}
                            className="h-8 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10"
                          >
                            <Bell className="h-3 w-3" />
                            Watch
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* TAB 3: PRICE WATCHES */}
            <TabsContent value="watches" className="space-y-3 pt-3">
              {loadingWatches ? (
                <div className="py-12 flex justify-center text-muted-foreground text-xs gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading tracked watchers...</span>
                </div>
              ) : watches.length === 0 ? (
                <div className="text-center py-10 rounded-xl border border-dashed text-xs text-muted-foreground space-y-2">
                  <Bell className="h-6 w-6 mx-auto opacity-40" />
                  <p className="font-semibold text-sm">No price watches active</p>
                  <p>Search flights or hotels above and click "Watch" to monitor price drops in the background.</p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {watches.map((w) => (
                    <div
                      key={w._id}
                      className="p-3.5 rounded-xl border border-border/50 bg-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] uppercase font-semibold">
                            {w.type}
                          </Badge>
                          <span className="font-semibold text-sm">
                            {w.type === "flight" ? `${w.origin} → ${w.destination}` : w.hotelName || w.destination}
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                              w.status === "active"
                                ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/30"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {w.status.toUpperCase()}
                          </span>
                        </div>

                        <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                          <span>Target: <b className="text-foreground">₹{w.targetPrice?.toLocaleString("en-IN")}</b></span>
                          {w.lastPrice && (
                            <span>Current: <b className="text-foreground">₹{w.lastPrice?.toLocaleString("en-IN")}</b></span>
                          )}
                          {w.lowestPrice && (
                            <span>Lowest: <b className="text-foreground">₹{w.lowestPrice?.toLocaleString("en-IN")}</b></span>
                          )}
                          {w.lastCheckedAt && (
                            <span>Checked {new Date(w.lastCheckedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 self-end sm:self-center">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => handleToggleWatchStatus(w)}
                          title={w.status === "active" ? "Pause watch" : "Resume watch"}
                        >
                          {w.status === "active" ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteWatch(w._id)}
                          title="Delete watch"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* CREATE PRICE WATCH MODAL */}
      <Dialog open={watchTargetModalOpen} onOpenChange={setWatchTargetModalOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4 text-primary" />
              Set Price Alert Target
            </DialogTitle>
            <DialogDescription className="text-xs">
              Advenza will poll the travel API in the background and notify you when the price crosses your threshold.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="p-3 rounded-lg border bg-muted/30 text-xs space-y-1">
              <span className="font-semibold text-foreground block">
                {watchItemToTrack?.airline || watchItemToTrack?.name || "Tracked Travel Item"}
              </span>
              <span className="text-muted-foreground">
                Current Best Rate: <b>₹{watchItemToTrack?.price?.toLocaleString("en-IN") || "—"}</b>
              </span>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Target Price (₹ INR)</Label>
              <Input
                type="number"
                value={targetPriceInput}
                onChange={(e) => setTargetPriceInput(Number(e.target.value))}
                min={100}
                className="h-9 text-sm font-semibold font-mono"
              />
              <span className="text-[11px] text-muted-foreground">
                Suggested target: 10% below current price
              </span>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Trigger Condition</Label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: "below_target", label: "Below Target" },
                  { id: "percentage_drop", label: "10% Drop" },
                  { id: "any_drop", label: "Any Drop" },
                ].map((cond) => (
                  <button
                    key={cond.id}
                    type="button"
                    onClick={() => setAlertCondition(cond.id as any)}
                    className={`py-1.5 text-xs font-medium rounded-md border transition-all ${
                      alertCondition === cond.id
                        ? "border-primary bg-primary/10 text-primary font-semibold"
                        : "border-border/60 text-muted-foreground hover:bg-muted/40"
                    }`}
                  >
                    {cond.label}
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={handleSavePriceWatch}
              disabled={creatingWatch || !targetPriceInput}
              className="w-full h-9 text-xs font-semibold gap-1.5"
            >
              {creatingWatch ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Activate Background Price Watch
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
