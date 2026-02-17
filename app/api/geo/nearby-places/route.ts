import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";
import { encodeGeohash, isValidGeohash, getNeighbors } from "@/lib/utils/geohash";
import { createPublicClient } from "@/lib/supabase/server";
import {
  getMatrix,
  isMcpConfigured,
} from "@/lib/services/mapbox-mcp";
import { isOpenNow } from "@/lib/utils/opening-hours";

interface NearbyPlace {
  id: string;
  name: string;
  type: string;
  address: string | null;
  lat: number;
  lng: number;
  distance: number | null; // meters (straight line)
  walking_time: number | null; // minutes
  driving_time: number | null; // minutes
  is_open: boolean | null;
  source: "community" | "osm";
  checkin_count?: number;
}

/**
 * GET /api/geo/nearby-places?lat=40.7128&lng=-74.0060&limit=3
 *
 * Get nearby literary places with travel times using Mapbox MCP
 * Used by the dashboard "Places Near You" widget
 */
export async function GET(request: NextRequest) {
  // Rate limit by IP (30 requests per minute)
  const ip = getClientIp(request);
  const { allowed } = await checkRateLimit(`geo-nearby:${ip}`, 30, 60000);

  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  const searchParams = request.nextUrl.searchParams;

  // Parse coordinates
  const lat = parseFloat(searchParams.get("lat") || "");
  const lng = parseFloat(searchParams.get("lng") || "");
  const limit = Math.min(parseInt(searchParams.get("limit") || "3", 10), 10);

  // Validate coordinates
  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json(
      { error: "Invalid coordinates. Required: lat, lng" },
      { status: 400 }
    );
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return NextResponse.json(
      { error: "Coordinates out of valid range" },
      { status: 400 }
    );
  }

  try {
    const supabase = createPublicClient();

    // Encode user location to geohash (precision 5 covers ~2.4km area)
    const userGeohash = encodeGeohash(lat, lng, 5);
    if (!isValidGeohash(userGeohash)) {
      return NextResponse.json(
        { error: "Could not encode location" },
        { status: 400 }
      );
    }

    // Get neighboring cells for search
    const searchHashes = getNeighbors(userGeohash);
    const patterns = searchHashes.map((h) => `${h}%`);

    // Fetch community places
    const { data: communityPlaces } = await supabase
      .from("places")
      .select("id, name, place_type, address, lat, lng, opening_hours")
      .or(patterns.map((p) => `geohash.like.${p}`).join(","))
      .not("lat", "is", null)
      .not("lng", "is", null)
      .limit(20);

    // Fetch cached OSM places
    const { data: cachedData } = await supabase
      .from("places_cache")
      .select("data")
      .in("geohash_prefix", searchHashes.map((h) => h.slice(0, 4)))
      .in("place_type", ["bookstore", "library", "cafe"]);

    // Combine and deduplicate places
    const allPlaces: Array<{
      id: string;
      name: string;
      type: string;
      address: string | null;
      lat: number;
      lng: number;
      opening_hours?: string;
      source: "community" | "osm";
    }> = [];

    // Add community places
    if (communityPlaces) {
      for (const p of communityPlaces) {
        if (p.lat && p.lng) {
          allPlaces.push({
            id: p.id,
            name: p.name,
            type: p.place_type,
            address: p.address,
            lat: p.lat,
            lng: p.lng,
            opening_hours: p.opening_hours,
            source: "community",
          });
        }
      }
    }

    // Add OSM places from cache (avoid duplicates by name)
    if (cachedData) {
      const communityNames = new Set(allPlaces.map((p) => p.name.toLowerCase()));
      for (const cache of cachedData) {
        interface CachedPlace {
          osm_id: number;
          name: string;
          type: string;
          lat: number;
          lng: number;
          address?: string;
          tags?: Record<string, string>;
        }
        const places = (cache.data as CachedPlace[]) || [];
        for (const p of places) {
          if (!communityNames.has(p.name.toLowerCase())) {
            allPlaces.push({
              id: `osm-${p.osm_id}`,
              name: p.name,
              type: p.type,
              address: p.address || null,
              lat: p.lat,
              lng: p.lng,
              opening_hours: p.tags?.opening_hours,
              source: "osm",
            });
          }
        }
      }
    }

    if (allPlaces.length === 0) {
      return NextResponse.json(
        { places: [], message: "No places found nearby" },
        {
          headers: {
            "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
          },
        }
      );
    }

    // Calculate straight-line distance and sort by proximity
    const placesWithDistance = allPlaces
      .map((p) => ({
        ...p,
        distance: calculateDistance(lat, lng, p.lat, p.lng),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit * 2); // Get more than needed for matrix calculation

    // Get travel times using Mapbox MCP if configured
    let travelTimes: Map<string, { walking: number; driving: number }> | null =
      null;

    if (isMcpConfigured() && placesWithDistance.length > 0) {
      const origins = [{ lat, lng }];
      const destinations = placesWithDistance.map((p) => ({
        lat: p.lat,
        lng: p.lng,
      }));

      // Fetch walking and driving times in parallel
      const [walkingMatrix, drivingMatrix] = await Promise.all([
        getMatrix(origins, destinations, "walking"),
        getMatrix(origins, destinations, "driving"),
      ]);

      if (walkingMatrix || drivingMatrix) {
        travelTimes = new Map();
        placesWithDistance.forEach((p, i) => {
          const walkingEntry = walkingMatrix?.entries.find(
            (e) => e.destination_index === i
          );
          const drivingEntry = drivingMatrix?.entries.find(
            (e) => e.destination_index === i
          );
          travelTimes!.set(p.id, {
            walking: walkingEntry ? Math.round(walkingEntry.duration / 60) : 0,
            driving: drivingEntry ? Math.round(drivingEntry.duration / 60) : 0,
          });
        });
      }
    }

    // Sort by walking time if available, otherwise by distance
    const sortedPlaces = [...placesWithDistance];
    if (travelTimes) {
      sortedPlaces.sort((a, b) => {
        const aTime = travelTimes!.get(a.id)?.walking || Infinity;
        const bTime = travelTimes!.get(b.id)?.walking || Infinity;
        return aTime - bTime;
      });
    }

    // Build final response
    const nearbyPlaces: NearbyPlace[] = sortedPlaces.slice(0, limit).map((p) => {
      const times = travelTimes?.get(p.id);
      const openStatus = isOpenNow(p.opening_hours ?? null);

      return {
        id: p.id,
        name: p.name,
        type: p.type,
        address: p.address,
        lat: p.lat,
        lng: p.lng,
        distance: Math.round(p.distance),
        walking_time: times?.walking || null,
        driving_time: times?.driving || null,
        is_open: openStatus?.isOpen ?? null,
        source: p.source,
      };
    });

    return NextResponse.json(
      { places: nearbyPlaces },
      {
        headers: {
          // Cache for 5 minutes
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    console.error("Error fetching nearby places:", error);
    return NextResponse.json(
      { error: "Failed to fetch nearby places" },
      { status: 500 }
    );
  }
}

/**
 * Calculate straight-line distance between two points (Haversine formula)
 * Returns distance in meters
 */
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}
