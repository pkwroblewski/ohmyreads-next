import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";
import { isForeignOrigin } from "@/lib/utils/csrf";
import { logError } from "@/lib/utils/log";
import {
  getIsochrone,
  isMcpConfigured,
  type TransportProfile,
} from "@/lib/services/mapbox-mcp";

/**
 * GET /api/geo/isochrone?lat=40.7128&lng=-74.0060&minutes=15&profile=walking
 *
 * Get an isochrone (reachable area) polygon using Mapbox MCP
 * Returns GeoJSON polygon that can be rendered on the map
 */
export async function GET(request: NextRequest) {
  // Block cross-site requests farming this paid-API proxy
  if (isForeignOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Check MCP is configured
  if (!isMcpConfigured()) {
    return NextResponse.json(
      { error: "Isochrone service not configured" },
      { status: 503 }
    );
  }

  // Rate limit by IP (10 requests per minute)
  const ip = getClientIp(request);
  const { allowed } = await checkRateLimit(`geo-isochrone:${ip}`, 10, 60000);

  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  // Daily backstop (50 requests per day)
  const daily = await checkRateLimit(`geo-isochrone-daily:${ip}`, 50, 86400000);

  if (!daily.allowed) {
    return NextResponse.json(
      { error: "Daily limit reached." },
      { status: 429 }
    );
  }

  const searchParams = request.nextUrl.searchParams;

  // Parse coordinates
  const lat = parseFloat(searchParams.get("lat") || "");
  const lng = parseFloat(searchParams.get("lng") || "");

  // Parse time (minutes)
  const minutesParam = parseInt(searchParams.get("minutes") || "15", 10);
  const validMinutes = [5, 10, 15, 20, 30, 45, 60];
  const minutes = validMinutes.includes(minutesParam) ? minutesParam : 15;

  // Parse profile (walking, cycling, driving)
  const profileParam = searchParams.get("profile") || "walking";
  const validProfiles: TransportProfile[] = ["walking", "cycling", "driving"];
  const profile: TransportProfile = validProfiles.includes(
    profileParam as TransportProfile
  )
    ? (profileParam as TransportProfile)
    : "walking";

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
    const isochrone = await getIsochrone({ lat, lng }, minutes, profile);

    if (!isochrone) {
      return NextResponse.json(
        { error: "Could not calculate reachable area" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        center: isochrone.center,
        minutes: isochrone.minutes,
        profile: isochrone.profile,
        geometry: isochrone.geometry,
      },
      {
        headers: {
          // Cache for 10 minutes
          "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200",
        },
      }
    );
  } catch (error) {
    logError("Error fetching isochrone", error);
    return NextResponse.json(
      { error: "Failed to fetch reachable area" },
      { status: 500 }
    );
  }
}
