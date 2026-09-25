import { logger } from "../../utils/logger.js";

/**
 * In-memory cache for destination images.
 * Key: normalized destination name
 * Value: { data: HeroImageObject, expiresAt: number }
 */
const imageCache = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Canonical destination dictionary for common aliases and misspellings.
 */
const CANONICAL_ALIASES = {
  // Varanasi
  kashi: "Varanasi",
  banaras: "Varanasi",
  benares: "Varanasi",
  benaras: "Varanasi",
  // Nashik
  nasik: "Nashik",
  naashik: "Nashik",
  // Bengaluru
  bangalore: "Bengaluru",
  banglore: "Bengaluru",
  bengalore: "Bengaluru",
  // Mumbai
  bombay: "Mumbai",
  mumabi: "Mumbai",
  mumbi: "Mumbai",
  // Delhi
  deli: "Delhi",
  dehli: "Delhi",
  "new delhi": "Delhi",
  "delhi ncr": "Delhi",
  // Kolkata
  calcutta: "Kolkata",
  kolkatta: "Kolkata",
  // Chennai
  madras: "Chennai",
  // Pune
  poona: "Pune",
  // Ahmedabad
  amhedabad: "Ahmedabad",
  ahmadabad: "Ahmedabad",
  // Trivandrum
  trivandrum: "Thiruvananthapuram",
  // Kochi
  cochin: "Kochi",
  // Panaji / Goa
  panjim: "Panaji",
  "north goa": "Goa",
  "south goa": "Goa",
  // Leh / Ladakh
  ladakh: "Leh",
  // Mysore
  mysuru: "Mysore",
  // Pondicherry
  pondicherry: "Puducherry",
  pondy: "Puducherry",
};

/**
 * Curated high-res landscape images for top destinations.
 * Used as a verified tier or fast fallback.
 */
const CURATED_DESTINATION_IMAGES = {
  varanasi: {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Varanasi%2C_India%2C_Ghats.jpg/1280px-Varanasi%2C_India%2C_Ghats.jpg",
    destination: "Varanasi",
    source: "wikimedia",
    photographer: "Wikimedia Commons",
    attributionUrl: "https://en.wikipedia.org/wiki/Varanasi",
  },
  nashik: {
    url: "https://upload.wikimedia.org/wikipedia/commons/6/6a/NashikViewfromPandavLeni.jpg",
    destination: "Nashik",
    source: "wikimedia",
    photographer: "Wikimedia Commons",
    attributionUrl: "https://en.wikipedia.org/wiki/Nashik",
  },
  jaipur: {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/East_facade_Hawa_Mahal_Jaipur_from_ground_level_%28July_2022%29_-_img_01.jpg/1280px-East_facade_Hawa_Mahal_Jaipur_from_ground_level_%28July_2022%29_-_img_01.jpg",
    destination: "Jaipur",
    source: "wikimedia",
    photographer: "Wikimedia Commons",
    attributionUrl: "https://en.wikipedia.org/wiki/Jaipur",
  },
  goa: {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fc/BeachFun.jpg/1280px-BeachFun.jpg",
    destination: "Goa",
    source: "wikimedia",
    photographer: "Wikimedia Commons",
    attributionUrl: "https://en.wikipedia.org/wiki/Goa",
  },
  mumbai: {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2b/Mumbai_Bandra-Worli_Sea_Link_03-2016_img3.jpg/1280px-Mumbai_Bandra-Worli_Sea_Link_03-2016_img3.jpg",
    destination: "Mumbai",
    source: "wikimedia",
    photographer: "Wikimedia Commons",
    attributionUrl: "https://en.wikipedia.org/wiki/Mumbai",
  },
  delhi: {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Jama_Masjid_2011.jpg/1280px-Jama_Masjid_2011.jpg",
    destination: "Delhi",
    source: "wikimedia",
    photographer: "Wikimedia Commons",
    attributionUrl: "https://en.wikipedia.org/wiki/Delhi",
  },
  pune: {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Pune_West_skyline_-_Mar_2020.jpg/1280px-Pune_West_skyline_-_Mar_2020.jpg",
    destination: "Pune",
    source: "wikimedia",
    photographer: "Wikimedia Commons",
    attributionUrl: "https://en.wikipedia.org/wiki/Pune",
  },
  hyderabad: {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/Aerial_view_of_Durgam_cheruvu_cable_bridge.jpg/1280px-Aerial_view_of_Durgam_cheruvu_cable_bridge.jpg",
    destination: "Hyderabad",
    source: "wikimedia",
    photographer: "Wikimedia Commons",
    attributionUrl: "https://en.wikipedia.org/wiki/Hyderabad",
  },
  udaipur: {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Evening_view%2C_City_Palace%2C_Udaipur.jpg/1280px-Evening_view%2C_City_Palace%2C_Udaipur.jpg",
    destination: "Udaipur",
    source: "wikimedia",
    photographer: "Wikimedia Commons",
    attributionUrl: "https://en.wikipedia.org/wiki/Udaipur",
  },
  bengaluru: {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/View_from_Visvesvaraya_Towers_Bangalore.jpg/1280px-View_from_Visvesvaraya_Towers_Bangalore.jpg",
    destination: "Bengaluru",
    source: "wikimedia",
    photographer: "Wikimedia Commons",
    attributionUrl: "https://en.wikipedia.org/wiki/Bangalore",
  },
  agra: {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Taj_Mahal_%28Edited%29.jpeg/1280px-Taj_Mahal_%28Edited%29.jpeg",
    destination: "Agra",
    source: "wikimedia",
    photographer: "Wikimedia Commons",
    attributionUrl: "https://en.wikipedia.org/wiki/Agra",
  },
  manali: {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Manali_City.jpg/1280px-Manali_City.jpg",
    destination: "Manali",
    source: "wikimedia",
    photographer: "Wikimedia Commons",
    attributionUrl: "https://en.wikipedia.org/wiki/Manali,_Himachal_Pradesh",
  },
  shimla: {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Shimla_Ridge_Evening.jpg/1280px-Shimla_Ridge_Evening.jpg",
    destination: "Shimla",
    source: "wikimedia",
    photographer: "Wikimedia Commons",
    attributionUrl: "https://en.wikipedia.org/wiki/Shimla",
  },
  amritsar: {
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/The_Golden_Temple_of_Amritsar_01.jpg/1280px-The_Golden_Temple_of_Amritsar_01.jpg",
    destination: "Amritsar",
    source: "wikimedia",
    photographer: "Wikimedia Commons",
    attributionUrl: "https://en.wikipedia.org/wiki/Amritsar",
  },
};

