import { NextResponse } from "next/server";

/**
 * GET /api/geo/ip-location
 * Returns approximate location based on user's IP address.
 * Server-side proxy to avoid CORS issues with ipapi.co
 */
export async function GET(request: Request) {
  try {
    // Get the user's IP from headers (works on Vercel and most hosting)
    const forwardedFor = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    const ip = forwardedFor?.split(",")[0]?.trim() || realIp || null;

    // Build URL - if we have an IP use it, otherwise ipapi will use the request IP
    const url = ip ? `https://ipapi.co/${ip}/json/` : "https://ipapi.co/json/";

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
    console.error("IP location error:", error);
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
