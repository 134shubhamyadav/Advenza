"use client";

import React, { useEffect, useRef, useId } from "react";

export interface FlightProgressBarProps {
  progress: number; // 0 to 100
  label?: string;
  origin?: string;
  destination?: string;
  showMeta?: boolean;
  showBar?: boolean;
  className?: string;
}

/**
 * Game-Grade Commercial Airplane Journey Progression Graphic
 * 
 * Continuous, physics-driven flight simulation across 12 distinct journey stages:
 * Stage 1  (0–5%):   Pre-flight — Parked at Departure Gate with connected Jet Bridge
 * Stage 2  (5–10%):  Taxiing — Moving slowly along Apron Taxiway (Jet Bridge retracts)
 * Stage 3  (10–20%): Takeoff Roll — High acceleration along Runway Centerline
 * Stage 4  (20–30%): Rotation — Nose gear lifts, main gear pivots on runway
 * Stage 5  (30–40%): Liftoff — Main wheels unstick, ascending above runway
 * Stage 6  (40–50%): Initial Climb — Climbing over departure airport, gear visible
 * Stage 7  (50–60%): Climb & Gear Retract — Gear tucks into bays, transitioning to mountains
 * Stage 8  (60–70%): Cruise — Steady flight at FL360 over volumetric cloud ocean at 850 km/h
 * Stage 9  (70–80%): Descent — Gentle nose-down glide, golden hour sunset transition
 * Stage 10 (80–90%): Final Approach — Gear deployed, aligning with Destination Runway & PAPI
 * Stage 11 (90–97%): Landing — Main gear touchdown, compression rebound, rollout deceleration
 * Stage 12 (97–100%): Arrival — Taxiing to illuminated Destination Gate & Jet Bridge
 */
