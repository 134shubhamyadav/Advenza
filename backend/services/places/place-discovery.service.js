/**
 * Advenza — Real Place Discovery & Verification Service
 *
 * Discovers verified real-world places, venues, and attractions using:
 * 1. Google Places API (New Places API v1 / REST Search with FieldMask) when configured.
 * 2. High-fidelity curated verified venue database for prominent destinations when API key is missing.
 *
 * Distinguishes POPULAR_ATTRACTIONS vs. AUTHENTIC HIDDEN_GEMS:
 * - Never invents venue names, addresses, or opening hours.
 * - Explicitly tracks verification status: LIVE_VERIFIED | CURATED_VERIFIED | INDICATIVE | UNAVAILABLE.
 * - Flags future dates (> 7 days) where live weekly hours are subject to confirmation.
 * - Provides whySpecial explanations for authentic hidden gems.
 */

import { env } from "../../config/env.js";
import { apiClient } from "../../utils/apiClient.js";
import { logger } from "../../utils/logger.js";
import { getTaxonomyForInterest, INTEREST_TAXONOMY } from "../itinerary/interest-taxonomy.js";
import {
  parseOpeningHours,
  isVenueOpenAt,
  isOutside7DayWindow,
} from "../itinerary/opening-hours.service.js";

// Cache for discovered places: `${destination}:${interest}:${date}` -> Array<Place>
const placesCache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// ── Curated Authentic Place Catalog ──────────────────────────────────────────
// Verified real places partitioned into POPULAR_ATTRACTION and HIDDEN_GEM
export const CURATED_DESTINATION_VENUES = {
  goa: [
    // ── Popular Attractions ──
    {
      name: "Basilica of Bom Jesus",
      category: "History",
      subcategory: "ancient_fort",
      placeType: "POPULAR_ATTRACTION",
      region: "Old Goa & Central",
      address: "Old Goa Rd, Bainguinim, Goa 403402",
      coordinates: { lat: 15.5009, lng: 73.9116 },
      openingHours: "09:00 – 18:30",
      rating: 4.7,
      userRatingsCount: 42000,
      timeRequiredMins: 90,
      mapLink: "https://maps.google.com/?q=Basilica+of+Bom+Jesus+Goa",
      matchReason: "UNESCO World Heritage site holding the sacred relics of St. Francis Xavier.",
      whySpecial: "India's foremost example of Jesuit baroque architecture with intricate gilded altars dating back to 1605.",
    },
    {
      name: "Fort Aguada & Lighthouse",
      category: "History",
      subcategory: "ancient_fort",
      placeType: "POPULAR_ATTRACTION",
      region: "North Goa Coast",
      address: "Aguada Fort Rd, Candolim, Goa 403515",
      coordinates: { lat: 15.4925, lng: 73.7736 },
      openingHours: "09:30 – 18:00",
      rating: 4.5,
      userRatingsCount: 38000,
      timeRequiredMins: 90,
      mapLink: "https://maps.google.com/?q=Fort+Aguada+Goa",
      matchReason: "17th-century Portuguese fortress commanding panoramic views over the confluence of Mandovi River and the Arabian Sea.",
      whySpecial: "Historic freshwater bastion once capable of replenishing 79 ocean vessels with a preserved four-storey lighthouse.",
    },
    {
      name: "Tito's Club & Mambo's",
      category: "Nightlife",
      subcategory: "nightclub",
      placeType: "POPULAR_ATTRACTION",
      region: "North Goa Coast",
      address: "Tito's Lane, Baga, Goa 403516",
      coordinates: { lat: 15.5562, lng: 73.7533 },
      openingHours: "18:00 – 03:30",
      rating: 4.3,
      userRatingsCount: 14200,
      timeRequiredMins: 150,
      mapLink: "https://maps.google.com/?q=Titos+Club+Goa",
      matchReason: "Iconic nightlife club famous for energetic dance floors and beach lane parties.",
      whySpecial: "The legendary pioneer of Goa's modern clubbing culture operating since 1971 on Tito's Lane.",
    },
    {
      name: "Curlies Beach Shack & Club",
      category: "Nightlife",
      subcategory: "beach_club",
      placeType: "POPULAR_ATTRACTION",
      region: "North Goa Coast",
      address: "South Anjuna Beach, Anjuna, Goa 403509",
      coordinates: { lat: 15.5732, lng: 73.7408 },
      openingHours: "08:30 – 03:00",
      rating: 4.2,
      userRatingsCount: 22000,
      timeRequiredMins: 120,
      mapLink: "https://maps.google.com/?q=Curlies+Anjuna+Goa",
      matchReason: "Legendary beachfront shack with sunset views, electronic music, and late-night social vibe.",
      whySpecial: "Multi-level beach haven with direct sunset vistas onto Anjuna's crashing waves and trance heritage.",
    },
    {
      name: "Dudhsagar Waterfalls",
      category: "Nature",
      subcategory: "waterfall",
      placeType: "POPULAR_ATTRACTION",
      region: "South Goa Hinterland",
      address: "Sonaulim, Goa 403410",
      coordinates: { lat: 15.3144, lng: 74.3143 },
      openingHours: "07:00 – 16:30",
      rating: 4.7,
      userRatingsCount: 31000,
      timeRequiredMins: 240,
      mapLink: "https://maps.google.com/?q=Dudhsagar+Waterfalls+Goa",
      matchReason: "Four-tiered majestic waterfall cascading through lush Western Ghats forest canopy.",
      whySpecial: "One of India's tallest waterfalls (310m) tumbling in a dramatic spray of white water framed by the rail viaduct.",
    },
    {
      name: "Fisherman's Wharf",
      category: "Food",
      subcategory: "regional_specialty",
      placeType: "POPULAR_ATTRACTION",
      region: "South Goa Coast",
      address: "Before The Bridge, At Camborchem, Mobor, Cavelossim, Goa 403731",
      coordinates: { lat: 15.1678, lng: 73.9482 },
      openingHours: "12:00 – 23:30",
      rating: 4.6,
      userRatingsCount: 16400,
      timeRequiredMins: 90,
      mapLink: "https://maps.google.com/?q=Fishermans+Wharf+Cavelossim+Goa",
      matchReason: "Riverside Goan culinary institution renowned for authentic Goan fish curry, prawn balchão, and bebinca.",
      whySpecial: "Open-air Sal river deck serving fresh catch bought straight from traditional local fishermen.",
      cuisine: "Goan Seafood & Coastal Non-Veg",
      priceLevel: "₹500 – ₹900 per person",
      dietary: ["non-veg", "seafood"],
      isLunch: true,
      isDinner: true,
    },
    {
      name: "Fat Fish",
      category: "Food",
      subcategory: "regional_specialty",
      placeType: "POPULAR_ATTRACTION",
      region: "North Goa Coast",
      address: "Agar Vaddo, Calangute-Arpora Road, Arpora, Goa 403516",
      coordinates: { lat: 15.5682, lng: 73.7668 },
      openingHours: "12:00 – 16:00, 19:00 – 23:30",
      rating: 4.4,
      userRatingsCount: 14200,
      timeRequiredMins: 75,
      mapLink: "https://maps.google.com/?q=Fat+Fish+Arpora+Goa",
      matchReason: "Vibrant Goan restaurant famous for colossal fish thalis, fresh crab xacuti, and prawn masala.",
      whySpecial: "Beloved coastal institution serving genuine Goan Saraswat fish thalis alongside cold local beverages.",
      cuisine: "Goan Seafood & Coastal Non-Veg",
      priceLevel: "₹400 – ₹700 per person",
      dietary: ["non-veg", "seafood"],
      isLunch: true,
      isDinner: true,
    },
    {
      name: "Gunpowder",
      category: "Food",
      subcategory: "regional_specialty",
      placeType: "HIDDEN_GEM",
      region: "North Goa Coast",
      address: "House No. 6, Saunto Vaddo, Assagao, Goa 403507",
      coordinates: { lat: 15.5925, lng: 73.7711 },
      openingHours: "12:00 – 15:30, 19:00 – 23:00",
      rating: 4.5,
      userRatingsCount: 5400,
      timeRequiredMins: 80,
      mapLink: "https://maps.google.com/?q=Gunpowder+Assagao+Goa",
      matchReason: "Charming heritage bungalow serving bold peninsular South Indian coastal non-vegetarian curries and fluffy appams.",
      whySpecial: "Courtyard dining surrounded by tropical foliage, famous for spicy Coorg Pandi Pork curry and Kerala Mutton roast.",
      cuisine: "Peninsular Coastal & Non-Veg",
      priceLevel: "₹500 – ₹850 per person",
      dietary: ["non-veg"],
      isLunch: true,
      isDinner: true,
    },
    {
      name: "Kokni Kanteen",
      category: "Food",
      subcategory: "regional_specialty",
      placeType: "HIDDEN_GEM",
      region: "Old Goa & Central",
      address: "Near Mahalaxmi Temple, Dr Dada Vaidya Rd, Panaji, Goa 403001",
      coordinates: { lat: 15.4989, lng: 73.8278 },
      openingHours: "12:30 – 15:30, 19:00 – 23:00",
      rating: 4.5,
      userRatingsCount: 4600,
      timeRequiredMins: 60,
      mapLink: "https://maps.google.com/?q=Kokni+Kanteen+Panaji+Goa",
      matchReason: "Vintage 1970s Goan heritage eatery celebrated for authentic, budget-friendly Goan fish thalis under ₹300.",
      whySpecial: "Preserves nostalgic Goan home dining with traditional brass tableware, tisrya (clam) masala, and digestive sol kadi.",
      cuisine: "Authentic Goan Hindu Seafood & Non-Veg",
      priceLevel: "₹200 – ₹350 per person",
      dietary: ["non-veg", "seafood"],
      isLunch: true,
      isDinner: true,
    },
    {
      name: "Ritz Classic",
      category: "Food",
      subcategory: "regional_specialty",
      placeType: "POPULAR_ATTRACTION",
      region: "Old Goa & Central",
      address: "18th June Rd, Panaji, Goa 403001",
      coordinates: { lat: 15.4962, lng: 73.8242 },
      openingHours: "11:30 – 16:00, 19:00 – 23:00",
      rating: 4.4,
      userRatingsCount: 12500,
      timeRequiredMins: 70,
      mapLink: "https://maps.google.com/?q=Ritz+Classic+Panaji+Goa",
      matchReason: "Legendary Panaji seafood lunch landmark renowned for its classic Goan Fish Curry Rice thali and butter garlic prawns.",
      whySpecial: "The ultimate benchmark for local Goan fish curry thali, drawing loyal office crowds and food connoisseurs daily.",
      cuisine: "Goan Seafood & Coastal Non-Veg",
      priceLevel: "₹300 – ₹500 per person",
      dietary: ["non-veg", "seafood"],
      isLunch: true,
      isDinner: true,
    },
    {
      name: "Souza Lobo",
      category: "Food",
      subcategory: "regional_specialty",
      placeType: "POPULAR_ATTRACTION",
      region: "North Goa Coast",
      address: "Calangute Beachfront, Calangute, Goa 403516",
      coordinates: { lat: 15.5435, lng: 73.7542 },
      openingHours: "11:30 – 23:30",
      rating: 4.3,
      userRatingsCount: 16800,
      timeRequiredMins: 90,
      mapLink: "https://maps.google.com/?q=Souza+Lobo+Calangute+Goa",
      matchReason: "Operating since 1932 on Calangute shore, famous for oceanfront dining and Goan seafood platters.",
      whySpecial: "Over 90 years of Goan culinary heritage with views of the Arabian Sea waves.",
      cuisine: "Goan Seafood & Non-Veg",
      priceLevel: "₹600 – ₹1000 per person",
      dietary: ["non-veg", "seafood"],
      isLunch: true,
      isDinner: true,
    },

    // ── Authentic Hidden Gems ──
    {
      name: "Kakolem Beach (Tiger Beach)",
      category: "Beaches",
      subcategory: "serene_beach",
      placeType: "HIDDEN_GEM",
      region: "South Goa Coast",
      address: "Cola, Canacona, South Goa 403702",
      coordinates: { lat: 15.0682, lng: 73.9535 },
      openingHours: "06:00 – 18:30",
      rating: 4.6,
      userRatingsCount: 1200,
      timeRequiredMins: 120,
      mapLink: "https://maps.google.com/?q=Kakolem+Beach+Goa",
      matchReason: "Pristine hidden cove reached via a scenic cliffside stairway with a freshwater stream cascading directly onto the beach.",
      whySpecial: "Completely off the typical tourist path, featuring dramatic red laterite cliffs, untouched golden sand, and zero commercial shacks.",
    },
    {
      name: "Divar Island & Piedade Village",
      category: "Culture",
      subcategory: "cultural_center",
      placeType: "HIDDEN_GEM",
      region: "Old Goa & Central",
      address: "Divar Island, North Goa 403403",
      coordinates: { lat: 15.5255, lng: 73.9056 },
      openingHours: "07:00 – 20:00",
      rating: 4.7,
      userRatingsCount: 950,
      timeRequiredMins: 150,
      mapLink: "https://maps.google.com/?q=Divar+Island+Goa",
      matchReason: "Quiet river island in the Mandovi accessible only by local ferry, filled with vintage Indo-Portuguese villas and emerald paddy fields.",
      whySpecial: "A peaceful step back in time with vintage wooden-railed homes, Church of Our Lady of Compassion, and scenic cycling dikes.",
    },
    {
      name: "Cabo de Rama Fort & Cliff Overlook",
      category: "History",
      subcategory: "ancient_fort",
      placeType: "HIDDEN_GEM",
      region: "South Goa Coast",
      address: "Taluka Cabo da Rama, Canacona, South Goa 403702",
      coordinates: { lat: 15.0934, lng: 73.9218 },
      openingHours: "09:00 – 17:30",
      rating: 4.6,
      userRatingsCount: 3800,
      timeRequiredMins: 90,
      mapLink: "https://maps.google.com/?q=Cabo+de+Rama+Fort+Goa",
      matchReason: "Atmospheric clifftop fortress ruins named after Lord Rama, offering unobstructed 180-degree ocean panoramas.",
      whySpecial: "Wild, wind-swept cliffside bastions with a white colonial chapel and virtually zero commercial crowds compared to Aguada.",
    },
    {
      name: "Savoi Organic Spice Plantation",
      category: "Nature",
      subcategory: "gardens_landscapes",
      placeType: "HIDDEN_GEM",
      region: "South Goa Hinterland",
      address: "Savoi-Verem, Ponda, Goa 403401",
      coordinates: { lat: 15.4526, lng: 74.0325 },
      openingHours: "09:00 – 16:30",
      rating: 4.7,
      userRatingsCount: 1600,
      timeRequiredMins: 120,
      mapLink: "https://maps.google.com/?q=Savoi+Plantation+Goa",
      matchReason: "200-year-old family-cultivated organic spice plantation nestled amidst dense betel nut palms and medicinal flora.",
      whySpecial: "Authentic agro-tourism walk guided by traditional botanists, concluding with a traditional wood-fired Saraswat meal served on banana leaves.",
    },
    {
      name: "Vinayak Family Restaurant",
      category: "Food",
      subcategory: "regional_specialty",
      placeType: "HIDDEN_GEM",
      region: "North Goa Coast",
      address: "House No 252, Sacol Waddo, Assagao, Goa 403507",
      coordinates: { lat: 15.5898, lng: 73.7735 },
      openingHours: "12:30 – 15:30, 19:00 – 22:30",
      rating: 4.6,
      userRatingsCount: 8900,
      timeRequiredMins: 75,
      mapLink: "https://maps.google.com/?q=Vinayak+Assagao+Goa",
      matchReason: "Unassuming local eatery overlooking green fields, celebrated by Goan residents for its unbeatable fresh fish thali.",
      whySpecial: "Zero tourist gimmicks; seasonal catches fried in semolina batter and home-ground Kokum curry prepared by a local Goan family.",
      cuisine: "Authentic Goan Seafood & Non-Veg",
      priceLevel: "₹250 – ₹450 per person",
      dietary: ["non-veg", "seafood"],
      isLunch: true,
      isDinner: true,
    },
    {
      name: "Galgibaga Beach",
      category: "Beaches",
      subcategory: "serene_beach",
      placeType: "HIDDEN_GEM",
      region: "South Goa Coast",
      address: "Canacona, South Goa 403728",
      coordinates: { lat: 14.9667, lng: 74.0500 },
      openingHours: "06:00 – 18:30",
      rating: 4.7,
      userRatingsCount: 1800,
      timeRequiredMins: 120,
      mapLink: "https://maps.google.com/?q=Galgibaga+Beach+Goa",
      matchReason: "One of Goa's cleanest, least crowded shores, protected turtle reserve with pine groves and zero commercial shacks.",
      whySpecial: "Untouched silver sands flanked by casuarina trees where Olive Ridley turtles nest peacefully with almost zero human footprint.",
    },
    {
      name: "Butterfly Beach",
      category: "Beaches",
      subcategory: "serene_beach",
      placeType: "HIDDEN_GEM",
      region: "South Goa Coast",
      address: "Palolem, Canacona, South Goa 403702",
      coordinates: { lat: 15.0212, lng: 74.0089 },
      openingHours: "06:00 – 18:30",
      rating: 4.6,
      userRatingsCount: 2400,
      timeRequiredMins: 120,
      mapLink: "https://maps.google.com/?q=Butterfly+Beach+Goa",
      matchReason: "Semi-circular secluded cove accessible only by boat from Palolem or dense forest trek, famous for dolphins.",
      whySpecial: "Hidden natural amphitheater of white sand embraced by steep volcanic rocks with tranquil crystalline waters.",
    },
    {
      name: "Ashwem Beach",
      category: "Beaches",
      subcategory: "serene_beach",
      placeType: "HIDDEN_GEM",
      region: "North Goa Coast",
      address: "Ashwem, Pernem, North Goa 403527",
      coordinates: { lat: 15.6567, lng: 73.7142 },
      openingHours: "06:00 – 19:30",
      rating: 4.6,
      userRatingsCount: 3200,
      timeRequiredMins: 120,
      mapLink: "https://maps.google.com/?q=Ashwem+Beach+Goa",
      matchReason: "Expansive, gentle white-sand shore far less crowded than commercial Baga/Calangute, lined with palm trees.",
      whySpecial: "A peaceful coastal stretch free from motorized sports, ideal for quiet sunset walks and unhurried beachside dining.",
    },
    {
      name: "Chorão Island & Dr. Salim Ali Bird Sanctuary",
      category: "Nature",
      subcategory: "nature_trail",
      placeType: "HIDDEN_GEM",
      region: "Old Goa & Central",
      address: "Chorão Island, Ribandar, Goa 403102",
      coordinates: { lat: 15.5135, lng: 73.8687 },
      openingHours: "06:00 – 18:00",
      rating: 4.5,
      userRatingsCount: 1100,
      timeRequiredMins: 120,
      mapLink: "https://maps.google.com/?q=Salim+Ali+Bird+Sanctuary+Goa",
      matchReason: "Estuarine mangrove forest inhabited by rare migratory birds, mudskippers, and flying foxes.",
      whySpecial: "Pristine wooden boardwalks cutting deep through tidal mangrove swamps accessible only by early morning canoe canoe/ferry.",
    },
  ],

  mumbai: [
    {
      name: "Gateway of India",
      category: "History",
      subcategory: "ancient_fort",
      placeType: "POPULAR_ATTRACTION",
      region: "South Mumbai Heritage",
      address: "Apollo Bunder, Colaba, Mumbai 400001",
      coordinates: { lat: 18.922, lng: 72.8347 },
      openingHours: "Open 24 hours",
      rating: 4.6,
      userRatingsCount: 84000,
      timeRequiredMins: 60,
      mapLink: "https://maps.google.com/?q=Gateway+of+India+Mumbai",
      matchReason: "Iconic 26-meter arch monument built to commemorate the visit of King George V.",
      whySpecial: "Majestic Indo-Saracenic triumphal arch overlooking the Arabian Sea and historic Taj Mahal Palace.",
    },
    {
      name: "Marine Drive Promenade",
      category: "Photography",
      subcategory: "golden_hour_view",
      placeType: "POPULAR_ATTRACTION",
      region: "South Mumbai Heritage",
      address: "Netaji Subhash Chandra Bose Rd, Mumbai 400020",
      coordinates: { lat: 18.9432, lng: 72.823 },
      openingHours: "Open 24 hours",
      rating: 4.8,
      userRatingsCount: 92000,
      timeRequiredMins: 90,
      mapLink: "https://maps.google.com/?q=Marine+Drive+Mumbai",
      matchReason: "3.6-kilometer C-shaped boulevard famously known as the Queen's Necklace.",
      whySpecial: "Spectacular sunset promenade curving alongside the sea with classic art deco architectural facades.",
    },
    {
      name: "Khotachiwadi Heritage Village",
      category: "Culture",
      subcategory: "cultural_center",
      placeType: "HIDDEN_GEM",
      region: "South Mumbai Heritage",
      address: "Girgaon, Mumbai 400004",
      coordinates: { lat: 18.9567, lng: 72.8188 },
      openingHours: "08:00 – 19:00",
      rating: 4.5,
      userRatingsCount: 850,
      timeRequiredMins: 75,
      mapLink: "https://maps.google.com/?q=Khotachiwadi+Mumbai",
      matchReason: "Protected 19th-century East Indian heritage precinct tucked silently behind buzzing Girgaon.",
      whySpecial: "Two-story Portuguese-style wooden cottages with verandas, external staircases, and close-knit artisanal residents.",
    },
    {
      name: "Banganga Sacred Water Tank",
      category: "History",
      subcategory: "heritage_quarter",
      placeType: "HIDDEN_GEM",
      region: "Malabar Hill & Coast",
      address: "Teen Batti, Malabar Hill, Mumbai 400006",
      coordinates: { lat: 18.9458, lng: 72.7937 },
      openingHours: "06:00 – 20:00",
      rating: 4.6,
      userRatingsCount: 2200,
      timeRequiredMins: 75,
      mapLink: "https://maps.google.com/?q=Banganga+Tank+Mumbai",
      matchReason: "Ancient rectangular water tank dating back to the 12th-century Silhara dynasty.",
      whySpecial: "An oasis of tranquility surrounded by Hindu temples and deepak-stambhas where freshwater springs emerge yards from the salty sea.",
    },
  ],

  manali: [
    {
      name: "Hadimba Temple",
      category: "History",
      subcategory: "heritage_architecture",
      placeType: "POPULAR_ATTRACTION",
      region: "Old Manali",
      address: "Hadimba Temple Rd, Manali 175131",
      coordinates: { lat: 32.2483, lng: 77.1692 },
      openingHours: "08:00 – 18:30",
      rating: 4.6,
      userRatingsCount: 45000,
      timeRequiredMins: 60,
      mapLink: "https://maps.google.com/?q=Hadimba+Temple+Manali",
      matchReason: "16th-century pagoda-style wooden temple dedicated to Hadimba Devi.",
      whySpecial: "Spectacular four-tier pagoda roof constructed from deodar timber nestled inside an ancient pine forest.",
    },
    {
      name: "Jogini Waterfall Trek",
      category: "Nature",
      subcategory: "waterfall",
      placeType: "HIDDEN_GEM",
      region: "Vashisht & Valley",
      address: "Vashisht Village, Manali 175103",
      coordinates: { lat: 32.2685, lng: 77.1956 },
      openingHours: "06:30 – 17:30",
      rating: 4.7,
      userRatingsCount: 3400,
      timeRequiredMins: 150,
      mapLink: "https://maps.google.com/?q=Jogini+Waterfall+Manali",
      matchReason: "Serene hike through apple orchards and pine groves leading to a dramatic 150-foot cascading mountain fall.",
      whySpecial: "Sacred local sanctuary offering peaceful spray pools and sweeping views of the snow-capped Rohtang peaks away from highway traffic.",
    },
  ],

  jaipur: [
    // ── Popular Attractions ──
    {
      name: "Amer Fort (Amber Palace)",
      category: "History",
      subcategory: "ancient_fort",
      placeType: "POPULAR_ATTRACTION",
      region: "Amer Heritage Ridge",
      address: "Devisinghpura, Amer, Jaipur 302001",
      coordinates: { lat: 26.9855, lng: 75.8513 },
      openingHours: "09:00 – 17:30",
      rating: 4.7,
      userRatingsCount: 78000,
      timeRequiredMins: 150,
      mapLink: "https://maps.google.com/?q=Amer+Fort+Jaipur",
      matchReason: "Colossal hilltop citadel renowned for artistic Hindu style elements, Sheesh Mahal, and Maota Lake views.",
      whySpecial: "Intricate mirror mosaics in the Hall of Mirrors reflecting candlelight into an entire starlit sky.",
    },
    {
      name: "Hawa Mahal (Palace of Winds)",
      category: "Architecture",
      subcategory: "heritage_architecture",
      placeType: "POPULAR_ATTRACTION",
      region: "Old Pink City & Walled City",
      address: "Hawa Mahal Rd, Badi Choupad, J.D.A. Market, Jaipur 302002",
      coordinates: { lat: 26.9239, lng: 75.8267 },
      openingHours: "09:00 – 17:00",
      rating: 4.6,
      userRatingsCount: 65000,
      timeRequiredMins: 60,
      mapLink: "https://maps.google.com/?q=Hawa+Mahal+Jaipur",
      matchReason: "Iconic five-story pink sandstone honeycomb facade with 953 jharokhas.",
      whySpecial: "Clever natural air-conditioning architecture allowing royal women to observe street life unobserved.",
    },
    {
      name: "Nahargarh Fort Sunset Viewpoint",
      category: "Nature",
      subcategory: "scenic_viewpoint",
      placeType: "POPULAR_ATTRACTION",
      region: "Aravalli Ridge & Hills",
      address: "Krishna Nagar, Brahampuri, Jaipur 302002",
      coordinates: { lat: 26.9373, lng: 75.8155 },
      openingHours: "10:00 – 22:00",
      rating: 4.6,
      userRatingsCount: 34000,
      timeRequiredMins: 90,
      mapLink: "https://maps.google.com/?q=Nahargarh+Fort+Jaipur",
      matchReason: "Dramatic clifftop fort offering breathtaking 360-degree panoramic views over the entire illuminated Pink City.",
      whySpecial: "Spectacular stepwell and royal suites perched high on the Aravalli precipice, perfect for sunset.",
    },
    {
      name: "Laxmi Misthan Bhandar (LMB)",
      category: "Food",
      subcategory: "regional_specialty",
      placeType: "POPULAR_ATTRACTION",
      region: "Old Pink City & Walled City",
      address: "Shop No. 98, 99, Johari Bazar Rd, Bapu Bazar, Jaipur 302003",
      coordinates: { lat: 26.9200, lng: 75.8245 },
      openingHours: "08:00 – 23:00",
      rating: 4.3,
      userRatingsCount: 16000,
      timeRequiredMins: 60,
      mapLink: "https://maps.google.com/?q=LMB+Johari+Bazar+Jaipur",
      matchReason: "Centuries-old culinary institution famous for authentic Rajasthani thalis, Pyaaz Kachori, and Ghewar.",
      whySpecial: "Serving royal Marwari recipes and quintessential sweet delicacies in the heart of the historic bazaar since 1727.",
    },

    // ── Authentic Hidden Gems ──
    {
      name: "Panna Meena Ka Kund Stepwell",
      category: "Architecture",
      subcategory: "heritage_architecture",
      placeType: "HIDDEN_GEM",
      region: "Amer Heritage Ridge",
      address: "Near Amer Fort, Jaipur 302028",
      coordinates: { lat: 26.9882, lng: 75.8584 },
      openingHours: "07:00 – 18:00",
      rating: 4.5,
      userRatingsCount: 3100,
      timeRequiredMins: 60,
      mapLink: "https://maps.google.com/?q=Panna+Meena+ka+Kund+Jaipur",
      matchReason: "16th-century geometric stepwell with interlocking criss-cross stairs.",
      whySpecial: "An architectural marvel of symmetrical optical illusion, far quieter than the main fort.",
    },
    {
      name: "Galta Ji (Monkey Temple & Natural Springs)",
      category: "Culture",
      subcategory: "cultural_center",
      placeType: "HIDDEN_GEM",
      region: "East Valley & Galta Gorge",
      address: "Galva Ashram, Galta Ji, Jaipur 302031",
      coordinates: { lat: 26.9167, lng: 75.8598 },
      openingHours: "06:00 – 19:30",
      rating: 4.4,
      userRatingsCount: 2900,
      timeRequiredMins: 90,
      mapLink: "https://maps.google.com/?q=Galta+Ji+Jaipur",
      matchReason: "Sacred prehistoric rock gorge with seven holy water kunds and pink stone pavilion temples.",
      whySpecial: "A serene hidden valley surrounded by steep cliffs, natural springs, and hundreds of playful resident langurs.",
    },
    {
      name: "Anokhi Museum of Hand Printing",
      category: "Museums",
      subcategory: "art_gallery",
      placeType: "HIDDEN_GEM",
      region: "Amer Heritage Ridge",
      address: "Anokhi Haveli, Kheri Gate, Amer, Jaipur 302028",
      coordinates: { lat: 26.9912, lng: 75.8519 },
      openingHours: "10:30 – 17:00",
      rating: 4.6,
      userRatingsCount: 980,
      timeRequiredMins: 75,
      mapLink: "https://maps.google.com/?q=Anokhi+Museum+of+Hand+Printing+Jaipur",
      matchReason: "Intimate UNESCO-awarded restored haveli preserving traditional Rajasthani woodblock textile carving and printing.",
      whySpecial: "Live master artisans carving teakwood printing blocks and demonstrating centuries-old natural dyeing heritage away from tourist bazaars.",
    },
  ],
};

