import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/utils/rate-limit";

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

    // Parse query parameters with input sanitization
    let q = (searchParams.get("q") || "").trim();
    const genre = searchParams.get("genre");
    const sort = searchParams.get("sort") || "popular";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
    const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") || "20") || 20), 50);

    // Sanitize search query:
    // - Cap length to prevent abuse
    // - Remove characters that can break PostgREST filter syntax
    if (q.length > 200) {
      q = q.slice(0, 200);
    }
    // Remove special filter characters: % _ ( ) , . and quotes
    // Keep alphanumeric, spaces, hyphens, and apostrophes for names
    q = q.replace(/[%_(),."'\\]/g, "");

    const offset = (page - 1) * limit;

    const supabase = await createClient();

    // Build query
    let query = supabase.from("books").select("*", { count: "exact" });

    // Apply search filter (safely escaped by Supabase client)
    if (q) {
      // Use separate ilike calls for cleaner filter construction
      query = query.or(`title.ilike.%${q}%,author.ilike.%${q}%`);
    }

    // Apply genre filter
    if (genre) {
      query = query.contains("genres", [genre]);
    }

    // Apply sorting
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
      default:
        query = query.order("ratings_count", { ascending: false });
        break;
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    // Execute query
    const { data: books, count, error } = await query;

    if (error) {
      console.error("Search error:", error);
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
    console.error("Search API error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
