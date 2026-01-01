/**
 * Mapbox MCP (Model Context Protocol) Service
 * Connects to Mapbox's hosted MCP server for geospatial AI capabilities
 * https://docs.mapbox.com/api/guides/mcp-server/
 */

const MCP_ENDPOINT = "https://mcp.mapbox.com/mcp";

// Transport profile types
export type TransportProfile = "walking" | "cycling" | "driving";

// Response types
export interface DirectionsResponse {
  duration: number; // seconds
  duration_text: string;
  distance: number; // meters
  distance_text: string;
  geometry?: string; // encoded polyline
  steps?: DirectionStep[];
}

export interface DirectionStep {
  instruction: string;
  distance: number;
  duration: number;
}

export interface IsochroneResponse {
  geometry: GeoJSON.Polygon;
  center: [number, number]; // [lng, lat]
  minutes: number;
  profile: TransportProfile;
}

export interface MatrixEntry {
  origin_index: number;
  destination_index: number;
  duration: number; // seconds
  distance: number; // meters
}

export interface MatrixResponse {
  origins: [number, number][];
  destinations: [number, number][];
  entries: MatrixEntry[];
}

export interface POIResult {
  id: string;
  name: string;
  address?: string;
  coordinates: [number, number]; // [lng, lat]
  category?: string;
  distance?: number;
}

export interface POISearchResponse {
  results: POIResult[];
  count: number;
}

// Simple in-memory cache
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T, ttlMs: number): void {
  cache.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
  });
}

// Cache TTLs
const CACHE_TTL = {
  directions: 5 * 60 * 1000, // 5 minutes
  isochrone: 10 * 60 * 1000, // 10 minutes
  matrix: 5 * 60 * 1000, // 5 minutes
  poi: 15 * 60 * 1000, // 15 minutes
};

/**
 * Make a JSON-RPC call to the Mapbox MCP server
 */
