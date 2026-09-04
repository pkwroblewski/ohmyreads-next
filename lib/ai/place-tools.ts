import { tool, jsonSchema } from "ai";
import { createPublicClient } from "@/lib/supabase/server";
import { encodeGeohash, getNeighbors } from "@/lib/utils/geohash";
import { getDirections, getIsochrone, isMcpConfigured } from "@/lib/services/mapbox-mcp";
import { isOpenNow } from "@/lib/utils/opening-hours";
import { logError } from "@/lib/utils/log";

// Define schemas
const searchNearbyPlacesSchema = jsonSchema<{
  lat: number;
  lng: number;
  types?: string[];
  maxMinutes?: number;
  profile?: "walking" | "cycling" | "driving";
  limit?: number;
}>({
  type: "object",
  properties: {
    lat: {
      type: "number",
      description: "Latitude of the search center",
    },
    lng: {
      type: "number",
      description: "Longitude of the search center",
    },
    types: {
      type: "array",
      items: { type: "string" },
      description:
        "Filter by place types: 'bookstore', 'library', 'cafe'. If not specified, searches all types.",
    },
    maxMinutes: {
      type: "number",
      description:
        "Maximum travel time in minutes. Use this when user asks for places 'within X minutes walk/drive'.",
    },
    profile: {
      type: "string",
      enum: ["walking", "cycling", "driving"],
      description: "Transport mode for travel time calculation. Default is 'walking'.",
    },
    limit: {
      type: "number",
      description: "Maximum number of results. Default is 5.",
    },
  },
  required: ["lat", "lng"],
});

const getDirectionsToPlaceSchema = jsonSchema<{
  origin_lat: number;
  origin_lng: number;
  dest_lat: number;
  dest_lng: number;
  profile?: "walking" | "cycling" | "driving";
}>({
  type: "object",
  properties: {
    origin_lat: {
      type: "number",
      description: "Origin latitude (user's location)",
    },
    origin_lng: {
      type: "number",
      description: "Origin longitude (user's location)",
    },
    dest_lat: {
      type: "number",
      description: "Destination latitude (place's location)",
    },
    dest_lng: {
      type: "number",
      description: "Destination longitude (place's location)",
    },
    profile: {
      type: "string",
      enum: ["walking", "cycling", "driving"],
      description: "Transport mode. Default is 'walking'.",
    },
  },
  required: ["origin_lat", "origin_lng", "dest_lat", "dest_lng"],
});

/**
 * Search for nearby literary places (bookstores, libraries, cafes)
 */
export const searchNearbyPlacesTool = tool({
  description:
    "Search for nearby bookstores, libraries, and cafes. Use this when users ask about places near them. Can filter by type and travel time.",
  inputSchema: searchNearbyPlacesSchema,
  execute: async (params) => {
    const {
      lat,
      lng,
      types = ["bookstore", "library", "cafe"],
      maxMinutes,
      profile = "walking",
      limit = 5,
    } = params;

    const supabase = createPublicClient();
    const geohash = encodeGeohash(lat, lng, 5);
    const searchHashes = getNeighbors(geohash);
    const patterns = searchHashes.map((h) => `${h}%`);

    try {
      // Fetch community places
      let query = supabase
        .from("places")
        .select("id, name, place_type, address, lat, lng, website")
        .or(patterns.map((p) => `geohash.like.${p}`).join(","))
        .not("lat", "is", null)
        .not("lng", "is", null);

      if (types.length > 0) {
        query = query.in("place_type", types);
      }

      const { data: communityPlaces } = await query.limit(20);

      // Fetch cached OSM places
      const { data: cachedData } = await supabase
        .from("places_cache")
        .select("data")
        .in("geohash_prefix", searchHashes.map((h) => h.slice(0, 4)))
        .in("place_type", types);

      // Combine places
      const allPlaces: Array<{
        id: string;
        name: string;
        type: string;
        address: string | null;
        lat: number;
        lng: number;
        opening_hours?: string;
        website?: string;
        source: "community" | "osm";
      }> = [];

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
              website: p.website ?? undefined,
              source: "community",
            });
          }
        }
      }

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
          // JSON column round-trip, not a join: the row type is `Json`
          const places = (cache.data as unknown as CachedPlace[]) || [];
          for (const p of places) {
            if (!communityNames.has(p.name.toLowerCase()) && types.includes(p.type)) {
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

      // Calculate distances and sort
      const placesWithDistance = allPlaces
        .map((p) => ({
          ...p,
          distance: calculateDistance(lat, lng, p.lat, p.lng),
        }))
        .sort((a, b) => a.distance - b.distance);

      // If maxMinutes specified and MCP configured, use isochrone to filter
      let filteredPlaces = placesWithDistance;
      if (maxMinutes && isMcpConfigured()) {
        const isochrone = await getIsochrone({ lat, lng }, maxMinutes, profile);
        if (isochrone) {
          // Filter places within the isochrone polygon
          const polygon = isochrone.geometry.coordinates[0] as [number, number][];
          filteredPlaces = placesWithDistance.filter((p) =>
            isPointInPolygon([p.lng, p.lat], polygon)
          );
        }
      }

      // Build results
      const results = filteredPlaces.slice(0, limit).map((p) => {
        const openStatus = isOpenNow(p.opening_hours ?? null);
        return {
          id: p.id,
          name: p.name,
          type: p.type,
          address: p.address,
          distance_meters: Math.round(p.distance),
          distance_text:
            p.distance < 1000
              ? `${Math.round(p.distance)} m`
              : `${(p.distance / 1000).toFixed(1)} km`,
          is_open: openStatus?.isOpen ?? null,
          website: p.website,
          lat: p.lat,
          lng: p.lng,
        };
      });

      return {
        success: true,
        count: results.length,
        places: results,
        search_params: {
          types,
          maxMinutes: maxMinutes || null,
          profile,
        },
      };
    } catch (error) {
      logError("Error searching places", error);
      return { success: false, error: "Failed to search places", places: [] };
    }
  },
});

/**
 * Get directions to a place
 */
export const getDirectionsToPlaceTool = tool({
  description:
    "Get directions from user's location to a specific place. Returns walking/cycling/driving time and distance.",
  inputSchema: getDirectionsToPlaceSchema,
  execute: async (params) => {
    const { origin_lat, origin_lng, dest_lat, dest_lng, profile = "walking" } = params;

    if (!isMcpConfigured()) {
      return {
        success: false,
        error: "Directions service not available",
      };
    }

    try {
      const directions = await getDirections(
        { lat: origin_lat, lng: origin_lng },
        { lat: dest_lat, lng: dest_lng },
        profile
      );

      if (!directions) {
        return { success: false, error: "Could not calculate directions" };
      }

      return {
        success: true,
        profile,
        duration_seconds: directions.duration,
        duration_text: directions.duration_text,
        distance_meters: directions.distance,
        distance_text: directions.distance_text,
      };
    } catch (error) {
      logError("Error getting directions", error);
      return { success: false, error: "Failed to get directions" };
    }
  },
});

/**
 * All available tools for place search AI
 */
export const placeSearchTools = {
  searchNearbyPlaces: searchNearbyPlacesTool,
  getDirections: getDirectionsToPlaceTool,
};

// Helper functions
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

function isPointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0],
      yi = polygon[i][1];
    const xj = polygon[j][0],
      yj = polygon[j][1];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}
