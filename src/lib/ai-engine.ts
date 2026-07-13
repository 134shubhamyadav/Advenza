// Deterministic mock "AI intelligence" layer for Aventra.
// Single source of truth for trip state, traveler preferences, health, risk,
// what-if simulation, tradeoffs, and explainability strings.

export type Traveler = {
  id: string;
  name: string;
  initials: string;
  color: string;
  prefs: {
    food: number;        // 0-100
    nature: number;
    history: number;
    nightlife: number;
    adventure: number;
    luxury: number;
    walking: number;     // tolerance for walking
    budget: number;      // per-person budget INR
  };
};

export const travelers: Traveler[] = [
  {
    id: "you",
    name: "Aditi (You)",
    initials: "AK",
    color: "from-primary to-accent",
    prefs: { food: 92, nature: 78, history: 84, nightlife: 40, adventure: 55, luxury: 70, walking: 75, budget: 90000 },
  },
  {
    id: "maya",
    name: "Maya Patel",
    initials: "MP",
    color: "from-accent to-primary",
    prefs: { food: 88, nature: 60, history: 72, nightlife: 65, adventure: 50, luxury: 80, walking: 60, budget: 100000 },
  },
  {
    id: "arjun",
    name: "Arjun Mehta",
    initials: "AM",
    color: "from-secondary to-accent",
    prefs: { food: 70, nature: 90, history: 55, nightlife: 30, adventure: 85, luxury: 45, walking: 92, budget: 70000 },
  },
  {
    id: "priya",
    name: "Priya Sharma",
    initials: "PS",
    color: "from-primary to-secondary",
    prefs: { food: 82, nature: 74, history: 88, nightlife: 55, adventure: 40, luxury: 75, walking: 65, budget: 85000 },
  },
];

// Weighted per-category compatibility across the group (avg / max spread penalty)
export function compatibility(t: Traveler[] = travelers) {
  const cats: (keyof Traveler["prefs"])[] = ["food", "nature", "history", "nightlife", "adventure", "luxury", "walking"];
  const scores = cats.map((c) => {
    const vals = t.map((x) => x.prefs[c]);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const spread = Math.max(...vals) - Math.min(...vals);
    // Reward high alignment (low spread) and healthy interest (high avg).
    return Math.round(Math.max(0, avg - spread * 0.35));
  });
  const overall = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  return { overall, byCategory: Object.fromEntries(cats.map((c, i) => [c, scores[i]])) as Record<string, number> };
}

// ---- Trip Health -------------------------------------------------------
export type HealthFactor = {
  key: string;
  label: string;
  score: number;      // 0-100
  status: "good" | "warn" | "bad";
  detail: string;
  suggestion?: string;
};

export function healthFactors(): HealthFactor[] {
  return [
    { key: "budget",   label: "Budget health",       score: 88, status: "good", detail: "₹1,42,000 of ₹1,80,000 committed. Buffer intact.", suggestion: "Move one fine-dining night to a chef's table to save ₹4,200." },
    { key: "weather",  label: "Weather outlook",     score: 76, status: "good", detail: "Monsoon fringe. 2 of 6 days may see light rain.", suggestion: "Shift the boat ride from Day 4 to Day 3 morning." },
    { key: "safety",   label: "Safety index",        score: 91, status: "good", detail: "Udaipur old town, tourist-friendly, well-lit ghats." },
    { key: "transport",label: "Transport reliability",score:70, status: "warn", detail: "IndiGo 6E 5311 has 22% historic delay >45 min.", suggestion: "Add a 2 hr buffer before the sunset dinner reservation." },
    { key: "crowd",    label: "Crowd density",       score: 82, status: "good", detail: "City Palace peak at 11:00. You're booked for 09:00." },
    { key: "schedule", label: "Schedule efficiency", score: 79, status: "good", detail: "Avg 11.4 km/day travel, low backtracking.", suggestion: "Swap Day 2 & Day 3 to save 6 km." },
    { key: "group",    label: "Group satisfaction",  score: 91, status: "good", detail: "Consensus across 4 travelers: 91%." },
  ];
}

export function healthScore() {
  const f = healthFactors();
  return Math.round(f.reduce((a, b) => a + b.score, 0) / f.length);
}

// ---- Twin activity feed & Commander events ----------------------------
export type TripEvent = {
  id: string;
  when: string;
  kind: "delay" | "weather" | "budget" | "cancel" | "closure" | "traffic" | "group" | "ai";
  title: string;
  reason: string;         // AI explanation
  action?: string;        // what the AI did
  delta?: string;         // net change
  severity: "info" | "warn" | "bad";
};

