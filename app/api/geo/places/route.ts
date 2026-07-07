import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";
import { isValidGeohash, decodeGeohash } from "@/lib/utils/geohash";
import { getNearbyPlaces, getCachedPlaces, type CachedPlaceData } from "@/lib/queries/geo";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

// Valid place types for filtering
const VALID_TYPES = ["bookstore", "library", "cafe", "restaurant", "bookclub", "popup", "other"];
const OSM_TYPES = ["bookstore", "library", "cafe", "restaurant"];

// Simple in-memory rate limiter for Overpass API
// Overpass allows ~2 requests per second for anonymous users
let lastOverpassRequest = 0;
const OVERPASS_MIN_INTERVAL = 1500; // 1.5 seconds between requests

async function waitForOverpassSlot(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastOverpassRequest;
  if (elapsed < OVERPASS_MIN_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, OVERPASS_MIN_INTERVAL - elapsed));
  }
  lastOverpassRequest = Date.now();
}

/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in kilometers
 */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * GET /api/geo/places?geohash=u33d&types=bookstore,library,cafe
 * 
 * Get places near a geohash location.
 * Combines:
 * - Community-submitted places from our database
 * - OSM places from Overpass API (cached)
 */
export async function GET(request: NextRequest) {
  // Rate limit by IP (30 requests per minute - includes external API calls)
  const ip = getClientIp(request);
  const { allowed } = await checkRateLimit(`geo-places:${ip}`, 30, 60000);
  
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const geohash = searchParams.get("geohash")?.toLowerCase();
  const typesParam = searchParams.get("types");
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Math.min(parseInt(limitParam, 10), 100) : 50;

  // Validate geohash
  if (!geohash || geohash.length < 3 || !isValidGeohash(geohash)) {
    return NextResponse.json(
      { error: "Valid geohash of at least 3 characters required" },
      { status: 400 }
    );
  }

  // Parse and validate types
  const requestedTypes = typesParam
    ? typesParam.split(",").filter((t) => VALID_TYPES.includes(t))
    : VALID_TYPES;

  const osmTypesToFetch = requestedTypes.filter((t) => OSM_TYPES.includes(t));
  // Use the geohash as-is for precision (4 chars = ~20km, 5 = ~5km, 6 = ~1.2km)
  const searchPrefix = geohash;

  try {
    // Fetch community places from our DB
    const communityPlaces = await getNearbyPlaces(searchPrefix, requestedTypes, limit);

    // Calculate per-type limit to ensure fair distribution
    const perTypeLimit = Math.ceil(limit / Math.max(osmTypesToFetch.length, 1));

    // Fetch OSM places (from cache or Overpass)
    const osmPlaces: CachedPlaceData[] = [];

    for (const placeType of osmTypesToFetch) {
      const cached = await getCachedPlaces(searchPrefix, placeType);

      if (cached && !cached.isStale) {
        // Use cached data - apply per-type limit
        osmPlaces.push(...cached.data.slice(0, perTypeLimit));
      } else {
        // Fetch from Overpass and cache
        const freshData = await fetchFromOverpass(geohash, placeType);
        if (freshData.length > 0) {
          await cacheOsmPlaces(searchPrefix, placeType, freshData);
        }
        // Apply per-type limit
        osmPlaces.push(...freshData.slice(0, perTypeLimit));
      }
    }

    // Combine and format results
    const results = {
      community: communityPlaces.slice(0, limit).map((p) => ({
        id: p.id,
        name: p.name,
        type: p.place_type,
        source: "community" as const,
        address: p.address,
        city: p.city,
        lat: p.lat,
        lng: p.lng,
        website: p.website,
        description: p.description,
      })),
      osm: osmPlaces.slice(0, limit).map((p) => ({
        id: `osm-${p.osm_id}`,
        name: p.name,
        type: p.type,
        source: "osm" as const,
        address: p.address || null,
        lat: p.lat,
        lng: p.lng,
        // Extract all useful OSM tags
        website: p.tags?.website || p.tags?.["contact:website"] || null,
        phone: p.tags?.phone || p.tags?.["contact:phone"] || null,
        email: p.tags?.email || p.tags?.["contact:email"] || null,
        opening_hours: p.tags?.opening_hours || null,
        wheelchair: p.tags?.wheelchair || null,
        description: p.tags?.description || null,
        image: p.tags?.image || p.tags?.wikimedia_commons || null,
      })),
    };

    return NextResponse.json(results, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
      },
    });
  } catch (error) {
    console.error("Error fetching places:", error);
    return NextResponse.json(
      { error: "Failed to fetch places" },
      { status: 500 }
    );
  }
}

