"use client";

import React, { useEffect, useRef } from "react";

interface HighwayProgressBarProps {
  progress: number; // 0 to 100
  label?: string;
  origin?: string;
  destination?: string;
  isBus?: boolean;
  showMeta?: boolean;
  showBar?: boolean;
  className?: string;
}

export function HighwayProgressBar({
  progress = 0,
  label = "Expressway Transit",
  origin = "Origin",
  destination = "Destination",
  isBus = false,
  showMeta = true,
  showBar = true,
  className = "",
}: HighwayProgressBarProps) {
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
  const tailRef = useRef<SVGCircleElement | null>(null);
  const csvgRef = useRef<SVGSVGElement>(null);
  const birdsRef = useRef<SVGSVGElement>(null);
  const dashRef = useRef<HTMLDivElement>(null);
  const armRef = useRef<SVGGElement | null>(null);

  // State refs for physics animation loop
  const pRef = useRef<number>((progress || 0) / 100);
  const smoothPRef = useRef<number>((progress || 0) / 100);
  const lastChangeRef = useRef<number>(performance.now());
  const vRef = useRef<number>(0);
  const angRef = useRef<number>(0);
  const bxRef = useRef<number>(0);
  const shownRef = useRef<number>(-1);
  const lastTimeRef = useRef<number>(performance.now());

  // Store layer object references for parallax shifting
  const layersRef = useRef<Array<{ e: HTMLElement; w: number; f: number; x: number }>>([]);
  const wheelsRef = useRef<Element[]>([]);
  const streaksRef = useRef<HTMLElement[]>([]);

  useEffect(() => {
    if (!sceneRef.current || !csvgRef.current) return;

    /* ---------- Scenery tiles (seamless) ---------- */
    const palm = (x: number, h: number) => {
      const y = 50, t = y - h;
      let f = "";
      [[-13, 5], [-8, -2], [0, -5], [8, -2], [13, 5], [-6, 6], [6, 6]].forEach((a) => {
        f += `<path d="M${x + 3} ${t}Q${x + 3 + a[0] / 2} ${t + a[1] - 5} ${x + 3 + a[0]} ${t + a[1] + 3}" stroke="#2c6a44" stroke-width="2" fill="none"/>`;
      });
      return `<path d="M${x} ${y}Q${x + 4} ${y - h / 2} ${x + 3} ${t}" stroke="#5a4a35" stroke-width="2.2" fill="none"/>${f}`;
    };

    const gulmohar = (x: number, r: number) =>
      `<rect x="${x - 1.5}" y="${50 - r}" width="3" height="${r}" fill="#5a4a35"/><circle cx="${x}" cy="${
        50 - r - r * 0.5
      }" r="${r}" fill="#3f8f4f"/>${[[-0.5, -0.6], [0.4, -0.2], [-0.2, 0.3], [0.6, -0.7], [-0.7, 0.1]]
        .map((d) => `<circle cx="${x + d[0] * r}" cy="${50 - r * 1.5 + d[1] * r}" r="2.6" fill="#e5532d"/>`)
        .join("")}`;

    let st = "";
    [[12, 8], [47, 30], [93, 62], [130, 14], [171, 44], [219, 22], [262, 70], [298, 5], [333, 38], [270, 52]].forEach(
      (a) => (st += `<circle cx="${a[0]}" cy="${a[1]}" r=".9" fill="#fff"/>`)
    );

    let bl = "";
    [
      [0, 26, 40], [28, 18, 62], [48, 30, 48], [80, 16, 76], [98, 26, 38], [126, 22, 58], [150, 34, 44],
      [186, 18, 70], [206, 28, 50], [236, 24, 36], [262, 20, 66], [284, 32, 46], [318, 16, 56], [336, 28, 40],
      [366, 22, 64], [390, 30, 48], [422, 18, 58], [442, 34, 42], [478, 28, 52], [508, 12, 36],
    ].forEach(([x, w, h], i) => {
      bl += `<rect x="${x}" y="${90 - h}" width="${w}" height="${h}" fill="${i % 2 ? "#7488a6" : "#6a7d9b"}"/>`;
      for (let yy = 90 - h + 6; yy < 84; yy += 8) {
        for (let xx = x + 4; xx < x + w - 4; xx += 7) {
          bl += `<rect x="${xx}" y="${yy}" width="3" height="3" fill="#dbe8f6" opacity=".45"/>`;
        }
      }
    });
    bl += '<line x1="88" y1="14" x2="88" y2="2" stroke="#6a7d9b" stroke-width="1.5"/>';

    let md = '<polygon points="0,22 0,16 4,14 96,14 100,16 100,22" fill="#bdbdb8"/>';
    [10, 30, 50, 70, 90].forEach((x) => (md += `<ellipse cx="${x}" cy="10" rx="9" ry="6" fill="#3d8a4a"/>`));
    [[6, 8], [16, 11], [27, 7], [36, 10], [48, 8], [58, 11], [68, 7], [77, 10], [88, 8], [95, 11]].forEach(
      (a) => (md += `<circle cx="${a[0]}" cy="${a[1]}" r="1.5" fill="#e0457b"/>`)
    );

    const wh = (x: number, y: number) =>
      `<circle cx="${x}" cy="${y}" r="3.8" fill="#222"/><circle cx="${x}" cy="${y}" r="1.6" fill="#aaa"/>`;

    const tiles: Record<string, [number, number, string]> = {
      stars: [300, 100, st],
      clouds: [
        520,
        70,
        `<g fill="#fff" opacity=".85"><ellipse cx="60" cy="24" rx="26" ry="8"/><ellipse cx="86" cy="19" rx="18" ry="9"/><ellipse cx="110" cy="25" rx="20" ry="7"/><ellipse cx="320" cy="40" rx="30" ry="8"/><ellipse cx="348" cy="34" rx="18" ry="9"/><ellipse cx="420" cy="14" rx="22" ry="6"/></g>`,
      ],
      haze: [
        600,
        110,
        `<path d="M0 110V70L80 45 170 62 260 38 350 60 440 42 520 64 600 70V110Z" fill="#bfd0e0" opacity=".85"/>`,
      ],
      city: [520, 90, bl],
      trees: [
        300,
        50,
        `<path d="M0 50V44Q75 38 150 44T300 44V50Z" fill="#3f7a54"/>${palm(30, 34)}${gulmohar(90, 13)}${palm(150, 28)}${gulmohar(205, 11)}${palm(250, 36)}`,
      ],
      signs: [
        700,
        70,
        `<rect x="140" y="38" width="3" height="32" fill="#555"/><rect x="172" y="38" width="3" height="32" fill="#555"/><rect x="118" y="14" width="70" height="26" fill="#1f7a8c"/><rect x="121" y="17" width="64" height="20" fill="none" stroke="#fff" stroke-width="1"/><text x="153" y="30" font-family="sans-serif" font-weight="700" font-size="9" fill="#fff" text-anchor="middle">DRIVE SAFE</text><rect x="498" y="26" width="3" height="44" fill="#555"/><rect x="448" y="6" width="104" height="28" rx="2" fill="#1b6b3a" stroke="#fff"/><text x="500" y="18" font-family="sans-serif" font-weight="700" font-size="8" fill="#fff" text-anchor="middle">EXPRESSWAY</text><text x="500" y="29" font-family="sans-serif" font-size="8" fill="#fff" text-anchor="middle">Exit 120 km</text>`,
      ],
      traffic: [
        900,
        30,
        `<rect x="60" y="6" width="50" height="19" fill="#e0a526"/><path d="M60 11h50M60 17h50" stroke="#c9372c" stroke-width="2"/><rect x="40" y="11" width="20" height="14" rx="2" fill="#c9372c"/><rect x="41" y="13" width="7" height="6" fill="#9fd0f0"/><rect x="39" y="21" width="3" height="2" fill="#fff3b0"/>${wh(50, 26)}${wh(78, 26)}${wh(100, 26)}
  <rect x="330" y="13" width="44" height="12" rx="3" fill="#3d6fd0"/><path d="M338 13L343 6H362L368 13Z" fill="#3d6fd0"/><path d="M342 12L345 8H355V12ZM358 12V8H362L365 12Z" fill="#cfeaf5"/><rect x="329" y="17" width="3" height="3" fill="#fff3b0"/>${wh(342, 26)}${wh(364, 26)}
  <rect x="600" y="4" width="80" height="22" rx="3" fill="#2f9e63"/><rect x="604" y="8" width="70" height="8" fill="#cfeaf5"/><rect x="599" y="18" width="3" height="3" fill="#fff3b0"/>${wh(620, 26)}${wh(660, 26)}`,
      ],
      median: [100, 22, md],
      lamps: [
        240,
        130,
        `<rect x="0" y="14" width="3" height="116" fill="#4b4f55"/><path d="M2 14Q22 4 36 12" stroke="#4b4f55" stroke-width="3" fill="none"/><rect x="30" y="11" width="12" height="4" rx="1" fill="#2f3237"/><rect x="33" y="15" width="6" height="2" fill="#ffd77a"/>`,
      ],
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

    if (dashRef.current) {
      layerElements.push({ e: dashRef.current, w: 60, f: 1, x: 0 });
    }
    layersRef.current = layerElements;

    /* ---------- Vehicle (SUV or Intercity Bus) ---------- */
    const R = isBus ? "#e05a2b" : "#d8433a";
    const tyre = (x: number) =>
      `<g class="wheel"><circle cx="${x}" cy="32" r="7.5" fill="#1b1d21"/><circle cx="${x}" cy="32" r="4.2" fill="#c9ccd1"/><path d="M${
        x - 4
      } 32h8M${x} 28v8" stroke="#8a8e94" stroke-width="1"/><circle cx="${x}" cy="32" r="1.4" fill="#555"/></g>`;

    if (isBus) {
      // Intercity AC Sleeper Bus
      csvgRef.current.innerHTML = `<defs><linearGradient id="bm-bus"><stop offset="0" stop-color="#fff2b0" stop-opacity=".9"/><stop offset="1" stop-color="#fff2b0" stop-opacity="0"/></linearGradient></defs>
<polygon id="beam-highway" points="117,23 230,10 230,38" fill="url(#bm-bus)" opacity="0"/><circle id="tail-highway" cx="4" cy="21" r="7" fill="#ff2b2b" opacity="0"/>
<path d="M4 32V10Q4 6 10 6H110Q118 6 120 14V32Z" fill="${R}"/>
<rect x="14" y="9" width="94" height="9" rx="1.5" fill="#1e2b3a"/>
<path d="M14 13.5H108" stroke="#fff" stroke-width="0.8" opacity="0.4"/>
<rect x="6" y="21" width="108" height="2" fill="#f7d050"/>
<rect x="4" y="24" width="4" height="6" fill="#ff2b2b"/><path d="M116 22L120 24V28H114Z" fill="#fff3b0"/>
<rect x="4" y="30" width="116" height="3" fill="#23262b"/><circle cx="26" cy="32" r="9.5" fill="#15171a"/><circle cx="96" cy="32" r="9.5" fill="#15171a"/>${tyre(
        26
      )}${tyre(96)}`;
    } else {
      // Red SUV
      csvgRef.current.innerHTML = `<defs><linearGradient id="bm-car"><stop offset="0" stop-color="#fff2b0" stop-opacity=".9"/><stop offset="1" stop-color="#fff2b0" stop-opacity="0"/></linearGradient></defs>
<polygon id="beam-highway" points="117,23 230,10 230,38" fill="url(#bm-car)" opacity="0"/><circle id="tail-highway" cx="4" cy="21" r="7" fill="#ff2b2b" opacity="0"/>
<path d="M4 32V22Q4 17 10 16L24 15L38 6Q40 4 44 4H80Q84 4 86 6L98 15L114 18Q120 19 120 26V32Z" fill="${R}"/>
<path d="M42 3.2H82" stroke="#2a2d31" stroke-width="1.6"/>
<polygon points="40,8 55,8 55,15.5 32,15.5" fill="#1e2b3a"/><polygon points="60,8 80,8 91,15.5 60,15.5" fill="#1e2b3a"/><path d="M43 9.5L50 9.5L44 14Z" fill="#fff" opacity=".18"/>
<path d="M57.5 16V30" stroke="#a82f2a" stroke-width="1"/><rect x="50" y="19" width="5" height="1.6" rx=".8" fill="#a82f2a"/><rect x="62" y="19" width="5" height="1.6" rx=".8" fill="#a82f2a"/>
<rect x="88" y="14" width="6" height="3" rx="1" fill="${R}"/><rect x="4" y="19" width="3" height="5" fill="#ff2b2b"/><path d="M116 19L120 21.5V25H114Z" fill="#fff3b0"/>
<rect x="4" y="30" width="116" height="3" fill="#23262b"/><circle cx="26" cy="32" r="9.5" fill="#15171a"/><circle cx="96" cy="32" r="9.5" fill="#15171a"/>${tyre(
        26
      )}${tyre(96)}`;
    }

    wheelsRef.current = Array.from(csvgRef.current.querySelectorAll(".wheel"));
    beamRef.current = csvgRef.current.querySelector("#beam-highway");
    tailRef.current = csvgRef.current.querySelector("#tail-highway");
    streaksRef.current = ["s1-hw", "s2-hw", "s3-hw"]
      .map((id) => sceneRef.current?.querySelector<HTMLElement>(`#${id}`))
      .filter(Boolean) as HTMLElement[];
    armRef.current = sceneRef.current.querySelector("#arm-hw");

    /* ---------- Speed model: accelerate, cruise, brake ---------- */
    const VMAX = isBus ? 90 : 120, BASE = 330;
    const RM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const target = () => {
      const p = smoothPRef.current;
      if (p <= 0.005 || p >= 0.995) return 0;
      const accel = Math.min(1, p / 0.08);
      const decel = Math.max(0, Math.min(1, (0.995 - p) / 0.12));
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
      vRef.current += (vt - vRef.current) * (1 - Math.exp(-dt * (vt > vRef.current ? 0.9 : 1.4)));
      if (vt === 0 && vRef.current < 0.4) vRef.current = 0;
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
        if (beamRef.current) beamRef.current.setAttribute("opacity", String(n2 * 0.7));
        if (tailRef.current) tailRef.current.setAttribute("opacity", String(n2 * 0.4));

        if (armRef.current) {
          armRef.current.style.transform = p >= 0.98 ? "rotate(-75deg)" : "rotate(0deg)";
        }

        if (fillRef.current) {
          fillRef.current.style.width = (p * 100).toFixed(2) + "%";
        }

        if (!RM) {
          layersRef.current.forEach((o) => {
            o.x = (o.x + f * BASE * o.f * dt) % o.w;
            o.e.style.backgroundPositionX = (-o.x).toFixed(2) + "px";
          });
          angRef.current = (angRef.current + f * 900 * dt) % 360;
          wheelsRef.current.forEach((w) => ((w as HTMLElement).style.transform = `rotate(${angRef.current}deg)`));

          if (birdsRef.current) {
            bxRef.current = (bxRef.current + dt * (10 + f * 28)) % (sceneRef.current.clientWidth + 120);
            birdsRef.current.style.left = (bxRef.current - 60).toFixed(1) + "px";
          }
          if (csvgRef.current) {
            csvgRef.current.style.transform = `translate3d(0, ${(Math.sin(now / 45) * 0.45 * f).toFixed(2)}px, 0) rotate(${
              ((vt - vRef.current) * -0.012).toFixed(2)
            }deg)`;
          }
        }
      }

      streaksRef.current.forEach((s, i) => {
        const w = 8 + f * (40 + i * 12);
        s.style.width = w.toFixed(1) + "px";
        s.style.left = -w.toFixed(1) + "px";
        s.style.opacity = String(f * 0.8);
      });

      const k = Math.round(vRef.current);
      if (k !== shownRef.current && spdRef.current) {
        shownRef.current = k;
        spdRef.current.textContent = k + " km/h";
      }

      animRef.current = requestAnimationFrame(frame);
    };

    animRef.current = requestAnimationFrame(frame);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [isBus]);

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
      [0, "Leaving Starting Point"],
      [0.2, "Entering Expressway Mainline"],
      [0.45, isBus ? "Cruising at 85 km/h · Intercity Route" : "Cruising at 100 km/h · National Highway"],
      [0.8, "Approaching Destination Interchange"],
      [1, "Passing Destination FASTag Toll"],
    ];
    let s = stages[0][1];
    stages.forEach((x) => {
      if (n >= x[0]) s = x[1];
    });
    if (labelRef.current) labelRef.current.textContent = label || s;
  }, [progress, label, isBus]);

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
              {label || (isBus ? "Intercity Bus Transit" : "Expressway Transit")}
            </span>
          </div>
          <div className="flex items-baseline gap-3">
            <span ref={spdRef} className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
              0 km/h
            </span>
            <b ref={pctRef} className="text-sm font-bold text-foreground">
              {Math.round(progress)}%
            </b>
          </div>
        </div>
      )}

      {/* ── HIGHWAY SCENE CANVAS ── */}
      <div
        ref={sceneRef}
        className="relative h-[170px] rounded-2xl overflow-hidden border border-border/80 shadow-md bg-gradient-to-b from-[#7fc0ee] to-[#fdebc6] dark:from-[#1b2b40] dark:to-[#3a2f30]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress)}
        aria-label="Highway simulation progress"
        style={{
          ["--p" as any]: 0,
          ["--cw" as any]: "clamp(130px, 22%, 170px)",
          contain: "layout paint",
        }}
      >
        <style>{`
          .hw-dusk { position: absolute; inset: 0; background: linear-gradient(#241d4f, #c9567a 62%, #f5a25d); opacity: 0; pointer-events: none; }
          .hw-stars { position: absolute; top: 0; left: 0; right: 0; height: 100px; opacity: 0; pointer-events: none; }
          .hw-sun { position: absolute; width: 30px; height: 30px; border-radius: 50%; background: #ffe9a0; box-shadow: 0 0 28px 10px rgba(255,220,130,.55); pointer-events: none; will-change: left, top; }
          .hw-layer { position: absolute; left: 0; right: 0; background-repeat: repeat-x; pointer-events: none; will-change: background-position; }
          .hw-clouds { top: 8px; height: 70px; opacity: .9; }
          .hw-haze { bottom: 66px; height: 110px; }
          .hw-city { bottom: 50px; height: 90px; }
          .hw-trees { bottom: 38px; height: 50px; }
          .hw-signs { bottom: 38px; height: 70px; }
          .hw-traffic { bottom: 34px; height: 30px; }
          .hw-median { bottom: 30px; height: 22px; }
          .hw-birds { position: absolute; top: 40px; left: -60px; width: 50px; height: 16px; pointer-events: none; will-change: left; }
          .hw-road { position: absolute; left: 0; right: 0; bottom: 0; height: 30px; background: #3b3e44; }
          .hw-road .hw-dash { position: absolute; left: 0; right: 0; top: 9px; height: 2px; background: repeating-linear-gradient(90deg, #f4f4f0 0 28px, transparent 28px 60px); }
          .hw-road .hw-edge { position: absolute; left: 0; right: 0; bottom: 5px; height: 2px; background: #e8e6e1; opacity: .8; }
          .hw-toll { position: absolute; right: 2px; bottom: 6px; width: 84px; height: 62px; pointer-events: none; }
          .hw-car { position: absolute; left: calc(4px + var(--p) * (100% - var(--cw) - 94px)); transform: translate3d(0, 0, 0); bottom: 5px; width: var(--cw); aspect-ratio: 3/1; will-change: left, transform; }
          .hw-car svg { width: 100%; height: 100%; display: block; overflow: visible; }
          .wheel { transform-box: fill-box; transform-origin: center; will-change: transform; }
          .hw-streak { position: absolute; height: 2px; background: linear-gradient(90deg, transparent, rgba(255,255,255,.85)); opacity: 0; }
          .hw-lamps { bottom: 0; height: 130px; }
          .hw-tint { position: absolute; inset: 0; background: #ff8a50; mix-blend-mode: multiply; opacity: 0; pointer-events: none; }
        `}</style>

        <div ref={duskRef} className="hw-dusk" />
        <div ref={starsRef} className="hw-layer hw-stars" data-t="stars" data-f="0" />
        <div ref={sunRef} className="hw-sun" />
        <div className="hw-layer hw-clouds" data-t="clouds" data-f=".015" />

        <svg
          ref={birdsRef}
          className="hw-birds"
          viewBox="0 0 50 16"
          fill="none"
          stroke="#fff"
          strokeWidth="1.4"
          strokeLinecap="round"
        >
          <path d="M2 8Q6 3 10 8Q14 3 18 8" />
          <path d="M24 5Q27 1 30 5Q33 1 36 5" />
        </svg>

        <div className="hw-layer hw-haze" data-t="haze" data-f=".02" />
        <div className="hw-layer hw-city" data-t="city" data-f=".06" />
        <div className="hw-layer hw-trees" data-t="trees" data-f=".3" />
        <div className="hw-layer hw-signs" data-t="signs" data-f=".7" />
        <div className="hw-layer hw-traffic" data-t="traffic" data-f="1.7" />
        <div className="hw-layer hw-median" data-t="median" data-f="1" />

        {/* Asphalt road with animated dash lines */}
        <div className="hw-road">
          <div ref={dashRef} className="hw-dash" />
          <div className="hw-edge" />
        </div>

        {/* Destination FASTag Toll Plaza */}
        <svg className="hw-toll" viewBox="0 0 84 62">
          <rect x="0" y="4" width="84" height="7" fill="#f2c230" />
          <path
            d="M4 4l6 7M16 4l6 7M28 4l6 7M40 4l6 7M52 4l6 7M64 4l6 7M76 4l6 7"
            stroke="#222"
            strokeWidth="3"
          />
          <rect x="8" y="11" width="5" height="51" fill="#6d7078" />
          <rect x="71" y="11" width="5" height="51" fill="#6d7078" />
          <rect x="52" y="34" width="14" height="28" fill="#e8e6e1" />
          <rect x="55" y="38" width="8" height="8" fill="#222" />
          <g id="arm-hw" style={{ transformOrigin: "13px 40px", transition: "transform .7s" }}>
            <rect x="13" y="38" width="39" height="3" fill="#d8433a" />
            <path d="M20 38v3M30 38v3M40 38v3" stroke="#fff" strokeWidth="4" />
          </g>
        </svg>

        {/* Vehicle (SUV or Intercity Bus) */}
        <div className="hw-car">
          <i id="s1-hw" className="hw-streak" style={{ top: "26%" }} />
          <i id="s2-hw" className="hw-streak" style={{ top: "48%" }} />
          <i id="s3-hw" className="hw-streak" style={{ top: "68%" }} />
          <svg ref={csvgRef} viewBox="0 0 120 40" />
        </div>

        {/* Street Lamps */}
        <div className="hw-layer hw-lamps" data-t="lamps" data-f="1" />
        <div ref={tintRef} className="hw-tint" />
      </div>

      {/* ── PROGRESS FILL BAR ── */}
      {showBar && (
        <div className="h-1.5 mt-2 rounded-full bg-muted/60 overflow-hidden border border-border/40">
          <i
            ref={fillRef}
            className="block h-full w-0 rounded-full bg-gradient-to-r from-[#4aa3df] to-[#d8433a] transition-[width] duration-700 ease-out"
          />
        </div>
      )}
    </div>
  );
}
