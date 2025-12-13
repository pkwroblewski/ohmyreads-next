import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const q = (searchParams.get("q") || "").trim();
    const genre = searchParams.get("genre");
    const sort = searchParams.get("sort") || "popular";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);

    const offset = (page - 1) * limit;

    const supabase = await createClient();

    // Build query
    let query = supabase.from("books").select("*", { count: "exact" });

    // Apply search filter
    if (q) {
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
