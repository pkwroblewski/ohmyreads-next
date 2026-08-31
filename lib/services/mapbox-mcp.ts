/**
 * Mapbox MCP (Model Context Protocol) Service
 * Connects to Mapbox's hosted MCP server for geospatial AI capabilities
 * https://docs.mapbox.com/api/guides/mcp-server/
 */

import { unstable_cache } from "next/cache";
import { logError, logger } from "@/lib/utils/log";
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

// Cache revalidation times (seconds) for unstable_cache
const CACHE_REVALIDATE = {
  directions: 300, // 5 minutes
  isochrone: 600, // 10 minutes
  matrix: 300, // 5 minutes
  poi: 900, // 15 minutes
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
    logger.error("MAPBOX_ACCESS_TOKEN is not configured");
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
      logger.error("MCP request failed", {
        status: response.status,
        body: text.slice(0, 500),
      });
      return { success: false, error: `Request failed: ${response.status}` };
    }

    const result = await response.json();

    if (result.error) {
      logError("MCP tool error", result.error);
      return { success: false, error: result.error.message || "Tool error" };
    }

    return { success: true, data: result.result as T };
  } catch (error) {
    logError("MCP request error", error);
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
 * Fetch directions between two points (uncached core)
 */
async function fetchDirections(
  originLat: number, originLng: number,
  destLat: number, destLng: number,
  profile: string
): Promise<DirectionsResponse | null> {
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
    origin: `${originLng},${originLat}`,
    destination: `${destLng},${destLat}`,
    profile,
  });

  if (!result.success || !result.data?.routes?.[0]) {
    return null;
  }

  const route = result.data.routes[0];
  return {
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
}

/**
 * Get directions between two points - cached for 5 minutes
 */
export async function getDirections(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  profile: TransportProfile = "walking"
): Promise<DirectionsResponse | null> {
  const cachedFn = unstable_cache(
    fetchDirections,
    ["mapbox-directions", `${origin.lat},${origin.lng}`, `${destination.lat},${destination.lng}`, profile],
    { revalidate: CACHE_REVALIDATE.directions }
  );
  return cachedFn(origin.lat, origin.lng, destination.lat, destination.lng, profile);
}

/**
 * Fetch isochrone (uncached core)
 */
async function fetchIsochrone(
  centerLat: number, centerLng: number,
  minutes: number, profile: string
): Promise<IsochroneResponse | null> {
  const result = await callMcp<{
    features?: Array<{
      geometry?: GeoJSON.Polygon;
    }>;
  }>("isochrone_tool", {
    coordinates: `${centerLng},${centerLat}`,
    contours_minutes: minutes,
    profile,
  });

  if (!result.success || !result.data?.features?.[0]?.geometry) {
    return null;
  }

  return {
    geometry: result.data.features[0].geometry,
    center: [centerLng, centerLat],
    minutes,
    profile: profile as TransportProfile,
  };
}

/**
 * Get isochrone (reachable area) from a point - cached for 10 minutes
 */
export async function getIsochrone(
  center: { lat: number; lng: number },
  minutes: number,
  profile: TransportProfile = "walking"
): Promise<IsochroneResponse | null> {
  const cachedFn = unstable_cache(
    fetchIsochrone,
    ["mapbox-isochrone", `${center.lat},${center.lng}`, String(minutes), profile],
    { revalidate: CACHE_REVALIDATE.isochrone }
  );
  return cachedFn(center.lat, center.lng, minutes, profile);
}

/**
 * Fetch travel time matrix (uncached core).
 * Takes serialized coordinate strings to be compatible with unstable_cache.
 */
async function fetchMatrix(
  originsJson: string, destinationsJson: string, profile: string
): Promise<MatrixResponse | null> {
  const origins: Array<{ lat: number; lng: number }> = JSON.parse(originsJson);
  const destinations: Array<{ lat: number; lng: number }> = JSON.parse(destinationsJson);

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

  return {
    origins: origins.map((o) => [o.lng, o.lat]),
    destinations: destinations.map((d) => [d.lng, d.lat]),
    entries,
  };
}

/**
 * Get travel time matrix between multiple points - cached for 5 minutes
 */
export async function getMatrix(
  origins: Array<{ lat: number; lng: number }>,
  destinations: Array<{ lat: number; lng: number }>,
  profile: TransportProfile = "walking"
): Promise<MatrixResponse | null> {
  const originsJson = JSON.stringify(origins);
  const destinationsJson = JSON.stringify(destinations);
  const cachedFn = unstable_cache(
    fetchMatrix,
    ["mapbox-matrix", originsJson, destinationsJson, profile],
    { revalidate: CACHE_REVALIDATE.matrix }
  );
  return cachedFn(originsJson, destinationsJson, profile);
}

/**
 * Fetch POI search results (uncached core)
 */
async function fetchPOI(
  query: string, proximityLat: number, proximityLng: number, limit: number
): Promise<POISearchResponse | null> {
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
    proximity: `${proximityLng},${proximityLat}`,
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

  return { results, count: results.length };
}

/**
 * Search for points of interest near a location - cached for 15 minutes
 */
export async function searchPOI(
  query: string,
  proximity: { lat: number; lng: number },
  limit: number = 10
): Promise<POISearchResponse | null> {
  const cachedFn = unstable_cache(
    fetchPOI,
    ["mapbox-poi", query, `${proximity.lat},${proximity.lng}`, String(limit)],
    { revalidate: CACHE_REVALIDATE.poi }
  );
  return cachedFn(query, proximity.lat, proximity.lng, limit);
}

/**
 * Fetch geocode result (uncached core)
 */
async function fetchGeocode(
  query: string
): Promise<{ lat: number; lng: number; label: string } | null> {
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

  return {
    lng: feature.geometry.coordinates[0],
    lat: feature.geometry.coordinates[1],
    label: feature.properties?.full_address || query,
  };
}

/**
 * Forward geocode an address to coordinates - cached for 15 minutes
 */
export async function forwardGeocode(
  query: string
): Promise<{ lat: number; lng: number; label: string } | null> {
  const cachedFn = unstable_cache(
    fetchGeocode,
    ["mapbox-geocode", query],
    { revalidate: CACHE_REVALIDATE.poi }
  );
  return cachedFn(query);
}

/**
 * Check if MCP is properly configured
 */
export function isMcpConfigured(): boolean {
  return !!process.env.MAPBOX_ACCESS_TOKEN;
}