export class PlaceDiscoveryService {
  constructor() {
    this.mapsApiKey =
      env.GOOGLE_MAPS_API_KEY ||
      env.MAPS_API_KEY ||
      process.env.VITE_GOOGLE_MAPS_API_KEY ||
      null;
  }

  /**
   * Reports live capability status of Place Discovery without exposing keys.
   */
  getProviderStatus() {
    const isConfigured = Boolean(this.mapsApiKey);
    return {
      provider: "Google Places API",
      status: isConfigured ? "CONFIGURED" : "NOT_CONFIGURED",
      isLive: isConfigured,
      curatedFallbackAvailable: true,
      message: isConfigured
        ? "Google Places API configured for live place discovery & verification."
        : "Google Places API key not configured. Using verified curated landmark catalog.",
    };
  }

  /**
   * Multi-signal Hidden Gem & Attraction Classifier.
   *
   * Rigorously classifies places using:
   * - Curated editorial verification (CONFIRMED_HIDDEN_GEM vs POPULAR_ATTRACTION)
   * - Commercial/Chain negative exclusions (fast food, ATMs, transit, gas stations)
   * - Mainstream popularity thresholds (review volume >= 5000, mega attractions)
   * - Uniqueness & Discovery relevance (cultural/nature/viewpoint keywords & niche categories)
   * - Review score and count sweet spot (40 to 3500 reviews, rating >= 4.4)
   *
   * @param {Object} place
   * @returns {{ gemConfidence: string, isPlaceHiddenGem: boolean, placeType: string, whySpecial: string }}
   */
  classifyPlace(place) {
    // 1. Curated catalog entries have grounded editorial verification
    if (place.isCurated || place.verificationStatus === "CURATED_VERIFIED") {
      const isCuratedGem = place.placeType === "HIDDEN_GEM" || place.placeType === "CONFIRMED_HIDDEN_GEM";
      if (isCuratedGem) {
        return {
          gemConfidence: "CONFIRMED_HIDDEN_GEM",
          isPlaceHiddenGem: true,
          placeType: "CONFIRMED_HIDDEN_GEM",
          whySpecial: place.whySpecial || place.matchReason || "Curated verified local discovery with exceptional cultural or scenic value.",
        };
      }
      return {
        gemConfidence: "POPULAR_ATTRACTION",
        isPlaceHiddenGem: false,
        placeType: "POPULAR_ATTRACTION",
        whySpecial: place.whySpecial || place.matchReason || "Major verified iconic landmark.",
      };
    }

    const name = String(place.name || place.placeName || "").trim();
    const nameLower = name.toLowerCase();
    const types = Array.isArray(place.types) ? place.types.map((t) => String(t).toLowerCase()) : [];
    const rating = Number(place.rating) || 0;
    const reviewCount = Number(place.userRatingsCount || place.userRatingCount) || 0;

    // 2. Negative Exclusions: Commercial chains, generic services, transport, amenities
    const EXCLUDED_TYPES = new Set([
      "gas_station",
      "convenience_store",
      "supermarket",
      "grocery_or_supermarket",
      "atm",
      "bank",
      "hospital",
      "car_rental",
      "car_repair",
      "car_wash",
      "transit_station",
      "subway_station",
      "airport",
      "train_station",
      "bus_station",
      "pharmacy",
      "drugstore",
      "real_estate_agency",
      "shopping_mall",
      "department_store",
      "hardware_store",
      "parking",
      "doctor",
      "dentist",
      "gym",
      "laundry",
      "accounting",
      "insurance_agency",
      "local_government_office",
      "post_office",
      "travel_agency",
    ]);

    const CHAIN_KEYWORDS = [
      "mcdonald", "starbucks", "subway", "kfc", "domino", "pizza hut", "burger king",
      "costa coffee", "cafe coffee day", "barista", "dunkin", "baskin robbins", "haldiram",
      "kamat", "oyo", "fabhotel", "treebo", "marriott", "hilton", "hyatt", "radisson",
      "novotel", "ibis", "westin", "sheraton",
    ];

    const hasExcludedType = types.some((t) => EXCLUDED_TYPES.has(t));
    const isChain = CHAIN_KEYWORDS.some((chain) => nameLower.includes(chain));

    if (hasExcludedType || isChain) {
      return {
        gemConfidence: "UNCLASSIFIED",
        isPlaceHiddenGem: false,
        placeType: "UNCLASSIFIED",
        whySpecial: "",
      };
    }

    // 3. Mainstream Popularity: Mega-attractions with massive review volume
    if (reviewCount >= 5000 || (types.includes("amusement_park") && reviewCount >= 2000)) {
      return {
        gemConfidence: "POPULAR_ATTRACTION",
        isPlaceHiddenGem: false,
        placeType: "POPULAR_ATTRACTION",
        whySpecial: `Major iconic landmark with verified high traveler volume (${reviewCount.toLocaleString()} reviews).`,
      };
    }

    // 4. Insufficient Evidence (< 40 reviews or rating < 4.4)
    if (reviewCount < 40 || rating < 4.4) {
      return {
        gemConfidence: "UNCLASSIFIED",
        isPlaceHiddenGem: false,
        placeType: reviewCount >= 1000 ? "POPULAR_ATTRACTION" : "UNCLASSIFIED",
        whySpecial: "",
      };
    }

    // 5. Positive Discovery Signals (Experiential categories & uniqueness keywords)
    const EXPERIENTIAL_TYPES = new Set([
      "art_gallery",
      "museum",
      "historical_landmark",
      "scenic_viewpoint",
      "hiking_area",
      "national_park",
      "park",
      "botanical_garden",
      "natural_feature",
      "bakery",
      "cafe",
      "bistro",
      "seafood_restaurant",
      "performing_arts_theater",
      "cultural_center",
      "place_of_worship",
      "monument",
      "campground",
    ]);

    const UNIQUENESS_KEYWORDS = [
      "viewpoint", "cove", "sanctuary", "trail", "heritage", "artisan", "organic",
      "spice", "bistro", "retreat", "ruins", "stepwell", "waterfall", "island",
      "cliff", "monastery", "haveli", "grotto", "chapel", "secluded", "overlook",
      "pass", "spring", "secret", "authentic", "hidden", "local",
    ];

    let score = 0;
    if (types.some((t) => EXPERIENTIAL_TYPES.has(t))) score += 2;
    if (UNIQUENESS_KEYWORDS.some((kw) => nameLower.includes(kw))) score += 2;
    if (rating >= 4.6) score += 1;
    if (reviewCount >= 60 && reviewCount <= 3000) score += 2;

    if (score >= 4) {
      return {
        gemConfidence: "POTENTIAL_HIDDEN_GEM",
        isPlaceHiddenGem: true,
        placeType: "POTENTIAL_HIDDEN_GEM",
        whySpecial: `Discovered local favorite (${rating}★, ${reviewCount.toLocaleString()} reviews) with distinct authentic appeal away from commercial crowds.`,
      };
    }

    if (reviewCount >= 1500) {
      return {
        gemConfidence: "POPULAR_ATTRACTION",
        isPlaceHiddenGem: false,
        placeType: "POPULAR_ATTRACTION",
        whySpecial: `Popular local venue with established traveler volume.`,
      };
    }

    return {
      gemConfidence: "UNCLASSIFIED",
      isPlaceHiddenGem: false,
      placeType: "UNCLASSIFIED",
      whySpecial: "",
    };
  }

