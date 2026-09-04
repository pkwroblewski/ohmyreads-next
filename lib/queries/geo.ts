import { createClient, createPublicClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getNeighbors, isValidGeohash } from "@/lib/utils/geohash";
import { logError } from "@/lib/utils/log";
// ============================================
// TYPES
// ============================================

export type PresenceType = "temporary" | "recommended";

export interface CurrentlyReadingBook {
  id: string;
  title: string;
  author: string | null;
  cover_url: string | null;
  slug: string | null;
}

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
  currently_reading: CurrentlyReadingBook | null;
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
 * Returns users with active check-ins (temporary or recommended presence).
 * Includes currently reading book if available.
 *
 * The visibility rules — location sharing on, unexpired check-in,
 * discoverable, not disabled — live in the `get_nearby_readers()` RPC
 * (migration 065). The location / presence columns are not readable any
 * other way, so there is nothing to re-filter here.
 */
export async function getNearbyReaders(
  geohashPrefix: string,
  limit: number = 50
): Promise<NearbyReader[]> {
  if (!geohashPrefix || !isValidGeohash(geohashPrefix)) {
    return [];
  }

  const supabase = createPublicClient();

  // The searched cell plus its surrounding cells, so a reader just across a
  // cell boundary is still found
  const searchHashes = getNeighbors(geohashPrefix);

  const { data, error } = await supabase.rpc("get_nearby_readers", {
    p_prefixes: searchHashes,
    p_limit: limit,
  });

  if (error) {
    logError("Error fetching nearby readers", error);
    return [];
  }

  const validReaders = data ?? [];
  if (validReaders.length === 0) {
    return [];
  }

  // Fetch currently reading books for all readers
  const userIds = validReaders.map((r) => r.id);
  const { data: readingData } = await supabase
    .from("user_books")
    .select("user_id, book:books(id, title, author, cover_url, slug)")
    .in("user_id", userIds)
    .eq("status", "reading")
    .order("updated_at", { ascending: false });

  // Create a map of user_id -> first currently reading book
  const readingMap = new Map<string, CurrentlyReadingBook>();
  if (readingData) {
    for (const entry of readingData) {
      // Only keep the first (most recently updated) book per user
      if (!readingMap.has(entry.user_id) && entry.book) {
        const book = entry.book;
        readingMap.set(entry.user_id, {
          id: book.id,
          title: book.title,
          author: book.author,
          cover_url: book.cover_url,
          slug: book.slug,
        });
      }
    }
  }

  // Merge readers with their currently reading books
  // (presence_type is plain text in the DB; narrowed to the app union here)
  return validReaders.map((reader) => ({
    ...reader,
    currently_reading: readingMap.get(reader.id) || null,
  })) as NearbyReader[];
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
    logError("Error fetching nearby places", error);
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
    // JSON column round-trip, not a join: the row type is `Json`
    data: data.data as unknown as CachedPlaceData[],
    isStale,
  };
}

// ============================================
// USER LOCATION
// ============================================

/**
 * Get a user's location settings (for their own profile)
 *
 * Reads the caller's own row through `get_my_profile()`: since migration 065
 * the location columns cannot be selected directly. `userId` must be the
 * signed-in user; anyone else's settings come back as null.
 */
export async function getUserLocation(userId: string): Promise<{
  enabled: boolean;
  geohash: string | null;
  label: string | null;
  precision: number;
} | null> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_my_profile").maybeSingle();

  if (error || !data || data.id !== userId) {
    return null;
  }

  return {
    enabled: data.location_enabled || false,
    geohash: data.location_geohash,
    label: data.location_label,
    precision: data.location_precision || 6,
  };
}

