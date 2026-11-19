"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Train,
  Plane,
  Car,
  Bus,
  Sparkles,
  ShieldCheck,
  Compass,
  MapPin,
  Clock,
  CheckCircle2,
  Building2,
  Utensils,
  Camera,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TripGenerationLoaderProps {
  loading: boolean;
  origin?: string;
  destination: string;
  travelMode?: string;
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
    desc: "Uncovering authentic cultural spots, cafes & viewpoints",
    icon: Compass,
    pct: 66,
  },
  {
    id: 4,
    title: "Risk & Weather Intelligence",
    desc: "Screening meteorological alerts & road transit safety",
    icon: ShieldCheck,
    pct: 85,
  },
  {
    id: 5,
    title: "Final AI Judge Synthesis",
    desc: "Pacing daily schedules to protect your exploration time",
    icon: Sparkles,
    pct: 96,
  },
];

export function TripGenerationLoader({
  loading,
  origin,
  destination,
  travelMode = "Train",
}: TripGenerationLoaderProps) {
  const [progress, setProgress] = useState(8);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Vehicle Icon based on mode
  const VehicleIcon =
    travelMode.toLowerCase().includes("flight") || travelMode.toLowerCase().includes("plane")
      ? Plane
      : travelMode.toLowerCase().includes("bus")
      ? Bus
      : travelMode.toLowerCase().includes("car") || travelMode.toLowerCase().includes("drive")
      ? Car
      : Train;

  useEffect(() => {
    if (!loading) {
      setProgress(0);
      setCurrentStageIndex(0);
      setElapsedSeconds(0);
      return;
    }

    const timer = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);

    // Dynamic easing progress simulation: rises quickly to 30%, then 65%, then 88%, smoothly creeping towards 96%
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
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
  }, [loading]);

  // Sync stage based on current progress percentage
  useEffect(() => {
    if (progress >= 85) setCurrentStageIndex(4);
    else if (progress >= 65) setCurrentStageIndex(3);
    else if (progress >= 42) setCurrentStageIndex(2);
    else if (progress >= 20) setCurrentStageIndex(1);
    else setCurrentStageIndex(0);
  }, [progress]);

  const activeStage = STAGES[currentStageIndex];
  const cleanOrigin = (origin || "Departure").split(",")[0].trim();
  const cleanDest = (destination || "Destination").split(",")[0].trim();

  return (
    <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-card/90 p-6 md:p-8 backdrop-blur-2xl shadow-2xl space-y-6">
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
            <h3 className="font-serif text-lg md:text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
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

        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground bg-muted/30 px-3 py-1.5 rounded-xl border border-border/60 self-start sm:self-auto">
          <Clock className="h-3.5 w-3.5 text-primary animate-spin" style={{ animationDuration: "3s" }} />
          <span>Elapsed: <b>{elapsedSeconds}s</b></span>
          <span className="text-muted-foreground/40">|</span>
          <span className="text-primary font-bold">{Math.round(progress)}%</span>
        </div>
      </div>

      {/* ── INTERACTIVE GRAPHIC: RAILWAY / TRANSIT TRACK ────────────────── */}
      <div className="relative pt-6 pb-4 px-2">
        {/* Track Stations Labels */}
        <div className="flex items-center justify-between text-xs font-semibold mb-3 px-1">
          <div className="flex items-center gap-1.5 text-foreground">
            <MapPin className="h-4 w-4 text-primary shrink-0" />
            <span className="truncate max-w-[140px] sm:max-w-[200px]">{cleanOrigin}</span>
          </div>

          <div className="text-[11px] text-muted-foreground uppercase tracking-widest font-mono">
            {travelMode} Journey
          </div>

          <div className="flex items-center gap-1.5 text-foreground">
            <span className="truncate max-w-[140px] sm:max-w-[200px]">{cleanDest}</span>
            <MapPin className="h-4 w-4 text-emerald-500 shrink-0" />
          </div>
        </div>

        {/* The Track Line & Sleepers */}
        <div className="relative h-12 flex items-center">
          {/* Background Track Ties / Railway Sleepers */}
          <div className="absolute inset-x-0 h-2 bg-muted/60 rounded-full overflow-hidden border border-border/70">
            {/* Striped railway sleeper pattern */}
            <div
              className="h-full w-full opacity-30"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(90deg, currentColor 0, currentColor 2px, transparent 2px, transparent 10px)",
              }}
            />
          </div>

          {/* Glowing Animated Filled Progress Track */}
          <motion.div
            className="absolute left-0 h-2 rounded-full bg-gradient-to-r from-primary via-emerald-500 to-accent shadow-[0_0_12px_rgba(16,185,129,0.5)]"
            style={{ width: `${progress}%` }}
            transition={{ ease: "easeOut", duration: 0.3 }}
          />

          {/* Station 1: Origin Terminal Anchor */}
          <div className="absolute left-0 -translate-x-1/2 h-5 w-5 rounded-full bg-background border-2 border-primary flex items-center justify-center z-10 shadow-sm">
            <div className="h-2 w-2 rounded-full bg-primary" />
          </div>

          {/* Station 2: Destination Terminal Anchor */}
          <div
            className={cn(
              "absolute right-0 translate-x-1/2 h-5 w-5 rounded-full bg-background border-2 transition-colors z-10 shadow-sm flex items-center justify-center",
              progress >= 95 ? "border-emerald-500 bg-emerald-50" : "border-border/80"
            )}
          >
            <div className={cn("h-2 w-2 rounded-full", progress >= 95 ? "bg-emerald-500" : "bg-muted-foreground/40")} />
          </div>

          {/* ── MOVING VEHICLE / TRAIN GLIDER ── */}
          <motion.div
            className="absolute -top-3 z-20 flex flex-col items-center pointer-events-none"
            style={{ left: `calc(${Math.min(94, Math.max(2, progress))}% - 18px)` }}
            transition={{ ease: "easeOut", duration: 0.2 }}
          >
            {/* Vehicle Card Capsule */}
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary text-primary-foreground shadow-lg border border-primary/30 transform hover:scale-105 transition-transform">
              <VehicleIcon className="h-3.5 w-3.5 animate-bounce" />
              <span className="text-[10px] font-mono font-bold">{Math.round(progress)}%</span>
            </div>
            {/* Triangle pointer down to rail */}
            <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[5px] border-t-primary" />
          </motion.div>
        </div>
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
                  "p-3 rounded-2xl border transition-all duration-300 relative overflow-hidden flex flex-col justify-between",
                  isDone
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                    : isCurrent
                    ? "bg-primary/10 border-primary ring-1 ring-primary/40 shadow-sm"
                    : "bg-muted/10 border-border/40 opacity-50"
                )}
              >
                <div className="flex items-center justify-between gap-1 mb-2">
                  <div
                    className={cn(
                      "h-6 w-6 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold",
                      isDone
                        ? "bg-emerald-500 text-white"
                        : isCurrent
                        ? "bg-primary text-primary-foreground animate-pulse"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {isDone ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : idx + 1}
                  </div>

                  {isCurrent && (
                    <span className="inline-block h-2 w-2 rounded-full bg-primary animate-ping" />
                  )}
                </div>

                <div>
                  <div className="text-[11px] font-bold leading-tight line-clamp-1">{s.title}</div>
                  <div className="text-[9px] text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                    {s.desc}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Current Active Step Banner */}
      <div className="rounded-2xl border border-primary/20 bg-muted/40 p-4 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <activeStage.icon className="h-4 w-4 animate-spin" style={{ animationDuration: "8s" }} />
          </div>
          <div>
            <div className="font-semibold text-foreground text-xs flex items-center gap-2">
              <span>{activeStage.title}</span>
              <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.2 rounded font-mono font-medium">
                In Progress
              </span>
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{activeStage.desc}</div>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
          <span className="text-[11px]">Zero-Hallucination Verified</span>
        </div>
      </div>
    </div>
  );
}
