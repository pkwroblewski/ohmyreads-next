import { NextRequest, NextResponse } from "next/server";
import { getWeeklySummary } from "@/lib/queries/events";
import { isValidGeohash } from "@/lib/utils/geohash";

/**
 * GET /api/geo/events/summary
 *
 * Query params:
 * - geohash: Location geohash prefix (required)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const geohash = searchParams.get("geohash");

  if (!geohash || !isValidGeohash(geohash)) {
    return NextResponse.json(
      { error: "Valid geohash parameter is required" },
      { status: 400 }
    );
  }

  try {
    const summary = await getWeeklySummary(geohash);

    return NextResponse.json(
      { summary },
      {
        headers: {
          // Cache for 1 hour since summaries are weekly
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
        },
      }
    );
  } catch (error) {
    console.error("Error fetching events summary:", error);
    return NextResponse.json(
      { error: "Failed to fetch events summary" },
      { status: 500 }
    );
  }
}
