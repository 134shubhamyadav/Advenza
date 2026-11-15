/**
 * Advenza — Comprehensive Interest Taxonomy & Time-Window Preferences
 *
 * Defines granular subcategories, optimal time windows, search keywords,
 * and Google Places API types for all 14 supported Advenza interests.
 */

export const INTEREST_TAXONOMY = {
  nightlife: {
    domain: "NIGHTLIFE_EVENING",
    label: "Nightlife",
    preferredWindows: [
      { name: "Evening Social", start: "19:00", end: "21:30" },
      { name: "Prime Nightlife", start: "21:00", end: "01:00" },
      { name: "Late Night", start: "23:00", end: "03:00" },
    ],
    defaultWindow: { start: "21:00", end: "01:00" },
    subcategories: [
      {
        id: "nightclub",
        label: "Nightclubs & Dance Clubs",
        keywords: ["nightclub", "dance club", "discotheque"],
        googlePlaceTypes: ["night_club"],
        typicalHours: { open: "21:30", close: "03:30", overnight: true },
        preferredSlot: "22:30",
        typicalDurationMins: 150,
      },
      {
        id: "pub_bar",
        label: "Pubs & Craft Bars",
        keywords: ["pub", "cocktail bar", "craft beer bar", "brewery"],
        googlePlaceTypes: ["bar"],
        typicalHours: { open: "18:00", close: "01:00", overnight: true },
        preferredSlot: "20:30",
        typicalDurationMins: 90,
      },
      {
        id: "beach_club",
        label: "Beach Clubs & Sunset Shacks",
        keywords: ["beach club", "beach shack lounge", "coastal club"],
        googlePlaceTypes: ["bar", "restaurant"],
        typicalHours: { open: "17:00", close: "02:00", overnight: true },
        preferredSlot: "21:00",
        typicalDurationMins: 120,
      },
      {
        id: "rooftop_lounge",
        label: "Rooftop Lounges",
        keywords: ["rooftop lounge", "rooftop bar", "sky bar"],
        googlePlaceTypes: ["bar", "restaurant"],
        typicalHours: { open: "18:30", close: "01:30", overnight: true },
        preferredSlot: "21:30",
        typicalDurationMins: 100,
      },
      {
        id: "live_music",
        label: "Live Music & Acoustic Venues",
        keywords: ["live music venue", "jazz club", "acoustic bar", "band performance"],
        googlePlaceTypes: ["bar", "night_club"],
        typicalHours: { open: "19:30", close: "01:00", overnight: true },
        preferredSlot: "20:30",
        typicalDurationMins: 120,
      },
      {
        id: "dj_events",
        label: "DJ & Electronic Events",
        keywords: ["dj event", "techno club", "electronic music party"],
        googlePlaceTypes: ["night_club"],
        typicalHours: { open: "22:00", close: "04:00", overnight: true },
        preferredSlot: "23:00",
        typicalDurationMins: 180,
      },
      {
        id: "night_market",
        label: "Night Markets & Evening Bazaars",
        keywords: ["night market", "evening bazaar", "saturday night market"],
        googlePlaceTypes: ["market", "shopping_mall"],
        typicalHours: { open: "18:00", close: "23:30", overnight: false },
        preferredSlot: "19:30",
        typicalDurationMins: 120,
      },
      {
        id: "cultural_evening",
        label: "Nighttime Cultural Experiences",
        keywords: ["evening cultural show", "traditional dance show", "sound and light show"],
        googlePlaceTypes: ["tourist_attraction"],
        typicalHours: { open: "19:00", close: "21:30", overnight: false },
        preferredSlot: "19:30",
        typicalDurationMins: 90,
      },
    ],
  },

  food: {
    domain: "FOOD_CULINARY",
    label: "Food",
    preferredWindows: [
      { name: "Breakfast & Morning Cafes", start: "08:00", end: "10:30" },
      { name: "Lunch & Regional Thalis", start: "12:30", end: "14:30" },
      { name: "Evening Street Food", start: "16:30", end: "19:00" },
      { name: "Dinner & Fine Dining", start: "19:30", end: "22:30" },
    ],
    defaultWindow: { start: "12:30", end: "22:00" },
    subcategories: [
      {
        id: "regional_specialty",
        label: "Local Cuisine & Regional Specialties",
        keywords: ["regional restaurant", "authentic local cuisine", "traditional kitchen"],
        googlePlaceTypes: ["restaurant"],
        typicalHours: { open: "12:00", close: "23:00", overnight: false },
        preferredSlot: "13:00",
        typicalDurationMins: 75,
      },
      {
        id: "famous_dining",
        label: "Famous & Heritage Restaurants",
        keywords: ["iconic restaurant", "historic eatery", "famous dining establishment"],
        googlePlaceTypes: ["restaurant"],
        typicalHours: { open: "12:00", close: "23:00", overnight: false },
        preferredSlot: "20:00",
        typicalDurationMins: 90,
      },
      {
        id: "street_food",
        label: "Street Food & Food Walks",
        keywords: ["street food lane", "chaat gali", "food street", "snack hub"],
        googlePlaceTypes: ["restaurant", "meal_takeaway"],
        typicalHours: { open: "16:00", close: "22:30", overnight: false },
        preferredSlot: "17:30",
        typicalDurationMins: 60,
      },
      {
        id: "food_market",
        label: "Food Markets & Produce Bazaars",
        keywords: ["food bazaar", "spice market", "local produce market", "fish market"],
        googlePlaceTypes: ["market"],
        typicalHours: { open: "08:00", close: "18:00", overnight: false },
        preferredSlot: "09:30",
        typicalDurationMins: 75,
      },
      {
        id: "cafes_desserts",
        label: "Artisan Cafes & Dessert Parlors",
        keywords: ["artisan bakery", "dessert parlour", "patisserie", "specialty cafe"],
        googlePlaceTypes: ["cafe", "bakery"],
        typicalHours: { open: "08:30", close: "21:30", overnight: false },
        preferredSlot: "10:00",
        typicalDurationMins: 60,
      },
      {
        id: "fine_dining",
        label: "Fine Dining & Chef Tastings",
        keywords: ["fine dining", "chef table", "luxury restaurant", "gourmet dining"],
        googlePlaceTypes: ["restaurant"],
        typicalHours: { open: "19:00", close: "23:30", overnight: false },
        preferredSlot: "20:30",
        typicalDurationMins: 120,
      },
    ],
  },

  nature: {
    domain: "NATURE_SCENIC",
    label: "Nature",
    preferredWindows: [
      { name: "Morning Scenic & Trails", start: "06:30", end: "10:30" },
      { name: "Midday Shaded Sanctuaries", start: "11:00", end: "15:00" },
      { name: "Sunset Viewpoints", start: "16:30", end: "18:45" },
    ],
    defaultWindow: { start: "07:00", end: "18:00" },
    subcategories: [
      {
        id: "nature_trail",
        label: "Nature Trails & Forest Walks",
        keywords: ["nature trail", "forest walk", "ecological trail"],
        googlePlaceTypes: ["park", "natural_feature"],
        typicalHours: { open: "06:00", close: "18:00", overnight: false },
        preferredSlot: "07:30",
        typicalDurationMins: 120,
      },
      {
        id: "scenic_viewpoint",
        label: "Scenic Panoramic Viewpoints",
        keywords: ["viewpoint", "panoramic outlook", "cliff lookout", "sunset point"],
        googlePlaceTypes: ["tourist_attraction", "natural_feature"],
        typicalHours: { open: "06:00", close: "19:00", overnight: false },
        preferredSlot: "17:15",
        typicalDurationMins: 60,
      },
      {
        id: "waterfall",
        label: "Waterfalls & Natural Springs",
        keywords: ["waterfall", "natural cascade", "springs"],
        googlePlaceTypes: ["natural_feature", "tourist_attraction"],
        typicalHours: { open: "08:00", close: "17:00", overnight: false },
        preferredSlot: "09:30",
        typicalDurationMins: 90,
      },
      {
        id: "national_park",
        label: "National Parks & Wildlife Sanctuaries",
        keywords: ["national park", "wildlife sanctuary", "safari park"],
        googlePlaceTypes: ["park", "tourist_attraction"],
        typicalHours: { open: "06:30", close: "17:30", overnight: false },
        preferredSlot: "07:00",
        typicalDurationMins: 180,
      },
      {
        id: "gardens_landscapes",
        label: "Botanical Gardens & Natural Landscapes",
        keywords: ["botanical garden", "ornamental garden", "arboretum"],
        googlePlaceTypes: ["park", "tourist_attraction"],
        typicalHours: { open: "08:30", close: "18:00", overnight: false },
        preferredSlot: "09:00",
        typicalDurationMins: 75,
      },
    ],
  },

  beaches: {
    domain: "BEACHES_COASTAL",
    label: "Beaches",
    preferredWindows: [
      { name: "Morning Calm & Swimming", start: "07:00", end: "10:30" },
      { name: "Sunset & Golden Hour", start: "16:00", end: "18:45" },
      { name: "Evening Coastal Shacks", start: "19:00", end: "22:30" },
    ],
    defaultWindow: { start: "07:00", end: "19:00" },
    subcategories: [
      {
        id: "serene_beach",
        label: "Tranquil & Scenic Beaches",
        keywords: ["secluded beach", "white sand beach", "pristine beach", "cove"],
        googlePlaceTypes: ["natural_feature"],
        typicalHours: { open: "06:00", close: "19:00", overnight: false },
        preferredSlot: "08:00",
        typicalDurationMins: 120,
      },
      {
        id: "watersports_beach",
        label: "Water Sports & Activity Beaches",
        keywords: ["water sports beach", "jet ski beach", "surfing beach"],
        googlePlaceTypes: ["natural_feature", "tourist_attraction"],
        typicalHours: { open: "09:00", close: "17:30", overnight: false },
        preferredSlot: "10:00",
        typicalDurationMins: 120,
      },
      {
        id: "sunset_beach",
        label: "Sunset Promenades & Coastal Shacks",
        keywords: ["sunset beach", "beach promenade", "beachfront shacks"],
        googlePlaceTypes: ["natural_feature", "restaurant"],
        typicalHours: { open: "07:00", close: "23:00", overnight: false },
        preferredSlot: "17:00",
        typicalDurationMins: 90,
      },
    ],
  },

  hiking: {
    domain: "ADVENTURE_OUTDOORS",
    label: "Hiking",
    preferredWindows: [
      { name: "Early Morning Trek", start: "06:00", end: "10:30" },
      { name: "Late Afternoon Ridge Walk", start: "15:30", end: "18:15" },
    ],
    defaultWindow: { start: "06:30", end: "11:00" },
    subcategories: [
      {
        id: "day_trek",
        label: "Day Treks & Summit Trails",
        keywords: ["trekking trail", "hiking trail", "peak hike", "mountain trek"],
        googlePlaceTypes: ["park", "natural_feature"],
        typicalHours: { open: "06:00", close: "17:00", overnight: false },
        preferredSlot: "06:30",
        typicalDurationMins: 210,
      },
      {
        id: "nature_walk",
        label: "Moderate Nature Walks & Ridge Paths",
        keywords: ["ridge walk", "moderate nature walk", "hill trail"],
        googlePlaceTypes: ["park"],
        typicalHours: { open: "07:00", close: "18:00", overnight: false },
        preferredSlot: "07:30",
        typicalDurationMins: 90,
      },
    ],
  },

  history: {
    domain: "CULTURE_HERITAGE",
    label: "History",
    preferredWindows: [
      { name: "Morning Monuments", start: "09:00", end: "12:30" },
      { name: "Afternoon Palaces & Forts", start: "14:00", end: "17:30" },
    ],
    defaultWindow: { start: "09:00", end: "17:30" },
    subcategories: [
      {
        id: "ancient_fort",
        label: "Historic Forts & Citadel Ruins",
        keywords: ["historic fort", "citadel", "fortress", "ancient ramparts"],
        googlePlaceTypes: ["tourist_attraction"],
        typicalHours: { open: "09:00", close: "17:30", overnight: false },
        preferredSlot: "09:30",
        typicalDurationMins: 120,
      },
      {
        id: "royal_palace",
        label: "Royal Palaces & Heritage Mansions",
        keywords: ["palace", "royal estate", "heritage mansion"],
        googlePlaceTypes: ["tourist_attraction", "museum"],
        typicalHours: { open: "09:30", close: "17:00", overnight: false },
        preferredSlot: "14:30",
        typicalDurationMins: 90,
      },
      {
        id: "heritage_quarter",
        label: "Heritage Quarters & Historic Walks",
        keywords: ["heritage quarter", "historic street", "colonial district", "old town"],
        googlePlaceTypes: ["tourist_attraction"],
        typicalHours: { open: "08:00", close: "20:00", overnight: false },
        preferredSlot: "16:00",
        typicalDurationMins: 90,
      },
    ],
  },

  museums: {
    domain: "CULTURE_HERITAGE",
    label: "Museums",
    preferredWindows: [
      { name: "Midday Museum Hours", start: "10:00", end: "16:30" },
    ],
    defaultWindow: { start: "10:00", end: "17:00" },
    subcategories: [
      {
        id: "art_gallery",
        label: "Art Museums & Contemporary Galleries",
        keywords: ["art gallery", "fine art museum", "contemporary art space"],
        googlePlaceTypes: ["art_gallery", "museum"],
        typicalHours: { open: "10:00", close: "17:30", overnight: false, closedDays: ["Monday"] },
        preferredSlot: "11:00",
        typicalDurationMins: 90,
      },
      {
        id: "history_museum",
        label: "Historical & Archaeological Museums",
        keywords: ["archaeological museum", "history museum", "state museum"],
        googlePlaceTypes: ["museum"],
        typicalHours: { open: "10:00", close: "17:00", overnight: false, closedDays: ["Monday"] },
        preferredSlot: "14:00",
        typicalDurationMins: 100,
      },
    ],
  },

  photography: {
    domain: "PHOTOGRAPHY_VISUAL",
    label: "Photography",
    preferredWindows: [
      { name: "Golden Hour Morning", start: "06:00", end: "08:00" },
      { name: "Golden Hour Sunset", start: "16:45", end: "18:45" },
      { name: "Blue Hour & Nightscapes", start: "19:00", end: "21:00" },
    ],
    defaultWindow: { start: "06:30", end: "19:00" },
    subcategories: [
      {
        id: "golden_hour_view",
        label: "Golden Hour Viewpoints & Lookouts",
        keywords: ["scenic sunrise spot", "sunset vantage point", "dramatic overlook"],
        googlePlaceTypes: ["tourist_attraction", "natural_feature"],
        typicalHours: { open: "06:00", close: "19:30", overnight: false },
        preferredSlot: "17:15",
        typicalDurationMins: 60,
      },
      {
        id: "architectural_photo",
        label: "Architectural & Heritage Facades",
        keywords: ["ornate architecture", "heritage facade", "iconic landmark"],
        googlePlaceTypes: ["tourist_attraction"],
        typicalHours: { open: "08:00", close: "18:00", overnight: false },
        preferredSlot: "08:00",
        typicalDurationMins: 60,
      },
    ],
  },

  wellness: {
    domain: "WELLNESS_RELAXATION",
    label: "Wellness",
    preferredWindows: [
      { name: "Morning Yoga & Meditation", start: "07:00", end: "09:30" },
      { name: "Afternoon Spa & Ayurvedic Therapy", start: "14:30", end: "18:00" },
    ],
    defaultWindow: { start: "08:00", end: "18:00" },
    subcategories: [
      {
        id: "spa_ayurveda",
        label: "Ayurvedic Centers & Spas",
        keywords: ["ayurvedic massage", "holistic spa", "wellness retreat"],
        googlePlaceTypes: ["spa"],
        typicalHours: { open: "09:00", close: "19:30", overnight: false },
        preferredSlot: "15:00",
        typicalDurationMins: 90,
      },
      {
        id: "yoga_meditation",
        label: "Yoga Shalas & Meditation Gardens",
        keywords: ["yoga shala", "meditation garden", "peaceful sanctuary"],
        googlePlaceTypes: ["park", "gym"],
        typicalHours: { open: "06:30", close: "19:00", overnight: false },
        preferredSlot: "07:30",
        typicalDurationMins: 75,
      },
    ],
  },

  adventure: {
    domain: "ADVENTURE_OUTDOORS",
    label: "Adventure",
    preferredWindows: [
      { name: "Morning Action & Water Sports", start: "08:30", end: "12:30" },
      { name: "Afternoon Air & Terrain Sports", start: "14:30", end: "17:30" },
    ],
    defaultWindow: { start: "08:30", end: "16:30" },
    subcategories: [
      {
        id: "watersports",
        label: "Water Sports & Scuba/Snorkeling",
        keywords: ["scuba diving", "snorkeling reef", "sea kayaking", "parasailing"],
        googlePlaceTypes: ["tourist_attraction"],
        typicalHours: { open: "08:30", close: "17:00", overnight: false },
        preferredSlot: "09:30",
        typicalDurationMins: 150,
      },
      {
        id: "outdoor_thrills",
        label: "Air, Terrain & Rock Adventure",
        keywords: ["paragliding launch", "rock climbing", "atv quad trail", "bungee jump"],
        googlePlaceTypes: ["tourist_attraction"],
        typicalHours: { open: "09:00", close: "17:00", overnight: false },
        preferredSlot: "10:30",
        typicalDurationMins: 120,
      },
    ],
  },

  shopping: {
    domain: "SHOPPING_ARTISAN",
    label: "Shopping",
    preferredWindows: [
      { name: "Afternoon Market Browsing", start: "11:30", end: "16:00" },
      { name: "Evening Bazaars & Flea Markets", start: "17:00", end: "21:30" },
    ],
    defaultWindow: { start: "11:00", end: "20:30" },
    subcategories: [
      {
        id: "local_bazaar",
        label: "Traditional Bazaars & Craft Markets",
        keywords: ["traditional bazaar", "handicrafts emporium", "artisan market", "flea market"],
        googlePlaceTypes: ["market", "shopping_mall"],
        typicalHours: { open: "10:30", close: "20:30", overnight: false },
        preferredSlot: "17:00",
        typicalDurationMins: 90,
      },
      {
        id: "specialty_stores",
        label: "Specialty Boutiques & Regional Goods",
        keywords: ["textile boutique", "spice shop", "antique emporium"],
        googlePlaceTypes: ["store"],
        typicalHours: { open: "10:30", close: "20:00", overnight: false },
        preferredSlot: "15:00",
        typicalDurationMins: 60,
      },
    ],
  },

  architecture: {
    domain: "CULTURE_HERITAGE",
    label: "Architecture",
    preferredWindows: [
      { name: "Morning Exterior Light", start: "08:30", end: "11:30" },
      { name: "Late Afternoon Golden Glaze", start: "15:30", end: "18:00" },
    ],
    defaultWindow: { start: "09:00", end: "17:30" },
    subcategories: [
      {
        id: "heritage_architecture",
        label: "Historic & Colonial Architecture",
        keywords: ["colonial architecture", "ancient stone temple", "ornate church", "historic haveli"],
        googlePlaceTypes: ["tourist_attraction", "church", "place_of_worship"],
        typicalHours: { open: "08:30", close: "18:00", overnight: false },
        preferredSlot: "09:30",
        typicalDurationMins: 75,
      },
    ],
  },

  culture: {
    domain: "CULTURE_HERITAGE",
    label: "Culture",
    preferredWindows: [
      { name: "Morning Heritage Immersion", start: "09:00", end: "12:30" },
      { name: "Evening Cultural Performances", start: "18:30", end: "21:00" },
    ],
    defaultWindow: { start: "09:30", end: "20:00" },
    subcategories: [
      {
        id: "cultural_center",
        label: "Living Cultural Centers & Artisan Villages",
        keywords: ["cultural center", "artisan village", "folk dance center"],
        googlePlaceTypes: ["tourist_attraction"],
        typicalHours: { open: "10:00", close: "19:00", overnight: false },
        preferredSlot: "10:30",
        typicalDurationMins: 90,
      },
    ],
  },

  cafes: {
    domain: "FOOD_CULINARY",
    label: "Cafes",
    preferredWindows: [
      { name: "Breakfast & Morning Brews", start: "08:00", end: "11:00" },
      { name: "Afternoon Relaxed Coffee", start: "15:30", end: "18:00" },
    ],
    defaultWindow: { start: "08:00", end: "18:00" },
    subcategories: [
      {
        id: "artisan_coffee",
        label: "Specialty Coffee Roasters & Scenic Cafes",
        keywords: ["specialty coffee", "third wave cafe", "scenic garden cafe", "roastery"],
        googlePlaceTypes: ["cafe"],
        typicalHours: { open: "08:00", close: "20:00", overnight: false },
        preferredSlot: "09:00",
        typicalDurationMins: 60,
      },
    ],
  },
};

/**
 * Resolves a raw interest name (case-insensitive) to its taxonomy entry.
 */
export function getTaxonomyForInterest(interestName) {
  if (!interestName || typeof interestName !== "string") return null;
  const lower = interestName.toLowerCase().trim();

  if (INTEREST_TAXONOMY[lower]) {
    return INTEREST_TAXONOMY[lower];
  }

  for (const [key, entry] of Object.entries(INTEREST_TAXONOMY)) {
    if (lower.includes(key) || key.includes(lower)) {
      return entry;
    }
  }

  return null;
}

