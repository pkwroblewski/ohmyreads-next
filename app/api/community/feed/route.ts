import { NextRequest, NextResponse } from "next/server";
import { getCommunityFeedPage } from "@/lib/queries/community";
import { checkRateLimit } from "@/lib/utils/rate-limit";

export async function GET(request: NextRequest) {
  // Rate limit by IP (100 requests per minute for feed pagination)
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
  const { allowed } = checkRateLimit(`feed:${ip}`, 100, 60000);
  
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const cursor = searchParams.get("cursor");
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Math.min(parseInt(limitParam, 10), 20) : 10;

  try {
    const data = await getCommunityFeedPage({ limit, cursor });
    return NextResponse.json(data, {
      headers: {
        // Cache feed for 30 seconds (frequently updated)
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    console.error("Error fetching community feed:", error);
    return NextResponse.json(
      { error: "Failed to fetch feed" },
      { status: 500 }
    );
  }
}

