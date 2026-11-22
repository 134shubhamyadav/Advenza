"use client";

import React, { useEffect, useRef } from "react";

interface FerryProgressBarProps {
  progress: number; // 0 to 100
  label?: string;
  origin?: string;
  destination?: string;
  showMeta?: boolean;
  showBar?: boolean;
  className?: string;
}

export function FerryProgressBar({
  progress = 0,
  label = "Coastal Ferry Transit",
  origin = "Origin Pier",
  destination = "Destination Jetty",
  showMeta = true,
  showBar = true,
  className = "",
}: FerryProgressBarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number | null>(null);

  // References to dynamic elements
  const sceneRef = useRef<HTMLDivElement>(null);
  const pctRef = useRef<HTMLElement>(null);
  const labelRef = useRef<HTMLElement>(null);
  const spdRef = useRef<HTMLElement>(null);
  const sunRef = useRef<HTMLDivElement>(null);
  const duskRef = useRef<HTMLDivElement>(null);
  const tintRef = useRef<HTMLDivElement>(null);
  const starsRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLElement>(null);
  const beamRef = useRef<SVGPolygonElement | null>(null);
  const csvgRef = useRef<SVGSVGElement>(null);
  const gullsRef = useRef<SVGSVGElement>(null);
  const wakeRef = useRef<HTMLDivElement>(null);

  // State refs for physics animation loop
  const pRef = useRef<number>((progress || 0) / 100);
  const smoothPRef = useRef<number>((progress || 0) / 100);
  const lastChangeRef = useRef<number>(performance.now());
  const vRef = useRef<number>(0);
  const bxRef = useRef<number>(0);
  const shownRef = useRef<number>(-1);
  const lastTimeRef = useRef<number>(performance.now());

  // Store layer object references for parallax shifting
  const layersRef = useRef<Array<{ e: HTMLElement; w: number; f: number; x: number }>>([]);
  const streaksRef = useRef<HTMLElement[]>([]);

  useEffect(() => {
    if (!sceneRef.current || !csvgRef.current) return;

    /* ---------- Scenery tiles (seamless oceanic) ---------- */
    let st = "";
    [[12, 8], [47, 30], [93, 62], [130, 14], [171, 44], [219, 22], [262, 70], [298, 5], [333, 38], [270, 52]].forEach(
      (a) => (st += `<circle cx="${a[0]}" cy="${a[1]}" r=".9" fill="#fff"/>`)
    );

    // Coastal headlands with lighthouse
    const coastalHeadlands = `<path d="M0 100V55L60 38 140 48 210 28 290 50 370 32 440 52 500 40 540 55V100Z" fill="#6d8da8"/>
<path d="M0 100V68L80 48 160 62 250 44 340 64 420 48 500 65 540 68V100Z" fill="#52708b"/>
<!-- Lighthouse on headland -->
<polygon points="208,28 212,28 214,10 206,10" fill="#f4f4f0"/>
<rect x="205" y="7" width="10" height="3" fill="#d8433a"/>
<circle cx="210" cy="5" r="2.2" fill="#ffe9a0"/>
<path d="M208 16h4M207 22h6" stroke="#d8433a" stroke-width="1.8"/>`;

    // Deep water wave swells
    let deepWater = '<rect width="400" height="40" fill="#2d5e88"/>';
    for (let x = 0; x < 400; x += 40) {
      deepWater += `<path d="M${x} 10Q${x + 20} 4 ${x + 40} 10" stroke="#3d729e" stroke-width="1.6" fill="none"/>
<path d="M${x + 20} 22Q${x + 40} 16 ${x + 60} 22" stroke="#254e73" stroke-width="1.4" fill="none"/>`;
    }

    // Mid ocean surface swells with foam crests
    let midWaves = '<rect width="320" height="30" fill="#245177"/>';
    for (let x = 0; x < 320; x += 32) {
      midWaves += `<path d="M${x} 8Q${x + 16} 2 ${x + 32} 8" stroke="#5da0cb" stroke-width="1.6" fill="none"/>
<circle cx="${x + 16}" cy="2" r="1" fill="#fff" opacity=".7"/>`;
    }

    // Foreground water with turquoise wave ripples & whitecaps
    let foreWater = '<rect width="240" height="24" fill="#1b4263"/>';
    for (let x = 0; x < 240; x += 24) {
      foreWater += `<path d="M${x} 6Q${x + 12} 0 ${x + 24} 6" stroke="#8fd2f2" stroke-width="1.8" fill="none"/>
<path d="M${x + 6} 14Q${x + 18} 9 ${x + 30} 14" stroke="#4881a8" stroke-width="1.2" fill="none"/>`;
    }

    // Navigation channel buoys (green port & red starboard)
    const buoys = `<g>
<circle cx="80" cy="22" r="5" fill="#222"/>
<polygon points="76,22 84,22 80,10" fill="#2e9b4d"/>
<circle cx="80" cy="9" r="1.8" fill="#44e574"/>
<circle cx="280" cy="20" r="5" fill="#222"/>
<polygon points="276,20 284,20 280,8" fill="#d8433a"/>
<circle cx="280" cy="7" r="1.8" fill="#ff4d4d"/>
</g>`;

    const tiles: Record<string, [number, number, string]> = {
      stars: [300, 100, st],
      clouds: [
        520,
        70,
        `<g fill="#fff" opacity=".85"><ellipse cx="60" cy="24" rx="26" ry="8"/><ellipse cx="86" cy="19" rx="18" ry="9"/><ellipse cx="110" cy="25" rx="20" ry="7"/><ellipse cx="320" cy="40" rx="30" ry="8"/><ellipse cx="348" cy="34" rx="18" ry="9"/><ellipse cx="420" cy="14" rx="22" ry="6"/></g>`,
      ],
      coast: [540, 100, coastalHeadlands],
      deep: [400, 40, deepWater],
      mid: [320, 30, midWaves],
      fore: [240, 24, foreWater],
      buoys: [400, 30, buoys],
    };

    const layerElements: Array<{ e: HTMLElement; w: number; f: number; x: number }> = [];
    const layerNodes = sceneRef.current.querySelectorAll<HTMLElement>("[data-t]");
    layerNodes.forEach((node) => {
      const type = node.dataset.t;
      if (!type || !tiles[type]) return;
      const [w, h, s] = tiles[type];
      node.style.backgroundImage = `url("data:image/svg+xml,${encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${w} ${h}'>${s}</svg>`
      )}")`;
      node.style.backgroundSize = `${w}px ${h}px`;
      layerElements.push({ e: node, w, f: Number(node.dataset.f) || 0, x: 0 });
    });
    layersRef.current = layerElements;

    /* ---------- Multi-Deck Passenger Cruise Ferry (Matching Reference Image) ---------- */
    csvgRef.current.innerHTML = `<defs>
  <linearGradient id="bm-ferry"><stop offset="0" stop-color="#fff2b0" stop-opacity=".9"/><stop offset="1" stop-color="#fff2b0" stop-opacity="0"/></linearGradient>
</defs>
<polygon id="beam-ferry" points="218,32 360,18 360,48" fill="url(#bm-ferry)" opacity="0"/>

<!-- TOP DECK / NAVIGATION BRIDGE & MAST -->
<!-- Radar mast & communication aerial -->
<path d="M120 1V10M116 3h8M118 6h4" stroke="#222" stroke-width="1.6"/>
<circle cx="120" cy="1" r="1.5" fill="#f0501f"/>

<!-- Exhaust Smokestack / Chimney -->
<rect x="52" y="3" width="12" height="11" rx="1.5" fill="#222"/>
<rect x="52" y="5" width="12" height="3" fill="#d93829"/>

<!-- Wheelhouse / Navigation Bridge -->
<path d="M102 12H134L138 20H98Z" fill="#f5df9a" stroke="#cca458" stroke-width="0.8"/>
<polygon points="106,14 130,14 133,18 103,18" fill="#1b2838"/>
<path d="M106 15H130" stroke="#fff" stroke-width="0.6" opacity="0.4"/>

<!-- Safety Railings along Upper Promenade Deck -->
<path d="M38 20H150" stroke="#d4b87a" stroke-width="1.4"/>
<g stroke="#d4b87a" stroke-width="0.8">
  ${[42, 54, 66, 78, 90, 102, 114, 126, 138, 148].map((x) => `<path d="M${x} 17v3"/>`).join("")}
</g>

<!-- UPPER PASSENGER DECK (Cream with window row) -->
<path d="M28 20H158Q168 20 174 24L178 30H24V24Q24 20 28 20Z" fill="#fcedc7" stroke="#cca458" stroke-width="0.8"/>
<!-- Upper Windows -->
<g fill="#213244">
  ${[32, 42, 52, 62, 72, 82, 92, 102, 112, 122, 132, 142, 152, 162]
    .map((x) => `<rect x="${x}" y="22.5" width="6.5" height="5.5" rx="1.2"/>`)
    .join("")}
</g>
<rect x="24" y="29.5" width="154" height="1.5" fill="#cca458"/>

<!-- LOWER PASSENGER DECK (Cream with window row) -->
<path d="M22 31H180L186 40H18V35Q18 31 22 31Z" fill="#fcedc7" stroke="#cca458" stroke-width="0.8"/>
<!-- Lower Windows -->
<g fill="#213244">
  ${[26, 36, 46, 56, 66, 76, 86, 96, 106, 116, 126, 136, 146, 156, 166, 174]
    .map((x) => `<rect x="${x}" y="33.5" width="6.5" height="5.5" rx="1.2"/>`)
    .join("")}
</g>

<!-- MAIN HULL (Vibrant Maritime Red) -->
<path d="M14 41H188L224 43Q228 44 220 52L194 56H20Q12 56 10 50L14 41Z" fill="#d93829" stroke="#b02619" stroke-width="0.8"/>

<!-- Bow Observation Portholes -->
<g fill="#fff" opacity="0.9">
  <circle cx="188" cy="46" r="2.2"/>
  <circle cx="196" cy="46" r="2.2"/>
  <circle cx="204" cy="46" r="2.2"/>
  <circle cx="212" cy="46" r="2.2"/>
</g>
<circle cx="218" cy="47" r="1.5" fill="#222"/>

<!-- WATERLINE KEEL (Dark Brown / Charcoal) -->
<path d="M16 54H196L192 58H20L16 54Z" fill="#3e2b24"/>`;

    beamRef.current = csvgRef.current.querySelector("#beam-ferry");
    streaksRef.current = ["s1-ferry", "s2-ferry"]
      .map((id) => sceneRef.current?.querySelector<HTMLElement>(`#${id}`))
      .filter(Boolean) as HTMLElement[];

    /* ---------- Nautical Speed & Wave Inertia Loop ---------- */
    const VMAX = 42, BASE = 220; // 42 km/h ≈ 23 knots
    const RM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const target = () => {
      const p = smoothPRef.current;
      if (p <= 0.005 || p >= 0.995) return 0;
      const accel = Math.min(1, p / 0.10);
      const decel = Math.max(0, Math.min(1, (0.995 - p) / 0.15));
      const curve = Math.min(accel, decel);
      return Math.max(0, VMAX * Math.sin((curve * Math.PI) / 2));
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - lastTimeRef.current) / 1000);
      lastTimeRef.current = now;

      // Continuous exponential progress interpolation at 160Hz
      const targetP = pRef.current;
      smoothPRef.current += (targetP - smoothPRef.current) * (1 - Math.exp(-dt * 8.5));
      const p = smoothPRef.current;

      const vt = target();
      vRef.current += (vt - vRef.current) * (1 - Math.exp(-dt * (vt > vRef.current ? 0.7 : 1.1)));
      if (vt === 0 && vRef.current < 0.3) vRef.current = 0;
      const f = vRef.current / VMAX;

      if (sceneRef.current) {
        sceneRef.current.style.setProperty("--p", p.toFixed(4));

        if (sunRef.current) {
          sunRef.current.style.left = (8 + p * 80).toFixed(2) + "%";
          sunRef.current.style.top = (112 - 95 * Math.sin(Math.PI * p)).toFixed(2) + "px";
        }

        const d = Math.max(0, (p - 0.5) / 0.5);
        if (duskRef.current) duskRef.current.style.opacity = String(d * 0.8);
        if (tintRef.current) tintRef.current.style.opacity = String(Math.max(0, (p - 0.6) / 0.4) * 0.35);
        if (starsRef.current) starsRef.current.style.opacity = String(Math.max(0, (p - 0.75) / 0.25));

        const n2 = Math.min(1, Math.max(0, (p - 0.6) / 0.3));
        if (beamRef.current) beamRef.current.setAttribute("opacity", String(n2 * 0.75));

        if (fillRef.current) {
          fillRef.current.style.width = (p * 100).toFixed(2) + "%";
        }

        if (!RM) {
          layersRef.current.forEach((o) => {
            o.x = (o.x + f * BASE * o.f * dt) % o.w;
            o.e.style.backgroundPositionX = (-o.x).toFixed(2) + "px";
          });

          if (gullsRef.current) {
            bxRef.current = (bxRef.current + dt * (12 + f * 20)) % (sceneRef.current.clientWidth + 140);
            gullsRef.current.style.left = (bxRef.current - 70).toFixed(1) + "px";
          }

          // Realistic nautical floating wave bobbing + pitch
          if (csvgRef.current) {
            const waveBob = Math.sin(now / 480) * 1.8 + Math.sin(now / 160) * 0.4;
            const wavePitch = Math.sin(now / 560) * 0.75;
            csvgRef.current.style.transform = `translate3d(0, ${waveBob.toFixed(2)}px, 0) rotate(${wavePitch.toFixed(2)}deg)`;
          }
        }
      }

      // Wake opacity & stretch based on boat speed
      if (wakeRef.current) {
        wakeRef.current.style.opacity = String(0.3 + f * 0.65);
        wakeRef.current.style.width = (40 + f * 120).toFixed(1) + "px";
      }

      streaksRef.current.forEach((s, i) => {
        const w = 12 + f * (35 + i * 14);
        s.style.width = w.toFixed(1) + "px";
        s.style.left = -w.toFixed(1) + "px";
        s.style.opacity = String(f * 0.85);
      });

      const k = Math.round(vRef.current);
      if (k !== shownRef.current && spdRef.current) {
        shownRef.current = k;
        spdRef.current.textContent = `${k} km/h (${Math.round(k * 0.54)} kts)`;
      }

      animRef.current = requestAnimationFrame(frame);
    };

    animRef.current = requestAnimationFrame(frame);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  // Update progress state when prop changes
  useEffect(() => {
    let n = progress;
    if (n > 1) n /= 100;
    n = Math.max(0, Math.min(1, n));

    if (n !== pRef.current) {
      lastChangeRef.current = performance.now();
      pRef.current = n;
    }

    if (!sceneRef.current) return;
    sceneRef.current.setAttribute("aria-valuenow", String(Math.round(n * 100)));
    if (pctRef.current) pctRef.current.textContent = Math.round(n * 100) + "%";

    const stages: Array<[number, string]> = [
      [0, "Boarding at Passenger Jetty · Lines Cast"],
      [0.2, "Navigating Harbor Channel"],
      [0.45, "Cruising Open Waterway · 22 Knots"],
      [0.8, "Approaching Destination Harbor & Breakwater"],
      [1, "Mooring at Destination Jetty Pier"],
    ];
    let s = stages[0][1];
    stages.forEach((x) => {
      if (n >= x[0]) s = x[1];
    });
    if (labelRef.current) labelRef.current.textContent = label || s;
  }, [progress, label]);

  return (
    <div ref={containerRef} className={`w-full select-none ${className}`}>
      {/* ── META HEADER ── */}
      {showMeta && (
        <div className="flex justify-between items-baseline mb-2 font-mono text-xs tabular-nums px-1">
          <div className="flex items-center gap-2 text-foreground font-sans">
            <span className="font-semibold text-primary">{origin}</span>
            <span className="text-muted-foreground">→</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">{destination}</span>
            <span className="text-muted-foreground/40 mx-1">|</span>
            <span ref={labelRef} className="text-xs text-muted-foreground font-normal">
              {label || "Coastal Ferry Transit"}
            </span>
          </div>
          <div className="flex items-baseline gap-3">
            <span ref={spdRef} className="text-xs font-mono font-bold text-cyan-600 dark:text-cyan-400">
              0 km/h (0 kts)
            </span>
            <b ref={pctRef} className="text-sm font-bold text-foreground">
              {Math.round(progress)}%
            </b>
          </div>
        </div>
      )}

      {/* ── FERRY WATERWAY CANVAS ── */}
      <div
        ref={sceneRef}
        className="relative h-[170px] rounded-2xl overflow-hidden border border-border/80 shadow-md bg-gradient-to-b from-[#56a3dd] via-[#7fc0ee] to-[#fdebc6] dark:from-[#152336] dark:via-[#1c2e47] dark:to-[#332a35]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress)}
        aria-label="Coastal ferry simulation progress"
        style={{
          ["--p" as any]: 0,
          ["--cw" as any]: "clamp(210px, 34%, 270px)",
          contain: "layout paint",
        }}
      >
        <style>{`
          .fy-dusk { position: absolute; inset: 0; background: linear-gradient(#1e1c4a, #a6456f 62%, #f59958); opacity: 0; pointer-events: none; }
          .fy-stars { position: absolute; top: 0; left: 0; right: 0; height: 100px; opacity: 0; pointer-events: none; }
          .fy-sun { position: absolute; width: 30px; height: 30px; border-radius: 50%; background: #ffe9a0; box-shadow: 0 0 28px 10px rgba(255,220,130,.55); pointer-events: none; will-change: left, top; }
          .fy-layer { position: absolute; left: 0; right: 0; background-repeat: repeat-x; pointer-events: none; will-change: background-position; }
          .fy-clouds { top: 8px; height: 70px; opacity: .85; }
          .fy-coast { bottom: 50px; height: 100px; }
          .fy-deep { bottom: 30px; height: 40px; }
          .fy-mid { bottom: 18px; height: 30px; }
          .fy-fore { bottom: 0; height: 24px; }
          .fy-buoys { bottom: 20px; height: 30px; }
          .fy-gulls { position: absolute; top: 35px; left: -70px; width: 56px; height: 18px; pointer-events: none; will-change: left; }
          .fy-pier { position: absolute; right: 0; bottom: 0; width: 88px; height: 60px; pointer-events: none; }
          .fy-boat { position: absolute; left: calc(4px + var(--p) * (100% - var(--cw) - 96px)); transform: translate3d(0, 0, 0); bottom: 12px; width: var(--cw); aspect-ratio: 230/60; will-change: left, transform; }
          .fy-boat svg { width: 100%; height: 100%; display: block; overflow: visible; }
          .fy-wake { position: absolute; left: -80px; bottom: 6px; height: 14px; width: 90px; background: radial-gradient(ellipse at right, rgba(255,255,255,0.7) 0%, rgba(143,210,242,0.3) 60%, transparent 100%); border-radius: 50%; pointer-events: none; will-change: width, opacity; }
          .fy-streak { position: absolute; height: 2px; background: linear-gradient(90deg, transparent, rgba(255,255,255,.9)); opacity: 0; }
          .fy-tint { position: absolute; inset: 0; background: #ff8a50; mix-blend-mode: multiply; opacity: 0; pointer-events: none; }
        `}</style>

        <div ref={duskRef} className="fy-dusk" />
        <div ref={starsRef} className="fy-layer fy-stars" data-t="stars" data-f="0" />
        <div ref={sunRef} className="fy-sun" />
        <div className="fy-layer fy-clouds" data-t="clouds" data-f=".015" />

        {/* Flying marine seagulls */}
        <svg
          ref={gullsRef}
          className="fy-gulls"
          viewBox="0 0 56 18"
          fill="none"
          stroke="#fff"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          <path d="M2 9Q7 3 12 9Q17 3 22 9" />
          <path d="M28 6Q32 1 36 6Q40 1 44 6" />
          <path d="M40 14Q44 10 48 14Q52 10 56 14" />
        </svg>

        {/* Coastal headlands & lighthouse */}
        <div className="fy-layer fy-coast" data-t="coast" data-f=".04" />

        {/* Deep ocean layer */}
        <div className="fy-layer fy-deep" data-t="deep" data-f=".15" />

        {/* Mid-swell water layer */}
        <div className="fy-layer fy-mid" data-t="mid" data-f=".45" />

        {/* Channel navigation buoys */}
        <div className="fy-layer fy-buoys" data-t="buoys" data-f=".75" />

        {/* Destination Passenger Ferry Jetty / Pier */}
        <svg className="fy-pier" viewBox="0 0 88 60">
          {/* Wooden pilings in water */}
          <rect x="8" y="24" width="4" height="36" fill="#3a2a1d" />
          <rect x="36" y="24" width="4" height="36" fill="#3a2a1d" />
          <rect x="64" y="24" width="4" height="36" fill="#3a2a1d" />
          <rect x="80" y="24" width="4" height="36" fill="#3a2a1d" />

          {/* Concrete Jetty Deck */}
          <rect x="4" y="20" width="84" height="8" rx="1.5" fill="#a8a39b" />
          <rect x="4" y="19" width="84" height="2" fill="#d2cec7" />

          {/* Passenger Terminal Shelter */}
          <rect x="28" y="4" width="56" height="15" rx="1" fill="#1b4d6b" />
          <polygon points="24,4 88,4 84,0 28,0" fill="#2d6f96" />
          <text x="56" y="14" fontFamily="sans-serif" fontWeight="700" fontSize="7" fill="#fff" textAnchor="middle">
            FERRY JETTY
          </text>

          {/* Mooring Bollards */}
          <circle cx="12" cy="18" r="2.5" fill="#f2c230" />
          <circle cx="26" cy="18" r="2.5" fill="#f2c230" />

          {/* Waiting Passengers */}
          <g>
            <circle cx="40" cy="15" r="2" fill="#e0b38a" />
            <rect x="38.5" y="17" width="3.5" height="7" rx="1" fill="#d8433a" />
            <circle cx="50" cy="15" r="2" fill="#c79a74" />
            <rect x="48.5" y="17" width="3.5" height="7" rx="1" fill="#f2c230" />
            <circle cx="62" cy="14.5" r="2" fill="#e0b38a" />
            <rect x="60.5" y="16.5" width="3.5" height="7.5" rx="1" fill="#2f6fd0" />
          </g>
        </svg>

        {/* Passenger Ferry Boat (Matching Reference Image) */}
        <div className="fy-boat">
          <div ref={wakeRef} className="fy-wake" />
          <i id="s1-ferry" className="fy-streak" style={{ top: "42%" }} />
          <i id="s2-ferry" className="fy-streak" style={{ top: "68%" }} />
          <svg ref={csvgRef} viewBox="0 0 230 60" />
        </div>

        {/* Foreground wave crests */}
        <div className="fy-layer fy-fore" data-t="fore" data-f="1.0" />
        <div ref={tintRef} className="fy-tint" />
      </div>

      {/* ── PROGRESS FILL BAR ── */}
      {showBar && (
        <div className="h-1.5 mt-2 rounded-full bg-muted/60 overflow-hidden border border-border/40">
          <i
            ref={fillRef}
            className="block h-full w-0 rounded-full bg-gradient-to-r from-[#56a3dd] to-[#d93829] transition-[width] duration-700 ease-out"
          />
        </div>
      )}
    </div>
  );
}
