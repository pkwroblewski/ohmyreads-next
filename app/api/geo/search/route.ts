import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";
import { encodeGeohash } from "@/lib/utils/geohash";

// In-memory cache for geocoding results (simple, server-local)
const geocodeCache = new Map<string, { data: GeocodingResult[]; expires: number }>();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

interface NominatimResult {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
    country_code?: string;
  };
}

interface GeocodingResult {
  id: number;
  lat: number;
  lng: number;
  label: string;
  city: string | null;
  country: string | null;
  countryCode: string | null;
  geohash: string;
}

/**
 * GET /api/geo/search?q=Berlin
 * 
 * Search for cities/places using Nominatim (OSM geocoding).
 * Rate-limited and cached.
 */
export async function GET(request: NextRequest) {
  // Rate limit by IP (20 requests per minute)
  const ip = getClientIp(request);
  const { allowed } = await checkRateLimit(`geo-search:${ip}`, 20, 60000);
  
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q")?.trim();
  const viewbox = searchParams.get("viewbox"); // "west,north,east,south" for location bias

  if (!query || query.length < 2) {
    return NextResponse.json(
      { error: "Query must be at least 2 characters" },
      { status: 400 }
    );
  }

  // Cap query length
  const sanitizedQuery = query.slice(0, 100);
  // Include viewbox in cache key so location-biased searches are cached separately
  const cacheKey = `${sanitizedQuery.toLowerCase()}:${viewbox || "global"}`;

  // Check cache
  const cached = geocodeCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return NextResponse.json(
      { results: cached.data },
      { headers: { "X-Cache": "HIT" } }
    );
  }

  try {
    // Call Nominatim API
    const nominatimUrl = new URL("https://nominatim.openstreetmap.org/search");
    nominatimUrl.searchParams.set("q", sanitizedQuery);
    nominatimUrl.searchParams.set("format", "json");
    nominatimUrl.searchParams.set("addressdetails", "1");
    nominatimUrl.searchParams.set("limit", "8");
    // Prevent deduplication to get all matching places (e.g., multiple branches)
    nominatimUrl.searchParams.set("dedupe", "0");
    // Include POIs like cafes, bookstores (removed featuretype=city restriction)

    // Add location bias if viewbox is provided (west,north,east,south)
    if (viewbox) {
      nominatimUrl.searchParams.set("viewbox", viewbox);
      nominatimUrl.searchParams.set("bounded", "0"); // Prefer but don't restrict to viewbox
    }

    const response = await fetch(nominatimUrl.toString(), {
      headers: {
        "User-Agent": "OhMyReads/1.0 (book reading community)",
        "Accept-Language": "en",
      },
    });

    if (!response.ok) {
      throw new Error(`Nominatim API error: ${response.status}`);
    }

    const data: NominatimResult[] = await response.json();

    // Transform results
    const results: GeocodingResult[] = data.map((item) => {
      const lat = parseFloat(item.lat);
      const lng = parseFloat(item.lon);
      const city = item.address?.city || item.address?.town || item.address?.village || null;
      
      return {
        id: item.place_id,
        lat,
        lng,
        label: item.display_name,
        city,
        country: item.address?.country || null,
        countryCode: item.address?.country_code?.toUpperCase() || null,
        geohash: encodeGeohash(lat, lng, 6),
      };
    });

    // Cache results
    geocodeCache.set(cacheKey, {
      data: results,
      expires: Date.now() + CACHE_TTL,
    });

    // Clean old cache entries periodically
    if (geocodeCache.size > 1000) {
      const now = Date.now();
      for (const [key, value] of geocodeCache.entries()) {
        if (value.expires < now) {
          geocodeCache.delete(key);
        }
      }
    }

    return NextResponse.json(
      { results },
      {
        headers: {
          "X-Cache": "MISS",
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
        },
      }
    );
  } catch (error) {
    console.error("Geocoding error:", error);
    return NextResponse.json(
      { error: "Geocoding failed. Please try again." },
      { status: 500 }
    );
  }
}