/**
 * Fetch places from Overpass API (OSM)
 */
async function fetchFromOverpass(
  geohash: string,
  placeType: string
): Promise<CachedPlaceData[]> {
  // Wait for rate limit slot before making request
  await waitForOverpassSlot();

  // Decode geohash to get bounding box
  const { lat: centerLat, lng: centerLng, latErr, lngErr } = decodeGeohash(geohash);

  // Create a bounding box - use 1.5x error for slight overlap, not 3x
  const bbox = {
    south: centerLat - latErr * 1.5,
    west: centerLng - lngErr * 1.5,
    north: centerLat + latErr * 1.5,
    east: centerLng + lngErr * 1.5,
  };

  // Map our types to OSM tags
  const osmQuery = getOsmQuery(placeType, bbox);

  // Overpass API servers (try in order if one fails)
  const OVERPASS_SERVERS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://z.overpass-api.de/api/interpreter",
  ];

  let data = null;

  for (const serverUrl of OVERPASS_SERVERS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000); // 8 second timeout per server

      const response = await fetch(serverUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `data=${encodeURIComponent(osmQuery)}`,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.ok) {
        data = await response.json();
        break; // Success, exit loop
      }
      console.error(`Overpass API error from ${serverUrl}: ${response.status}`);
    } catch (error) {
      console.error(`Overpass fetch error from ${serverUrl}:`, error);
    }
  }

  if (!data) {
    console.error("All Overpass servers failed");
    return [];
  }

  // Parse Overpass response
  const places: CachedPlaceData[] = [];

  for (const element of data.elements || []) {
    if (!element.tags?.name) continue;

    const lat = element.lat || element.center?.lat;
    const lng = element.lon || element.center?.lon;

    if (!lat || !lng) continue;

    places.push({
      osm_id: element.id,
      name: element.tags.name,
      type: placeType,
      lat,
      lng,
      address: formatOsmAddress(element.tags),
      tags: element.tags,
    });
  }

  // Sort by distance from center (closest first)
  places.sort((a, b) => {
    const distA = haversineDistance(centerLat, centerLng, a.lat, a.lng);
    const distB = haversineDistance(centerLat, centerLng, b.lat, b.lng);
    return distA - distB;
  });

  return places;
}

/**
 * Generate Overpass QL query for a place type
 */
function getOsmQuery(
  placeType: string,
  bbox: { south: number; west: number; north: number; east: number }
): string {
  const bboxStr = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  
  let tagQuery = "";
  switch (placeType) {
    case "bookstore":
      tagQuery = '["shop"="books"]';
      break;
    case "library":
      tagQuery = '["amenity"="library"]';
      break;
    case "cafe":
      tagQuery = '["amenity"="cafe"]';
      break;
    case "restaurant":
      tagQuery = '["amenity"="restaurant"]';
      break;
    default:
      return "";
  }

  return `
    [out:json][timeout:15];
    (
      node${tagQuery}(${bboxStr});
      way${tagQuery}(${bboxStr});
    );
    out center tags 200;
  `;
}

/**
 * Format OSM address tags into a readable string
 */
function formatOsmAddress(tags: Record<string, string>): string | undefined {
  const parts = [
    tags["addr:street"],
    tags["addr:housenumber"],
    tags["addr:city"],
    tags["addr:postcode"],
  ].filter(Boolean);
  
  return parts.length > 0 ? parts.join(", ") : undefined;
}

/**
 * Cache OSM places in the database
 */
async function cacheOsmPlaces(
  geohashPrefix: string,
  placeType: string,
  places: CachedPlaceData[]
): Promise<void> {
  try {
    const supabase = createAdminClient();
    
    await supabase
      .from("places_cache")
      .upsert({
        geohash_prefix: geohashPrefix,
        place_type: placeType,
        data: places as unknown as Json,
        fetched_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h
      }, {
        onConflict: "geohash_prefix,place_type",
      });
  } catch (error) {
    console.error("Error caching OSM places:", error);
  }
}

