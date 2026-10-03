/**
 * Interest Intelligence & Alignment Service — Part 7
 *
 * Centralizes interest taxonomy, normalization, multi-interest composite synergies,
 * prompt context generation, and deterministic activity tag validation for Advenza.
 */

// ── Master Domain Identifiers ────────────────────────────────────────────────
export const NORMALIZED_DOMAINS = {
  FOOD_CULINARY: "FOOD_CULINARY",
  CULTURE_HERITAGE: "CULTURE_HERITAGE",
  NATURE_SCENIC: "NATURE_SCENIC",
  BEACHES_COASTAL: "BEACHES_COASTAL",
  ADVENTURE_OUTDOORS: "ADVENTURE_OUTDOORS",
  PHOTOGRAPHY_VISUAL: "PHOTOGRAPHY_VISUAL",
  NIGHTLIFE_EVENING: "NIGHTLIFE_EVENING",
  SHOPPING_ARTISAN: "SHOPPING_ARTISAN",
  WELLNESS_RELAXATION: "WELLNESS_RELAXATION",
};

// ── Domain Display Labels ────────────────────────────────────────────────────
export const DOMAIN_LABELS = {
  [NORMALIZED_DOMAINS.FOOD_CULINARY]: "Food & Culinary",
  [NORMALIZED_DOMAINS.CULTURE_HERITAGE]: "Culture & Heritage",
  [NORMALIZED_DOMAINS.NATURE_SCENIC]: "Nature & Scenic",
  [NORMALIZED_DOMAINS.BEACHES_COASTAL]: "Beaches & Coastal",
  [NORMALIZED_DOMAINS.ADVENTURE_OUTDOORS]: "Adventure & Outdoors",
  [NORMALIZED_DOMAINS.PHOTOGRAPHY_VISUAL]: "Photography & Visuals",
  [NORMALIZED_DOMAINS.NIGHTLIFE_EVENING]: "Nightlife & Evening",
  [NORMALIZED_DOMAINS.SHOPPING_ARTISAN]: "Shopping & Artisans",
  [NORMALIZED_DOMAINS.WELLNESS_RELAXATION]: "Wellness & Relaxation",
};

