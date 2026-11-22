"use client";

import React, { useEffect, useRef } from "react";

interface BusProgressBarProps {
  progress: number; // 0 to 100
  label?: string;
  origin?: string;
  destination?: string;
  showMeta?: boolean;
  showBar?: boolean;
  className?: string;
}

export function BusProgressBar({
  progress = 0,
  label = "Intercity Bus Journey",
  origin = "Origin",
  destination = "Destination",
  showMeta = true,
  showBar = true,
  className = "",
}: BusProgressBarProps) {
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
  const doorRef = useRef<SVGElement | null>(null);

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

    const banyan = (x: number, r: number) =>
      `<rect x="${x - 2}" y="${50 - r}" width="4" height="${r}" fill="#5a4a35"/><circle cx="${x}" cy="${50 - r - r * 0.45}" r="${r}" fill="#2f7a45"/><circle cx="${x + r * 0.55}" cy="${50 - r - r * 0.2}" r="${r * 0.7}" fill="#3b8f55"/><circle cx="${x - r * 0.6}" cy="${50 - r - r * 0.1}" r="${r * 0.65}" fill="#2a6e40"/>`;

    let st = "";
    [[12, 8], [47, 30], [93, 62], [130, 14], [171, 44], [219, 22], [262, 70], [298, 5], [333, 38], [270, 52]].forEach(
      (a) => (st += `<circle cx="${a[0]}" cy="${a[1]}" r=".9" fill="#fff"/>`)
    );

    let bl = "";
    const buildingData: Array<[number, number, number, string]> = [
      [0, 40, 36, "#e6c38a"],
      [42, 30, 52, "#d99a86"],
      [74, 36, 40, "#9cc3d1"],
      [112, 28, 60, "#e9d48f"],
      [142, 44, 34, "#c98f9a"],
      [188, 30, 48, "#a9c9a0"],
      [220, 38, 58, "#e6b58a"],
      [260, 34, 40, "#9fb9d6"],
      [296, 26, 66, "#d9a086"],
      [324, 42, 36, "#e8d49a"],
      [368, 30, 52, "#b7cfa0"],
      [400, 38, 44, "#d99a9a"],
      [440, 32, 60, "#9cc3d1"],
      [474, 46, 38, "#e6c38a"],
    ];
    buildingData.forEach(([x, w, h, c], i) => {
      bl += `<rect x="${x}" y="${80 - h}" width="${w}" height="${h}" fill="${c}"/><rect x="${x}" y="${80 - h}" width="${w}" height="3" fill="#000" opacity=".12"/>`;
      for (let yy = 80 - h + 8; yy < 74; yy += 10) {
        for (let xx = x + 5; xx < x + w - 6; xx += 9) {
          bl += `<rect x="${xx}" y="${yy}" width="4" height="5.5" fill="#46566b" opacity=".6"/>`;
        }
      }
      if (i % 3 === 0) {
        bl += `<rect x="${x + w / 2 - 5}" y="${80 - h - 9}" width="10" height="9" rx="2" fill="#2f6fa8"/><rect x="${x + w / 2 - 6}" y="${80 - h - 10}" width="12" height="2" fill="#244f78"/>`;
      }
    });

    let md = '<polygon points="0,22 0,16 4,14 96,14 100,16 100,22" fill="#cfcfc8"/>';
    for (let x = 0; x < 100; x += 10) {
      md += `<rect x="${x}" y="18" width="10" height="4" fill="${x % 20 ? "#f2c230" : "#222"}"/>`;
    }
    [10, 30, 50, 70, 90].forEach((x) => (md += `<ellipse cx="${x}" cy="10" rx="9" ry="6" fill="#3d8a4a"/>`));
    [[6, 8], [14, 11], [24, 7], [34, 10], [46, 7], [56, 11], [66, 7], [76, 10], [86, 7], [95, 11], [40, 12], [80, 12]].forEach(
      (a) => (md += `<circle cx="${a[0]}" cy="${a[1]}" r="1.7" fill="#d6338a"/>`)
    );

    const wh = (x: number, y: number, r = 3.8) =>
      `<circle cx="${x}" cy="${y}" r="${r}" fill="#222"/><circle cx="${x}" cy="${y}" r="${r * 0.42}" fill="#aaa"/>`;

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
        `<path d="M0 110V72L80 46 170 64 260 40 350 62 440 44 520 66 600 72V110Z" fill="#a9c4b4" opacity=".85"/><path d="M0 110V88L110 66 220 84 330 62 450 84 600 88V110Z" fill="#86ab94" opacity=".9"/>`,
      ],
      city: [520, 80, bl],
      trees: [
        300,
        50,
        `<path d="M0 50V45Q75 40 150 45T300 45V50Z" fill="#3f7a54"/>${banyan(40, 14)}${palm(100, 34)}${banyan(170, 11)}${palm(230, 30)}${banyan(272, 13)}`,
      ],
      lamps: [
        280,
        130,
        `<g fill="#64748b"><rect x="138" y="24" width="3" height="106"/><path d="M139.5 24 Q139.5 12 152 12 H160" fill="none" stroke="#64748b" stroke-width="2.6"/><rect x="156" y="10" width="10" height="4" rx="1.5" fill="#475569"/><polygon points="154,14 168,14 176,58 146,58" fill="#fff9db" opacity=".12"/></g>`,
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

    /* ---------- Ultra-Detailed Vecteezy White Luxury Intercity Coach (Exact Match to Vector) ---------- */
    const spokeWindows = (cx: number, cy: number, rInner = 5.8, rOuter = 10.6) => {
      let spokes = "";
      const count = 8;
      for (let i = 0; i < count; i++) {
        const a1 = (i * 45 * Math.PI) / 180;
        const a2 = ((i * 45 + 26) * Math.PI) / 180;
        const x1 = (cx + rInner * Math.cos(a1)).toFixed(2);
        const y1 = (cy + rInner * Math.sin(a1)).toFixed(2);
        const x2 = (cx + rOuter * Math.cos(a1)).toFixed(2);
        const y2 = (cy + rOuter * Math.sin(a1)).toFixed(2);
        const x3 = (cx + rOuter * Math.cos(a2)).toFixed(2);
        const y3 = (cy + rOuter * Math.sin(a2)).toFixed(2);
        const x4 = (cx + rInner * Math.cos(a2)).toFixed(2);
        const y4 = (cy + rInner * Math.sin(a2)).toFixed(2);
        spokes += `<polygon points="${x1},${y1} ${x2},${y2} ${x3},${y3} ${x4},${y4}" fill="#141a23"/>`;
      }
      return spokes;
    };

    const boltHoles = (cx: number, cy: number, r = 3.6) => {
      let bolts = "";
      for (let i = 0; i < 6; i++) {
        const rad = (i * 60 * Math.PI) / 180;
        const bx = (cx + r * Math.cos(rad)).toFixed(2);
        const by = (cy + r * Math.sin(rad)).toFixed(2);
        bolts += `<circle cx="${bx}" cy="${by}" r="0.85" fill="#f8fafc"/>`;
      }
      return bolts;
    };

    const tyreAssembly = (cx: number, cy = 87) =>
      `<g transform="translate(${cx}, ${cy})">
        <!-- Ground Contact Shadow -->
        <ellipse cx="0" cy="17.5" rx="19" ry="1.6" fill="#000" opacity="0.4"/>
        <g class="wheel">
          <!-- Deep Black Outer Rubber Tyre -->
          <circle cx="0" cy="0" r="17" fill="#181c22"/>
          <!-- Tyre Sidewall Tread Ridge -->
          <circle cx="0" cy="0" r="14.8" fill="none" stroke="#2a333f" stroke-width="1.1"/>
          <circle cx="0" cy="0" r="13.0" fill="#0f141a"/>
          <!-- High-Visibility Precision Silver Alloy Rim -->
          <circle cx="0" cy="0" r="12.2" fill="url(#rim-bus-metal)" stroke="#ffffff" stroke-width="0.8"/>
          <!-- 8 Precision Ventilated Radial Spoke Windows (Visible Spinning Action) -->
          ${spokeWindows(0, 0, 5.8, 10.6)}
          <!-- Silver Inner Hub Ring -->
          <circle cx="0" cy="0" r="5.6" fill="#cbd5e1" stroke="#94a3b8" stroke-width="0.6"/>
          <!-- Heavy-Duty Center Axle Hubcap -->
          <circle cx="0" cy="0" r="3.8" fill="#334155" stroke="#1e293b" stroke-width="0.8"/>
          <!-- 6 Chrome Lug Nuts -->
          ${boltHoles(0, 0, 2.6)}
          <!-- Center Axle Chrome Pin -->
          <circle cx="0" cy="0" r="1.3" fill="#f8fafc"/>
        </g>
      </g>`;

    csvgRef.current.innerHTML = `<defs>
  <!-- Pearl White Metallic Body Gradient (Vecteezy Luxury Coach) -->
  <linearGradient id="bb-bus" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#ffffff"/>
    <stop offset="65%" stop-color="#f8fafc"/>
    <stop offset="88%" stop-color="#f1f5f9"/>
    <stop offset="100%" stop-color="#e2e8f0"/>
  </linearGradient>
  <!-- Gloss Tinted Passenger Window Ribbon -->
  <linearGradient id="win-bus" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#0f172a"/>
    <stop offset="45%" stop-color="#1e293b"/>
    <stop offset="100%" stop-color="#0f172a"/>
  </linearGradient>
  <linearGradient id="bm-bus">
    <stop offset="0%" stop-color="#fff8db" stop-opacity=".85"/>
    <stop offset="100%" stop-color="#fff8db" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="rim-bus-metal" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#ffffff"/>
    <stop offset="35%" stop-color="#e2e8f0"/>
    <stop offset="70%" stop-color="#cbd5e1"/>
    <stop offset="100%" stop-color="#94a3b8"/>
  </linearGradient>
</defs>

<!-- Headlight Forward Beam & Tail Lamp Glow -->
<polygon id="beam-bus" points="330,70 470,48 470,96" fill="url(#bm-bus)" opacity="0"/>
<circle id="tail-bus" cx="12" cy="66" r="14" fill="#ef4444" opacity="0"/>

<!-- Underfloor Ground Chassis Shadow -->
<rect x="35" y="102.5" width="275" height="1.8" rx="0.9" fill="#000" opacity="0.22"/>

<!-- Low-Profile White Roof Aerocap AC Unit (Vecteezy Reference) -->
<path d="M 68 6 H 240 Q 244 6 244 12 H 64 Q 64 6 68 6 Z" fill="#ffffff" stroke="#cbd5e1" stroke-width="0.8"/>
<line x1="74" y1="9" x2="234" y2="9" stroke="#e2e8f0" stroke-width="1.2"/>

<!-- Dark Wheel Well Recesses (Fender Liners Behind Wheels) -->
<path d="M 58 83 A 20 20 0 0 1 98 83 Z" fill="#0f172a"/>
<path d="M 248 83 A 20 20 0 0 1 288 83 Z" fill="#0f172a"/>

<!-- Main Pearl-White Coach Body Silhouette -->
<path d="M 14 83 L 58 83 A 20 20 0 0 1 98 83 L 248 83 A 20 20 0 0 1 288 83 L 322 83 Q 328 83 331 78 L 334 58 L 330 24 Q 325 12 310 12 L 20 12 Q 14 12 14 18 L 14 83 Z" fill="url(#bb-bus)" stroke="#cbd5e1" stroke-width="0.9"/>

<!-- Rear Vertical LED Taillight Cluster -->
<rect x="12" y="56" width="3.5" height="18" rx="1.2" fill="#ef4444" stroke="#b91c1c" stroke-width="0.6"/>
<rect x="13" y="58" width="1.5" height="14" rx="0.6" fill="#fca5a5"/>

<!-- ── SIGNATURE VECTEEZY AERODYNAMIC FRONT CANOPY & SWEEPING ARCS ── -->
<!-- Dark Aerodynamic Cockpit & Windshield Canopy -->
<path d="M 235 12 H 308 Q 325 12 330 22 L 334 56 Q 332 62 320 64 L 285 64 Q 244 60 235 12 Z" fill="#141a23"/>

<!-- Iconic Vecteezy Dynamic Sweeping White Blade Arc -->
<path d="M 242 12 Q 256 12 272 20 Q 298 34 316 48 Q 326 56 328 62 L 322 63 Q 314 54 294 38 Q 270 24 238 16 Z" fill="#ffffff"/>
<path d="M 242 12 Q 256 12 272 20 Q 298 34 316 48 Q 326 56 328 62" stroke="#e2e8f0" stroke-width="0.7" fill="none"/>

<!-- ── CONTINUOUS PANORAMIC DARK TINTED PASSENGER WINDOW RIBBON ── -->
<rect x="20" y="18" width="224" height="30" fill="url(#win-bus)"/>

<!-- Top Window Glass Reflection Accent -->
<line x1="22" y1="20" x2="242" y2="20" stroke="#ffffff" stroke-width="0.8" opacity="0.25"/>

<!-- Window Frame Vertical Mullions / Pillars (Vecteezy Even Spacing) -->
<line x1="48" y1="18" x2="48" y2="48" stroke="#0f172a" stroke-width="1.8"/>
<line x1="76" y1="18" x2="76" y2="48" stroke="#0f172a" stroke-width="1.8"/>
<line x1="104" y1="18" x2="104" y2="48" stroke="#0f172a" stroke-width="1.8"/>
<line x1="132" y1="18" x2="132" y2="48" stroke="#0f172a" stroke-width="1.8"/>
<line x1="160" y1="18" x2="160" y2="48" stroke="#0f172a" stroke-width="1.8"/>
<line x1="188" y1="18" x2="188" y2="48" stroke="#0f172a" stroke-width="1.8"/>
<line x1="216" y1="18" x2="216" y2="48" stroke="#0f172a" stroke-width="1.8"/>
<line x1="244" y1="18" x2="244" y2="48" stroke="#0f172a" stroke-width="1.8"/>

<!-- Interior Passenger Seat Headrests (Subtle Depth) -->
<g fill="#475569" opacity="0.45">
  <rect x="28" y="26" width="9" height="11" rx="2.5"/>
  <rect x="56" y="26" width="9" height="11" rx="2.5"/>
  <rect x="84" y="26" width="9" height="11" rx="2.5"/>
  <rect x="112" y="26" width="9" height="11" rx="2.5"/>
  <rect x="140" y="26" width="9" height="11" rx="2.5"/>
  <rect x="168" y="26" width="9" height="11" rx="2.5"/>
  <rect x="196" y="26" width="9" height="11" rx="2.5"/>
  <rect x="224" y="26" width="9" height="11" rx="2.5"/>
</g>

<!-- Front Cockpit Windshield Pane & Driver Station -->
<path d="M 288 20 H 304 Q 318 20 322 26 L 326 50 L 290 50 Z" fill="#0f172a" opacity="0.95"/>
<rect x="296" y="32" width="9" height="14" rx="2.5" fill="#475569" opacity="0.8"/>
<line x1="304" y1="46" x2="310" y2="40" stroke="#334155" stroke-width="2.4"/>

<!-- Signature Aerodynamic White Swan-Neck Side-View Mirror -->
<path d="M 314 12 Q 334 10 338 22 L 338 28" fill="none" stroke="#ffffff" stroke-width="2.6" stroke-linecap="round"/>
<path d="M 314 12 Q 334 10 338 22 L 338 28" fill="none" stroke="#cbd5e1" stroke-width="0.8" stroke-linecap="round"/>
<rect x="335" y="26" width="5.5" height="18" rx="2" fill="#ffffff" stroke="#cbd5e1" stroke-width="0.8"/>
<rect x="336.5" y="28" width="2.8" height="14" rx="1" fill="#475569"/>

<!-- Horizontal Body Character Crease Lines -->
<line x1="14" y1="54" x2="310" y2="54" stroke="#e2e8f0" stroke-width="0.8"/>

<!-- Front Passenger Entry Door Frame & Panel -->
<rect id="bus-door" x="286" y="52" width="26" height="30" rx="1.5" fill="#f8fafc" stroke="#cbd5e1" stroke-width="0.8"/>
<rect x="304" y="64" width="2.5" height="6" rx="1" fill="#64748b"/>

<!-- 3 Large Flush White Underfloor Luggage Compartment Doors (Vecteezy Vector) -->
<g fill="#ffffff" stroke="#cbd5e1" stroke-width="0.8">
  <rect x="108" y="60" width="42" height="18" rx="1.5"/>
  <rect x="154" y="60" width="42" height="18" rx="1.5"/>
  <rect x="200" y="60" width="42" height="18" rx="1.5"/>
</g>
<!-- Luggage Bay Latches -->
<rect x="124" y="72" width="10" height="2" rx="1" fill="#94a3b8"/>
<rect x="170" y="72" width="10" height="2" rx="1" fill="#94a3b8"/>
<rect x="216" y="72" width="10" height="2" rx="1" fill="#94a3b8"/>

<!-- Rear Engine Service Compartment & Cooling Air Intake Louvers -->
<rect x="20" y="58" width="24" height="20" rx="1.5" fill="#f8fafc" stroke="#cbd5e1" stroke-width="0.8"/>
<line x1="23" y1="62" x2="39" y2="62" stroke="#94a3b8" stroke-width="1.2"/>
<line x1="23" y1="66" x2="39" y2="66" stroke="#94a3b8" stroke-width="1.2"/>
<line x1="23" y1="70" x2="39" y2="70" stroke="#94a3b8" stroke-width="1.2"/>
<line x1="23" y1="74" x2="39" y2="74" stroke="#94a3b8" stroke-width="1.2"/>

<!-- Modern Front Projector Headlight Assembly -->
<polygon points="320,66 328,64 332,74 320,74" fill="#f8fafc" stroke="#cbd5e1" stroke-width="0.8"/>
<rect x="323" y="67" width="4" height="4" rx="0.8" fill="#e0f2fe"/>
<circle cx="327" cy="71" r="1.2" fill="#f59e0b"/>

<!-- Rear Axle Assembly (cx=78, cy=87, ground=104) -->
${tyreAssembly(78, 87)}

<!-- Front Axle Assembly (cx=268, cy=87, ground=104) -->
${tyreAssembly(268, 87)}`;

    wheelsRef.current = Array.from(csvgRef.current.querySelectorAll(".wheel"));
    beamRef.current = csvgRef.current.querySelector("#beam-bus");
    tailRef.current = csvgRef.current.querySelector("#tail-bus");
    streaksRef.current = ["s1-bus", "s2-bus", "s3-bus"]
      .map((id) => sceneRef.current?.querySelector<HTMLElement>(`#${id}`))
      .filter(Boolean) as HTMLElement[];
    doorRef.current = csvgRef.current.querySelector("#bus-door");

    /* ---------- Realistic Heavy Coach Physics & Speed Model ---------- */
    const VMAX = 80, BASE = 320;
    const RM = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const target = () => {
      const p = smoothPRef.current;
      if (p <= 0.005 || p >= 0.995) return 0;
      // Smooth sinusoidal acceleration ramp from departure (0 to 0.10)
      const accel = Math.min(1, p / 0.10);
      // Smooth deceleration ramp approaching destination bus stand (0.84 to 0.995)
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
      vRef.current += (vt - vRef.current) * (1 - Math.exp(-dt * (vt > vRef.current ? 1.6 : 2.4)));
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
        if (beamRef.current) beamRef.current.setAttribute("opacity", String(n2 * 0.7));
        if (tailRef.current) tailRef.current.setAttribute("opacity", String(n2 * 0.4));

        if (doorRef.current) {
          doorRef.current.setAttribute("fill", p >= 0.98 ? "#cbd5e1" : "#f8fafc");
        }

        if (fillRef.current) {
          fillRef.current.style.width = (p * 100).toFixed(2) + "%";
        }

        if (!RM) {
          layersRef.current.forEach((o) => {
            o.x = (o.x + f * BASE * o.f * dt) % o.w;
            o.e.style.backgroundPositionX = (-o.x).toFixed(2) + "px";
          });

          // Butterly smooth rotation synchronized with road speed (zero slip, concentric)
          angRef.current = (angRef.current + f * 720 * dt) % 360;
          wheelsRef.current.forEach((w) => w.setAttribute("transform", `rotate(${angRef.current.toFixed(1)})`));

          if (birdsRef.current) {
            bxRef.current = (bxRef.current + dt * (10 + f * 28)) % (sceneRef.current.clientWidth + 120);
            birdsRef.current.style.left = (bxRef.current - 60).toFixed(1) + "px";
          }

          // Authentic commercial bus pneumatic air-ride suspension dynamics:
          // Low-frequency gentle floating chassis oscillation (1.4 Hz) + inertial acceleration/braking pitch
          const dv = vt - vRef.current;
          const pitch = Math.max(-1.0, Math.min(0.5, dv * -0.04)) + Math.sin(now * 0.009) * 0.15 * f;
          const bounce = Math.sin(now * 0.009) * 0.55 * f;

          if (csvgRef.current) {
            csvgRef.current.style.transform = `translate3d(0, ${bounce.toFixed(2)}px, 0) rotate(${pitch.toFixed(2)}deg)`;
          }
        }
      }

      streaksRef.current.forEach((s, i) => {
        const w = 8 + f * (32 + i * 10);
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
      [0, "Boarding at Intercity ISBT Platform"],
      [0.2, "Entering Highway Corridor"],
      [0.45, "Cruising at 80 km/h · AC Sleeper Route"],
      [0.8, "Approaching Destination Bus Stand"],
      [1, "Arrived at Destination Bay · Doors Open"],
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
              {label || "Intercity Bus Journey"}
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

      {/* ── BUS SCENE CANVAS ── */}
      <div
        ref={sceneRef}
        className="relative h-[170px] rounded-2xl overflow-hidden border border-border/80 shadow-md bg-gradient-to-b from-[#7fc0ee] to-[#fdebc6] dark:from-[#1b2b40] dark:to-[#3a2f30]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress)}
        aria-label="Bus journey simulation progress"
        style={{
          ["--p" as any]: 0,
          ["--cw" as any]: "clamp(195px, 28%, 245px)",
          contain: "layout paint",
        }}
      >
        <style>{`
          .bus-dusk { position: absolute; inset: 0; background: linear-gradient(#241d4f, #c9567a 62%, #f5a25d); opacity: 0; pointer-events: none; }
          .bus-stars { position: absolute; top: 0; left: 0; right: 0; height: 100px; opacity: 0; pointer-events: none; }
          .bus-sun { position: absolute; width: 30px; height: 30px; border-radius: 50%; background: #ffe9a0; box-shadow: 0 0 28px 10px rgba(255,220,130,.55); pointer-events: none; will-change: left, top; }
          .bus-layer { position: absolute; left: 0; right: 0; background-repeat: repeat-x; pointer-events: none; will-change: background-position; }
          .bus-clouds { top: 8px; height: 70px; opacity: .9; }
          .bus-haze { bottom: 60px; height: 110px; }
          .bus-city { bottom: 42px; height: 80px; }
          .bus-trees { bottom: 34px; height: 50px; }
          .bus-lamps { bottom: 26px; height: 110px; }
          .bus-birds { position: absolute; top: 40px; left: -60px; width: 50px; height: 16px; pointer-events: none; will-change: left; }
          .bus-road { position: absolute; left: 0; right: 0; bottom: 0; height: 30px; background: #232931; }
          .bus-road .bus-dash { position: absolute; left: 0; right: 0; top: 10px; height: 2px; background: repeating-linear-gradient(90deg, #f4f4f0 0 28px, transparent 28px 60px); }
          .bus-road .bus-edge { position: absolute; left: 0; right: 0; bottom: 5px; height: 2px; background: #e2e8f0; opacity: .85; }
          .bus-stand { position: absolute; right: 2px; bottom: 5px; width: 84px; height: 62px; pointer-events: none; }
          .bus-coach { position: absolute; left: calc(4px + var(--p) * (100% - var(--cw) - 86px)); transform: translate3d(0, 0, 0); bottom: 5px; width: var(--cw); aspect-ratio: 350/106; will-change: left, transform; }
          .bus-coach svg { width: 100%; height: 100%; display: block; overflow: visible; }
          .wheel { will-change: transform; }
          .bus-streak { position: absolute; height: 2px; background: linear-gradient(90deg, transparent, rgba(255,255,255,.85)); opacity: 0; }
          .bus-tint { position: absolute; inset: 0; background: #ff8a50; mix-blend-mode: multiply; opacity: 0; pointer-events: none; }
        `}</style>

        <div ref={duskRef} className="bus-dusk" />
        <div ref={starsRef} className="bus-layer bus-stars" data-t="stars" data-f="0" />
        <div ref={sunRef} className="bus-sun" />
        <div className="bus-layer bus-clouds" data-t="clouds" data-f=".015" />

        <svg
          ref={birdsRef}
          className="bus-birds"
          viewBox="0 0 50 16"
          fill="none"
          stroke="#fff"
          strokeWidth="1.4"
          strokeLinecap="round"
        >
          <path d="M2 8Q6 3 10 8Q14 3 18 8" />
          <path d="M24 5Q27 1 30 5Q33 1 36 5" />
        </svg>

        <div className="bus-layer bus-haze" data-t="haze" data-f=".02" />
        <div className="bus-layer bus-city" data-t="city" data-f=".06" />
        <div className="bus-layer bus-trees" data-t="trees" data-f=".3" />
        <div className="bus-layer bus-lamps" data-t="lamps" data-f=".6" />

        {/* Asphalt highway road with animated dash lines */}
        <div className="bus-road">
          <div ref={dashRef} className="bus-dash" />
          <div className="bus-edge" />
        </div>

        {/* Destination Intercity Bus Stand Terminal with passengers waiting */}
        <svg className="bus-stand" viewBox="0 0 84 62">
          <rect y="56" width="84" height="6" fill="#b8b2a6" />
          <rect x="2" y="12" width="80" height="6" rx="1" fill="#3f6fb5" />
          <rect x="2" y="16" width="80" height="2" fill="#2d4f86" />
          <rect x="6" y="18" width="4" height="38" fill="#6d7078" />
          <rect x="74" y="18" width="4" height="38" fill="#6d7078" />
          <rect x="14" y="19" width="56" height="12" rx="1" fill="#1b6b3a" stroke="#fff" strokeWidth=".8" />
          <text x="42" y="28.2" fontFamily="sans-serif" fontWeight="700" fontSize="8" fill="#fff" textAnchor="middle">
            BUS STAND
          </text>
          <rect x="20" y="48" width="40" height="2.5" fill="#8a5a3a" />
          <path d="M24 50.5v5M56 50.5v5" stroke="#6b4a30" strokeWidth="2" />
          <g>
            <circle cx="30" cy="38" r="2.6" fill="#e0b38a" />
            <rect x="27.5" y="41" width="5" height="12" rx="1.5" fill="#d8433a" />
            <circle cx="41" cy="39" r="2.6" fill="#c79a74" />
            <rect x="38.5" y="42" width="5" height="11" rx="1.5" fill="#2f6fd0" />
            <circle cx="51" cy="38.5" r="2.6" fill="#e0b38a" />
            <rect x="48.5" y="41.5" width="5" height="11.5" rx="1.5" fill="#f2c230" />
          </g>
        </svg>

        {/* Modern Commercial Coach with Rotating Dual-Axle Wheels */}
        <div className="bus-coach">
          <i id="s1-bus" className="bus-streak" style={{ top: "30%" }} />
          <i id="s2-bus" className="bus-streak" style={{ top: "52%" }} />
          <i id="s3-bus" className="bus-streak" style={{ top: "74%" }} />
          <svg ref={csvgRef} viewBox="0 0 350 106" />
        </div>

        <div ref={tintRef} className="bus-tint" />
      </div>

      {/* ── PROGRESS FILL BAR ── */}
      {showBar && (
        <div className="h-1.5 mt-2 rounded-full bg-muted/60 overflow-hidden border border-border/40">
          <i
            ref={fillRef}
            className="block h-full w-0 rounded-full bg-gradient-to-r from-[#0288d1] to-[#00e5ff] transition-[width] duration-700 ease-out"
          />
        </div>
      )}
    </div>
  );
}