async function callMcp<T>(
  toolName: string,
  args: Record<string, unknown>
): Promise<{ success: boolean; data?: T; error?: string }> {
  const token = process.env.MAPBOX_ACCESS_TOKEN;

  if (!token) {
    console.error("MAPBOX_ACCESS_TOKEN is not configured");
    return { success: false, error: "Mapbox token not configured" };
  }

  try {
    const response = await fetch(MCP_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "tools/call",
        params: { name: toolName, arguments: args },
        id: Date.now(),
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`MCP request failed: ${response.status}`, text);
      return { success: false, error: `Request failed: ${response.status}` };
    }

    const result = await response.json();

    if (result.error) {
      console.error("MCP tool error:", result.error);
      return { success: false, error: result.error.message || "Tool error" };
    }

    return { success: true, data: result.result as T };
  } catch (error) {
    console.error("MCP request error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Format duration in seconds to human-readable text
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return "< 1 min";
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  if (remainingMins === 0) {
    return `${hours} hr`;
  }
  return `${hours} hr ${remainingMins} min`;
}

/**
 * Format distance in meters to human-readable text
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  const km = meters / 1000;
  if (km < 10) {
    return `${km.toFixed(1)} km`;
  }
  return `${Math.round(km)} km`;
}

/**
 * Get directions between two points
 */
export async function getDirections(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  profile: TransportProfile = "walking"
): Promise<DirectionsResponse | null> {
  const cacheKey = `directions:${origin.lat},${origin.lng}:${destination.lat},${destination.lng}:${profile}`;
  const cached = getCached<DirectionsResponse>(cacheKey);
  if (cached) return cached;

  const result = await callMcp<{
    routes?: Array<{
      duration: number;
      distance: number;
      geometry?: string;
      legs?: Array<{
        steps?: Array<{
          maneuver?: { instruction?: string };
          distance?: number;
          duration?: number;
        }>;
      }>;
    }>;
  }>("directions_tool", {
    origin: `${origin.lng},${origin.lat}`,
    destination: `${destination.lng},${destination.lat}`,
    profile,
  });

  if (!result.success || !result.data?.routes?.[0]) {
    return null;
  }

  const route = result.data.routes[0];
  const response: DirectionsResponse = {
    duration: route.duration,
    duration_text: formatDuration(route.duration),
    distance: route.distance,
    distance_text: formatDistance(route.distance),
    geometry: route.geometry,
    steps: route.legs?.[0]?.steps?.map((step) => ({
      instruction: step.maneuver?.instruction || "",
      distance: step.distance || 0,
      duration: step.duration || 0,
    })),
  };

  setCache(cacheKey, response, CACHE_TTL.directions);
  return response;
}

/**
 * Get isochrone (reachable area) from a point
 */
export async function getIsochrone(
  center: { lat: number; lng: number },
  minutes: number,
  profile: TransportProfile = "walking"
): Promise<IsochroneResponse | null> {
  const cacheKey = `isochrone:${center.lat},${center.lng}:${minutes}:${profile}`;
  const cached = getCached<IsochroneResponse>(cacheKey);
  if (cached) return cached;

  const result = await callMcp<{
    features?: Array<{
      geometry?: GeoJSON.Polygon;
    }>;
  }>("isochrone_tool", {
    coordinates: `${center.lng},${center.lat}`,
    contours_minutes: minutes,
    profile,
  });

  if (!result.success || !result.data?.features?.[0]?.geometry) {
    return null;
  }

  const response: IsochroneResponse = {
    geometry: result.data.features[0].geometry,
    center: [center.lng, center.lat],
    minutes,
    profile,
  };

  setCache(cacheKey, response, CACHE_TTL.isochrone);
  return response;
}

/**
 * Get travel time matrix between multiple points
 */
export async function getMatrix(
  origins: Array<{ lat: number; lng: number }>,
  destinations: Array<{ lat: number; lng: number }>,
  profile: TransportProfile = "walking"
): Promise<MatrixResponse | null> {
  // Create cache key from sorted coordinates hash
  const originsStr = origins.map((o) => `${o.lat},${o.lng}`).join("|");
  const destsStr = destinations.map((d) => `${d.lat},${d.lng}`).join("|");
  const cacheKey = `matrix:${originsStr}:${destsStr}:${profile}`;
  const cached = getCached<MatrixResponse>(cacheKey);
  if (cached) return cached;

  // Format coordinates for MCP (lng,lat format)
  const originCoords = origins.map((o) => `${o.lng},${o.lat}`).join(";");
  const destCoords = destinations.map((d) => `${d.lng},${d.lat}`).join(";");

  const result = await callMcp<{
    durations?: number[][];
    distances?: number[][];
  }>("matrix_tool", {
    coordinates: `${originCoords};${destCoords}`,
    sources: origins.map((_, i) => i).join(";"),
    destinations: destinations.map((_, i) => origins.length + i).join(";"),
    profile,
  });

  if (!result.success || !result.data?.durations) {
    return null;
  }

  const entries: MatrixEntry[] = [];
  const durations = result.data.durations;
  const distances = result.data.distances || [];

  for (let i = 0; i < origins.length; i++) {
    for (let j = 0; j < destinations.length; j++) {
      entries.push({
        origin_index: i,
        destination_index: j,
        duration: durations[i]?.[j] || 0,
        distance: distances[i]?.[j] || 0,
      });
    }
  }

  const response: MatrixResponse = {
    origins: origins.map((o) => [o.lng, o.lat]),
    destinations: destinations.map((d) => [d.lng, d.lat]),
    entries,
  };

  setCache(cacheKey, response, CACHE_TTL.matrix);
  return response;
}

/**
 * Search for points of interest near a location
 */
export async function searchPOI(
  query: string,
  proximity: { lat: number; lng: number },
  limit: number = 10
): Promise<POISearchResponse | null> {
  const cacheKey = `poi:${query}:${proximity.lat},${proximity.lng}:${limit}`;
  const cached = getCached<POISearchResponse>(cacheKey);
  if (cached) return cached;

  const result = await callMcp<{
    features?: Array<{
      id?: string;
      properties?: {
        name?: string;
        full_address?: string;
        category?: string;
      };
      geometry?: {
        coordinates?: [number, number];
      };
    }>;
  }>("poi_search_tool", {
    query,
    proximity: `${proximity.lng},${proximity.lat}`,
    limit,
  });

  if (!result.success || !result.data?.features) {
    return null;
  }

  const results: POIResult[] = result.data.features.map((f) => ({
    id: f.id || "",
    name: f.properties?.name || "Unknown",
    address: f.properties?.full_address,
    coordinates: f.geometry?.coordinates || [0, 0],
    category: f.properties?.category,
  }));

  const response: POISearchResponse = {
    results,
    count: results.length,
  };

  setCache(cacheKey, response, CACHE_TTL.poi);
  return response;
}

/**
 * Forward geocode an address to coordinates
 */
export async function forwardGeocode(
  query: string
): Promise<{ lat: number; lng: number; label: string } | null> {
  const cacheKey = `geocode:${query}`;
  const cached = getCached<{ lat: number; lng: number; label: string }>(
    cacheKey
  );
  if (cached) return cached;

  const result = await callMcp<{
    features?: Array<{
      geometry?: { coordinates?: [number, number] };
      properties?: { full_address?: string };
    }>;
  }>("forward_geocode_tool", {
    query,
    limit: 1,
  });

  if (!result.success || !result.data?.features?.[0]) {
    return null;
  }

  const feature = result.data.features[0];
  if (!feature.geometry?.coordinates) return null;

  const response = {
    lng: feature.geometry.coordinates[0],
    lat: feature.geometry.coordinates[1],
    label: feature.properties?.full_address || query,
  };

  setCache(cacheKey, response, CACHE_TTL.poi);
  return response;
}

/**
 * Check if MCP is properly configured
 */
export function isMcpConfigured(): boolean {
  return !!process.env.MAPBOX_ACCESS_TOKEN;
}

/**
 * Clear all cached MCP responses
 */
export function clearMcpCache(): void {
  cache.clear();
}