/**
 * Universal neutral travel landscape placeholder.
 * Used ONLY when no destination photo can be found.
 */
const NEUTRAL_TRAVEL_PLACEHOLDER = {
  url: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1600&q=80&auto=format&fit=crop",
  destination: "Travel",
  source: "placeholder",
  photographer: "Advenza Travel",
  attributionUrl: "https://unsplash.com",
};

/**
 * Normalizes a destination string by stripping state/country suffixes
 * and resolving known variations without merging distinct cities.
 *
 * Examples:
 * "Varanasi, Uttar Pradesh" -> "Varanasi"
 * "Banaras" -> "Varanasi"
 * "Kashi" -> "Varanasi"
 * "Nashik, Maharashtra, India" -> "Nashik"
 * "Jaipur, Rajasthan" -> "Jaipur"
 */
export function normalizeDestination(raw) {
  if (!raw || typeof raw !== "string") return "";

  // Split by comma and take primary city
  let primary = raw.split(",")[0].trim();

  // Remove common administrative prefixes/suffixes like "City", "District"
  primary = primary
    .replace(/\b(city|district|town|division|metropolitan area|d\.t|dt)\b/gi, "")
    .trim();

  const lower = primary.toLowerCase().replace(/\s+/g, " ");

  // Check alias dictionary
  if (CANONICAL_ALIASES[lower]) {
    return CANONICAL_ALIASES[lower];
  }

  // Capitalize primary city words
  return primary
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Fetches image from Wikipedia page image API.
 */
async function fetchFromWikipedia(destination) {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(
      destination
    )}&prop=pageimages|extracts&format=json&pithumbsize=1600&redirects=1`;

    const res = await fetch(url, {
      headers: {
        "User-Agent": "AdvenzaTravelApp/1.0 (contact@advenza.app)",
        Accept: "application/json",
      },
    });

    if (!res.ok) return null;

    const data = await res.json();
    const pages = data.query?.pages || {};
    const page = Object.values(pages)[0];

    if (page && page.thumbnail?.source && !page.thumbnail.source.includes("Flag_of") && !page.thumbnail.source.includes("Seal_of")) {
      return {
        url: page.thumbnail.source,
        destination,
        source: "wikimedia",
        photographer: "Wikimedia Commons",
        attributionUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title || destination)}`,
        fetchedAt: new Date(),
      };
    }
    return null;
  } catch (err) {
    logger.warn(`[DestinationImageService] Wikipedia API error for ${destination}: ${err.message}`);
    return null;
  }
}

/**
 * Fetches image from Wikimedia Commons search API.
 */