export function FlightProgressBar({
  progress = 0,
  label,
  origin = "Mumbai Intercity Hub (BOM)",
  destination = "Surat Central Airport (STV)",
  showMeta = true,
  showBar = true,
  className = "",
}: FlightProgressBarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number | null>(null);
  const uid = useId().replace(/:/g, "_");

  // DOM element references for 160Hz transform manipulation
  const sceneRef = useRef<SVGSVGElement>(null);
  const skyDawnRef = useRef<SVGRectElement>(null);
  const skyDayRef = useRef<SVGRectElement>(null);
  const skySunsetRef = useRef<SVGRectElement>(null);
  const skyNightRef = useRef<SVGRectElement>(null);
  const starsRef = useRef<SVGGElement>(null);
  const sunGroupRef = useRef<SVGGElement>(null);
  const moonGroupRef = useRef<SVGGElement>(null);

  // Parallax environment groups
  const mountainsLayerRef = useRef<SVGGElement>(null);
  const cloudSeaLayerRef = useRef<SVGGElement>(null);
  const midCloudsLayerRef = useRef<SVGGElement>(null);
  const wispsLayerRef = useRef<SVGGElement>(null);
  const departureAirportRef = useRef<SVGGElement>(null);
  const destinationAirportRef = useRef<SVGGElement>(null);
  const jetBridgeDepRef = useRef<SVGGElement>(null);

  // Aircraft components
  const aircraftGroupRef = useRef<SVGGElement>(null);
  const aircraftBodyRef = useRef<SVGGElement>(null);
  const noseGearRef = useRef<SVGGElement>(null);
  const mainGearRef = useRef<SVGGElement>(null);
  const noseWheelsRef = useRef<SVGGElement[]>([]);
  const mainWheelsRef = useRef<SVGGElement[]>([]);
  const contrailsRef = useRef<SVGPathElement[]>([]);
  const streaksRef = useRef<SVGLineElement[]>([]);
  const wingtipStrobeRef = useRef<SVGCircleElement>(null);
  const beaconStrobesRef = useRef<SVGCircleElement[]>([]);
  const landingBeamRef = useRef<SVGPolygonElement>(null);
  const cabinWindowsGlowRef = useRef<SVGGElement>(null);
  const engineGlowRef = useRef<SVGEllipseElement>(null);
  const touchdownSmokeRef = useRef<SVGGElement>(null);

  // UI status elements
  const pctTextRef = useRef<HTMLElement>(null);
  const speedTextRef = useRef<HTMLElement>(null);
  const stageTextRef = useRef<HTMLElement>(null);
  const altTextRef = useRef<HTMLElement>(null);
  const fillTrackRef = useRef<HTMLDivElement>(null);

  // Physics animation state
  const targetPRef = useRef<number>(Math.max(0, Math.min(1, (progress || 0) / 100)));
  const currentPRef = useRef<number>(Math.max(0, Math.min(1, (progress || 0) / 100)));
  const vRef = useRef<number>(0);
  const wheelAngleRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(performance.now());
  const radarScanRef = useRef<number>(0);

  // Parallax offsets
  const mtnOffsetRef = useRef<number>(0);
  const cloudSeaOffsetRef = useRef<number>(0);
  const midCloudsOffsetRef = useRef<number>(0);
  const wispsOffsetRef = useRef<number>(0);

  // Smoothstep utility
  const ss = (min: number, max: number, x: number) => {
    const t = Math.max(0, Math.min(1, (x - min) / (max - min)));
    return t * t * (3 - 2 * t);
  };

  // Stage 1–12 Flight Kinematics
  // 1. Altitude a(p) in [0, 1] (0 = ground pavement, 1 = cruise ceiling FL360)
  const getAltitude = (p: number) => {
    if (p <= 0.20) return 0;
    if (p < 0.30) return 0.04 * ss(0.20, 0.30, p); // nose rotation lift
    if (p < 0.58) return 0.04 + 0.96 * ss(0.30, 0.58, p); // steep climb
    if (p <= 0.72) return 1.0; // stable cruise ceiling
    if (p < 0.915) return 1.0 * (1 - ss(0.72, 0.915, p)); // smooth descent
    return 0; // touchdown and rollout
  };

  // 2. Pitch Angle (degrees): positive is nose up, negative is nose down
  const getPitch = (p: number) => {
    if (p < 0.05) return 0;
    if (p < 0.18) return 0; // level takeoff roll
    if (p < 0.28) return 10.5 * ss(0.18, 0.28, p); // rotation (+10.5 deg)
    if (p < 0.48) return 10.5 + 1.2 * ss(0.28, 0.48, p); // climb (+11.7 deg)
    if (p < 0.58) return 11.7 - 9.9 * ss(0.48, 0.58, p); // transition to cruise (+1.8 deg)
    if (p <= 0.72) return 1.8; // cruise attitude (+1.8 deg)
    if (p < 0.82) return 1.8 - 4.8 * ss(0.72, 0.82, p); // descent glide (-3.0 deg)
    if (p < 0.91) return -3.0 + 5.5 * ss(0.82, 0.91, p); // approach flare (+2.5 deg)
    if (p < 0.935) return 2.5 * (1 - ss(0.91, 0.935, p)); // nose settling onto runway
    return 0;
  };

  // 3. Horizontal screen position X(p) in pixels (in 1600-wide viewBox):
  // Keeps aircraft beautifully framed in the golden ratio sweet spot without clipping
  const getScreenX = (p: number) => {
    if (p < 0.05) return 220; // departure gate
    if (p < 0.18) return 220 + 160 * ss(0.05, 0.18, p); // taxiing to runway threshold
    if (p < 0.55) return 380 + 200 * ss(0.18, 0.55, p); // climb to mid-screen
    if (p <= 0.72) return 580 + 40 * ss(0.55, 0.72, p); // cruising around 600px
    if (p < 0.915) return 620 - 100 * ss(0.72, 0.915, p); // approach position 520px
    return 520 + 180 * ss(0.915, 1.0, p); // rollout to destination gate 700px
  };

  // 4. Landing Gear state g(p) in [0, 1] (1 = extended, 0 = retracted)
  const getGearState = (p: number) => {
    if (p <= 0.46) return 1;
    if (p < 0.58) return 1 - ss(0.46, 0.58, p); // retracting
    if (p <= 0.78) return 0; // fully tucked during cruise
    if (p < 0.88) return ss(0.78, 0.88, p); // extending on final approach
    return 1; // fully locked down for landing & arrival
  };

  // 5. Airspeed (km/h) across the flight envelope
  const getSpeed = (p: number) => {
    if (p < 0.03) return 0;
    if (p < 0.08) return 30 * ss(0.03, 0.08, p); // taxi speed 0 -> 30 km/h
    if (p < 0.20) return 30 + 230 * ss(0.08, 0.20, p); // takeoff roll 30 -> 260 km/h
    if (p < 0.35) return 260 + 220 * ss(0.20, 0.35, p); // liftoff 260 -> 480 km/h
    if (p < 0.55) return 480 + 370 * ss(0.35, 0.55, p); // climb to 850 km/h
    if (p <= 0.72) return 850; // cruising speed 850 km/h
    if (p < 0.84) return 850 - 570 * ss(0.72, 0.84, p); // descent 850 -> 280 km/h
    if (p < 0.915) return 280 - 60 * ss(0.84, 0.915, p); // approach 280 -> 220 km/h
    if (p < 0.97) return 220 - 180 * ss(0.915, 0.97, p); // reverse thrust rollout 220 -> 40 km/h
    return Math.max(0, 40 * (1 - ss(0.97, 1.0, p))); // taxi to gate 0 km/h
  };

  // 6. Descriptive stage narrative
  const getStageInfo = (p: number): { name: string; altText: string } => {
    if (p < 0.05) return { name: "Stage 1 · Pre-flight · Parked at Gate with Jet Bridge", altText: "0 ft (Gate)" };
    if (p < 0.10) return { name: "Stage 2 · Taxiing · Moving along Apron Taxiway", altText: "0 ft (Taxi)" };
    if (p < 0.20) return { name: "Stage 3 · Takeoff Roll · Accelerating on Runway 09L", altText: "0 ft (Rollout)" };
    if (p < 0.30) return { name: "Stage 4 · Rotation · Raising Nose on Runway", altText: "0 ft (Vr Rotate)" };
    if (p < 0.40) return { name: "Stage 5 · Liftoff · Airborne from Runway", altText: "850 ft" };
    if (p < 0.50) return { name: "Stage 6 · Initial Climb · Climbing over Airport", altText: "6,500 ft" };
    if (p < 0.60) return { name: "Stage 7 · Climb & Gear Retract · Ascending to FL360", altText: "21,000 ft" };
    if (p < 0.72) return { name: "Stage 8 · Cruise · FL360 Above Cloud Ocean (850 km/h)", altText: "36,000 ft (FL360)" };
    if (p < 0.82) return { name: "Stage 9 · Descent · Glide Path toward Destination", altText: "18,000 ft" };
    if (p < 0.915) return { name: "Stage 10 · Final Approach · Gear Down & Runway Alignment", altText: "2,400 ft" };
    if (p < 0.97) return { name: "Stage 11 · Landing · Touchdown & Runway Rollout", altText: "0 ft (Touchdown)" };
    return { name: "Stage 12 · Arrival · Parked at Destination Gate", altText: "0 ft (Arrived)" };
  };

  // Sync prop changes
  useEffect(() => {
    const clamped = Math.max(0, Math.min(1, (progress || 0) / 100));
    targetPRef.current = clamped;
  }, [progress]);

  // Main 160Hz continuous animation and physics loop
  useEffect(() => {
    const RM = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - lastTimeRef.current) / 1000);
      lastTimeRef.current = now;

      // Exponential progress interpolation for butter-smooth scrubbing
      const targetP = targetPRef.current;
      currentPRef.current += (targetP - currentPRef.current) * (1 - Math.exp(-dt * 9.0));
      const p = currentPRef.current;

      // Calculate kinematics
      const targetSpeed = getSpeed(p);
      vRef.current += (targetSpeed - vRef.current) * (1 - Math.exp(-dt * 3.5));
      const currentSpeed = vRef.current;
      const speedRatio = currentSpeed / 850;
      const altRatio = getAltitude(p);
      const pitchDeg = getPitch(p);
      const gear = getGearState(p);

      // ── A. SKY & CELESTIAL ATMOSPHERE ──
      // Dynamic 4-phase sky blending: Dawn (0–0.22) -> Day (0.22–0.68) -> Sunset (0.68–0.88) -> Night (0.88–1.0)
      const dawnWeight = 1 - ss(0.08, 0.28, p);
      const dayWeight = ss(0.12, 0.32, p) * (1 - ss(0.64, 0.84, p));
      const sunsetWeight = ss(0.60, 0.78, p) * (1 - ss(0.85, 0.96, p));
      const nightWeight = ss(0.82, 0.98, p);

      if (skyDawnRef.current) skyDawnRef.current.setAttribute("opacity", dawnWeight.toFixed(3));
      if (skyDayRef.current) skyDayRef.current.setAttribute("opacity", dayWeight.toFixed(3));
      if (skySunsetRef.current) skySunsetRef.current.setAttribute("opacity", sunsetWeight.toFixed(3));
      if (skyNightRef.current) skyNightRef.current.setAttribute("opacity", nightWeight.toFixed(3));
      if (starsRef.current) starsRef.current.setAttribute("opacity", nightWeight.toFixed(3));

      // Sun and Moon celestial parabolic trajectory
      if (sunGroupRef.current) {
        const sunX = 140 + p * 1320;
        const sunY = 440 - 320 * Math.sin(Math.PI * Math.min(1, p / 0.88));
        const sunScale = p > 0.85 ? Math.max(0, 1 - (p - 0.85) / 0.08) : 1;
        sunGroupRef.current.setAttribute("transform", `translate(${sunX.toFixed(1)}, ${sunY.toFixed(1)}) scale(${sunScale.toFixed(2)})`);
        sunGroupRef.current.setAttribute("opacity", sunScale.toFixed(2));
      }

      if (moonGroupRef.current) {
        const moonOpacity = Math.max(0, (p - 0.82) / 0.18);
        moonGroupRef.current.setAttribute("opacity", moonOpacity.toFixed(3));
      }

      // ── B. PARALLAX ENVIRONMENT LAYERS ──
      if (!RM) {
        // Delta speed factor for horizontal movement
        const dx = speedRatio * dt * 420;

        mtnOffsetRef.current = (mtnOffsetRef.current + dx * 0.22) % 1600;
        cloudSeaOffsetRef.current = (cloudSeaOffsetRef.current + dx * 0.95) % 1600;
        midCloudsOffsetRef.current = (midCloudsOffsetRef.current + dx * 1.8) % 1600;
        wispsOffsetRef.current = (wispsOffsetRef.current + dx * 3.4) % 1600;

        if (mountainsLayerRef.current) {
          mountainsLayerRef.current.setAttribute("transform", `translate(${-mtnOffsetRef.current.toFixed(1)}, 0)`);
          // Mountain visibility increases as aircraft gains altitude
          const mtnOpacity = 0.35 + 0.65 * altRatio;
          mountainsLayerRef.current.setAttribute("opacity", mtnOpacity.toFixed(2));
        }

        if (cloudSeaLayerRef.current) {
          cloudSeaLayerRef.current.setAttribute("transform", `translate(${-cloudSeaOffsetRef.current.toFixed(1)}, 0)`);
          // Cloud ocean swells into full opacity during cruising altitude (FL360)
          const cloudSeaOpacity = ss(0.35, 0.58, p) * (1 - ss(0.72, 0.92, p));
          cloudSeaLayerRef.current.setAttribute("opacity", cloudSeaOpacity.toFixed(3));
        }

        if (midCloudsLayerRef.current) {
          midCloudsLayerRef.current.setAttribute("transform", `translate(${-midCloudsOffsetRef.current.toFixed(1)}, 0)`);
          const midOpacity = 0.3 + 0.7 * altRatio;
          midCloudsLayerRef.current.setAttribute("opacity", midOpacity.toFixed(2));
        }

        if (wispsLayerRef.current) {
          wispsLayerRef.current.setAttribute("transform", `translate(${-wispsOffsetRef.current.toFixed(1)}, 0)`);
          // Foreground mist streams at high speed during cruise
          const wispsOpacity = speedRatio * (0.2 + 0.8 * altRatio);
          wispsLayerRef.current.setAttribute("opacity", wispsOpacity.toFixed(2));
        }

        // Rotate wheels around axle centers based on ground movement
        if (altRatio < 0.05) {
          wheelAngleRef.current = (wheelAngleRef.current + currentSpeed * dt * 28) % 360;
          const rotStr = wheelAngleRef.current.toFixed(1);
          if (mainWheelsRef.current[0]) mainWheelsRef.current[0].setAttribute("transform", `rotate(${rotStr}, 124, 57)`);
          if (mainWheelsRef.current[1]) mainWheelsRef.current[1].setAttribute("transform", `rotate(${rotStr}, 140, 57)`);
          if (noseWheelsRef.current[0]) noseWheelsRef.current[0].setAttribute("transform", `rotate(${rotStr}, 220, 57)`);
        }
      }

      // ── C. AIRPORT RUNWAYS & TERMINALS TRANSLATION ──
      // Departure Airport (visible 0%–45%, scrolls left as aircraft takes off)
      if (departureAirportRef.current) {
        const depScrollX = -p * 2600;
        // Ground drops and fades as aircraft climbs
        const depY = altRatio * 180;
        const depOpacity = Math.max(0, 1 - altRatio * 1.6);
        departureAirportRef.current.setAttribute(
          "transform",
          `translate(${depScrollX.toFixed(1)}, ${depY.toFixed(1)})`
        );
        departureAirportRef.current.setAttribute("opacity", depOpacity.toFixed(3));
      }

      // Articulated Jet Bridge at Departure Gate:
      // At p=0–0.05, connected to L1 door. Retracts backward at p=0.05–0.10
      if (jetBridgeDepRef.current) {
        const bridgeRetract = ss(0.04, 0.09, p);
        const bx = -bridgeRetract * 65;
        const by = -bridgeRetract * 15;
        jetBridgeDepRef.current.setAttribute("transform", `translate(${bx.toFixed(1)}, ${by.toFixed(1)})`);
      }

      // Destination Airport (scrolls in from right as p reaches 0.78–1.0)
      if (destinationAirportRef.current) {
        const destApproachX = (0.94 - p) * 2800;
        const destY = altRatio * 180;
        const destOpacity = Math.max(0, 1 - altRatio * 1.5);
        destinationAirportRef.current.setAttribute(
          "transform",
          `translate(${destApproachX.toFixed(1)}, ${destY.toFixed(1)})`
        );
        destinationAirportRef.current.setAttribute("opacity", destOpacity.toFixed(3));
      }

      // ── D. AIRCRAFT KINEMATICS & ARTICULATION ──
      const acX = getScreenX(p);
      // Runway tarmac ground datum line is Y = 398px.
      // Cruise ceiling is Y = 160px (altitude displacement = 238px)
      const cruiseCeilingY = 160;
      const groundDatumY = 398;
      const acY = groundDatumY - altRatio * (groundDatumY - cruiseCeilingY);

      // Subtle realistic aerodynamic float during cruise
      const aeroFloatY = altRatio > 0.4 && !RM ? Math.sin(now / 520) * 2.2 * speedRatio : 0;
      const aeroFloatPitch = altRatio > 0.4 && !RM ? Math.sin(now / 640) * 0.45 * speedRatio : 0;

      // Touchdown compression shock absorption at p ~ 0.915–0.935
      const touchdownCompression = p >= 0.912 && p <= 0.945 ? Math.sin((p - 0.912) / 0.033 * Math.PI) * 4.5 : 0;

      if (aircraftGroupRef.current) {
        aircraftGroupRef.current.setAttribute(
          "transform",
          `translate(${acX.toFixed(1)}, ${(acY + aeroFloatY + touchdownCompression).toFixed(1)})`
        );
      }

      if (aircraftBodyRef.current) {
        // Pitch rotation pivoted on main landing gear center of gravity (X=135, Y=42)
        const finalPitch = pitchDeg + aeroFloatPitch;
        aircraftBodyRef.current.setAttribute(
          "transform",
          `rotate(${(-finalPitch).toFixed(2)}, 135, 42)`
        );
      }

      // Articulated Landing Gear: smooth retraction & deployment
      const gearScaleY = gear;
      const gearTranslateY = (1 - gear) * -16;
      const gearOpacity = Math.min(1, gear * 1.4);

      if (noseGearRef.current) {
        noseGearRef.current.setAttribute(
          "transform",
          `translate(0, ${gearTranslateY.toFixed(1)}) scale(1, ${gearScaleY.toFixed(2)})`
        );
        noseGearRef.current.setAttribute("opacity", gearOpacity.toFixed(2));
      }

      if (mainGearRef.current) {
        mainGearRef.current.setAttribute(
          "transform",
          `translate(0, ${gearTranslateY.toFixed(1)}) scale(1, ${gearScaleY.toFixed(2)})`
        );
        mainGearRef.current.setAttribute("opacity", gearOpacity.toFixed(2));
      }

      // Touchdown smoke puff
      if (touchdownSmokeRef.current) {
        const smokeOpacity = p >= 0.912 && p <= 0.94 ? (1 - (p - 0.912) / 0.028) * 0.85 : 0;
        touchdownSmokeRef.current.setAttribute("opacity", smokeOpacity.toFixed(2));
      }

      // ── E. LIGHTING & SPECIAL EFFECTS ──
      // Wingtip aviation strobe (FAA double-flash cycle every 1.2s)
      const strobeCycle = (now % 1200) / 1200;
      const isStrobeActive = strobeCycle < 0.04 || (strobeCycle > 0.11 && strobeCycle < 0.15);
      if (wingtipStrobeRef.current) {
        wingtipStrobeRef.current.setAttribute("opacity", isStrobeActive ? "1" : "0.08");
      }

      // Red anti-collision flashing beacon (pulsing softly every 0.75s)
      const beaconPulse = 0.25 + 0.75 * Math.pow(Math.sin((now / 750) * Math.PI), 4);
      beaconStrobesRef.current.forEach((b) => {
        if (b) b.setAttribute("opacity", beaconPulse.toFixed(2));
      });

      // Forward landing light beam (illuminates ground during approach, landing, and night arrival)
      if (landingBeamRef.current) {
        const beamIntensity = (1 - altRatio) * (0.2 + 0.8 * nightWeight) + (p >= 0.80 ? 0.6 : 0);
        landingBeamRef.current.setAttribute("opacity", (beamIntensity * 0.75).toFixed(2));
      }

      // Cabin window illumination glows warmly during evening/dusk/night
      if (cabinWindowsGlowRef.current) {
        const windowGlow = 0.2 + 0.8 * (sunsetWeight + nightWeight);
        cabinWindowsGlowRef.current.setAttribute("opacity", windowGlow.toFixed(2));
      }

      // Engine core thrust glow
      if (engineGlowRef.current) {
        const thrustIntensity = Math.min(1, 0.35 + 0.65 * speedRatio);
        engineGlowRef.current.setAttribute("opacity", thrustIntensity.toFixed(2));
      }

      // Billowing engine contrails during high-altitude cruise
      contrailsRef.current.forEach((c, idx) => {
        if (!c) return;
        const trailLength = speedRatio * (altRatio > 0.3 ? 120 + idx * 40 : 0);
        const trailOpacity = ss(0.42, 0.60, altRatio) * speedRatio * (idx === 0 ? 0.9 : 0.7);
        c.setAttribute("stroke-dashoffset", String(-now * 0.15));
        c.setAttribute("opacity", trailOpacity.toFixed(2));
        c.setAttribute("d", `M 98 ${42 + idx * 3} Q ${98 - trailLength * 0.5} ${43 + idx * 3 + Math.sin(now / 200 + idx) * 1.5} ${98 - trailLength} ${44 + idx * 4}`);
      });

      // Aerodynamic wind speed streaks
      streaksRef.current.forEach((s, idx) => {
        if (!s) return;
        const streakOpacity = altRatio * speedRatio * 0.75;
        const streakLen = 25 + idx * 15 + speedRatio * 40;
        s.setAttribute("opacity", streakOpacity.toFixed(2));
        s.setAttribute("x1", String(-streakLen));
        s.setAttribute("x2", "0");
      });

      // ── F. LIVE TELEMETRY LABELS ──
      const roundedSpeed = Math.round(currentSpeed);
      if (speedTextRef.current) {
        speedTextRef.current.textContent = `${roundedSpeed} km/h`;
      }

      if (pctTextRef.current) {
        pctTextRef.current.textContent = `${Math.round(p * 100)}%`;
      }

      const stageInfo = getStageInfo(p);
      if (stageTextRef.current) {
        stageTextRef.current.textContent = label || stageInfo.name;
      }
      if (altTextRef.current) {
        altTextRef.current.textContent = stageInfo.altText;
      }

      if (fillTrackRef.current) {
        fillTrackRef.current.style.width = `${(p * 100).toFixed(2)}%`;
      }

      animRef.current = requestAnimationFrame(frame);
    };

    animRef.current = requestAnimationFrame(frame);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [label]);

  return (
    <div ref={containerRef} className={`w-full select-none ${className}`}>
      {/* ── METADATA & TELEMETRY HEADER ── */}
      {showMeta && (
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2 px-1 font-mono text-xs tabular-nums">
          <div className="flex items-center gap-2 text-foreground font-sans min-w-0">
            <span className="font-semibold text-primary truncate max-w-[180px] sm:max-w-none">
              {origin}
            </span>
            <span className="text-muted-foreground/60 font-mono">→</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400 truncate max-w-[180px] sm:max-w-none">
              {destination}
            </span>
            <span className="text-muted-foreground/40 hidden sm:inline mx-1">|</span>
            <span
              ref={stageTextRef}
              className="text-xs text-muted-foreground font-normal truncate hidden md:inline"
            >
              Stage 1 · Pre-flight
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span
              ref={altTextRef}
              className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-muted/80 text-muted-foreground hidden sm:inline"
            >
              0 ft (Gate)
            </span>
            <span
              ref={speedTextRef}
              className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400 min-w-[65px] text-right"
            >
              0 km/h
            </span>
            <b ref={pctTextRef} className="text-sm font-bold text-foreground min-w-[38px] text-right">
              {Math.round(progress)}%
            </b>
          </div>
        </div>
      )}

      {/* ── HIGH-FIDELITY FLIGHT CANVAS (1600 × 500 Responsive Aspect Ratio) ── */}
      <div className="relative w-full aspect-[16/5] min-h-[200px] max-h-[380px] rounded-3xl overflow-hidden border border-border/80 shadow-xl bg-[#0f172a] select-none">
        <svg
          ref={sceneRef}
          viewBox="0 0 1600 500"
          className="w-full h-full block"
          preserveAspectRatio="xMidYMid slice"
          role="img"
          aria-label="Interactive commercial flight simulation"
        >
          <defs>
            {/* 1. Dynamic Atmosphere Gradients */}
            {/* Morning Dawn (0–22%) */}
            <linearGradient id={`${uid}_sky_dawn`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1e1b4b" />
              <stop offset="35%" stopColor="#312e81" />
              <stop offset="65%" stopColor="#c026d3" />
              <stop offset="85%" stopColor="#f43f5e" />
              <stop offset="100%" stopColor="#fed7aa" />
            </linearGradient>

            {/* Radiant Daytime Cruise (22–68%) */}
            <linearGradient id={`${uid}_sky_day`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0369a1" />
              <stop offset="40%" stopColor="#0284c7" />
              <stop offset="70%" stopColor="#38bdf8" />
              <stop offset="90%" stopColor="#7dd3fc" />
              <stop offset="100%" stopColor="#e0f2fe" />
            </linearGradient>

            {/* Sunset & Golden Hour Descent (68–88%) */}
            <linearGradient id={`${uid}_sky_sunset`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0f172a" />
              <stop offset="30%" stopColor="#312e81" />
              <stop offset="55%" stopColor="#831843" />
              <stop offset="78%" stopColor="#dc2626" />
              <stop offset="92%" stopColor="#ea580c" />
              <stop offset="100%" stopColor="#fef08a" />
            </linearGradient>

            {/* Midnight Navy Night Arrival (88–100%) */}
            <linearGradient id={`${uid}_sky_night`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#020617" />
              <stop offset="45%" stopColor="#090d16" />
              <stop offset="75%" stopColor="#0f172a" />
              <stop offset="100%" stopColor="#1e293b" />
            </linearGradient>

            {/* 2. Aircraft Paint Gradients (White Body with Royal Blue & Gold Livery) */}
            <linearGradient id={`${uid}_fuselage`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="35%" stopColor="#f8fafc" />
              <stop offset="75%" stopColor="#e2e8f0" />
              <stop offset="100%" stopColor="#94a3b8" />
            </linearGradient>

            <linearGradient id={`${uid}_belly_ribbon`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#0f172a" />
              <stop offset="40%" stopColor="#1e3a8a" />
              <stop offset="85%" stopColor="#2563eb" />
              <stop offset="100%" stopColor="#38bdf8" />
            </linearGradient>

            <linearGradient id={`${uid}_tail_fin`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#1e3a8a" />
              <stop offset="70%" stopColor="#0f172a" />
              <stop offset="100%" stopColor="#1e293b" />
            </linearGradient>

            <linearGradient id={`${uid}_engine_cowl`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f8fafc" />
              <stop offset="60%" stopColor="#e2e8f0" />
              <stop offset="100%" stopColor="#94a3b8" />
            </linearGradient>

            <linearGradient id={`${uid}_thrust_core`} x1="1" y1="0" x2="0" y2="0">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.9" />
              <stop offset="40%" stopColor="#f59e0b" stopOpacity="0.75" />
              <stop offset="85%" stopColor="#ef4444" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
            </linearGradient>

            <linearGradient id={`${uid}_landing_beam`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#fffbeb" stopOpacity="0.85" />
              <stop offset="50%" stopColor="#fef08a" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#fef08a" stopOpacity="0" />
            </linearGradient>

            {/* 3. Mountain Shading Gradients */}
            <linearGradient id={`${uid}_mtn_back`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#475569" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#1e293b" stopOpacity="0.8" />
            </linearGradient>

            <linearGradient id={`${uid}_mtn_fore`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#64748b" />
              <stop offset="50%" stopColor="#334155" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>

            {/* 4. Volumetric Cloud Ocean Shading */}
            <linearGradient id={`${uid}_cloud_sea`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="35%" stopColor="#f0f9ff" />
              <stop offset="70%" stopColor="#dbeafe" />
              <stop offset="100%" stopColor="#93c5fd" />
            </linearGradient>

            {/* 5. Terminal Building Glazing */}
            <linearGradient id={`${uid}_terminal_glass`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#0f172a" stopOpacity="0.95" />
            </linearGradient>
          </defs>

          {/* ── 1. SKY ATMOSPHERE (Four blended continuous layers) ── */}
          <rect ref={skyDawnRef} x="0" y="0" width="1600" height="500" fill={`url(#${uid}_sky_dawn)`} opacity="1" />
          <rect ref={skyDayRef} x="0" y="0" width="1600" height="500" fill={`url(#${uid}_sky_day)`} opacity="0" />
          <rect ref={skySunsetRef} x="0" y="0" width="1600" height="500" fill={`url(#${uid}_sky_sunset)`} opacity="0" />
          <rect ref={skyNightRef} x="0" y="0" width="1600" height="500" fill={`url(#${uid}_sky_night)`} opacity="0" />

          {/* ── 2. NIGHT CELESTIAL STARS (Visible during night arrival) ── */}
          <g ref={starsRef} opacity="0" fill="#ffffff">
            {[
              [80, 45, 1.2], [140, 90, 0.9], [220, 30, 1.4], [310, 85, 0.8], [420, 40, 1.1],
              [510, 95, 1.3], [630, 35, 0.8], [740, 75, 1.4], [860, 45, 1.0], [950, 110, 1.2],
              [1080, 35, 1.5], [1190, 80, 0.8], [1280, 50, 1.3], [1370, 95, 0.9], [1480, 40, 1.4],
              [180, 140, 0.9], [360, 160, 1.1], [580, 130, 1.0], [820, 150, 1.2], [1040, 140, 0.9],
              [1220, 160, 1.1], [1420, 130, 1.3], [1530, 80, 1.0], [90, 180, 0.8], [710, 170, 1.1],
            ].map(([cx, cy, r], i) => (
              <circle key={i} cx={cx} cy={cy} r={r} />
            ))}
          </g>

          {/* ── 3. SUN & CELESTIAL BODY ── */}
          <g ref={sunGroupRef} transform="translate(140, 440)">
            {/* Outer corona dispersion */}
            <circle cx="0" cy="0" r="54" fill="#fef08a" opacity="0.25" filter="blur(4px)" />
            {/* Warm sun halo */}
            <circle cx="0" cy="0" r="32" fill="#fffbeb" opacity="0.65" />
            {/* Pure sun core */}
            <circle cx="0" cy="0" r="18" fill="#ffffff" />
          </g>

          {/* Crescent Moon for Night Arrival */}
          <g ref={moonGroupRef} transform="translate(1420, 85)" opacity="0">
            <circle cx="0" cy="0" r="22" fill="#fef08a" opacity="0.85" />
            <circle cx="8" cy="-6" r="20" fill="#090d16" />
          </g>

          {/* ── 4. HIGH-ALTITUDE CIRRUS CLOUD STREAKS ── */}
          <g opacity="0.65" fill="none" stroke="#ffffff" strokeLinecap="round">
            <path d="M 60 70 Q 240 50 420 72 T 840 65" strokeWidth="3" opacity="0.5" />
            <path d="M 500 85 Q 720 60 940 85 T 1380 75" strokeWidth="2.5" opacity="0.45" />
            <path d="M 980 95 Q 1180 75 1420 95" strokeWidth="2" opacity="0.4" />
          </g>

          {/* ── 5. DISTANT SNOW-CAPPED ALPINE MOUNTAIN RANGE (Parallax Layer) ── */}
          <g ref={mountainsLayerRef} opacity="0.6">
            {/* Seamless 3200px width for infinite wrapping */}
            <g>
              {/* Back Ridge */}
              <polygon
                points="0,430 0,260 80,210 160,250 250,195 340,245 440,180 540,240 660,190 760,235 880,185 990,240 1100,190 1220,250 1340,195 1440,240 1540,205 1600,230 1600,430"
                fill={`url(#${uid}_mtn_back)`}
              />
              <polygon
                points="1600,430 1600,260 1680,210 1760,250 1850,195 1940,245 2040,180 2140,240 2260,190 2360,235 2480,185 2590,240 2700,190 2820,250 2940,195 3040,240 3140,205 3200,230 3200,430"
                fill={`url(#${uid}_mtn_back)`}
              />
              {/* Fore Ridge with Sunlit Rock Facets & Snow Peaks */}
              <polygon
                points="0,430 0,300 70,240 150,285 240,225 330,290 430,210 530,280 630,220 740,290 850,215 960,285 1060,225 1170,295 1280,220 1390,285 1500,230 1600,270 1600,430"
                fill={`url(#${uid}_mtn_fore)`}
              />
              <polygon
                points="1600,430 1600,300 1670,240 1750,285 1840,225 1930,290 2030,210 2130,280 2230,220 2340,290 2450,215 2560,285 2660,225 2770,295 2880,220 2990,285 3100,230 3200,270 3200,430"
                fill={`url(#${uid}_mtn_fore)`}
              />
              {/* Snow Caps */}
              {[70, 240, 430, 630, 850, 1060, 1280, 1500, 1670, 1840, 2030, 2230, 2450, 2660, 2880, 3100].map((px, idx) => (
                <polygon
                  key={idx}
                  points={`${px},${210 + (idx % 3) * 15} ${px - 18},${235 + (idx % 3) * 15} ${px - 4},${228 + (idx % 3) * 15} ${px},${232 + (idx % 3) * 15} ${px + 8},${227 + (idx % 3) * 15} ${px + 20},${236 + (idx % 3) * 15}`}
                  fill="#ffffff"
                  opacity="0.9"
                />
              ))}
            </g>
          </g>

          {/* ── 6. VOLUMETRIC CLOUD OCEAN CARPET (Cruising Altitude Deck) ── */}
          <g ref={cloudSeaLayerRef} opacity="0">
            <g fill={`url(#${uid}_cloud_sea)`}>
              {/* 3200px Continuous Cumulus Cloud Ocean Floor */}
              <path d="M 0 500 L 0 350 C 40 310, 100 320, 150 335 C 200 300, 280 300, 340 330 C 400 305, 480 305, 540 335 C 600 295, 700 295, 770 330 C 840 305, 920 305, 980 335 C 1040 300, 1140 300, 1210 330 C 1280 305, 1360 305, 1420 335 C 1480 295, 1560 300, 1600 330 L 1600 500 Z" />
              <path d="M 1600 500 L 1600 350 C 1640 310, 1700 320, 1750 335 C 1800 300, 1880 300, 1940 330 C 2000 305, 2080 305, 2140 335 C 2200 295, 2300 295, 2370 330 C 2440 305, 2520 305, 2580 335 C 2640 300, 2740 300, 2810 330 C 2880 305, 2960 305, 3020 335 C 3080 295, 3160 300, 3200 330 L 3200 500 Z" />
            </g>
            {/* Luminous Sunlit Cloud Billow Highlights */}
            <g fill="#ffffff" opacity="0.8">
              {[80, 270, 470, 690, 910, 1130, 1340, 1550, 1680, 1870, 2070, 2290, 2510, 2730, 2940, 3150].map((cx, idx) => (
                <ellipse key={idx} cx={cx} cy={335} rx="48" ry="18" />
              ))}
            </g>
          </g>

          {/* ── 7. PASSING MID-LEVEL CUMULUS CLOUDS (Flight Level Drift) ── */}
          <g ref={midCloudsLayerRef} opacity="0.45" fill="#ffffff">
            <g>
              <path d="M 120 220 C 120 185, 165 170, 200 180 C 220 160, 260 155, 290 170 C 320 150, 370 160, 390 185 C 415 180, 440 200, 430 225 Z" />
              <path d="M 720 240 C 720 210, 755 195, 790 205 C 810 185, 850 180, 880 195 C 910 175, 960 185, 980 210 C 1005 205, 1030 225, 1020 250 Z" />
              <path d="M 1320 210 C 1320 180, 1360 165, 1395 175 C 1415 155, 1460 150, 1490 165 C 1520 145, 1570 155, 1590 180 C 1615 175, 1640 195, 1630 220 Z" />
              {/* Repeated for wrap */}
              <path d="M 1720 220 C 1720 185, 1765 170, 1800 180 C 1820 160, 1860 155, 1890 170 C 1920 150, 1970 160, 1990 185 C 2015 180, 2040 200, 2030 225 Z" />
              <path d="M 2320 240 C 2320 210, 2355 195, 2390 205 C 2410 185, 2450 180, 2480 195 C 2510 175, 2560 185, 2580 210 C 2605 205, 2630 225, 2620 250 Z" />
              <path d="M 2920 210 C 2920 180, 2960 165, 2995 175 C 3015 155, 3060 150, 3090 165 C 3120 145, 3170 155, 3190 180 C 3215 175, 3240 195, 3230 220 Z" />
            </g>
          </g>

          {/* ── 8. DEPARTURE AIRPORT (Stage 1–5 Ground Operations) ── */}
          <g ref={departureAirportRef}>
            {/* Airfield Grass Verge */}
            <rect x="-200" y="380" width="2200" height="120" fill="#15803d" />
            <rect x="-200" y="380" width="2200" height="6" fill="#166534" />

            {/* Departure Runway 09L */}
            <rect x="-100" y="396" width="2100" height="90" fill="#1e293b" />
            <line x1="-100" y1="398" x2="2000" y2="398" stroke="#ffffff" strokeWidth="2.5" />
            {/* Runway Threshold Piano Keys (12 bars) */}
            <g fill="#ffffff">
              {Array.from({ length: 12 }).map((_, i) => (
                <rect key={i} x={360 + i * 20} y="405" width="12" height="42" />
              ))}
            </g>
            {/* Runway Threshold Green Lights Bar */}
            <g fill="#22c55e">
              {Array.from({ length: 16 }).map((_, i) => (
                <circle key={i} cx={350 + i * 16} cy="400" r="2.5" />
              ))}
            </g>
            {/* White Centerline Dashed Stripe */}
            <line x1="620" y1="440" x2="2000" y2="440" stroke="#ffffff" strokeWidth="4" strokeDasharray="36 24" />
            {/* Yellow Taxiway Lead-In Line */}
            <path d="M -50 460 L 260 460 Q 320 460 350 440" fill="none" stroke="#f59e0b" strokeWidth="2.5" />

            {/* Departure Terminal Building Architecture */}
            <g transform="translate(40, 240)">
              {/* Terminal Concourse Body */}
              <rect x="0" y="50" width="280" height="96" rx="4" fill="#334155" />
              {/* Modern Curved Roof Canopy */}
              <path d="M -15 50 Q 140 24 295 50 L 290 56 Q 140 32 -10 56 Z" fill="#94a3b8" />
              {/* Glazed Glass Windows */}
              <rect x="15" y="60" width="250" height="42" rx="2" fill={`url(#${uid}_terminal_glass)`} />
              {/* Window Mullions */}
              {Array.from({ length: 14 }).map((_, i) => (
                <line key={i} x1={25 + i * 18} y1="60" x2={25 + i * 18} y2="102" stroke="#475569" strokeWidth="1" />
              ))}
              {/* Gate Sign: GATE 12A */}
              <rect x="195" y="44" width="75" height="14" rx="2" fill="#0f172a" />
              <text x="232" y="55" fill="#38bdf8" fontSize="9" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
                GATE 12A
              </text>
            </g>

            {/* Departure Air Traffic Control Tower */}
            <g transform="translate(345, 175)">
              {/* Tower Shaft */}
              <polygon points="18,175 14,50 32,50 28,175" fill="#64748b" />
              {/* Glazed 360-deg Cab */}
              <polygon points="6,50 40,50 46,26 0,26" fill={`url(#${uid}_terminal_glass)`} stroke="#475569" strokeWidth="1.5" />
              {/* Roof Radome & Antennas */}
              <path d="M 12 26 Q 23 14 34 26 Z" fill="#f8fafc" />
              <line x1="23" y1="14" x2="23" y2="2" stroke="#94a3b8" strokeWidth="2" />
              <circle cx="23" cy="2" r="3" fill="#ef4444" />
            </g>

            {/* Articulated Passenger Jet Bridge (Connected at Gate 0–5%, Retracts at 5–10%) */}
            <g ref={jetBridgeDepRef} transform="translate(180, 310)">
              {/* Terminal Rotunda Pivot */}
              <circle cx="0" cy="40" r="14" fill="#475569" stroke="#334155" strokeWidth="2" />
              {/* Telescopic Accordion Tunnel */}
              <rect x="0" y="32" width="70" height="16" rx="2" fill="#64748b" stroke="#334155" strokeWidth="1" />
              {/* Accordion Pleats */}
              {Array.from({ length: 5 }).map((_, i) => (
                <line key={i} x1={12 + i * 11} y1="32" x2={12 + i * 11} y2="48" stroke="#334155" strokeWidth="1.2" />
              ))}
              {/* Aircraft Docking Cab */}
              <rect x="68" y="28" width="22" height="24" rx="3" fill="#334155" />
              <rect x="74" y="32" width="12" height="16" fill="#38bdf8" opacity="0.6" />
              {/* Support Wheel Bogie */}
              <line x1="50" y1="48" x2="50" y2="78" stroke="#1e293b" strokeWidth="3" />
              <circle cx="46" cy="78" r="4.5" fill="#0f172a" />
              <circle cx="54" cy="78" r="4.5" fill="#0f172a" />
            </g>
          </g>

          {/* ── 9. DESTINATION AIRPORT (Stage 9–12 Arrival Operations) ── */}
          <g ref={destinationAirportRef} transform="translate(3200, 0)">
            {/* Airfield Grass Verge */}
            <rect x="0" y="380" width="2200" height="120" fill="#15803d" />
            <rect x="0" y="380" width="2200" height="6" fill="#166534" />

            {/* Destination Runway 27R */}
            <rect x="100" y="396" width="2100" height="90" fill="#1e293b" />
            <line x1="100" y1="398" x2="2200" y2="398" stroke="#ffffff" strokeWidth="2.5" />
            {/* Runway Approach Lighting System (ALS Masts) */}
            <g stroke="#ffffff" strokeWidth="1.5">
              {Array.from({ length: 8 }).map((_, i) => (
                <g key={i} transform={`translate(${-120 + i * 28}, 420)`}>
                  <line x1="0" y1="0" x2="0" y2="18" />
                  <circle cx="0" cy="0" r="3" fill="#ffffff" />
                </g>
              ))}
            </g>
            {/* PAPI 4-Light Glideslope Indicator */}
            <g transform="translate(240, 390)">
              <circle cx="0" cy="0" r="3" fill="#ef4444" />
              <circle cx="8" cy="0" r="3" fill="#ef4444" />
              <circle cx="16" cy="0" r="3" fill="#ffffff" />
              <circle cx="24" cy="0" r="3" fill="#ffffff" />
            </g>
            {/* Destination Runway Threshold Piano Keys */}
            <g fill="#ffffff">
              {Array.from({ length: 12 }).map((_, i) => (
                <rect key={i} x={180 + i * 20} y="405" width="12" height="42" />
              ))}
            </g>
            {/* Threshold Green Lights */}
            <g fill="#22c55e">
              {Array.from({ length: 16 }).map((_, i) => (
                <circle key={i} cx={170 + i * 16} cy="400" r="2.5" />
              ))}
            </g>
            {/* Centerline Dashes */}
            <line x1="440" y1="440" x2="1600" y2="440" stroke="#ffffff" strokeWidth="4" strokeDasharray="36 24" />

            {/* Runway Blue & Green Night Taxiway Lights */}
            <g fill="#38bdf8">
              {Array.from({ length: 24 }).map((_, i) => (
                <circle key={i} cx={200 + i * 45} cy="484" r="2.2" />
              ))}
            </g>
            <g fill="#22c55e">
              {Array.from({ length: 20 }).map((_, i) => (
                <circle key={i} cx={300 + i * 45} cy="460" r="2" />
              ))}
            </g>

            {/* Destination Terminal Building */}
            <g transform="translate(860, 240)">
              <rect x="0" y="50" width="320" height="96" rx="4" fill="#1e293b" />
              <path d="M -10 50 Q 160 22 330 50 L 325 56 Q 160 30 -5 56 Z" fill="#64748b" />
              {/* Warm Night Concourse Lighting */}
              <rect x="20" y="62" width="280" height="40" rx="2" fill="#fef08a" opacity="0.85" />
              {Array.from({ length: 16 }).map((_, i) => (
                <line key={i} x1={32 + i * 17} y1="62" x2={32 + i * 17} y2="102" stroke="#334155" strokeWidth="1.2" />
              ))}
              {/* Destination Gate Sign: GATE 4B */}
              <rect x="215" y="44" width="75" height="14" rx="2" fill="#0f172a" />
              <text x="252" y="55" fill="#22c55e" fontSize="9" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
                GATE 4B
              </text>
            </g>

            {/* Destination ATC Tower */}
            <g transform="translate(1220, 175)">
              <polygon points="18,175 14,50 32,50 28,175" fill="#475569" />
              <polygon points="6,50 40,50 46,26 0,26" fill="#fef08a" opacity="0.9" stroke="#334155" strokeWidth="1.5" />
              <path d="M 12 26 Q 23 14 34 26 Z" fill="#94a3b8" />
              <circle cx="23" cy="2" r="3.5" fill="#22c55e" />
            </g>

            {/* Arrival Jet Bridge at Gate 4B */}
            <g transform="translate(880, 312)">
              <circle cx="0" cy="40" r="14" fill="#334155" />
              <rect x="0" y="32" width="85" height="16" rx="2" fill="#475569" />
              <rect x="80" y="28" width="24" height="24" rx="3" fill="#1e293b" />
              <rect x="86" y="32" width="12" height="16" fill="#fef08a" opacity="0.8" />
              <line x1="60" y1="48" x2="60" y2="78" stroke="#0f172a" strokeWidth="3" />
              <circle cx="56" cy="78" r="4.5" fill="#0f172a" />
              <circle cx="64" cy="78" r="4.5" fill="#0f172a" />
            </g>
          </g>

          {/* ── 10. AIRCRAFT GROUP (Widebody Commercial Airliner: A350/787 Profile) ── */}
          <g ref={aircraftGroupRef} transform="translate(220, 398)">
            {/* Forward Landing Light Projector Beam */}
            <polygon
              ref={landingBeamRef}
              points="248,34 520,12 520,68"
              fill={`url(#${uid}_landing_beam)`}
              opacity="0"
              pointerEvents="none"
            />

            {/* Touchdown Wheel Smoke Puff at Main Bogie (p ~ 0.915) */}
            <g ref={touchdownSmokeRef} opacity="0" transform="translate(100, 48)">
              <ellipse cx="0" cy="0" rx="18" ry="8" fill="#ffffff" opacity="0.75" />
              <circle cx="-12" cy="-4" r="10" fill="#f1f5f9" opacity="0.6" />
              <circle cx="-24" cy="-2" r="12" fill="#cbd5e1" opacity="0.45" />
            </g>

            {/* Aerodynamic Speed Streaks (High-Speed Cruise) */}
            <g stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" opacity="0">
              <line ref={(el) => { if (el) streaksRef.current[0] = el; }} x1="-40" y1="18" x2="0" y2="18" />
              <line ref={(el) => { if (el) streaksRef.current[1] = el; }} x1="-60" y1="36" x2="0" y2="36" />
              <line ref={(el) => { if (el) streaksRef.current[2] = el; }} x1="-45" y1="52" x2="0" y2="52" />
            </g>

            {/* Jet Engine Contrails (Bilateral Billowing Clouds) */}
            <path
              ref={(el) => { if (el) contrailsRef.current[0] = el; }}
              d="M 98 42 Q 20 42 -80 43"
              fill="none"
              stroke="#ffffff"
              strokeWidth="5"
              strokeLinecap="round"
              opacity="0"
            />
            <path
              ref={(el) => { if (el) contrailsRef.current[1] = el; }}
              d="M 98 46 Q 20 46 -80 48"
              fill="none"
              stroke="#ffffff"
              strokeWidth="4"
              strokeLinecap="round"
              opacity="0"
            />

            {/* PIVOTING AIRCRAFT BODY (Rotates along pitch angle centered at X=135, Y=42) */}
            <g ref={aircraftBodyRef}>
              {/* Horizontal Stabilizer (Elevator Fin) */}
              <polygon points="26,30 4,28 2,32 32,34" fill="#94a3b8" />
              <rect x="2" y="30" width="3" height="2" rx="1" fill="#1e293b" />

              {/* Swept Vertical Tail Fin (Deep Navy/Royal Blue Livery) */}
              <path d="M 52 24 L 12 2 L 20 2 L 60 24 Z" fill={`url(#${uid}_tail_fin)`} />
              <path d="M 20 2 L 26 2 L 62 24 L 60 24 Z" fill="#ef4444" />
              {/* Airline Compass Rose Insignia */}
              <circle cx="38" cy="13" r="4.5" fill="#ffffff" opacity="0.95" />
              <polygon points="38,9 41,15 35,15" fill="#f59e0b" />
              <polygon points="38,17 41,11 35,11" fill="#2563eb" />
              {/* Tail Fin Top Anti-Collision Red Beacon */}
              <circle ref={(el) => { if (el) beaconStrobesRef.current[0] = el; }} cx="16" cy="2" r="2.4" fill="#ef4444" />

              {/* Streamlined Fuselage Body (Boeing 787 / A350 Style) */}
              <path
                d="M 28 32 Q 28 22 52 22 L 198 22 Q 236 22 254 33 Q 242 44 198 44 L 52 44 Q 28 44 28 32 Z"
                fill={`url(#${uid}_fuselage)`}
                stroke="#cbd5e1"
                strokeWidth="0.8"
              />

              {/* Royal Blue Belly Swoop Cheatline Ribbon */}
              <path
                d="M 36 38 Q 130 43 242 36 L 246 38 Q 130 47 40 42 Z"
                fill={`url(#${uid}_belly_ribbon)`}
              />
              <path d="M 42 41 Q 130 46 238 39" stroke="#f59e0b" strokeWidth="1.2" fill="none" />

              {/* Cockpit Sunglasses Visor Canopy & Glint */}
              <path d="M 220 26 H 238 Q 248 26 250 31 L 234 31 Q 222 31 220 26 Z" fill="#0f172a" />
              <polygon points="223,27 232,27 231,30 222,30" fill="#38bdf8" opacity="0.75" />
              <polygon points="234,27 243,27 245,30 235,30" fill="#38bdf8" opacity="0.75" />
              <line x1="224" y1="27.5" x2="244" y2="27.5" stroke="#ffffff" strokeWidth="0.8" opacity="0.85" />

              {/* 18 Passenger Cabin Windows (Dark Frames) */}
              <g fill="#1e293b">
                {[60, 68, 76, 84, 92, 100, 108, 116, 124, 132, 140, 148, 156, 164, 172, 180, 188, 196, 204].map((x) => (
                  <rect key={x} x={x} y="27" width="3.6" height="4.6" rx="1.2" />
                ))}
              </g>

              {/* Warm Ambient Cabin Window Glow (Illuminates in Dusk & Night) */}
              <g ref={cabinWindowsGlowRef} fill="#fef08a" opacity="0.3">
                {[60, 68, 76, 84, 92, 100, 108, 116, 124, 132, 140, 148, 156, 164, 172, 180, 188, 196, 204].map((x) => (
                  <circle key={x} cx={x + 1.8} cy="29.3" r="1.3" />
                ))}
              </g>

              {/* Passenger Doors (L1, L2, L3) */}
              <rect x="52" y="24" width="4.8" height="18" rx="1" fill="none" stroke="#94a3b8" strokeWidth="0.7" />
              <rect x="136" y="24" width="4.8" height="18" rx="1" fill="none" stroke="#94a3b8" strokeWidth="0.7" />
              <rect x="210" y="24" width="4.8" height="18" rx="1" fill="none" stroke="#94a3b8" strokeWidth="0.7" />

              {/* Swept Main Wing & Blended Sharklet Winglet */}
              <path d="M 122 37 L 176 37 L 114 58 L 92 58 Z" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="0.8" />
              {/* Blended Sharklet Wingtip */}
              <path d="M 92 58 L 88 51 L 93 51 L 96 58 Z" fill="#2563eb" />
              {/* Green Navigation LED (Starboard) */}
              <circle cx="91" cy="53" r="1.6" fill="#22c55e" />
              {/* Wingtip High-Intensity White Flashing Strobe */}
              <circle ref={wingtipStrobeRef} cx="88" cy="51" r="2.5" fill="#ffffff" opacity="0.1" />

              {/* High-Bypass Turbofan Jet Engine Nacelle */}
              <path d="M 140 38 V 45" stroke="#475569" strokeWidth="2.8" />
              {/* Nacelle Cowl */}
              <rect x="122" y="43" width="38" height="13" rx="6.5" fill={`url(#${uid}_engine_cowl)`} stroke="#64748b" strokeWidth="0.8" />
              {/* Chrome Inlet Lip */}
              <ellipse cx="159" cy="49.5" rx="2.8" ry="6" fill="#f8fafc" stroke="#475569" strokeWidth="0.8" />
              {/* Dark Fan Inlet & Titanium Spinner */}
              <ellipse cx="157.5" cy="49.5" rx="2.3" ry="5.2" fill="#0f172a" />
              <circle cx="157.5" cy="49.5" r="1.8" fill="#94a3b8" />
              <circle cx="157.5" cy="49.5" r="0.7" fill="#ffffff" />
              {/* Exhaust Nozzle */}
              <ellipse cx="122" cy="49.5" rx="2.4" ry="4.6" fill="#334155" />
              {/* Engine Core Thrust Glow */}
              <ellipse ref={engineGlowRef} cx="106" cy="49.5" rx="14" ry="4" fill={`url(#${uid}_thrust_core)`} opacity="0.6" />

              {/* Fuselage Top & Belly Red Anti-Collision Beacons */}
              <circle ref={(el) => { if (el) beaconStrobesRef.current[1] = el; }} cx="128" cy="21.5" r="2" fill="#ef4444" />
              <circle ref={(el) => { if (el) beaconStrobesRef.current[2] = el; }} cx="138" cy="44.5" r="2" fill="#ef4444" />

              {/* ── ARTICULATED RETRACTABLE LANDING GEAR ── */}
              {/* Main Landing Gear Bogie (Under Wing, X=130) */}
              <g ref={mainGearRef} id="main-gear">
                {/* Heavy Oleo Telescopic Strut & Torque Scissor */}
                <path d="M 132 46 V 56 M 128 50 L 132 53" stroke="#334155" strokeWidth="2.4" strokeLinecap="round" />
                {/* 4-Wheel Dual Bogie Beam */}
                <rect x="122" y="55" width="20" height="2.5" rx="1" fill="#1e293b" />
                {/* Front Wheel Pair */}
                <g ref={(el) => { if (el) mainWheelsRef.current[0] = el; }}>
                  <circle cx="124" cy="57" r="5.2" fill="#0f172a" />
                  <circle cx="124" cy="57" r="2.6" fill="#94a3b8" />
                  <circle cx="124" cy="57" r="1.1" fill="#475569" />
                </g>
                {/* Rear Wheel Pair */}
                <g ref={(el) => { if (el) mainWheelsRef.current[1] = el; }}>
                  <circle cx="140" cy="57" r="5.2" fill="#0f172a" />
                  <circle cx="140" cy="57" r="2.6" fill="#94a3b8" />
                  <circle cx="140" cy="57" r="1.1" fill="#475569" />
                </g>
              </g>

              {/* Nose Landing Gear Assembly (Under Cockpit, X=220) */}
              <g ref={noseGearRef} id="nose-gear">
                {/* Forward Strut & Taxi Light */}
                <path d="M 220 43 V 55" stroke="#334155" strokeWidth="2.2" strokeLinecap="round" />
                <circle cx="221" cy="49" r="1.4" fill="#fef08a" />
                {/* Dual Nose Wheel */}
                <g ref={(el) => { if (el) noseWheelsRef.current[0] = el; }}>
                  <circle cx="220" cy="57" r="4.2" fill="#0f172a" />
                  <circle cx="220" cy="57" r="2.1" fill="#94a3b8" />
                  <circle cx="220" cy="57" r="0.9" fill="#475569" />
                </g>
              </g>
            </g>
          </g>

          {/* ── 11. FOREGROUND TRANSLUCENT ATMOSPHERIC VAPOR WISPS (Cruise Speed Stream) ── */}
          <g ref={wispsLayerRef} opacity="0.35" fill="none" stroke="#ffffff" strokeLinecap="round">
            <path d="M 40 180 Q 240 160 480 185 T 960 175" strokeWidth="3.5" opacity="0.4" />
            <path d="M 320 230 Q 560 210 820 235 T 1380 220" strokeWidth="2.8" opacity="0.35" />
            <path d="M 720 160 Q 940 140 1220 165 T 1600 155" strokeWidth="2.2" opacity="0.3" />
            {/* Repeated for seamless wrap */}
            <path d="M 1640 180 Q 1840 160 2080 185 T 2560 175" strokeWidth="3.5" opacity="0.4" />
            <path d="M 1920 230 Q 2160 210 2420 235 T 2980 220" strokeWidth="2.8" opacity="0.35" />
            <path d="M 2320 160 Q 2540 140 2820 165 T 3200 155" strokeWidth="2.2" opacity="0.3" />
          </g>
        </svg>
      </div>

      {/* ── PROGRESS TRACK FILL BAR ── */}
      {showBar && (
        <div className="h-2 mt-2 rounded-full bg-muted/60 overflow-hidden border border-border/40 p-0.5">
          <div
            ref={fillTrackRef}
            className="h-full rounded-full bg-gradient-to-r from-sky-400 via-primary to-emerald-500 shadow-sm transition-[width] duration-300 ease-out"
            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
          />
        </div>
      )}
    </div>
  );
}
