import { NextRequest, NextResponse } from "next/server";
import { searchExternalBooks } from "@/lib/utils/external-book-search";
import { createPublicClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/utils/rate-limit";

export async function GET(request: NextRequest) {
  // Rate limit by IP (30 requests per minute for external search - more expensive)
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
  const { allowed } = checkRateLimit(`external-search:${ip}`, 30, 60000);
  
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q")?.trim();
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Math.min(parseInt(limitParam, 10), 20) : 10;

  if (!query || query.length < 2) {
    return NextResponse.json(
      { error: "Query must be at least 2 characters" },
      { status: 400 }
    );
  }

  try {
    // Search external APIs
    const results = await searchExternalBooks(query, limit);

    // Check which books already exist in our database
    const supabase = createPublicClient();

    // Collect ISBNs, Google IDs, and Open Library IDs to check
    const isbns = results.filter((r) => r.isbn).map((r) => r.isbn as string);
    const googleIds = results.filter((r) => r.googleBooksId).map((r) => r.googleBooksId as string);
    const openLibraryIds = results.filter((r) => r.openLibraryId).map((r) => r.openLibraryId as string);

    // Query existing books
    const existingBooks: Map<string, { id: string; slug: string; matchedBy: string }> = new Map();

    if (isbns.length > 0) {
      const { data: byIsbn } = await supabase
        .from("books")
        .select("id, slug, isbn")
        .in("isbn", isbns);
      
      byIsbn?.forEach((b) => {
        if (b.isbn) existingBooks.set(`isbn:${b.isbn}`, { id: b.id, slug: b.slug, matchedBy: "isbn" });
      });
    }

    if (googleIds.length > 0) {
      const { data: byGoogle } = await supabase
        .from("books")
        .select("id, slug, google_books_id")
        .in("google_books_id", googleIds);
      
      byGoogle?.forEach((b) => {
        if (b.google_books_id) existingBooks.set(`google:${b.google_books_id}`, { id: b.id, slug: b.slug, matchedBy: "google_books_id" });
      });
    }

    if (openLibraryIds.length > 0) {
      const { data: byOpenLibrary } = await supabase
        .from("books")
        .select("id, slug, open_library_id")
        .in("open_library_id", openLibraryIds);
      
      byOpenLibrary?.forEach((b) => {
        if (b.open_library_id) existingBooks.set(`ol:${b.open_library_id}`, { id: b.id, slug: b.slug, matchedBy: "open_library_id" });
      });
    }

    // Enrich results with existence info
    const enrichedResults = results.map((result) => {
      let existing: { id: string; slug: string; matchedBy: string } | undefined;

      if (result.isbn) {
        existing = existingBooks.get(`isbn:${result.isbn}`);
      }
      if (!existing && result.googleBooksId) {
        existing = existingBooks.get(`google:${result.googleBooksId}`);
      }
      if (!existing && result.openLibraryId) {
        existing = existingBooks.get(`ol:${result.openLibraryId}`);
      }

      return {
        ...result,
        existsInCatalog: !!existing,
        existingBookId: existing?.id || null,
        existingBookSlug: existing?.slug || null,
        matchedBy: existing?.matchedBy || null,
      };
    });

    return NextResponse.json(
      {
        results: enrichedResults,
        total: enrichedResults.length,
      },
      {
        headers: {
          // Cache external search results for 5 minutes (expensive API call)
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    console.error("External book search error:", error);
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    );
  }
}