async function fetchFromWikimediaCommons(destination) {
  try {
    const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
      destination + " landmark panorama"
    )}&gsrnamespace=6&prop=imageinfo&iiprop=url|size|extmetadata&format=json&iiurlwidth=1600`;

    const res = await fetch(searchUrl, {
      headers: {
        "User-Agent": "AdvenzaTravelApp/1.0 (contact@advenza.app)",
        Accept: "application/json",
      },
    });

    if (!res.ok) return null;

    const data = await res.json();
    const pages = data.query?.pages || {};
    const pageList = Object.values(pages);

    for (const p of pageList) {
      const info = p.imageinfo?.[0];
      const thumb = info?.thumburl || info?.url;
      if (thumb && (thumb.endsWith(".jpg") || thumb.endsWith(".jpeg") || thumb.endsWith(".png") || thumb.includes(".jpg/") || thumb.includes(".jpeg/"))) {
        const rawArtist = info?.extmetadata?.Artist?.value || "Wikimedia Commons";
        const cleanArtist = rawArtist.replace(/<[^>]*>/g, "").trim().slice(0, 50) || "Wikimedia Commons";

        return {
          url: thumb,
          destination,
          source: "wikimedia",
          photographer: cleanArtist,
          attributionUrl: info?.descriptionshorturl || "https://commons.wikimedia.org",
          fetchedAt: new Date(),
        };
      }
    }
    return null;
  } catch (err) {
    logger.warn(`[DestinationImageService] Wikimedia Commons search error for ${destination}: ${err.message}`);
    return null;
  }
}

/**
 * Fetches image from Unsplash API if access key is available.
 */
async function fetchFromUnsplash(destination) {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) return null;

  try {
    const searchUrl = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(
      destination + " landmark"
    )}&orientation=landscape&per_page=1`;

    const res = await fetch(searchUrl, {
      headers: {
        Authorization: `Client-ID ${accessKey}`,
        "Accept-Version": "v1",
      },
    });

    if (!res.ok) return null;

    const data = await res.json();
    const photo = data.results?.[0];

    if (photo && photo.urls?.regular) {
      return {
        url: photo.urls.regular,
        destination,
        source: "unsplash",
        photographer: photo.user?.name || "Unsplash Photographer",
        photographerUrl: photo.user?.links?.html || "https://unsplash.com",
        attributionUrl: photo.links?.html || "https://unsplash.com",
        fetchedAt: new Date(),
      };
    }
    return null;
  } catch (err) {
    logger.warn(`[DestinationImageService] Unsplash API error for ${destination}: ${err.message}`);
    return null;
  }
}

/**
 * Primary public method to resolve a verified destination hero image.
 * Follows strict fallback hierarchy:
 * 1. In-memory cache
 * 2. Unsplash API (if configured)
 * 3. Wikipedia official page image
 * 4. Wikimedia Commons landmark search
 * 5. Curated destination registry
 * 6. Neutral travel landscape placeholder
 *
 * @param {string} rawDestination
 * @returns {Promise<{ url: string, destination: string, source: string, photographer: string, attributionUrl?: string, fetchedAt: Date }>}
 */
export async function fetchDestinationImage(rawDestination) {
  const destination = normalizeDestination(rawDestination);
  if (!destination) {
    return { ...NEUTRAL_TRAVEL_PLACEHOLDER, fetchedAt: new Date() };
  }

  const cacheKey = destination.toLowerCase();

  // Tier 1: Cache check
  const cached = imageCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  logger.info(`[DestinationImageService] Resolving image for destination: "${destination}"`);

  // Tier 2: Unsplash API (if key present)
  let result = await fetchFromUnsplash(destination);

  // Tier 3: Wikipedia Page Image (highest accuracy for city lead landmark)
  if (!result) {
    result = await fetchFromWikipedia(destination);
  }

  // Tier 4: Wikimedia Commons Landmark Search
  if (!result) {
    result = await fetchFromWikimediaCommons(destination);
  }

  // Tier 5: Curated Destination Registry
  if (!result && CURATED_DESTINATION_IMAGES[cacheKey]) {
    const curated = CURATED_DESTINATION_IMAGES[cacheKey];
    result = {
      ...curated,
      source: "curated",
      fetchedAt: new Date(),
    };
  }

  // Tier 6: Neutral Travel Placeholder
  if (!result) {
    logger.warn(`[DestinationImageService] No specific photo found for "${destination}". Using neutral placeholder.`);
    result = {
      ...NEUTRAL_TRAVEL_PLACEHOLDER,
      destination,
      fetchedAt: new Date(),
    };
  }

  // Store in cache
  imageCache.set(cacheKey, {
    data: result,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return result;
}

/**
 * Clears the image cache (useful for testing).
 */
export function clearDestinationImageCache() {
  imageCache.clear();
}