export const tripEvents: TripEvent[] = [
  {
    id: "e1", when: "12 min ago", kind: "delay", severity: "warn",
    title: "IndiGo 6E 5311 delayed 1h 40m",
    reason: "ATC congestion at DEL. 92% probability of landing before 12:40 IST.",
    action: "Pushed Taj Lake Palace check-in to 14:00 and rescheduled Ambrai dinner from 19:00 → 20:15.",
    delta: "Buffer preserved, no cost impact.",
  },
  {
    id: "e2", when: "1 h ago", kind: "weather", severity: "info",
    title: "Light rain forecast for Day 4 afternoon",
    reason: "IMD updated Udaipur forecast: 62% chance of showers 14:00–17:00.",
    action: "Swapped Jag Mandir boat cruise to Day 3 sunrise. Held the Day 4 slot for indoor Crystal Gallery.",
    delta: "Same activities, better weather match.",
  },
  {
    id: "e3", when: "3 h ago", kind: "budget", severity: "info",
    title: "Food category tracking 12% over",
    reason: "Two chef-tasting menus this week added ₹8,400 over the plan.",
    action: "Suggested a Hanuman Ghat thali experience Day 5 (₹1,600 for two).",
    delta: "Projected saving ₹4,200.",
  },
  {
    id: "e4", when: "yesterday", kind: "group", severity: "info",
    title: "Priya confirmed the Udaipur trip",
    reason: "Group size is now 4. Consensus score rose from 87% → 91%.",
    action: "Rebooked Ambrai for 4 guests. Added one lake-view suite.",
    delta: "+₹22,000 in stays, split 4 ways.",
  },
];

// ---- Explainability / Recommendation reasoning ------------------------
export type Reasoning = {
  match: number;                 // 0-100
  why: string;
  pros: string[];
  cons: string[];
  costImpact?: string;
  timeImpact?: string;
  distance?: string;
};

export const reasoningLibrary: Record<string, Reasoning> = {
  "taj-lake-palace": {
    match: 94,
    why: "Matches your luxury (70) and history (84) prefs, walking distance to City Palace jetty, and Maya's stay quality bar.",
    pros: ["Iconic lake-view suite", "Butler + private boat transfer", "Rated 4.9 by solo & couple travelers"],
    cons: ["+₹6,200 over Comfort tier", "Boat is the only access after 22:00"],
    costImpact: "+₹6,200",
    timeImpact: "+8 min transit vs. old town stay",
    distance: "0.4 km from City Palace jetty",
  },
  "ambrai-dinner": {
    match: 89,
    why: "Riverside seating aligns with your food (92) preference and the sunset window on Day 2.",
    pros: ["Best-in-class Rajasthani thali", "Sunset view of City Palace", "Kid-friendly if group changes"],
    cons: ["Fills fast after 18:30", "Vegetarian-only menu"],
    costImpact: "₹3,400 for 4",
    timeImpact: "90 min",
    distance: "700 m walk from hotel jetty",
  },
  "boat-jag-mandir": {
    match: 91,
    why: "Sunrise slot avoids the 62% afternoon rain risk on Day 4 and pairs with Arjun's nature score (90).",
    pros: ["Golden light for photography", "Fewer boats before 08:30", "Included in stay"],
    cons: ["Early start (06:30 wake)"],
    costImpact: "Included",
    timeImpact: "2 h round trip",
    distance: "1.1 km on water",
  },
  "auto-rickshaw": {
    match: 82,
    why: "Cheaper than a private car and short hops fit Arjun's walking tolerance (92).",
    pros: ["₹80–₹150 per hop", "No parking hassle in old town"],
    cons: ["No AC", "Rain-limited"],
    costImpact: "≈₹600/day",
    timeImpact: "Comparable to cab in old town",
    distance: "≤ 4 km per hop",
  },
};

// ---- Tradeoff engine ---------------------------------------------------
export type TradeoffOption = {
  id: string;
  label: string;
  price: number;
  timeMin: number;
  comfort: number;   // 0-100
  crowd: number;     // 0-100 (lower = quieter)
  rating: number;    // 0-5
  confidence: number;// 0-100
  bestFor: string;
  pros: string[];
  cons: string[];
};

export const stayOptions: TradeoffOption[] = [
  {
    id: "taj", label: "Taj Lake Palace", price: 42000, timeMin: 12, comfort: 96, crowd: 30, rating: 4.9, confidence: 94,
    bestFor: "Couples celebrating something",
    pros: ["Icon of Udaipur", "Butler service", "Boat access"],
    cons: ["Premium price", "Boat-only after 22:00"],
  },
  {
    id: "leela", label: "The Leela Palace", price: 32000, timeMin: 22, comfort: 92, crowd: 40, rating: 4.8, confidence: 90,
    bestFor: "Groups wanting space",
    pros: ["Larger rooms", "Best breakfast in city", "Road access"],
    cons: ["25 min drive to old town"],
  },
  {
    id: "haveli", label: "Jagat Niwas Haveli", price: 9800, timeMin: 4, comfort: 78, crowd: 55, rating: 4.6, confidence: 86,
    bestFor: "Solo & budget travelers",
    pros: ["Steps from Gangaur Ghat", "Rooftop lake view", "1/4 the price"],
    cons: ["Small rooms", "No pool"],
  },
];

