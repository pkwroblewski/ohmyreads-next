import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";
import { sanitizePostgrestValue } from "@/lib/utils/sanitize";
import { logError } from "@/lib/utils/log";

export interface InstantSearchResult {
  id: string;
  title: string;
  author: string;
  slug: string;
  coverUrl: string | null;
  rating: number | null;
  genre: string | null;
}

export interface InstantSearchResponse {
  books: InstantSearchResult[];
  total: number;
  query: string;
}

export async function GET(request: NextRequest) {
  // Rate limit: 100 requests per minute for instant search (higher than regular)
  const ip = getClientIp(request);
  const { allowed } = await checkRateLimit(`instant-search:${ip}`, 100, 60000);

  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);

    // Get and sanitize query
    let q = (searchParams.get("q") || "").trim();

    // Minimum 2 characters required
    if (q.length < 2) {
      return NextResponse.json(
        { books: [], total: 0, query: q },
        {
          headers: {
            "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
          },
        }
      );
    }

    // Sanitize: cap length, then strip PostgREST structural characters
    if (q.length > 100) {
      q = q.slice(0, 100);
    }
    q = sanitizePostgrestValue(q);

    const supabase = await createClient();

    // Query with minimal fields for speed
    // Prioritize author matches (when someone searches "tokarczuk", show her books first)
    const { data: books, count, error } = await supabase
      .from("books")
      .select(
        "id, title, author, slug, cover_url, average_rating, genres",
        { count: "exact" }
      )
      .or(`title.ilike.%${q}%,author.ilike.%${q}%`)
      .order("ratings_count", { ascending: false, nullsFirst: false })
      .limit(6);

    if (error) {
      logError("Instant search error", error);
      return NextResponse.json(
        { error: "Search failed" },
        { status: 500 }
      );
    }

    // Sort results: author matches first, then by popularity
    const sortedBooks = (books || []).sort((a, b) => {
      const aAuthorMatch = a.author?.toLowerCase().includes(q.toLowerCase());
      const bAuthorMatch = b.author?.toLowerCase().includes(q.toLowerCase());

      if (aAuthorMatch && !bAuthorMatch) return -1;
      if (!aAuthorMatch && bAuthorMatch) return 1;
      return 0; // Keep original order (by ratings_count)
    });

    // Map to response format
    const results: InstantSearchResult[] = sortedBooks.map((book) => ({
      id: book.id,
      title: book.title,
      author: book.author,
      slug: book.slug,
      coverUrl: book.cover_url,
      rating: book.average_rating,
      genre: book.genres?.[0] || null,
    }));

    return NextResponse.json(
      {
        books: results,
        total: count || 0,
        query: q,
      },
      {
        headers: {
          // Short cache for instant search (fresher results)
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (error) {
    logError("Instant search API error", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
