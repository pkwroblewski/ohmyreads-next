import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import { isValidGeohash } from "@/lib/utils/geohash";
import { getNearbyReaders } from "@/lib/queries/geo";

// Force dynamic rendering to prevent caching of presence data
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/geo/readers?geohash=u33d
 * 
 * Get readers who have opted in to location sharing near a geohash.
 * Returns approximate locations only (no precise coordinates).
 */
export async function GET(request: NextRequest) {
  // Rate limit by IP (60 requests per minute)
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
  const { allowed } = await checkRateLimit(`geo-readers:${ip}`, 60, 60000);
  
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const geohash = searchParams.get("geohash")?.toLowerCase();
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Math.min(parseInt(limitParam, 10), 100) : 50;

  // Validate geohash
  if (!geohash || geohash.length < 2 || !isValidGeohash(geohash)) {
    return NextResponse.json(
      { error: "Valid geohash of at least 2 characters required" },
      { status: 400 }
    );
  }

  // Use only first 4 chars for privacy (covers ~20km area)
  const searchPrefix = geohash.slice(0, Math.min(geohash.length, 4));

  try {
    const readers = await getNearbyReaders(searchPrefix, limit);

    // Sanitize reader data for API response
    const sanitizedReaders = readers.map((reader) => {
      // Normalize presence type (handle null, case differences, etc.)
      const rawPresenceType = reader.presence_type;
      const presenceType: "static" | "temporary" | "recommended" =
        rawPresenceType === "temporary" || rawPresenceType === "recommended"
          ? rawPresenceType
          : "static";

      // For temporary/recommended presence, return full geohash (user consented to precise location)
      // For static presence, truncate to 4 chars for privacy (~20km area)
      const fullGeohash = reader.location_geohash || "";
      const isCheckIn = presenceType === "temporary" || presenceType === "recommended";
      const geohashPrefix = isCheckIn ? fullGeohash : fullGeohash.slice(0, 4);

      // Format currently reading book for API response
      const currentlyReading = reader.currently_reading
        ? {
            id: reader.currently_reading.id,
            title: reader.currently_reading.title,
            author: reader.currently_reading.author,
            coverUrl: reader.currently_reading.cover_url,
            slug: reader.currently_reading.slug,
          }
        : null;

      return {
        id: reader.id,
        username: reader.username,
        displayName: reader.display_name,
        avatarUrl: reader.avatar_url,
        locationLabel: reader.location_label,
        geohashPrefix: geohashPrefix || null,
        presenceType,
        presenceNote: reader.presence_note,
        presenceExpiresAt: reader.presence_expires_at,
        currentlyReading,
      };
    });

    return NextResponse.json(
      { readers: sanitizedReaders },
      {
        headers: {
          // Short cache for reader data since presence changes frequently
          // no-cache ensures revalidation, s-maxage=5 allows brief edge caching
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("Error fetching nearby readers:", error);
    return NextResponse.json(
      { error: "Failed to fetch readers" },
      { status: 500 }
    );
  }
}

