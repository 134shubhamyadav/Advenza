"use client";

import React, { useEffect, useRef } from "react";

interface VandeBharatProgressBarProps {
  progress: number; // 0 to 100
  label?: string;
  origin?: string;
  destination?: string;
  showMeta?: boolean;
  showBar?: boolean;
  className?: string;
}

export function VandeBharatProgressBar({
  progress = 0,
  label = "Express Transit",
  origin = "Origin",
  destination = "Destination",
  showMeta = true,
  showBar = true,
  className = "",
}: VandeBharatProgressBarProps) {
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
  const tsvgRef = useRef<SVGSVGElement>(null);
  const birdsRef = useRef<SVGSVGElement>(null);
  const sleepersRef = useRef<HTMLDivElement>(null);

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

  // Setup scenery tiles and trainset SVG on mount
  useEffect(() => {
    if (!sceneRef.current || !tsvgRef.current) return;

    /* ---------- Scenery tiles (seamless) ---------- */
    const palm = (x: number, h: number) => {
      const y = 46, t = y - h;
      let f = "";
      [[-13, 5], [-8, -2], [0, -5], [8, -2], [13, 5], [-6, 6], [6, 6]].forEach((a) => {
        f += `<path d="M${x + 3} ${t}Q${x + 3 + a[0] / 2} ${t + a[1] - 5} ${x + 3 + a[0]} ${t + a[1] + 3}" stroke="#2c6a44" stroke-width="2" fill="none"/>`;
      });
      return `<path d="M${x} ${y}Q${x + 4} ${y - h / 2} ${x + 3} ${t}" stroke="#5a4a35" stroke-width="2.2" fill="none"/>${f}`;
    };

    const house = (x: number) =>
      `<rect x="${x}" y="38" width="14" height="8" fill="#e8d9b8"/><polygon points="${x - 2},38 ${x + 7},31 ${x + 16},38" fill="#a4533a"/>`;

    const turbine = (x: number, h: number, r: number) => {
      let b = "";
      [90, 210, 330].forEach((a) => {
        const q = ((a + r) * Math.PI) / 180;
        b += `<line x1="${x}" y1="${80 - h}" x2="${x + 16 * Math.cos(q)}" y2="${80 - h - 16 * Math.sin(q)}" stroke="#f7f7f7" stroke-width="1.6"/>`;
      });
      return `<line x1="${x}" y1="80" x2="${x}" y2="${80 - h}" stroke="#eee" stroke-width="2"/>${b}<circle cx="${x}" cy="${80 - h}" r="2" fill="#ddd"/>`;
    };

    let st = "";
    [[12, 8], [47, 30], [93, 62], [130, 14], [171, 44], [219, 22], [262, 70], [298, 5], [333, 38], [270, 52]].forEach(
      (a) => (st += `<circle cx="${a[0]}" cy="${a[1]}" r=".9" fill="#fff"/>`)
    );

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
        `<path d="M0 110V70L80 45 170 62 260 38 350 60 440 42 520 64 600 70V110Z" fill="#c5d4e6" opacity=".8"/>`,
      ],
      ghats: [
        480,
        100,
        `<path d="M0 100V60L50 30 90 52 150 18 210 56 270 34 330 60 400 26 450 50 480 60V100Z" fill="#8aa5c0"/><path d="M0 100V75L70 55 140 72 220 50 300 74 380 58 480 75V100Z" fill="#6a86a3"/><rect y="86" width="480" height="14" fill="#fff" opacity=".18"/>`,
      ],
      turb: [520, 80, turbine(60, 56, 10) + turbine(200, 48, 50) + turbine(330, 58, 25) + turbine(450, 52, 70)],
      village: [
        400,
        60,
        `<path d="M0 60V46Q100 40 200 46T400 46V60Z" fill="#3f7a54"/>${palm(30, 30)}${palm(58, 24)}${house(110)}${house(138)}${palm(172, 28)}<rect x="240" y="34" width="22" height="12" fill="#d9c7a5"/><path d="M242 34L251 14L260 34Z" fill="#e0b46a"/><circle cx="251" cy="12" r="2" fill="#c9563f"/>${palm(300, 32)}${palm(336, 26)}${house(360)}`,
      ],
      trees: [
        260,
        44,
        `<rect x="29" y="26" width="3" height="18" fill="#5a4a35"/><circle cx="30" cy="22" r="16" fill="#2e7a45"/><circle cx="38" cy="26" r="11" fill="#3e8f55"/><rect x="119" y="30" width="3" height="14" fill="#5a4a35"/><circle cx="120" cy="26" r="12" fill="#2e7a45"/><rect x="199" y="24" width="3" height="20" fill="#5a4a35"/><circle cx="200" cy="20" r="18" fill="#2a6e40"/><circle cx="210" cy="26" r="11" fill="#3e8f55"/>`,
      ],
      paddy: [
        160,
        26,
        `<rect width="160" height="26" fill="#7fbf5a"/><rect y="6" width="160" height="4" fill="#92d06a"/><rect y="14" width="160" height="4" fill="#6aa84b"/>${[8, 24, 40, 56, 72, 88, 104, 120, 136, 152]
          .map((x) => `<path d="M${x} 25l-2-8M${x} 25l1-9M${x} 25l3-7" stroke="#3f8a35" stroke-width="1" fill="none"/>`)
          .join("")}`,
      ],
      ohe: [
        140,
        110,
        `<g fill="#4b4f55"><rect x="0" y="10" width="2" height="100"/><rect x="138" y="10" width="2" height="100"/><rect x="0" y="14" width="18" height="2"/><rect x="122" y="14" width="18" height="2"/></g><path d="M0 14Q70 26 140 14" stroke="#3a3d42" fill="none"/><path d="M0 30H140" stroke="#3a3d42" fill="none"/><g stroke="#3a3d42" stroke-width=".6"><path d="M35 21V30M70 24V30M105 21V30"/></g>`,
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

    if (sleepersRef.current) {
      layerElements.push({ e: sleepersRef.current, w: 16, f: 1, x: 0 });
    }
    layersRef.current = layerElements;

    /* ---------- Vande Bharat (orange/grey) trainset, facing right ---------- */
    const O = "#f0501f", G = "#43474b", K = "#12161b";
    let t =
      '<defs><linearGradient id="bm-train"><stop offset="0" stop-color="#fff2b0" stop-opacity=".9"/><stop offset="1" stop-color="#fff2b0" stop-opacity="0"/></linearGradient></defs><polygon id="beam-train" points="418,36 560,24 560,50" fill="url(#bm-train)" opacity="0"/>';
    const wx: number[] = [];

    [0, 99, 198].forEach((x) => {
      t += `<rect x="${x + 96}" y="14" width="3" height="24" fill="#1a1d20"/><rect x="${x}" y="5" width="96" height="4" rx="1.5" fill="#2c2f31"/><rect x="${x}" y="8" width="96" height="32" rx="2" fill="${G}"/>
 <rect x="${x}" y="11" width="96" height="2.5" fill="${O}"/><rect x="${x + 13}" y="15" width="70" height="14" rx="2" fill="${K}"/><rect class="lw" x="${x + 13}" y="15" width="70" height="14" rx="2"/>
 <rect x="${x + 13}" y="16" width="70" height="1" fill="#2a323b" opacity=".6"/><rect x="${x}" y="31" width="96" height="5.5" fill="${O}"/><rect x="${x}" y="36.5" width="96" height="3.5" fill="#37393c"/>
 <rect x="${x + 1}" y="11" width="9" height="27" fill="${O}"/><rect x="${x + 86}" y="11" width="9" height="27" fill="${O}"/>
 <rect x="${x + 3.5}" y="16" width="4" height="10" rx="1" fill="${K}"/><rect x="${x + 88.5}" y="16" width="4" height="10" rx="1" fill="${K}"/>
 <rect x="${x + 39}" y="12.2" width="18" height="1.6" fill="#e6b84a"/>
 <path d="M${x + 3} 40v6M${x + 9} 40v6M${x + 3} 42.5h6M${x + 3} 45h6M${x + 87} 40v6M${x + 93} 40v6M${x + 87} 42.5h6M${x + 87} 45h6" stroke="#e8e8e8" stroke-width=".8"/>
 <rect x="${x}" y="40" width="96" height="3" fill="#22262b"/><rect x="${x + 34}" y="43" width="28" height="3.5" fill="#353b42"/><rect x="${x + 8}" y="43.5" width="34" height="2.5" fill="#2a2f36"/><rect x="${x + 56}" y="43.5" width="34" height="2.5" fill="#2a2f36"/>`;
      [14, 30, 66, 82].forEach((d) => wx.push(x + d));
    });

    const H = `<path d="M297 5H345Q405 8 420 40H297Z" fill="${G}"/><rect x="297" y="11" width="50" height="2.5" fill="${O}"/><rect x="297" y="31" width="118" height="5.5" fill="${O}"/><rect x="297" y="36.5" width="120" height="3.5" fill="#37393c"/>
 <rect x="298" y="11" width="9" height="27" fill="${O}"/><rect x="300.5" y="16" width="4" height="10" rx="1" fill="${K}"/>
 <polygon points="326,11 337,11 322,38 311,38" fill="#fff"/><polygon points="341,11 346,11 331,38 326,38" fill="#fff" opacity=".9"/>
 <path d="M347 15Q385 16 404 28L352 28Z" fill="${K}"/><path d="M386 40Q410 40 420 40Q417 24 396 17Q394 30 386 40Z" fill="#f3f5f7"/>
 <path d="M345 5Q405 8 420 40L412 40Q398 13 345 11Z" fill="${O}"/><circle cx="416" cy="34" r="2.4" fill="#fff6c0"/>
 <rect x="297" y="40" width="120" height="3" fill="#22262b"/><rect x="330" y="43" width="30" height="3.5" fill="#353b42"/>`;

    t +=
      H +
      `<path d="M226 5L238 -4L250 5M231 -4H245" stroke="#3a3f47" stroke-width="1.8" fill="none"/><g fill="#1f2328" stroke="#bfb9ad" stroke-width="1">`;
    const wheel = (x: number) =>
      `<g class="wheel"><circle cx="${x}" cy="46" r="6"/><line x1="${x - 5}" y1="46" x2="${x + 5}" y2="46"/></g>`;
    [312, 330, 372, 392].forEach((x) => wx.push(x));
    wx.forEach((x) => (t += wheel(x)));

    const tail = `<g transform="translate(420 0) scale(-1 1)">${H.replace(
      "#fff6c0",
      "#ff3b30"
    )}<g fill="#1f2328" stroke="#bfb9ad" stroke-width="1">${[312, 330, 372, 392].map(wheel).join("")}</g></g><rect x="123" y="14" width="3" height="24" fill="#1a1d20"/>`;

    tsvgRef.current.innerHTML = tail + '<g transform="translate(126 0)">' + t + "</g></g>";

    wheelsRef.current = Array.from(tsvgRef.current.querySelectorAll(".wheel"));
    beamRef.current = tsvgRef.current.querySelector("#beam-train");
    streaksRef.current = ["s1", "s2", "s3"]
      .map((id) => sceneRef.current?.querySelector<HTMLElement>(`#${id}`))
      .filter(Boolean) as HTMLElement[];

    /* ---------- Speed model: accelerate, cruise, brake ---------- */
    const VMAX = 160, BASE = 420;
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

      // Butter-smooth continuous exponential smoothing at 160Hz
      const targetP = pRef.current;
      smoothPRef.current += (targetP - smoothPRef.current) * (1 - Math.exp(-dt * 8.5));
      const p = smoothPRef.current;

      const vt = target();
      vRef.current += (vt - vRef.current) * (1 - Math.exp(-dt * (vt > vRef.current ? 0.9 : 1.4)));
      if (vt === 0 && vRef.current < 0.4) vRef.current = 0;
      const f = vRef.current / VMAX;

      if (sceneRef.current) {
        sceneRef.current.style.setProperty("--p", p.toFixed(4));
        sceneRef.current.style.setProperty("--lw", String(Math.max(0, (p - 0.6) / 0.3) * 0.8));

        const d = Math.max(0, (p - 0.5) / 0.5);
        if (duskRef.current) duskRef.current.style.opacity = String(d * 0.8);
        if (tintRef.current) tintRef.current.style.opacity = String(Math.max(0, (p - 0.6) / 0.4) * 0.35);
        if (starsRef.current) starsRef.current.style.opacity = String(Math.max(0, (p - 0.75) / 0.25));

        if (sunRef.current) {
          sunRef.current.style.left = (8 + p * 80).toFixed(2) + "%";
          sunRef.current.style.top = (112 - 95 * Math.sin(Math.PI * p)).toFixed(2) + "px";
        }
        if (beamRef.current) {
          beamRef.current.setAttribute("opacity", String(Math.min(1, Math.max(0, (p - 0.6) / 0.3)) * 0.7));
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
          if (tsvgRef.current) {
            tsvgRef.current.style.transform = `translate3d(0, ${(Math.sin(now / 55) * 0.5 * f).toFixed(2)}px, 0)`;
          }
        }
      }

      if (sleepersRef.current) {
        sleepersRef.current.style.opacity = String(1 - 0.45 * f);
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
      [0, "Boarding & Platform Clearance"],
      [0.2, "Accelerating on Mainline"],
      [0.45, "Cruising at 130 km/h · Electrified Rail"],
      [0.8, "Approaching Destination Station"],
      [1, "Arrived at Platform"],
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
              {label || "Express Transit"}
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

      {/* ── VANDE BHARAT SCENE CANVAS ── */}
      <div
        ref={sceneRef}
        className="relative h-[170px] rounded-2xl overflow-hidden border border-border/80 shadow-md bg-gradient-to-b from-[#7fc0ee] to-[#fdebc6] dark:from-[#1b2b40] dark:to-[#3a2f30]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress)}
        aria-label="Vande Bharat simulation progress"
        style={{ ["--p" as any]: 0, ["--lw" as any]: 0, contain: "layout paint" }}
      >
        <style>{`
          .scene-vb > * { position: absolute; }
          .vb-dusk { inset: 0; background: linear-gradient(#241d4f, #c9567a 62%, #f5a25d); opacity: 0; pointer-events: none; }
          .vb-stars { top: 0; left: 0; right: 0; height: 100px; opacity: 0; pointer-events: none; }
          .vb-sun { position: absolute; width: 30px; height: 30px; border-radius: 50%; background: #ffe9a0; box-shadow: 0 0 28px 10px rgba(255,220,130,.55); pointer-events: none; will-change: left, top; }
          .vb-layer { position: absolute; left: 0; right: 0; background-repeat: repeat-x; pointer-events: none; will-change: background-position; }
          .vb-clouds { top: 8px; height: 70px; opacity: .9; }
          .vb-haze { bottom: 76px; height: 110px; }
          .vb-ghats { bottom: 56px; height: 100px; }
          .vb-turb { bottom: 48px; height: 80px; }
          .vb-village { bottom: 44px; height: 60px; }
          .vb-trees { bottom: 34px; height: 44px; }
          .vb-paddy { bottom: 28px; height: 26px; }
          .vb-birds { position: absolute; top: 48px; left: -60px; width: 50px; height: 16px; pointer-events: none; will-change: left; }
          .vb-ground { position: absolute; left: 0; right: 0; bottom: 0; height: 28px; background: #3a2f28; }
          .vb-rail, .vb-lit { position: absolute; left: 0; top: 0; height: 4px; }
          .vb-rail { right: 0; background: #a9a39a; }
          .vb-lit { width: calc(var(--p) * 100%); background: #f2b84b; box-shadow: 0 0 8px #f2b84b; will-change: width; }
          .vb-sleepers { position: absolute; left: 0; right: 0; top: 4px; height: 10px; background: repeating-linear-gradient(90deg, #6b4f3a 0 8px, transparent 8px 16px); }
          .vb-station { position: absolute; right: 0; bottom: 28px; width: 70px; height: 60px; }
          .vb-train { position: absolute; left: calc(4px + var(--p) * (100% - 74px)); transform: translateX(calc(var(--p) * -100%)) translate3d(0, 0, 0); bottom: 27px; width: clamp(300px, 56%, 560px); aspect-ratio: 546/52; will-change: left, transform; }
          .vb-train svg { width: 100%; height: 100%; display: block; overflow: visible; }
          .wheel { transform-box: fill-box; transform-origin: center; will-change: transform; }
          .lw { fill: #ffd77a; opacity: var(--lw); }
          .vb-streak { position: absolute; height: 2px; background: linear-gradient(90deg, transparent, rgba(255,255,255,.85)); opacity: 0; }
          .vb-ohe { bottom: 28px; height: 110px; }
          .vb-tint { position: absolute; inset: 0; background: #ff8a50; mix-blend-mode: multiply; opacity: 0; pointer-events: none; }
        `}</style>

        <div ref={duskRef} className="vb-dusk" />
        <div ref={starsRef} className="vb-layer vb-stars" data-t="stars" data-f="0" />
        <div ref={sunRef} className="vb-sun" />
        <div className="vb-layer vb-clouds" data-t="clouds" data-f=".015" />

        <svg
          ref={birdsRef}
          className="vb-birds"
          viewBox="0 0 50 16"
          fill="none"
          stroke="#fff"
          strokeWidth="1.4"
          strokeLinecap="round"
        >
          <path d="M2 8Q6 3 10 8Q14 3 18 8" />
          <path d="M24 5Q27 1 30 5Q33 1 36 5" />
          <path d="M34 13Q37 9 40 13Q43 9 46 13" />
        </svg>

        <div className="vb-layer vb-haze" data-t="haze" data-f=".02" />
        <div className="vb-layer vb-ghats" data-t="ghats" data-f=".05" />
        <div className="vb-layer vb-turb" data-t="turb" data-f=".09" />
        <div className="vb-layer vb-village" data-t="village" data-f=".2" />
        <div className="vb-layer vb-trees" data-t="trees" data-f=".45" />
        <div className="vb-layer vb-paddy" data-t="paddy" data-f=".8" />

        {/* Destination Station */}
        <svg className="vb-station" viewBox="0 0 70 60">
          <rect y="52" width="70" height="8" fill="#b8b2a6" />
          <polygon points="0,18 70,18 65,9 5,9" fill="#c9563f" />
          <g fill="#555">
            <rect x="7" y="18" width="3" height="34" />
            <rect x="34" y="18" width="3" height="34" />
            <rect x="60" y="18" width="3" height="34" />
          </g>
          <rect x="13" y="21" width="42" height="11" fill="#f2c230" />
          <rect x="17" y="24" width="34" height="2" fill="#222" />
          <rect x="22" y="28" width="24" height="2" fill="#222" />
          <rect x="42" y="46" width="14" height="2" fill="#6b4f3a" />
          <circle cx="23" cy="40" r="3" fill="#ffd77a" />
        </svg>

        {/* Ground track with lit progress line and sleepers */}
        <div className="vb-ground">
          <div className="vb-rail" />
          <div className="vb-lit" />
          <div ref={sleepersRef} className="vb-sleepers" />
        </div>

        {/* Vande Bharat Trainset */}
        <div className="vb-train">
          <i id="s1" className="vb-streak" style={{ top: "14px" }} />
          <i id="s2" className="vb-streak" style={{ top: "26px" }} />
          <i id="s3" className="vb-streak" style={{ top: "36px" }} />
          <svg ref={tsvgRef} viewBox="0 0 546 52" />
        </div>

        {/* 25kV OHE Catenary Wire (No sparkles/flash as requested) */}
        <div className="vb-layer vb-ohe" data-t="ohe" data-f="1" />
        <div ref={tintRef} className="vb-tint" />
      </div>

      {/* ── PROGRESS FILL BAR ── */}
      {showBar && (
        <div className="h-1.5 mt-2 rounded-full bg-muted/60 overflow-hidden border border-border/40">
          <i
            ref={fillRef}
            className="block h-full w-0 rounded-full bg-gradient-to-r from-[#f2b84b] to-[#f0501f] transition-[width] duration-700 ease-out"
          />
        </div>
      )}
    </div>
  );
}