// ── Interest-to-Domain Mapping Matrix (Aliasing & Normalization) ─────────────
const INTEREST_ALIAS_MAP = {
  // Food & Culinary
  food: [NORMALIZED_DOMAINS.FOOD_CULINARY],
  dining: [NORMALIZED_DOMAINS.FOOD_CULINARY],
  culinary: [NORMALIZED_DOMAINS.FOOD_CULINARY],
  cafes: [NORMALIZED_DOMAINS.FOOD_CULINARY],
  cafe: [NORMALIZED_DOMAINS.FOOD_CULINARY],
  coffee: [NORMALIZED_DOMAINS.FOOD_CULINARY],
  streetfood: [NORMALIZED_DOMAINS.FOOD_CULINARY],
  "street food": [NORMALIZED_DOMAINS.FOOD_CULINARY],
  bakery: [NORMALIZED_DOMAINS.FOOD_CULINARY],
  bakeries: [NORMALIZED_DOMAINS.FOOD_CULINARY],

  // Culture & Heritage
  culture: [NORMALIZED_DOMAINS.CULTURE_HERITAGE],
  cultural: [NORMALIZED_DOMAINS.CULTURE_HERITAGE],
  history: [NORMALIZED_DOMAINS.CULTURE_HERITAGE],
  historic: [NORMALIZED_DOMAINS.CULTURE_HERITAGE],
  historical: [NORMALIZED_DOMAINS.CULTURE_HERITAGE],
  heritage: [NORMALIZED_DOMAINS.CULTURE_HERITAGE],
  museums: [NORMALIZED_DOMAINS.CULTURE_HERITAGE],
  museum: [NORMALIZED_DOMAINS.CULTURE_HERITAGE],
  art: [NORMALIZED_DOMAINS.CULTURE_HERITAGE],
  gallery: [NORMALIZED_DOMAINS.CULTURE_HERITAGE],
  monuments: [NORMALIZED_DOMAINS.CULTURE_HERITAGE],

  // Architecture (Intersects Culture & Visuals)
  architecture: [NORMALIZED_DOMAINS.CULTURE_HERITAGE, NORMALIZED_DOMAINS.PHOTOGRAPHY_VISUAL],

  // Nature & Scenic
  nature: [NORMALIZED_DOMAINS.NATURE_SCENIC],
  scenic: [NORMALIZED_DOMAINS.NATURE_SCENIC],
  wildlife: [NORMALIZED_DOMAINS.NATURE_SCENIC],
  mountains: [NORMALIZED_DOMAINS.NATURE_SCENIC],
  waterfalls: [NORMALIZED_DOMAINS.NATURE_SCENIC],
  landscapes: [NORMALIZED_DOMAINS.NATURE_SCENIC],

  // Beaches & Coastal
  beaches: [NORMALIZED_DOMAINS.BEACHES_COASTAL],
  beach: [NORMALIZED_DOMAINS.BEACHES_COASTAL],
  coastal: [NORMALIZED_DOMAINS.BEACHES_COASTAL],
  sea: [NORMALIZED_DOMAINS.BEACHES_COASTAL],
  ocean: [NORMALIZED_DOMAINS.BEACHES_COASTAL],

  // Adventure & Outdoors
  adventure: [NORMALIZED_DOMAINS.ADVENTURE_OUTDOORS],
  outdoors: [NORMALIZED_DOMAINS.ADVENTURE_OUTDOORS],
  sports: [NORMALIZED_DOMAINS.ADVENTURE_OUTDOORS],
  watersports: [NORMALIZED_DOMAINS.ADVENTURE_OUTDOORS, NORMALIZED_DOMAINS.BEACHES_COASTAL],
  "water sports": [NORMALIZED_DOMAINS.ADVENTURE_OUTDOORS, NORMALIZED_DOMAINS.BEACHES_COASTAL],
  rafting: [NORMALIZED_DOMAINS.ADVENTURE_OUTDOORS],
  paragliding: [NORMALIZED_DOMAINS.ADVENTURE_OUTDOORS],

  // Hiking (Intersects Adventure & Nature)
  hiking: [NORMALIZED_DOMAINS.ADVENTURE_OUTDOORS, NORMALIZED_DOMAINS.NATURE_SCENIC],
  trekking: [NORMALIZED_DOMAINS.ADVENTURE_OUTDOORS, NORMALIZED_DOMAINS.NATURE_SCENIC],
  trails: [NORMALIZED_DOMAINS.ADVENTURE_OUTDOORS, NORMALIZED_DOMAINS.NATURE_SCENIC],
  trek: [NORMALIZED_DOMAINS.ADVENTURE_OUTDOORS, NORMALIZED_DOMAINS.NATURE_SCENIC],

  // Photography & Visuals
  photography: [NORMALIZED_DOMAINS.PHOTOGRAPHY_VISUAL],
  photos: [NORMALIZED_DOMAINS.PHOTOGRAPHY_VISUAL],
  photogenic: [NORMALIZED_DOMAINS.PHOTOGRAPHY_VISUAL],
  viewpoints: [NORMALIZED_DOMAINS.PHOTOGRAPHY_VISUAL, NORMALIZED_DOMAINS.NATURE_SCENIC],

  // Nightlife & Evening
  nightlife: [NORMALIZED_DOMAINS.NIGHTLIFE_EVENING],
  clubs: [NORMALIZED_DOMAINS.NIGHTLIFE_EVENING],
  pubs: [NORMALIZED_DOMAINS.NIGHTLIFE_EVENING],
  bars: [NORMALIZED_DOMAINS.NIGHTLIFE_EVENING],
  evening: [NORMALIZED_DOMAINS.NIGHTLIFE_EVENING],

  // Shopping & Artisans
  shopping: [NORMALIZED_DOMAINS.SHOPPING_ARTISAN],
  markets: [NORMALIZED_DOMAINS.SHOPPING_ARTISAN],
  bazaar: [NORMALIZED_DOMAINS.SHOPPING_ARTISAN],
  bazaars: [NORMALIZED_DOMAINS.SHOPPING_ARTISAN],
  handicrafts: [NORMALIZED_DOMAINS.SHOPPING_ARTISAN, NORMALIZED_DOMAINS.CULTURE_HERITAGE],
  souvenirs: [NORMALIZED_DOMAINS.SHOPPING_ARTISAN],

  // Wellness & Relaxation
  wellness: [NORMALIZED_DOMAINS.WELLNESS_RELAXATION],
  spa: [NORMALIZED_DOMAINS.WELLNESS_RELAXATION],
  yoga: [NORMALIZED_DOMAINS.WELLNESS_RELAXATION],
  ayurveda: [NORMALIZED_DOMAINS.WELLNESS_RELAXATION],
  relaxation: [NORMALIZED_DOMAINS.WELLNESS_RELAXATION],
  peaceful: [NORMALIZED_DOMAINS.WELLNESS_RELAXATION],
};

