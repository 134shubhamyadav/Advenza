"use client";

import React, { useEffect, useState } from "react";
import {
  Train,
  Plane,
  Car,
  Bus,
  Ship,
  Sparkles,
  ShieldCheck,
  Compass,
  MapPin,
  Clock,
  Building2,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ModeSceneRenderer } from "@/components/travel/transit-scenes/ModeSceneRenderer";

export type ProgressStatus = "loading" | "success" | "error";

interface TripGenerationLoaderProps {
  loading: boolean;
  origin?: string;
  destination: string;
  travelMode?: string;
  customProgress?: number;
  status?: ProgressStatus;
  onComplete?: () => void;
}

const STAGES = [
  {
    id: 1,
    title: "Route & Transit Windows",
    desc: "Calculating timetables, transit delays & arrival buffers",
    icon: Train,
    pct: 20,
  },
  {
    id: 2,
    title: "Stay & Accommodation",
    desc: "Resolving verified hotels, zero-cost stays & check-in times",
    icon: Building2,
    pct: 42,
  },
  {
    id: 3,
    title: "Attractions & Hidden Gems",
    desc: "Curating verified landmarks, opening hours & pacing",
    icon: Compass,
    pct: 65,
  },
  {
    id: 4,
    title: "Risk & Weather Intelligence",
    desc: "Assessing local climate forecasts, route safety & contingencies",
    icon: ShieldCheck,
    pct: 85,
  },
  {
    id: 5,
    title: "Final AI Synthesis",
    desc: "Balancing budget constraints & generating master timeline",
    icon: Sparkles,
    pct: 100,
  },
];

