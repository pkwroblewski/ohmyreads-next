import { createPublicClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getNeighbors, isValidGeohash } from "@/lib/utils/geohash";

// ============================================
// TYPES
// ============================================

export type PresenceType = "static" | "temporary" | "recommended";

export interface NearbyReader {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  location_label: string | null;
  location_geohash: string | null;
  presence_type: PresenceType | null;
  presence_expires_at: string | null;
  presence_note: string | null;
}

export interface Place {
  id: string;
  name: string;
  place_type: string;
  address: string | null;
  city: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  geohash: string | null;
  website: string | null;
  description: string | null;
}

export interface CachedPlaceData {
  osm_id: number;
  name: string;
  type: string;
  lat: number;
  lng: number;
  address?: string;
  tags?: Record<string, string>;
}

// ============================================
// READERS QUERY
// ============================================

/**
 * Get readers near a geohash location
 * Returns users who have opted in to location sharing.
 * Filters out expired temporary/recommended presence.
 */
export async function getNearbyReaders(
  geohashPrefix: string,
  limit: number = 50
): Promise<NearbyReader[]> {
  if (!geohashPrefix || !isValidGeohash(geohashPrefix)) {
    return [];
  }

  const supabase = createPublicClient();

  // Get all neighboring geohash cells to cover the area
  const searchHashes = getNeighbors(geohashPrefix);

  // Build LIKE patterns for each hash prefix
  const patterns = searchHashes.map(h => `${h}%`);

  // Query for users in any of the nearby cells
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, location_label, location_geohash, presence_type, presence_expires_at, presence_note")
    .eq("location_enabled", true)
    .not("location_geohash", "is", null)
    .or(patterns.map(p => `location_geohash.like.${p}`).join(","))
    .limit(limit);

  if (error) {
    console.error("Error fetching nearby readers:", error);
    return [];
  }

  if (!data) {
    return [];
  }

  // Filter out expired temporary/recommended presence
  const now = new Date();
  return data.filter((reader) => {
    // Static presence never expires
    if (!reader.presence_type || reader.presence_type === "static") {
      return true;
    }
    // Non-static presence must have a future expiry
    if (reader.presence_expires_at) {
      return new Date(reader.presence_expires_at) > now;
    }
    // If no expiry set but non-static, treat as expired
    return false;
  });
}

// ============================================
// COMMUNITY PLACES QUERY
// ============================================

/**
 * Get approved community places near a location
 */
export async function getNearbyPlaces(
  geohashPrefix: string,
  types?: string[],
  limit: number = 100
): Promise<Place[]> {
  if (!geohashPrefix || !isValidGeohash(geohashPrefix)) {
    return [];
  }

  const supabase = createPublicClient();
  
  // Get neighboring cells
  const searchHashes = getNeighbors(geohashPrefix);
  const patterns = searchHashes.map(h => `${h}%`);
  
  let query = supabase
    .from("places")
    .select("*")
    .or(patterns.map(p => `geohash.like.${p}`).join(","));
  
  // Filter by type if specified
  if (types && types.length > 0) {
    query = query.in("place_type", types);
  }
  
  const { data, error } = await query.limit(limit);

  if (error) {
    console.error("Error fetching nearby places:", error);
    return [];
  }

  return data || [];
}

// ============================================
// PLACES CACHE
// ============================================

/**
 * Get cached OSM places for a geohash prefix
 * Note: Uses admin client because places_cache has no public RLS policies (server-only)
 */
export async function getCachedPlaces(
  geohashPrefix: string,
  placeType: string
): Promise<{ data: CachedPlaceData[]; isStale: boolean } | null> {
  const supabase = createAdminClient();
  
  const { data, error } = await supabase
    .from("places_cache")
    .select("data, expires_at")
    .eq("geohash_prefix", geohashPrefix)
    .eq("place_type", placeType)
    .single();

  if (error || !data) {
    return null;
  }

  const isStale = new Date(data.expires_at) < new Date();
  return {
    data: data.data as CachedPlaceData[],
    isStale,
  };
}

/**
 * Save OSM places to cache
 * Note: This should be called from API routes using service role
 */
export async function savePlacesCache(
  geohashPrefix: string,
  placeType: string,
  places: CachedPlaceData[]
): Promise<boolean> {
  // This function will be called from API routes with admin client
  // The actual implementation is in the API route
  console.log(`Would cache ${places.length} ${placeType} places for ${geohashPrefix}`);
  return true;
}

// ============================================
// USER LOCATION
// ============================================

/**
 * Get a user's location settings (for their own profile)
 */
export async function getUserLocation(userId: string): Promise<{
  enabled: boolean;
  geohash: string | null;
  label: string | null;
  precision: number;
} | null> {
  const supabase = createPublicClient();
  
  const { data, error } = await supabase
    .from("profiles")
    .select("location_enabled, location_geohash, location_label, location_precision")
    .eq("id", userId)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    enabled: data.location_enabled || false,
    geohash: data.location_geohash,
    label: data.location_label,
    precision: data.location_precision || 6,
  };
}

