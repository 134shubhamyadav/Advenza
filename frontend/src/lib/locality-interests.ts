/**
 * Advenza — Locality-Aware Contextual Travel Interests
 *
 * Provides authentic, hyper-local travel experiences tailored to the specific
 * destination rather than generic static checkboxes.
 */

export interface LocalityInterest {
  id: string;
  label: string;
  icon?: string;
  category?: string;
}

const REGIONAL_INTEREST_CATALOG: Record<string, string[]> = {
  goa: [
    "🏖️ Beaches & Watersports",
    "⛪ Portuguese Heritage & Old Goa",
    "🍹 Nightlife & Beach Shacks",
    "🌿 Spice Plantations & Waterfalls",
    "🛥️ Sunset Mandovi Cruises",
    "☕ Fontainhas Heritage Cafes",
    "🧘 Ayurvedic Wellness & Yoga",
    "🛍️ Flea Markets & Boutiques",
    "🍛 Goan Fish Curry & Seafood",
    "🚲 Divar Island Cycling",
  ],
  jaisalmer: [
    "🏜️ Sam Sand Dunes & Camel Safari",
    "🏰 Jaisalmer Living Fort (Sonar Quila)",
    "✨ Desert Stargazing & Camping",
    "🪕 Rajasthani Folk Music & Dance",
    "🏛️ Patwon Ki Haveli Architecture",
    "🌅 Gadisar Lake Sunset",
    "🛍️ Leather, Quilts & Camel Wool Crafts",
    "🍛 Authentic Dal Baati Churma",
    "🛕 Ancient Jain Temples",
  ],
  surat: [
    "🥘 Iconic Street Food (Locho, Ghari & Khaman)",
    "🧵 Textile & Silk Bazaars",
    "💎 Diamond Trading Hub & Sparkle",
    "🏖️ Dumas Black Sand Beach",
    "🏰 16th-Century Surat Castle",
    "🌿 Tapi Riverfront Promenade",
    "🏛️ Chintamani Jain Heritage",
    "🛍️ Zari Embroidery & Handlooms",
    "☕ Pal Food Street Culture",
  ],
  jaipur: [
    "🏰 Amer, Jaigarh & Nahargarh Forts",
    "👑 City Palace & Hawa Mahal",
    "🛍️ Johari & Bapu Bazaars",
    "🍛 Royal Rajasthani Thali & Street Chaat",
    "🎨 Hand Block Printing & Blue Pottery",
    "🛕 Birla & Galtaji Sun Temples",
    "☕ Rooftop Sunset Cafes",
    "🏛️ Albert Hall & Museums",
    "🪕 Chokhi Dhani Cultural Village",
  ],
  varanasi: [
    "🌅 Sunrise Boat Ride on Holy Ganga",
    "🪔 Ganga Aarti at Dashashwamedh Ghat",
    "🛕 Kashi Vishwanath & Ancient Temples",
    "🧵 Banarasi Silk Saree Weaving",
    "🍲 Kachori, Tamatar Chaat & Banarasi Paan",
    "🎶 Classical Indian Music & Heritage",
    "🏛️ Sarnath Buddhist Excursion",
    "☕ Old Alley Heritage Cafes",
  ],
  manali: [
    "❄️ Solang Valley & Snow Points",
    "🥾 Alpine Trekking & Forest Trails",
    "☕ Old Manali Bohemian Cafes",
    "♨️ Vashisht Natural Hot Springs",
    "🛶 Beas River White Water Rafting",
    "🍎 Apple Orchards & Waterfalls (Jogini)",
    "🛕 Hadimba Devi Ancient Wooden Temple",
    "🛍️ Mall Road Handloom Shawls",
    "🏔️ Rohtang Pass / Atal Tunnel Views",
  ],
  ladakh: [
    "🏔️ High Himalayan Passes (Khardung La)",
    "🛕 Ancient Buddhist Monasteries (Hemis, Thiksey)",
    "🌌 Dark Sky Stargazing (Hanle & Nubra)",
    "🚙 Pangong Tso & Hunder Sand Dunes",
    "🥾 Markha Valley High Altitude Trek",
    "🍜 Authentic Thukpa, Momos & Butter Tea",
    "🛍️ Tibetan Refugee Markets",
    "🏍️ Himalayan Motorcycle Expeditions",
  ],
  leh: [
    "🏔️ High Himalayan Passes (Khardung La)",
    "🛕 Ancient Buddhist Monasteries (Hemis, Thiksey)",
    "🌌 Dark Sky Stargazing (Hanle & Nubra)",
    "🚙 Pangong Tso & Hunder Sand Dunes",
    "🥾 Markha Valley High Altitude Trek",
    "🍜 Authentic Thukpa, Momos & Butter Tea",
    "🛍️ Tibetan Refugee Markets",
  ],
  mumbai: [
    "🏛️ Colonial Heritage (CSMT / Gateway of India)",
    "🌊 Marine Drive & Bandstand Promenades",
    "☕ Kala Ghoda Art & Heritage Cafes",
    "🍲 Iconic Street Food (Vada Pav, Pav Bhaji)",
    "🎭 Bollywood, Live Theatres & Comedy",
    "🛍️ Colaba Causeway & Fashion Street",
    "🚢 Elephanta Island Boat Excursion",
    "🍸 Sea-Facing Rooftop Lounges",
    "🌿 Sanjay Gandhi National Park & Kanheri Caves",
  ],
  delhi: [
    "🏛️ Red Fort, Qutub Minar & Humayun's Tomb",
    "🍛 Old Delhi Culinary Trail (Chandni Chowk)",
    "🛍️ Dilli Haat & Janpath Crafts Bazaars",
    "🌳 Lodhi Gardens & Sunder Nursery",
    "🎨 National Museum & Art Galleries",
    "☕ Hauz Khas Village Lake Cafes",
    "🛕 Akshardham Temple & Musical Fountain",
    "🛍️ Khan Market & Connaught Place Boutiques",
  ],
  udaipur: [
    "🏰 City Palace Complex & Royal Museums",
    "🚤 Lake Pichola Sunset Boat Cruise",
    "🎭 Bagore Ki Haveli Folk Dance Show",
    "🍛 Authentic Mewari Cuisine & Lakeside Dining",
    "🎨 Miniature Rajput Paintings & Crafts",
    "🏛️ Saheliyon Ki Bari Royal Gardens",
    "🏰 Monsoon Palace (Sajjangarh) Hilltop View",
  ],
  kerala: [
    "🛶 Backwaters Houseboat Cruise (Alleppey)",
    "🍵 Munnar Tea Plantations & Misty Hills",
    "🌊 Marari & Varkala Cliff Beaches",
    "🎭 Kathakali & Kalaripayattu Martial Arts",
    "🌿 Authentic Ayurvedic Spas & Massages",
    "🍲 Malabar Spices, Appam & Seafood",
    "⛪ Fort Kochi Colonial Quarters & Chinese Nets",
  ],
  kochi: [
    "⛪ Fort Kochi Colonial Quarters & Mattancherry",
    "🐟 Chinese Fishing Nets & Fresh Catch",
    "🎨 Kochi-Muziris Biennale & Art Cafes",
    "🎭 Kathakali Performance & Heritage Walk",
    "🛍️ Jew Town Antique & Spice Markets",
    "🛶 Marine Drive Boat Cruise",
  ],
  munnar: [
    "🍵 Endless Tea Plantations & Tea Museum",
    "🥾 Anamudi Peak & Eravikulam National Park",
    "💧 Attukal & Lakkam Waterfalls",
    "🌿 Spice Garden Tours & Cardamom Trails",
    "🏕️ Mountain View Camping & Mist",
  ],
  kolkata: [
    "🏛️ Victoria Memorial & Colonial Architecture",
    "🍲 Kathi Rolls & Bengali Sweets (Rosogolla, Sandesh)",
    "📚 College Street Boi Para (Book Market)",
    "🚋 Historic Tram Ride & Howrah Bridge Walk",
    "🎨 Kumartuli Clay Idol Workshops",
    "☕ Indian Coffee House Cultural Adda",
    "🛕 Dakshineswar & Belur Math Temples",
  ],
  bengaluru: [
    "☕ Specialty Coffee & Microbrewery Scene",
    "🌳 Cubbon Park & Lalbagh Botanical Gardens",
    "🏛️ Bangalore Palace & Tipu's Summer Fort",
    "🍛 Classic South Indian Tiffin (Vidyarthi Bhavan)",
    "🎨 Indiranagar & Church Street Boutiques",
    "🛍️ Commercial Street & Brigade Road",
  ],
  hyderabad: [
    "🏰 Historic Golconda Fort & Sound Show",
    "🍲 World-Famous Hyderabadi Dum Biryani",
    "🏛️ Charminar & Chowmahalla Palace",
    "💎 Laad Bazaar Glass Bangles & Pearls",
    "☕ Irani Chai & Osmania Biscuits at Nimrah",
    "🌊 Hussain Sagar Lake & Buddha Statue",
  ],
  agra: [
    "🕌 Taj Mahal at Sunrise (UNESCO)",
    "🏰 Agra Fort & Mughal Palaces",
    "🍬 Petha & Mughlai Street Food",
    "🏛️ Fatehpur Sikri Historical Excursion",
    "🎨 Marble Inlay Pietra Dura Artisan Workshops",
    "🌿 Mehtab Bagh Riverside Taj Sunset",
  ],
  amritsar: [
    "🛕 Golden Temple (Harmandir Sahib) & Langar",
    "🇮🇳 Wagah Border Beating Retreat Ceremony",
    "🍲 Amritsari Kulcha, Lassi & Street Food",
    "🏛️ Jallianwala Bagh Historic Memorial",
    "🛍️ Phulkari Embroidery & Heritage Bazaars",
  ],
  rishikesh: [
    "🧘 Yoga, Meditation & Himalayan Ashrams",
    "🛶 Ganga River White Water Rafting",
    "🪔 Triveni Ghat Evening Ganga Aarti",
    "☕ Laxman Jhula Organic Cafes & Bakeries",
    "🥾 Beatles Ashram & Forest Trails",
    "🏕️ Riverside Camping & Bonfire",
  ],
  andaman: [
    "🤿 Scuba Diving & Coral Reef Snorkeling",
    "🏖️ Radhanagar & Elephant Beach (Havelock)",
    "🏛️ Cellular Jail National Memorial & Light Show",
    "🛶 Mangrove Night Kayaking & Bioluminescence",
    "🛥️ Inter-Island Catamaran Island Hopping",
    "🦞 Fresh Island Seafood Grills",
  ],
  dubai: [
    "🏙️ Burj Khalifa & Sky View Observation Decks",
    "🏜️ Desert Dune Bashing, Quad Biking & BBQ",
    "🛍️ Dubai Mall & Gold / Spice Souks",
    "🛥️ Dubai Marina Luxury Yacht Cruise",
    "🎨 Museum of the Future & Architectural Marvels",
    "🏖️ JBR Beach & Palm Jumeirah Beach Clubs",
  ],
  paris: [
    "🗼 Eiffel Tower & Trocadéro Views",
    "🎨 The Louvre & Musée d'Orsay Art Collections",
    "🥐 Authentic Boulangeries, Patisseries & Cafes",
    "⛪ Notre-Dame, Sainte-Chapelle & Latin Quarter",
    "🛥️ Seine River Evening Dinner Cruise",
    "🛍️ Le Marais Boutiques & Vintage Shopping",
  ],
};

