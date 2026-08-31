import { NextRequest, NextResponse } from "next/server";
import { getEventsNearby, getEventsByCity } from "@/lib/queries/events";
import { isValidGeohash } from "@/lib/utils/geohash";
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";
import { logError } from "@/lib/utils/log";

/**
 * GET /api/geo/events
 *
 * Query params:
 * - geohash: Location geohash prefix (required if no city)
 * - city: City name to search (alternative to geohash)
 * - limit: Max number of events (default 20, max 50)
 */
export async function GET(request: NextRequest) {
  // Rate limit by IP (30 requests per minute)
  const ip = getClientIp(request);
  const { allowed } = await checkRateLimit(`geo-events:${ip}`, 30, 60000);

  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const geohash = searchParams.get("geohash");
  const city = searchParams.get("city");
  const limitParam = searchParams.get("limit");
  const limit = Math.min(parseInt(limitParam || "20", 10), 50);

  // Validate input - need either geohash or city
  if (!geohash && !city) {
    return NextResponse.json(
      { error: "Either geohash or city parameter is required" },
      { status: 400 }
    );
  }

  try {
    let events;

    if (city) {
      // Search by city name
      events = await getEventsByCity(city, limit);
    } else if (geohash && isValidGeohash(geohash)) {
      // Search by geohash
      events = await getEventsNearby(geohash, limit);
    } else {
      return NextResponse.json(
        { error: "Invalid geohash format" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { events },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    logError("Error fetching events", error);
    return NextResponse.json(
      { error: "Failed to fetch events" },
      { status: 500 }
    );
  }
}
