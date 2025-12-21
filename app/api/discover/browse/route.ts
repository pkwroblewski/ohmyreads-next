import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { browseReaders, searchReaders } from "@/lib/queries/discover";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const sortBy = searchParams.get("sort") || "followers";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 50);

    // Get current user if authenticated
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // If there's a search query, use search function
    if (query && query.length >= 2) {
      const result = await searchReaders({
        query,
        limit,
        offset: (page - 1) * limit,
        excludeUserId: user?.id,
      });

      return NextResponse.json({
        readers: result.readers,
        total: result.total,
        page,
        limit,
      });
    }

    // Otherwise browse with filters
    const result = await browseReaders({
      currentUserId: user?.id,
      filters: {
        sortBy: sortBy as "compatibility" | "activity" | "followers" | "recent",
      },
      page,
      limit,
    });

    return NextResponse.json({
      readers: result.readers,
      total: result.total,
      page,
      limit,
    });
  } catch (error) {
    console.error("Error browsing readers:", error);
    return NextResponse.json(
      { error: "Failed to browse readers" },
      { status: 500 }
    );
  }
}