// ── Domain Focus Directives ──────────────────────────────────────────────────
export const DOMAIN_DIRECTIVES = {
  [NORMALIZED_DOMAINS.FOOD_CULINARY]:
    "FOOD & CULINARY FOCUS: Prioritize iconic local eateries, street food hubs, regional specialty dishes, traditional cooking styles, authentic bakeries/cafes, and evening food markets.",
  [NORMALIZED_DOMAINS.CULTURE_HERITAGE]:
    "CULTURE & HERITAGE FOCUS: Prioritize historical monuments, ancient forts/palaces, renowned museums, heritage walking lanes, local craftsmanship, and cultural performances.",
  [NORMALIZED_DOMAINS.NATURE_SCENIC]:
    "NATURE & SCENIC FOCUS: Prioritize lush viewpoints, nature trails, waterfalls, botanical sanctuaries, tranquil lakesides, and panoramic landscape spots.",
  [NORMALIZED_DOMAINS.BEACHES_COASTAL]:
    "BEACHES & COASTAL FOCUS: Prioritize scenic beaches, coastal promenades, water activities, beach shack dining, sunset vantage points, and tranquil shoreline walks.",
  [NORMALIZED_DOMAINS.ADVENTURE_OUTDOORS]:
    "ADVENTURE & OUTDOORS FOCUS: Prioritize active outdoor experiences (trekking, water sports, coastal kayaking, paragliding, cycling trails, wildlife safaris) during optimal daylight hours.",
  [NORMALIZED_DOMAINS.PHOTOGRAPHY_VISUAL]:
    "PHOTOGRAPHY & VISUALS FOCUS: Prioritize golden-hour viewpoints, architectural marvels, panoramic landscapes, atmospheric heritage alleys, and photogenic sunset/sunrise spots.",
  [NORMALIZED_DOMAINS.NIGHTLIFE_EVENING]:
    "NIGHTLIFE & EVENINGS FOCUS: Prioritize atmospheric night markets, live music venues, beachside shacks, evening cultural shows, and vibrant dining/social hubs.",
  [NORMALIZED_DOMAINS.SHOPPING_ARTISAN]:
    "SHOPPING & ARTISANS FOCUS: Prioritize traditional local bazaars, artisan handicraft emporiums, spice markets, textile quarters, and unique regional souvenir spots.",
  [NORMALIZED_DOMAINS.WELLNESS_RELAXATION]:
    "WELLNESS & RELAXATION FOCUS: Prioritize serene gardens, peaceful morning yoga/walk spots, relaxing spa/ayurveda experiences, tranquil water bodies, and unhurried dining.",
};

