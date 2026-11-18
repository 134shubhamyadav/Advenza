import { useState } from "react";
import { Train, Clock, MapPin, Calendar, ChevronDown, ChevronUp, Radio, CheckCircle2, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface RailwayStop {
  sequence: number;
  stationCode: string;
  stationName: string;
  stationNameHindi?: string;
  scheduledArrival?: string | null;
  scheduledDeparture?: string | null;
  haltDuration?: string;
  haltMinutes?: number;
  distanceFromOriginKm?: number;
  platform?: string;
  railwayDay?: number;
  calendarDate?: string;
  isBoarding?: boolean;
  isDestination?: boolean;
}

export interface LiveTrackingInfo {
  isLive: boolean;
  status: string;
  statusText?: string;
  delayMinutes: number;
  currentStationCode?: string;
  currentLocation?: any;
  previousHalt?: any;
  nextHalt?: any;
  lastUpdatedAt?: string;
  dataSource?: string;
  verificationStatus?: string;
}

export interface RailwayTimelineData {
  trainNumber: string;
  trainName: string;
  trainNameHindi?: string;
  trainType?: string;
  direction?: string;
  fromStation: {
    code: string;
    name: string;
    platform?: string;
    departureTime?: string;
    railwayDay?: number;
  };
  toStation: {
    code: string;
    name: string;
    platform?: string;
    arrivalTime?: string;
    railwayDay?: number;
  };
  journeyStartDate: string;
  destinationArrivalDate: string;
  destinationArrivalTime: string;
  totalDurationMinutes?: number;
  totalDurationText?: string;
  totalJourneyDays?: number;
  dayCrossings?: number;
  isOvernight?: boolean;
  stoppagesCount?: number;
  stops?: RailwayStop[];
  liveTracking?: LiveTrackingInfo;
  dataClassification?: string;
}

interface RailwayTimelineCardProps {
  timeline: RailwayTimelineData;
  title?: string;
}

export function RailwayTimelineCard({ timeline, title = "Railway Journey Timeline" }: RailwayTimelineCardProps) {
  const [showStops, setShowStops] = useState(false);

  if (!timeline) return null;

  const isLive = Boolean(timeline.liveTracking?.isLive);
  const delayMinutes = timeline.liveTracking?.delayMinutes || 0;
  const isDelayed = delayMinutes > 0;
  const stops = timeline.stops || [];

  return (
    <div className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/[0.07] via-background to-background p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary shadow-xs">
            <Train className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-sm sm:text-base text-foreground">
                {timeline.trainNumber} - {timeline.trainName}
              </h3>
              <Badge variant="outline" className="text-[10px] font-mono bg-primary/10 text-primary border-primary/20">
                {timeline.trainType || "SUPERFAST"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <span>{title}</span>
              <span>·</span>
              <span className="font-medium text-foreground">{timeline.totalDurationText || "Transit"}</span>
              {timeline.dayCrossings != null && timeline.dayCrossings > 0 && (
                <>
                  <span>·</span>
                  <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                    {timeline.totalJourneyDays} Days / {timeline.dayCrossings} Night{timeline.dayCrossings > 1 ? "s" : ""} on Train
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Data Classification Badge */}
        <div className="flex items-center gap-2">
          {isLive ? (
            <Badge className="bg-emerald-600 text-white gap-1 text-[11px] animate-pulse">
              <Radio className="h-3 w-3" /> LIVE TRACKING ACTIVE
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1 text-[11px] font-mono">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              {timeline.dataClassification || "SCHEDULED_VERIFIED"}
            </Badge>
          )}
        </div>
      </div>

      {/* Boarding vs Arrival Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Boarding Station */}
        <div className="rounded-xl border border-border/70 bg-background/80 p-3 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3 text-primary" /> Boarding Station
            </span>
            <Badge variant="outline" className="text-[10px] font-mono">
              Day {timeline.fromStation?.railwayDay || 1}
            </Badge>
          </div>
          <p className="font-bold text-sm text-foreground">
            {timeline.fromStation?.name} ({timeline.fromStation?.code})
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
            <span>📅 {timeline.journeyStartDate}</span>
            <span>·</span>
            <span className="font-bold text-primary">Dep: {timeline.fromStation?.departureTime}</span>
            {timeline.fromStation?.platform && <span>· Pf {timeline.fromStation.platform}</span>}
          </div>
        </div>

        {/* Destination Station */}
        <div className="rounded-xl border border-border/70 bg-background/80 p-3 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3 text-emerald-500" /> Destination Station
            </span>
            <Badge variant="outline" className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
              Day {timeline.toStation?.railwayDay || (timeline.dayCrossings ? timeline.dayCrossings + 1 : 1)}
            </Badge>
          </div>
          <p className="font-bold text-sm text-foreground">
            {timeline.toStation?.name} ({timeline.toStation?.code})
          </p>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-muted-foreground">📅 {timeline.destinationArrivalDate}</span>
            <span>·</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              Arr: {timeline.destinationArrivalTime}
            </span>
            {timeline.toStation?.platform && <span className="text-muted-foreground">· Pf {timeline.toStation.platform}</span>}
          </div>
        </div>
      </div>

      {/* Live Running Status Banner */}
      {timeline.liveTracking && (
        <div className={`rounded-xl border p-3 text-xs flex flex-wrap items-center justify-between gap-2 ${
          isLive
            ? isDelayed
              ? "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"
            : "border-border/60 bg-muted/40 text-muted-foreground"
        }`}>
          <div className="flex items-center gap-2">
            {isLive ? (
              <Radio className="h-4 w-4 shrink-0 text-primary animate-pulse" />
            ) : (
              <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <span>
              {timeline.liveTracking.statusText ||
                (isLive
                  ? isDelayed
                    ? `Running ${delayMinutes} mins late`
                    : "Running on time"
                  : "Live tracking active during journey dates (last 5 days to today). Verified timetable shown.")}
            </span>
          </div>
          {isLive && isDelayed && (
            <Badge variant="destructive" className="text-[10px]">
              +{delayMinutes}m delay
            </Badge>
          )}
        </div>
      )}

      {/* Intermediate Stops Collapsible */}
      {stops.length > 0 && (
        <div className="space-y-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowStops((prev) => !prev)}
            className="w-full justify-between text-xs font-medium text-muted-foreground hover:text-foreground h-8 px-2"
          >
            <span className="flex items-center gap-1.5">
              <span>🚉 Timetable & Intermediate Stoppages ({stops.length} stations)</span>
            </span>
            {showStops ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>

          {showStops && (
            <div className="max-h-64 overflow-y-auto rounded-xl border border-border/60 bg-background/50 divide-y divide-border/40 text-xs">
              {stops.map((st) => (
                <div
                  key={`${st.stationCode}_${st.sequence}`}
                  className={`flex items-center justify-between p-2.5 transition-colors ${
                    st.isBoarding
                      ? "bg-primary/10 font-semibold"
                      : st.isDestination
                        ? "bg-emerald-500/10 font-semibold"
                        : "hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-muted-foreground w-5 text-right">{st.sequence}.</span>
                    <div>
                      <p className="text-foreground">
                        {st.stationName} <span className="font-mono text-muted-foreground">({st.stationCode})</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Day {st.railwayDay || 1} {st.calendarDate ? `· ${st.calendarDate}` : ""} {st.haltDuration ? `· Halt ${st.haltDuration}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="text-right font-mono text-[11px]">
                    <p className="text-foreground">
                      {st.scheduledArrival ? `Arr: ${st.scheduledArrival}` : "Origin"}
                    </p>
                    <p className="text-muted-foreground">
                      {st.scheduledDeparture ? `Dep: ${st.scheduledDeparture}` : "Terminus"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default RailwayTimelineCard;
