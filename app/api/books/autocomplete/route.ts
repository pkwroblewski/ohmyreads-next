import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";

export interface AuthorSuggestion {
  name: string;
  bookCount: number;
}

export interface BookSuggestion {
  id: string;
  title: string;
  author: string;
  slug: string;
  coverUrl: string | null;
}

export interface AutocompleteResponse {
  authors: AuthorSuggestion[];
  books: BookSuggestion[];
  query: string;
}

export async function GET(request: NextRequest) {
  // Rate limit: 100 requests per minute
  const ip = getClientIp(request);
  const { allowed } = await checkRateLimit(`autocomplete:${ip}`, 100, 60000);

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
        { authors: [], books: [], query: q },
        {
          headers: {
            "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
          },
        }
      );
    }

    // Sanitize: cap length and remove special characters
    if (q.length > 100) {
      q = q.slice(0, 100);
    }
    q = q.replace(/[%_(),."'\\]/g, "");

    const supabase = await createClient();

    // Run both queries in parallel
    const [authorsResult, booksResult] = await Promise.all([
      // Authors: distinct authors matching query with book count
      supabase.rpc("search_authors", { search_query: q }).limit(3),
      // Books: top 5 books matching title or author
      supabase
        .from("books")
        .select("id, title, author, slug, cover_url")
        .or(`title.ilike.%${q}%,author.ilike.%${q}%`)
        .order("ratings_count", { ascending: false, nullsFirst: false })
        .limit(5),
    ]);

    // Handle potential RPC not existing - fallback to simpler query
    let authors: AuthorSuggestion[] = [];
    if (authorsResult.error) {
      // Fallback: simple distinct author query
      const { data: fallbackAuthors } = await supabase
        .from("books")
        .select("author")
        .ilike("author", `%${q}%`)
        .order("ratings_count", { ascending: false, nullsFirst: false })
        .limit(20);

      // Manually count and dedupe
      const authorCounts = new Map<string, number>();
      (fallbackAuthors || []).forEach((b) => {
        if (b.author) {
          const key = b.author.toLowerCase();
          const existing = authorCounts.get(key);
          if (!existing) {
            authorCounts.set(key, 1);
          } else {
            authorCounts.set(key, existing + 1);
          }
        }
      });

      // Get original case for display
      const authorNames = new Map<string, string>();
      (fallbackAuthors || []).forEach((b) => {
        if (b.author) {
          const key = b.author.toLowerCase();
          if (!authorNames.has(key)) {
            authorNames.set(key, b.author);
          }
        }
      });

      authors = Array.from(authorCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([key, count]) => ({
          name: authorNames.get(key) || key,
          bookCount: count,
        }));
    } else {
      authors = (authorsResult.data || []).map(
        (a: { author: string; book_count: number }) => ({
          name: a.author,
          bookCount: a.book_count,
        })
      );
    }

    // Format books
    const books: BookSuggestion[] = (booksResult.data || []).map((book) => ({
      id: book.id,
      title: book.title,
      author: book.author,
      slug: book.slug,
      coverUrl: book.cover_url,
    }));

    return NextResponse.json(
      { authors, books, query: q },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (error) {
    console.error("Autocomplete API error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