// ── Composite Synergy Intent Rules ───────────────────────────────────────────
const SYNERGY_RULES = [
  {
    domains: [NORMALIZED_DOMAINS.FOOD_CULINARY, NORMALIZED_DOMAINS.CULTURE_HERITAGE],
    intentId: "CULINARY_HERITAGE",
    title: "Culinary Heritage & Historic Eateries",
    directive:
      "Pair heritage walking explorations with century-old local eateries, historic bakeries, spice/produce markets, and authentic regional culinary institutions.",
  },
  {
    domains: [NORMALIZED_DOMAINS.FOOD_CULINARY, NORMALIZED_DOMAINS.PHOTOGRAPHY_VISUAL],
    intentId: "VISUAL_CULINARY",
    title: "Photogenic Culinary Experiences",
    directive:
      "Incorporate atmospheric open-air cafes, scenic rooftop dining, vibrant street food lanes, and photogenic food markets.",
  },
  {
    domains: [NORMALIZED_DOMAINS.CULTURE_HERITAGE, NORMALIZED_DOMAINS.PHOTOGRAPHY_VISUAL],
    intentId: "HERITAGE_PHOTOGRAPHY",
    title: "Photographic Heritage & Architecture",
    directive:
      "Explore historical monuments, ancient forts, and heritage quarter alleys during golden hour (early morning / late afternoon) for optimal lighting.",
  },
  {
    domains: [NORMALIZED_DOMAINS.BEACHES_COASTAL, NORMALIZED_DOMAINS.FOOD_CULINARY],
    intentId: "COASTAL_CULINARY",
    title: "Coastal Dining & Seafood Culture",
    directive:
      "Integrate authentic beach shack cuisine, fresh coastal seafood dining, seaside cafes, and sunset coastal dinner spots.",
  },
  {
    domains: [NORMALIZED_DOMAINS.NATURE_SCENIC, NORMALIZED_DOMAINS.PHOTOGRAPHY_VISUAL],
    intentId: "SCENIC_PHOTOGRAPHY",
    title: "Scenic Landscapes & Viewpoint Photography",
    directive:
      "Time visits to panoramic viewpoints, waterfalls, and cliffside lookouts for morning light and dramatic sunset vistas.",
  },
  {
    domains: [NORMALIZED_DOMAINS.ADVENTURE_OUTDOORS, NORMALIZED_DOMAINS.NATURE_SCENIC],
    intentId: "OUTDOOR_ADVENTURE",
    title: "Nature Trails & Active Exploration",
    directive:
      "Schedule nature treks, forest hikes, or kayaking through scenic ecological corridors during comfortable morning hours.",
  },
  {
    domains: [NORMALIZED_DOMAINS.NIGHTLIFE_EVENING, NORMALIZED_DOMAINS.FOOD_CULINARY],
    intentId: "EVENING_SOCIAL_CULINARY",
    title: "Evening Street Food & Social Nightlife",
    directive:
      "Combine buzzing night markets, live music dining, and atmospheric twilight social quarters.",
  },
  {
    domains: [NORMALIZED_DOMAINS.SHOPPING_ARTISAN, NORMALIZED_DOMAINS.CULTURE_HERITAGE],
    intentId: "CULTURAL_CRAFTS_MARKETS",
    title: "Artisan Bazaars & Cultural Crafts",
    directive:
      "Visit traditional artisan workshops, weaving/pottery communities, and heritage handicraft bazaars.",
  },
  {
    domains: [NORMALIZED_DOMAINS.WELLNESS_RELAXATION, NORMALIZED_DOMAINS.NATURE_SCENIC],
    intentId: "NATURE_WELLNESS",
    title: "Tranquil Nature & Restorative Leisure",
    directive:
      "Incorporate peaceful botanical gardens, tranquil morning walks by water bodies, and unhurried natural surroundings.",
  },
  {
    domains: [NORMALIZED_DOMAINS.BEACHES_COASTAL, NORMALIZED_DOMAINS.NIGHTLIFE_EVENING],
    intentId: "COASTAL_NIGHTLIFE",
    title: "Beachfront Nightlife & Social Shacks",
    directive:
      "Transition from evening sunset beach walks into lively beach shacks with acoustic music and coastal social vibes.",
  },
  {
    domains: [NORMALIZED_DOMAINS.ADVENTURE_OUTDOORS, NORMALIZED_DOMAINS.BEACHES_COASTAL],
    intentId: "COASTAL_ADVENTURE",
    title: "Coastal Water Sports & Marine Adventure",
    directive:
      "Incorporate kayaking, scuba/snorkeling, surfing, or coastal cliff walks during daytime hours.",
  },
];

/**
 * Normalizes an array or string of raw user interests into structured domains and composite synergies.
 *
 * @param {string[]|string} rawInterests
 * @returns {Object} Normalized interest profile
 */
