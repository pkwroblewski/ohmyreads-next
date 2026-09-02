import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { browseReaders, searchReaders } from "@/lib/queries/discover";
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";
import { logError } from "@/lib/utils/log";
import { z } from "zod";

// `parseInt` yields NaN for junk and lets negatives through; both used to reach
// the query as an offset and surface as a 500.
const pagingSchema = z.object({
  page: z.coerce.number().int().min(1).max(500).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export async function GET(request: NextRequest) {
  // Rate limit: 60 requests per minute. This route is unauthenticated and scans
  // the profiles table, so it needs a throttle like the other public search
  // endpoints.
  const ip = getClientIp(request);
  const { allowed } = await checkRateLimit(`discover-browse:${ip}`, 60, 60000);

  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const sortBy = searchParams.get("sort") || "followers";
    const paging = pagingSchema.safeParse({
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    });
    if (!paging.success) {
      return NextResponse.json(
        { error: "Invalid page or limit" },
        { status: 400 }
      );
    }
    const { page, limit } = paging.data;

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
    logError("Error browsing readers", error);
    return NextResponse.json(
      { error: "Failed to browse readers" },
      { status: 500 }
    );
  }
}
