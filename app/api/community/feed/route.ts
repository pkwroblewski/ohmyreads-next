import { NextRequest, NextResponse } from "next/server";
import { getCommunityFeedPage } from "@/lib/queries/community";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const cursor = searchParams.get("cursor");
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Math.min(parseInt(limitParam, 10), 20) : 10;

  try {
    const data = await getCommunityFeedPage({ limit, cursor });
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching community feed:", error);
    return NextResponse.json(
      { error: "Failed to fetch feed" },
      { status: 500 }
    );
  }
}

