import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";
import { isForeignOrigin } from "@/lib/utils/csrf";

/**
 * GET /api/geo/places/enrich?name=BookStore&lat=51.5&lng=-0.1
 *
 * Enriches OSM place data with Google Places API
 * Returns: photo, rating, review count, hours, website
 */
export async function GET(request: NextRequest) {
  // Block cross-site requests farming this paid-API proxy
  if (isForeignOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Rate limit by IP (20 requests per minute - Google API is expensive)
  const ip = getClientIp(request);
  const { allowed } = await checkRateLimit(`places-enrich:${ip}`, 20, 60000);

  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  // Daily backstop (200 requests per day)
  const daily = await checkRateLimit(`places-enrich-daily:${ip}`, 200, 86400000);

  if (!daily.allowed) {
    return NextResponse.json(
      { error: "Daily limit reached." },
      { status: 429 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const name = searchParams.get("name");
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const osmId = searchParams.get("osm_id");

  if (!name || !lat || !lng) {
    return NextResponse.json(
      { error: "name, lat, and lng are required" },
      { status: 400 }
    );
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { found: false, reason: "Google Places API not configured" },
      { status: 200 }
    );
  }

  // Check cache first
  const cacheKey = osmId || `${name}-${lat}-${lng}`;
  const cached = await getCachedEnrichment(cacheKey);
  if (cached) {
    return NextResponse.json(cached, {
      headers: { "X-Cache": "HIT" },
    });
  }

  try {
    // Search for place using Google Places Text Search
    const searchUrl = "https://places.googleapis.com/v1/places:searchText";
    const searchRes = await fetch(searchUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.photos,places.regularOpeningHours,places.websiteUri,places.googleMapsUri",
      },
      body: JSON.stringify({
        textQuery: name,
        locationBias: {
          circle: {
            center: { latitude: parseFloat(lat), longitude: parseFloat(lng) },
            radius: 500,
          },
        },
        maxResultCount: 1,
      }),
    });

    if (!searchRes.ok) {
      console.error("Google Places API error:", await searchRes.text());
      return NextResponse.json({ found: false, reason: "API error" });
    }

    const data = await searchRes.json();
    const place = data.places?.[0];

    if (!place) {
      return NextResponse.json({ found: false, reason: "Place not found" });
    }

    // Build photo URL if available
    let photoUrl = null;
    if (place.photos?.[0]?.name) {
      photoUrl = `https://places.googleapis.com/v1/${place.photos[0].name}/media?key=${apiKey}&maxWidthPx=400`;
    }

    const result = {
      found: true,
      googlePlaceId: place.id,
      name: place.displayName?.text || name,
      address: place.formattedAddress,
      rating: place.rating,
      reviewCount: place.userRatingCount,
      photoUrl,
      hours: place.regularOpeningHours?.weekdayDescriptions,
      website: place.websiteUri,
      googleMapsUrl: place.googleMapsUri,
    };

    // Cache the result
    await cacheEnrichment(cacheKey, result);

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
        "X-Cache": "MISS",
      },
    });
  } catch (error) {
    console.error("Error enriching place:", error);
    return NextResponse.json({ found: false, reason: "Error fetching data" });
  }
}

// Simple in-memory cache (resets on server restart)
const memoryCache = new Map<string, { data: Record<string, unknown>; expiresAt: number }>();

/**
 * Get cached enrichment data from memory
 */
async function getCachedEnrichment(
  cacheKey: string
): Promise<Record<string, unknown> | null> {
  const cached = memoryCache.get(cacheKey);
  if (!cached) return null;

  // Check if expired
  if (Date.now() > cached.expiresAt) {
    memoryCache.delete(cacheKey);
    return null;
  }

  return cached.data;
}

/**
 * Cache enrichment data in memory (1 hour TTL)
 */
async function cacheEnrichment(
  cacheKey: string,
  data: Record<string, unknown>
): Promise<void> {
  memoryCache.set(cacheKey, {
    data,
    expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour
  });

  // Clean up old entries (keep cache under 1000 entries)
  if (memoryCache.size > 1000) {
    const oldestKey = memoryCache.keys().next().value;
    if (oldestKey) memoryCache.delete(oldestKey);
  }
}