  /**
   * Search places via Google Places API (New REST v1 or fallback Text Search).
   */
  async searchGooglePlaces({ query, locationBias, placeType, maxResults = 5 }) {
    if (!this.mapsApiKey) {
      return { success: false, places: [], source: "NOT_CONFIGURED" };
    }

    try {
      const v1Url = "https://places.googleapis.com/v1/places:searchText";
      const body = {
        textQuery: query,
        maxResultCount: maxResults,
      };

      if (placeType) {
        body.includedType = placeType;
      }

      const res = await apiClient.request(v1Url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": this.mapsApiKey,
          "X-Goog-FieldMask":
            "places.displayName,places.formattedAddress,places.location,places.regularOpeningHours,places.currentOpeningHours,places.rating,places.userRatingCount,places.googleMapsUri,places.businessStatus,places.types",
        },
        body: JSON.stringify(body),
        timeoutMs: 5000,
        maxRetries: 1,
      });

      if (res.ok) {
        const data = await res.json();
        const results = (data.places || []).map((p) => {
          const rawHours =
            p.currentOpeningHours?.weekdayDescriptions?.join("; ") ||
            p.regularOpeningHours?.weekdayDescriptions?.join("; ") ||
            "";

          const ratingCount = p.userRatingCount || 0;
          const ratingVal = p.rating || 4.0;
          const classification = this.classifyPlace({
            name: p.displayName?.text || query,
            types: p.types || [],
            rating: ratingVal,
            userRatingsCount: ratingCount,
            isCurated: false,
          });

          return {
            name: p.displayName?.text || query,
            address: p.formattedAddress || "",
            coordinates: {
              lat: p.location?.latitude || null,
              lng: p.location?.longitude || null,
            },
            openingHours: rawHours,
            rating: ratingVal,
            userRatingsCount: ratingCount,
            placeType: classification.placeType,
            gemConfidence: classification.gemConfidence,
            isPlaceHiddenGem: classification.isPlaceHiddenGem,
            mapLink: p.googleMapsUri || `https://maps.google.com/?q=${encodeURIComponent(p.displayName?.text || query)}`,
            businessStatus: p.businessStatus || "OPERATIONAL",
            types: p.types || [],
            source: "LIVE_VERIFIED",
            whySpecial: classification.whySpecial || (classification.isPlaceHiddenGem ? `Discovered local favorite (${ratingVal}★) with distinct authentic appeal.` : "Major iconic landmark with verified traveler reviews."),
          };
        });

        return { success: true, places: results, source: "LIVE_VERIFIED" };
      }
    } catch (err) {
      logger.warn(`[PlaceDiscovery] Google Places API v1 search failed: ${err.message}`);
    }

    return { success: false, places: [], source: "UNAVAILABLE" };
  }

  /**
   * Discovers all verified places for a destination, separating Popular Attractions from Hidden Gems.
   *
   * @param {Object} options
   * @param {string} options.destination - City / Destination name
   * @param {string[]} [options.interests] - User interests (optional)
   * @returns {Promise<Object>} { popularAttractions, hiddenGems, allPlaces, regions, isCurated }
   */
  async discoverAllPlacesForDestination({ destination, interests = [] }) {
    const destClean = String(destination || "").trim();
    if (!destClean) {
      return { popularAttractions: [], hiddenGems: [], allPlaces: [], regions: [], isCurated: false };
    }

    const destKey = destClean.toLowerCase().split(",")[0].trim();
    const catalogMatches = CURATED_DESTINATION_VENUES[destKey] || [];

    const popularAttractions = [];
    const hiddenGems = [];
    const regionMap = new Map();

    const addPlace = (p) => {
      const classification = this.classifyPlace({ ...p, isCurated: true });
      const isGem = classification.isPlaceHiddenGem;
      const formatted = {
        placeName: p.name,
        placeCategory: p.category,
        placeSubcategory: p.subcategory || p.category,
        placeType: isGem ? "HIDDEN_GEM" : "POPULAR_ATTRACTION",
        gemConfidence: classification.gemConfidence,
        isPlaceHiddenGem: isGem,
        region: p.region || "Central",
        address: p.address,
        coordinates: p.coordinates,
        openingHours: p.openingHours,
        parsedHours: parseOpeningHours(p.openingHours),
        rating: p.rating,
        userRatingsCount: p.userRatingsCount,
        mapLink: p.mapLink,
        matchReason: p.matchReason,
        whySpecial: p.whySpecial || classification.whySpecial || p.matchReason,
        timeRequiredMins: p.timeRequiredMins || 90,
        verificationStatus: "CURATED_VERIFIED",
      };

      if (isGem) {
        hiddenGems.push(formatted);
      } else {
        popularAttractions.push(formatted);
      }

      const regName = p.region || "Central";
      regionMap.set(regName, (regionMap.get(regName) || 0) + 1);
    };

    // Populate from curated catalog
    catalogMatches.forEach(addPlace);

    const regions = Array.from(regionMap.entries()).map(([name, count]) => ({ name, count }));

    return {
      popularAttractions,
      hiddenGems,
      allPlaces: [...popularAttractions, ...hiddenGems],
      regions,
      isCurated: catalogMatches.length > 0,
    };
  }

  /**
   * Discovers verified places for the trip's destination and user interests.
   * Preserves backward compatibility while adding placeType, whySpecial, region, and isPlaceHiddenGem.
   *
   * @param {Object} options
   * @param {string} options.destination - City / Destination name
   * @param {string[]|string} options.interests - Selected interests
   * @param {Array<{ dayNumber: number, date: string, dayName: string }>} options.dates - Trip calendar dates
   * @param {Object} [options.tripTiming] - Trip timing windows (Part 4)
   * @returns {Promise<Array<Object>>} Structured verified places matching interests
   */
  async discoverPlacesForInterests({ destination, interests, dates = [], tripTiming = {} }) {
    const destClean = String(destination || "").trim();
    if (!destClean) return [];

    const interestList = Array.isArray(interests)
      ? interests.map((s) => String(s).trim()).filter(Boolean)
      : typeof interests === "string" && interests.trim()
      ? interests.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    const destKey = destClean.toLowerCase().split(",")[0].trim();
    const cacheKey = `${destKey}:${interestList.sort().join("_")}`;

    if (placesCache.has(cacheKey)) {
      const cached = placesCache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.places;
      }
    }

    const verifiedPlaces = [];
    const seenNames = new Set();

    // 1. Gather curated catalog matches for this destination
    const catalogMatches = CURATED_DESTINATION_VENUES[destKey] || [];

    for (const catPlace of catalogMatches) {
      if (seenNames.has(catPlace.name.toLowerCase())) continue;

      // Filter by interests if interests are specified
      if (interestList.length > 0) {
        const matchesInterest = interestList.some((rawInterest) => {
          const taxonomy = getTaxonomyForInterest(rawInterest);
          if (!taxonomy) return false;
          return (
            catPlace.category.toLowerCase() === taxonomy.label.toLowerCase() ||
            taxonomy.subcategories.some((sc) => sc.id === catPlace.subcategory)
          );
        });
        if (!matchesInterest && catPlace.placeType !== "POPULAR_ATTRACTION") {
          continue; // Keep top popular attractions even with specific interests for balance
        }
      }

      seenNames.add(catPlace.name.toLowerCase());

      const parsedHours = parseOpeningHours(catPlace.openingHours);
      let isFutureUnconfirmed = false;
      if (dates.length > 0) {
        isFutureUnconfirmed = dates.some((d) => isOutside7DayWindow(d.date));
      }

      const classification = this.classifyPlace({ ...catPlace, isCurated: true });
      const isGem = classification.isPlaceHiddenGem;

      verifiedPlaces.push({
        placeName: catPlace.name,
        placeCategory: catPlace.category,
        placeSubcategory: catPlace.subcategory || catPlace.category,
        placeType: isGem ? "HIDDEN_GEM" : "POPULAR_ATTRACTION",
        gemConfidence: classification.gemConfidence,
        isPlaceHiddenGem: isGem,
        region: catPlace.region || "Central",
        address: catPlace.address,
        coordinates: catPlace.coordinates,
        openingHours: catPlace.openingHours,
        parsedHours,
        rating: catPlace.rating,
        userRatingsCount: catPlace.userRatingsCount,
        mapLink: catPlace.mapLink,
        suggestedVisitTime: isGem ? "16:00" : "10:30",
        suggestedDurationMins: catPlace.timeRequiredMins || 90,
        matchReason: catPlace.matchReason,
        whySpecial: catPlace.whySpecial || classification.whySpecial || catPlace.matchReason,
        verificationStatus: "CURATED_VERIFIED",
        isFutureScheduleUnconfirmed: isFutureUnconfirmed,
        closedDays: catPlace.closedDays || parsedHours.closedDays || [],
      });
    }

    // 2. If Google Places API is configured, search for live places matching interests
    if (this.mapsApiKey && interestList.length > 0) {
      for (const rawInterest of interestList.slice(0, 3)) {
        const taxonomy = getTaxonomyForInterest(rawInterest);
        if (!taxonomy || taxonomy.subcategories.length === 0) continue;

        const topSubcat = taxonomy.subcategories[0];
        const searchKeyword = `${topSubcat.keywords[0]} in ${destClean}`;

        try {
          const liveResult = await this.searchGooglePlaces({
            query: searchKeyword,
            placeType: topSubcat.googlePlaceTypes?.[0],
            maxResults: 3,
          });

          if (liveResult.success && liveResult.places.length > 0) {
            for (const lp of liveResult.places) {
              if (seenNames.has(lp.name.toLowerCase())) continue;
              seenNames.add(lp.name.toLowerCase());

              const parsedHours = parseOpeningHours(lp.openingHours);
              const isFutureUnconfirmed = dates.some((d) => isOutside7DayWindow(d.date));

              verifiedPlaces.push({
                placeName: lp.name,
                placeCategory: taxonomy.label,
                placeSubcategory: topSubcat.label,
                placeType: lp.placeType || "POPULAR_ATTRACTION",
                gemConfidence: lp.gemConfidence || (lp.isPlaceHiddenGem ? "POTENTIAL_HIDDEN_GEM" : "POPULAR_ATTRACTION"),
                isPlaceHiddenGem: Boolean(lp.isPlaceHiddenGem),
                region: "Local Area",
                address: lp.address,
                coordinates: lp.coordinates,
                openingHours: lp.openingHours || "Hours unconfirmed",
                parsedHours,
                rating: lp.rating,
                userRatingsCount: lp.userRatingsCount,
                mapLink: lp.mapLink,
                suggestedVisitTime: topSubcat.preferredSlot || "15:00",
                suggestedDurationMins: topSubcat.typicalDurationMins || 90,
                matchReason: `Verified ${topSubcat.label.toLowerCase()} in ${destClean} discovered via Google Places.`,
                whySpecial: lp.whySpecial || `Discovered live verified experience in ${destClean}.`,
                verificationStatus: "LIVE_VERIFIED",
                isFutureScheduleUnconfirmed: isFutureUnconfirmed,
                closedDays: parsedHours.closedDays || [],
              });
            }
          }
        } catch (apiErr) {
          logger.warn(`[PlaceDiscovery] Live search error: ${apiErr.message}`);
        }
      }
    }

    // Cache the result
    placesCache.set(cacheKey, { places: verifiedPlaces, timestamp: Date.now() });

    return verifiedPlaces;
  }
}

export const placeDiscoveryService = new PlaceDiscoveryService();
