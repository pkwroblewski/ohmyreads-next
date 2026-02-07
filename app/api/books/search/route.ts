import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import { parseSearchParams } from "@/lib/validation/search";
import { logger, extractErrorInfo, extractSupabaseErrorInfo } from "@/lib/utils/log";
import { sanitizePostgrestValue } from "@/lib/utils/sanitize";

export async function GET(request: NextRequest) {
  // Rate limit by IP (60 requests per minute for search)
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
  const { allowed } = await checkRateLimit(`search:${ip}`, 60, 60000);

  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);

    // Parse and validate query parameters with Zod schema
    const parseResult = parseSearchParams(searchParams);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error },
        { status: 400 }
      );
    }

    const { q, genre, sort, page, limit } = parseResult.data;
    const offset = (page - 1) * limit;

    const supabase = await createClient();

    // Build query
    let query = supabase.from("books").select("*", { count: "exact" });

    // Apply search filter (sanitize input to prevent PostgREST query manipulation)
    if (q) {
      const safeQ = sanitizePostgrestValue(q);
      query = query.or(`title.ilike.%${safeQ}%,author.ilike.%${safeQ}%`);
    }

    // Apply genre filter
    if (genre) {
      query = query.contains("genres", [genre]);
    }

    // Apply sorting (sort is validated by Zod, all cases handled)
    switch (sort) {
      case "newest":
        query = query.order("created_at", { ascending: false });
        break;
      case "rating":
        query = query.order("average_rating", {
          ascending: false,
          nullsFirst: false,
        });
        break;
      case "title":
        query = query.order("title", { ascending: true });
        break;
      case "popular":
        query = query.order("ratings_count", { ascending: false });
        break;
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    // Execute query
    const { data: books, count, error } = await query;

    if (error) {
      logger.error("Book search query failed", extractSupabaseErrorInfo(error));
      return NextResponse.json(
        { error: "Failed to search books" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        books: books || [],
        total: count || 0,
        page,
        totalPages: Math.ceil((count || 0) / limit),
        hasMore: offset + limit < (count || 0),
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      }
    );
  } catch (error) {
    logger.error("Search API unexpected error", extractErrorInfo(error));
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