export function TripGenerationLoader({
  loading,
  origin,
  destination,
  travelMode = "Train",
  customProgress,
  status = "loading",
  onComplete,
}: TripGenerationLoaderProps) {
  const [internalProgress, setInternalProgress] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const progress = customProgress !== undefined ? customProgress : internalProgress;

  // Derived synchronously without triggering extra setState or render re-entry
  const currentStageIndex =
    progress >= 85 ? 4 :
    progress >= 65 ? 3 :
    progress >= 42 ? 2 :
    progress >= 20 ? 1 : 0;

  const mode = (travelMode || "train").toLowerCase();
  const ModeIcon =
    mode.includes("flight") || mode.includes("air") || mode.includes("plane")
      ? Plane
      : mode.includes("car") || mode.includes("drive")
      ? Car
      : mode.includes("bus")
      ? Bus
      : mode.includes("ferry") || mode.includes("boat") || mode.includes("ship")
      ? Ship
      : Train;

  const modeLabel =
    mode.includes("flight") || mode.includes("air") || mode.includes("plane")
      ? "Flight"
      : mode.includes("car") || mode.includes("drive")
      ? "Car / Drive"
      : mode.includes("bus")
      ? "Intercity Bus"
      : mode.includes("ferry") || mode.includes("boat") || mode.includes("ship")
      ? "Coastal Ferry"
      : "Train";

  useEffect(() => {
    if (customProgress !== undefined) return;

    if (!loading) {
      setInternalProgress(0);
      setElapsedSeconds(0);
      return;
    }

    const timer = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);

    const progressInterval = setInterval(() => {
      setInternalProgress((prev) => {
        if (prev < 25) return prev + 3;
        if (prev < 50) return prev + 2;
        if (prev < 75) return prev + 1.2;
        if (prev < 90) return prev + 0.6;
        if (prev < 96) return prev + 0.2;
        return prev;
      });
    }, 200);

    return () => {
      clearInterval(timer);
      clearInterval(progressInterval);
    };
  }, [loading, customProgress]);

  useEffect(() => {
    if (progress >= 100 && onComplete) {
      const t = setTimeout(() => {
        onComplete();
      }, 800);
      return () => clearTimeout(t);
    }
  }, [progress >= 100, onComplete]);

  const cleanOrigin = (origin || "Departure").split(",")[0].trim();
  const cleanDest = (destination || "Destination").split(",")[0].trim();

  return (
    <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-card/95 p-6 md:p-8 backdrop-blur-2xl shadow-2xl space-y-6">
      {/* Ambient background glow wash */}
      <div className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 -bottom-20 h-56 w-56 rounded-full bg-accent/15 blur-3xl" />

      {/* Header: Title + Elapsed Timer */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/50 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground shadow-md">
            <Sparkles className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <h3 className="font-sans text-lg md:text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              Architecting Your Itinerary
              <span className="text-xs font-sans px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-semibold animate-pulse">
                AI Active
              </span>
            </h3>
            <p className="text-xs text-muted-foreground">
              Multi-agent pipeline conducting verified scheduling & route synchronization
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-xl border border-border/60 self-start sm:self-auto shadow-sm">
          <Clock className="h-3.5 w-3.5 text-primary animate-spin" style={{ animationDuration: "3s" }} />
          <span>Elapsed: <b>{elapsedSeconds}s</b></span>
          <span className="text-muted-foreground/40">|</span>
          <span className="text-primary font-bold">{Math.round(progress)}%</span>
        </div>
      </div>

      {/* Route Badge */}
      <div className="flex items-center justify-between text-xs font-semibold px-1">
        <div className="flex items-center gap-1.5 text-foreground">
          <MapPin className="h-4 w-4 text-primary shrink-0" />
          <span className="truncate max-w-[140px] sm:max-w-[220px] font-medium">{cleanOrigin}</span>
        </div>

        <div className="text-[11px] text-muted-foreground uppercase tracking-widest font-mono flex items-center gap-1.5 bg-muted/50 px-3 py-1 rounded-full border border-border/60 shadow-xs">
          <ModeIcon className="h-3.5 w-3.5 text-primary" />
          <span>{modeLabel} Route</span>
        </div>

        <div className="flex items-center gap-1.5 text-foreground">
          <span className="truncate max-w-[140px] sm:max-w-[220px] font-medium">{cleanDest}</span>
          <MapPin className="h-4 w-4 text-emerald-500 shrink-0" />
        </div>
      </div>

      {/* ── LIVE ANIMATED TRANSIT SIMULATION (Vande Bharat / Flight / Bus / Car / Ferry) ── */}
      <div className="pt-1">
        <ModeSceneRenderer
          travelMode={travelMode}
          progress={progress}
          label={STAGES[currentStageIndex]?.desc}
          origin={cleanOrigin}
          destination={cleanDest}
          showMeta={true}
          showBar={true}
        />
      </div>

      {/* ── MULTI-STAGE MILESTONE PIPELINE ── */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <span className="font-semibold text-foreground uppercase tracking-wider text-[11px]">
            AI Pipeline Verification
          </span>
          <span>Stage {currentStageIndex + 1} of 5</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
          {STAGES.map((s, idx) => {
            const isDone = currentStageIndex > idx;
            const isCurrent = currentStageIndex === idx;
            const Icon = s.icon;

            return (
              <div
                key={s.id}
                className={cn(
                  "rounded-2xl border p-3 text-xs transition-all relative overflow-hidden",
                  isDone
                    ? "border-emerald-500/40 bg-emerald-500/5 text-foreground"
                    : isCurrent
                    ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/40"
                    : "border-border/60 bg-muted/20 text-muted-foreground/60 opacity-60"
                )}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div
                    className={cn(
                      "h-6 w-6 rounded-lg flex items-center justify-center text-xs",
                      isDone
                        ? "bg-emerald-500 text-white"
                        : isCurrent
                        ? "bg-primary text-primary-foreground animate-pulse"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  {isDone ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  ) : isCurrent ? (
                    <span className="h-2 w-2 rounded-full bg-primary animate-ping" />
                  ) : null}
                </div>
                <p className="font-semibold text-[11px] leading-tight line-clamp-1">{s.title}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2 leading-tight">
                  {s.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
