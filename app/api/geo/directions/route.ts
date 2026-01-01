import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import {
  getDirections,
  isMcpConfigured,
  type TransportProfile,
} from "@/lib/services/mapbox-mcp";

/**
 * GET /api/geo/directions?origin_lat=40.7128&origin_lng=-74.0060&dest_lat=40.7580&dest_lng=-73.9855&profile=walking
 *
 * Get directions between two points using Mapbox MCP
 * Returns duration, distance, and optionally step-by-step directions
 */
export async function GET(request: NextRequest) {
  // Check MCP is configured
  if (!isMcpConfigured()) {
    return NextResponse.json(
      { error: "Directions service not configured" },
      { status: 503 }
    );
  }

  // Rate limit by IP (60 requests per minute)
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
  const { allowed } = checkRateLimit(`geo-directions:${ip}`, 60, 60000);

  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  const searchParams = request.nextUrl.searchParams;

  // Parse origin coordinates
  const originLat = parseFloat(searchParams.get("origin_lat") || "");
  const originLng = parseFloat(searchParams.get("origin_lng") || "");

  // Parse destination coordinates
  const destLat = parseFloat(searchParams.get("dest_lat") || "");
  const destLng = parseFloat(searchParams.get("dest_lng") || "");

  // Parse profile (walking, cycling, driving)
  const profileParam = searchParams.get("profile") || "walking";
  const validProfiles: TransportProfile[] = ["walking", "cycling", "driving"];
  const profile: TransportProfile = validProfiles.includes(
    profileParam as TransportProfile
  )
    ? (profileParam as TransportProfile)
    : "walking";

  // Validate coordinates
  if (
    isNaN(originLat) ||
    isNaN(originLng) ||
    isNaN(destLat) ||
    isNaN(destLng)
  ) {
    return NextResponse.json(
      {
        error:
          "Invalid coordinates. Required: origin_lat, origin_lng, dest_lat, dest_lng",
      },
      { status: 400 }
    );
  }

  // Validate coordinate ranges
  if (
    originLat < -90 ||
    originLat > 90 ||
    destLat < -90 ||
    destLat > 90 ||
    originLng < -180 ||
    originLng > 180 ||
    destLng < -180 ||
    destLng > 180
  ) {
    return NextResponse.json(
      { error: "Coordinates out of valid range" },
      { status: 400 }
    );
  }

  try {
    const directions = await getDirections(
      { lat: originLat, lng: originLng },
      { lat: destLat, lng: destLng },
      profile
    );

    if (!directions) {
      return NextResponse.json(
        { error: "Could not calculate directions" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        profile,
        duration: directions.duration,
        duration_text: directions.duration_text,
        distance: directions.distance,
        distance_text: directions.distance_text,
        steps: directions.steps,
        geometry: directions.geometry,
      },
      {
        headers: {
          // Cache for 5 minutes
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    console.error("Error fetching directions:", error);
    return NextResponse.json(
      { error: "Failed to fetch directions" },
      { status: 500 }
    );
  }
}
