import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getFollowingFeedPage } from "@/lib/queries/community";
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";

export async function GET(request: NextRequest) {
  // Rate limit by IP
  const ip = getClientIp(request);
  const { allowed } = await checkRateLimit(`feed-following:${ip}`, 100, 60000);

  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  // Check authentication
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const cursor = searchParams.get("cursor");
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Math.min(parseInt(limitParam, 10), 20) : 10;

  try {
    const data = await getFollowingFeedPage({
      userId: user.id,
      limit,
      cursor,
    });

    return NextResponse.json(data, {
      headers: {
        // Don't cache following feed as it's personalized
        "Cache-Control": "private, no-cache",
      },
    });
  } catch (error) {
    console.error("Error fetching following feed:", error);
    return NextResponse.json(
      { error: "Failed to fetch feed" },
      { status: 500 }
    );
  }
}
