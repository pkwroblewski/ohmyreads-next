import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";
import { isForeignOrigin } from "@/lib/utils/csrf";
import { logError } from "@/lib/utils/log";

/**
 * GET /api/geo/ip-location
 * Returns approximate location based on user's IP address.
 * Server-side proxy to avoid CORS issues with ipapi.co
 */
export async function GET(request: Request) {
  // Block cross-site requests farming this external-API proxy
  if (isForeignOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    // Get the user's IP from headers (works on Vercel and most hosting)
    const ip = getClientIp(request);
    const ipForLookup = ip !== "unknown" ? ip : null;

    // Rate limit: 10 requests per minute per IP
    const { allowed } = await checkRateLimit(`geo-ip:${ip}`, 10, 60000);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    // Build URL - if we have an IP use it, otherwise ipapi will use the request IP
    const url = ipForLookup ? `https://ipapi.co/${ipForLookup}/json/` : "https://ipapi.co/json/";

    const res = await fetch(url, {
      headers: {
        "User-Agent": "OhMyReads/1.0",
      },
      // Cache for 1 hour to avoid rate limits
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      // If ipapi fails, return a default location (Luxembourg City)
      return NextResponse.json({
        latitude: 49.6116,
        longitude: 6.1319,
        city: "Luxembourg City",
        country: "Luxembourg",
        fallback: true,
      });
    }

    const data = await res.json();

    // Check for rate limit or error response
    if (data.error || !data.latitude || !data.longitude) {
      return NextResponse.json({
        latitude: 49.6116,
        longitude: 6.1319,
        city: "Luxembourg City",
        country: "Luxembourg",
        fallback: true,
      });
    }

    return NextResponse.json({
      latitude: data.latitude,
      longitude: data.longitude,
      city: data.city,
      country: data.country_name,
    });
  } catch (error) {
    logError("IP location error", error);
    // Return Luxembourg as default fallback
    return NextResponse.json({
      latitude: 49.6116,
      longitude: 6.1319,
      city: "Luxembourg City",
      country: "Luxembourg",
      fallback: true,
    });
  }
}