// ---- Risk radar --------------------------------------------------------
export type RiskItem = {
  key: string;
  label: string;
  level: "low" | "med" | "high";
  summary: string;
  tips: string[];
};

export const risks: RiskItem[] = [
  { key: "weather",   label: "Weather",             level: "med",  summary: "Monsoon fringe. Rain risk 2 of 6 days.", tips: ["Pack a compact rain shell", "Move boat rides to mornings"] },
  { key: "scams",     label: "Tourist scams",       level: "low",  summary: "Udaipur reports few tourist scams. Watch for auto meter switch.", tips: ["Prefer prepaid autos or Ola/Uber", "Confirm price before boarding"] },
  { key: "crowd",     label: "Crowd density",       level: "low",  summary: "Shoulder season. Peak only around City Palace 11:00–13:00.", tips: ["Enter major sites at opening", "Reserve boats one day ahead"] },
  { key: "night",     label: "Late-night safety",   level: "low",  summary: "Well-lit ghats and active tourist police in old town.", tips: ["Share live location with the group", "Use hotel boat after 22:00"] },
  { key: "transport", label: "Transport disruption",level: "med",  summary: "Flight IndiGo 6E 5311 has 22% historic delay.", tips: ["Keep a 2 hr buffer on arrival day", "Save airline chat in Home screen"] },
  { key: "closures",  label: "Holiday closures",    level: "low",  summary: "No major closures overlap your dates.", tips: ["Verify museum timings the night before"] },
];

export const emergencyContacts = [
  { label: "Police (India)", value: "112" },
  { label: "Ambulance",      value: "108" },
  { label: "Tourist helpline",value: "1363" },
  { label: "Hotel concierge",value: "+91 294 242 8800" },
];

// ---- What-If simulator -------------------------------------------------
export type SimInput = {
  budget: number;
  days: number;
  travelers: number;
  tier: "Economy" | "Comfort" | "Luxury";
  transport: "Train" | "Flight" | "Private car";
};

export const baseSim: SimInput = { budget: 180000, days: 6, travelers: 2, tier: "Comfort", transport: "Flight" };

export function simulate(input: SimInput) {
  const tierMult = input.tier === "Economy" ? 0.72 : input.tier === "Luxury" ? 1.55 : 1;
  const transportMult = input.transport === "Train" ? 0.6 : input.transport === "Private car" ? 1.25 : 1;
  const projected = Math.round(38000 * input.days * tierMult * transportMult * (0.85 + 0.15 * input.travelers) / 2);
  const perDay = Math.round(projected / input.days);
  const health = Math.max(40, Math.min(99, 92 - Math.abs(projected - input.budget) / 4000));
  const savings = input.budget - projected;
  const activities = Math.round(input.days * (input.tier === "Luxury" ? 2.4 : input.tier === "Economy" ? 3.5 : 3));
  const travelTime = input.transport === "Train" ? "12–14 h" : input.transport === "Private car" ? "8 h drive" : "1 h 40 flight";
  return { projected, perDay, health: Math.round(health), savings, activities, travelTime };
}

// ---- Packing -----------------------------------------------------------
export type PackItem = { name: string; why: string; done?: boolean };
export const packing: Record<string, PackItem[]> = {
  Essentials: [
    { name: "Aadhaar + printed ID copies", why: "Required at hotel check-in and domestic security." },
    { name: "Reusable water bottle",       why: "Tap water not potable. Hotel provides refill stations." },
    { name: "UPI-linked phone + power bank",why: "Cash is rarely needed; most vendors accept UPI." },
  ],
  "Weather-specific": [
    { name: "Compact rain shell",  why: "62% rain chance on Day 4 afternoon (monsoon fringe)." },
    { name: "Breathable cottons",  why: "Daytime highs 32–34°C; humidity 68%." },
    { name: "Light layer for boat rides", why: "Lake breeze drops perceived temp by ~4°C at sunrise." },
  ],
  Documents: [
    { name: "Flight PNR (6E 5311)", why: "Delay-tracked automatically by Aventra." },
    { name: "Hotel reservation QR", why: "Taj Lake Palace scans QR at boat jetty." },
    { name: "Travel insurance card",why: "Covers Rajasthan medical + trip interruption." },
  ],
  Electronics: [
    { name: "Universal adapter (Type C/D)",why: "India uses Type D primarily; hotels vary." },
    { name: "20,000 mAh power bank",     why: "Long temple/palace visits, few charging points." },
    { name: "Camera + polarizer",        why: "Cuts lake glare for boat photography." },
  ],
  Medicines: [
    { name: "ORS sachets",     why: "Heat + spice can dehydrate; ORS restores in 15 min." },
    { name: "Antihistamine",   why: "Pollen high on shoulder-season mornings." },
    { name: "Personal prescription meds", why: "Rural pharmacies may not stock brand equivalents." },
  ],
  Optional: [
    { name: "Modest scarf/stole", why: "Temple etiquette; also useful on the boat at sunrise." },
    { name: "Kindle / book",      why: "Slow reading time on lake views." },
  ],
};