export function normalizeInterests(rawInterests) {
  const selected = Array.isArray(rawInterests)
    ? rawInterests.map((s) => String(s).trim()).filter(Boolean)
    : typeof rawInterests === "string" && rawInterests.trim()
    ? rawInterests.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const domainSet = new Set();

  selected.forEach((interest) => {
    const lower = interest.toLowerCase().trim();

    // 1. Direct match in alias map
    if (INTEREST_ALIAS_MAP[lower]) {
      INTEREST_ALIAS_MAP[lower].forEach((d) => domainSet.add(d));
      return;
    }

    // 2. Partial substring search across keys
    let matched = false;
    for (const [aliasKey, domains] of Object.entries(INTEREST_ALIAS_MAP)) {
      if (lower.includes(aliasKey) || aliasKey.includes(lower)) {
        domains.forEach((d) => domainSet.add(d));
        matched = true;
        break;
      }
    }

    // 3. Fallback: match directly against normalized domain names
    if (!matched) {
      for (const domain of Object.values(NORMALIZED_DOMAINS)) {
        if (lower.includes(domain.toLowerCase()) || domain.toLowerCase().includes(lower)) {
          domainSet.add(domain);
          matched = true;
          break;
        }
      }
    }
  });

  const normalizedDomains = Array.from(domainSet);
  const domainLabels = normalizedDomains.map((d) => DOMAIN_LABELS[d] || d);

  // Compute active composite synergies
  const compositeIntents = [];
  SYNERGY_RULES.forEach((rule) => {
    const matchesAll = rule.domains.every((d) => domainSet.has(d));
    if (matchesAll) {
      compositeIntents.push({
        intentId: rule.intentId,
        title: rule.title,
        directive: rule.directive,
        domains: rule.domains,
      });
    }
  });

  return {
    selected,
    normalizedDomains,
    domainLabels,
    compositeIntents,
    hasInterests: selected.length > 0 || normalizedDomains.length > 0,
  };
}

/**
 * Builds the structured User Interest Alignment prompt section for the AI itinerary builder.
 *
 * @param {Object} interestProfile - Output from normalizeInterests
 * @returns {string} Formatted prompt block
 */
export function buildInterestPromptSection(interestProfile) {
  if (!interestProfile.hasInterests) {
    return `• GENERAL EXPLORATION: Balance authentic regional highlights, local dining, scenic views, and key cultural/heritage landmarks without generic checklist filler.`;
  }

  const sections = [];

  // 1. Individual Domain Directives
  interestProfile.normalizedDomains.forEach((domain) => {
    const directive = DOMAIN_DIRECTIVES[domain];
    if (directive) {
      sections.push(`• ${directive}`);
    }
  });

  // 2. Multi-Interest Composite Intent Directives (if any triggered)
  if (interestProfile.compositeIntents.length > 0) {
    sections.push("\nCOMPOSITE MULTI-INTEREST SYNERGY DIRECTIVES (CRITICAL):");
    interestProfile.compositeIntents.forEach((synergy) => {
      sections.push(`★ ${synergy.title.toUpperCase()}: ${synergy.directive}`);
    });
  }

  return sections.join("\n");
}

/**
 * Validates and sanitizes activity interest tags against normalized domains and selected interests.
 *
 * @param {string[]} rawTags - Tags generated by AI or provided by caller
 * @param {Object} interestProfile - Normalized interest profile
 * @returns {string[]} Sanitized interest tags
 */
export function sanitizeActivityInterestTags(rawTags, interestProfile) {
  if (!Array.isArray(rawTags) || rawTags.length === 0) {
    return [];
  }

  const validTagSet = new Set();

  // Populate valid set from user selections and recognized domain labels
  interestProfile.selected.forEach((s) => validTagSet.add(s.toLowerCase()));
  interestProfile.domainLabels.forEach((l) => validTagSet.add(l.toLowerCase()));
  Object.values(DOMAIN_LABELS).forEach((l) => validTagSet.add(l.toLowerCase()));

  const sanitized = [];
  rawTags.forEach((tag) => {
    if (typeof tag !== "string") return;
    const cleaned = tag.trim();
    if (!cleaned) return;

    // Check if tag maps to any known domain or user interest
    const lower = cleaned.toLowerCase();
    for (const valid of validTagSet) {
      if (lower === valid || lower.includes(valid) || valid.includes(lower)) {
        sanitized.push(cleaned);
        break;
      }
    }
  });

  // Deduplicate preserving casing
  return Array.from(new Set(sanitized));
}