const UNIVERSAL_FALLBACK_INTERESTS = [
  "🏛️ Factual Heritage & Historic Landmarks",
  "🍲 Local Street Food & Regional Dining",
  "🌿 Scenic Nature & Natural Landscapes",
  "🛍️ Traditional Bazaars & Artisan Crafts",
  "☕ Cafes & Cultural Neighborhoods",
  "🥾 Outdoor Adventure & Walking Trails",
  "📸 Photography & Scenic Viewpoints",
  "🎨 Art Galleries & Architecture",
  "✨ Authentic Hidden Gems & Quiet Corners",
  "🧘 Wellness, Spas & Restful Exploration",
];

/**
 * Returns locality-aware interests tailored specifically to the destination.
 */
export function getLocalityInterests(
  destination: string,
  destinationOverview?: any
): string[] {
  if (!destination) return UNIVERSAL_FALLBACK_INTERESTS;

  const destClean = destination.toLowerCase().trim();
  const cityKey = destClean.split(",")[0].trim().replace(/[^a-z]/g, "");

  // 1. Direct Catalog Match
  for (const [key, items] of Object.entries(REGIONAL_INTEREST_CATALOG)) {
    if (cityKey.includes(key) || key.includes(cityKey)) {
      return items;
    }
  }

  // 2. Synthesize from Destination Overview Highlights & Day Trips if available
  const dynamicSet = new Set<string>();

  if (destinationOverview?.durationRecommendation) {
    const rec = destinationOverview.durationRecommendation;

    // Add day trips as featured local activities
    if (Array.isArray(rec.dayTrips)) {
      rec.dayTrips.slice(0, 3).forEach((dt: string) => {
        dynamicSet.add(`🚗 Day Excursion: ${dt}`);
      });
    }

    // Add popular highlight categories
    if (Array.isArray(rec.popularHighlights)) {
      rec.popularHighlights.slice(0, 4).forEach((p: any) => {
        if (p.name) dynamicSet.add(`📍 ${p.name} (${p.category || "Must-See"})`);
      });
    }

    // Add hidden gem highlights
    if (Array.isArray(rec.hiddenGemHighlights)) {
      rec.hiddenGemHighlights.slice(0, 3).forEach((g: any) => {
        if (g.name) dynamicSet.add(`💎 ${g.name} (${g.category || "Local Gem"})`);
      });
    }
  }

  // 3. Keyword / Geographical Feature Detection
  if (destClean.includes("beach") || destClean.includes("island") || destClean.includes("sea")) {
    dynamicSet.add("🏖️ Beaches & Coastal Promenades");
    dynamicSet.add("🛥️ Sunset Boat Cruises");
    dynamicSet.add("🦞 Fresh Coastal Seafood");
  } else if (destClean.includes("hill") || destClean.includes("mountain") || destClean.includes("valley") || destClean.includes("pass")) {
    dynamicSet.add("🥾 Alpine Trekking & Forest Trails");
    dynamicSet.add("📸 Mountain Viewpoints & Sunrises");
    dynamicSet.add("☕ Cozy Mountain Cafes");
  } else if (destClean.includes("fort") || destClean.includes("temple") || destClean.includes("puri") || destClean.includes("nagar")) {
    dynamicSet.add("🏛️ Historic Architecture & Forts");
    dynamicSet.add("🛕 Spiritual Heritage & Ancient Temples");
    dynamicSet.add("🛍️ Traditional Crafts & Bazaars");
  }

  // 4. Fill remaining slots with tailored universal experiences
  for (const item of UNIVERSAL_FALLBACK_INTERESTS) {
    if (dynamicSet.size >= 10) break;
    dynamicSet.add(item);
  }

  return Array.from(dynamicSet);
}
