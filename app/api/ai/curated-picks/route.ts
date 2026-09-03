import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { unstable_cache } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/server";
import { CACHE_TAGS } from "@/lib/cache/tags";
import { curatedPickSchema } from "@/lib/ai/schemas";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import { isForeignOrigin } from "@/lib/utils/csrf";
import { logError } from "@/lib/utils/log";
interface CuratedPick {
  bookId: string;
  reason: string;
  matchType: "mood" | "theme" | "author" | "genre" | "vibe";
}

/** Caps one blurb. 10-20 words asked for, so this only bounds a runaway. */
const MAX_PICK_TOKENS = 120;

function getModel() {
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return google("gemini-2.0-flash");
  }
  return null;
}

function fallbackPick(book: {
  id: string;
  genres: string[] | null;
}): CuratedPick {
  return {
    bookId: book.id,
    reason: `Popular ${book.genres?.[0] || "read"} pick`,
    matchType: "genre",
  };
}

/**
 * Build the picks for one reader. Reads only through `createPublicClient()` and
 * never touches `cookies()`, which is what makes it safe to wrap in
 * `unstable_cache` below.
 */
async function generateCuratedPicks(userId: string): Promise<CuratedPick[]> {
  const publicClient = createPublicClient();

  // Fetch taste profile (correct table and column names)
  const { data: tasteProfile } = await publicClient
    .from("user_taste_profiles")
    .select("preferred_genres, preferred_vibes, preferred_pace, preferred_length")
    .eq("user_id", userId)
    .single();

  // Fetch recent books the user has read or rated
  const { data: userBooks } = await publicClient
    .from("user_books")
    .select("rating, books(title, author)")
    .eq("user_id", userId)
    .not("books", "is", null)
    .order("updated_at", { ascending: false })
    .limit(10);

  const recentBooks = (userBooks || []).flatMap((ub) =>
    ub.books && !Array.isArray(ub.books)
      ? [
          {
            title: ub.books.title,
            author: ub.books.author,
            rating: ub.rating || undefined,
          },
        ]
      : []
  );

  // Get recommended books (use existing scoring or simple query)
  const { data: recommendedBooks, error: booksError } = await publicClient
    .from("books")
    .select(`
      id,
      title,
      author,
      genres,
      description
    `)
    .order("ratings_count", { ascending: false, nullsFirst: false })
    .limit(4);

  if (booksError || !recommendedBooks?.length) {
    return [];
  }

  const model = getModel();

  // If no AI model available, return simple picks without AI-generated reasons
  if (!model) {
    return recommendedBooks.map(fallbackPick);
  }

  // Build context about the user
  let userContext = "Anonymous reader browsing for new books.";
  if (tasteProfile || recentBooks.length > 0) {
    const parts: string[] = [];
    if (tasteProfile?.preferred_genres?.length) {
      parts.push(`Loves: ${tasteProfile.preferred_genres.join(", ")}`);
    }
    if (tasteProfile?.preferred_vibes?.length) {
      parts.push(`Vibes: ${tasteProfile.preferred_vibes.join(", ")}`);
    }
    if (recentBooks.length > 0) {
      const bookList = recentBooks
        .slice(0, 5)
        .map((b) => `"${b.title}"${b.rating ? ` (${b.rating}★)` : ""}`)
        .join(", ");
      parts.push(`Recent reads: ${bookList}`);
    }
    if (parts.length > 0) {
      userContext = parts.join(". ");
    }
  }

  // One request per book, in parallel: they share no state, and run serially
  // the reader waited on four sequential round-trips for a single grid.
  return Promise.all(
    recommendedBooks.map(async (book) => {
      try {
        const { object } = await generateObject({
          model,
          schema: curatedPickSchema,
          maxOutputTokens: MAX_PICK_TOKENS,
          system: `You are a personal book recommender. Generate a very short (10-20 words max) personalized reason why this specific reader might love this book. Be warm, specific, and avoid generic phrases. Focus on emotional appeal or thematic connection. Also classify the match type.`,
          prompt: `Reader profile: ${userContext}

Book: "${book.title}" by ${book.author}
Genres: ${book.genres?.join(", ") || "Unknown"}
Description: ${book.description?.slice(0, 200) || "No description"}`,
        });

        return {
          bookId: book.id,
          reason: object.reason,
          matchType: object.matchType,
        };
      } catch (aiError) {
        // Covers both a provider failure and NoObjectGeneratedError (model
        // returned something the schema rejects).
        logError("AI generation failed for book", aiError, { bookId: book.id });
        return fallbackPick(book);
      }
    })
  );
}

/**
 * Per-reader, 1 hour — the same TTL the old module-level `Map` intended, but on
 * a cache that actually survives. On serverless every request may land on a new
 * instance, so that `Map` was near-always empty: it never returned a hit worth
 * having, while growing without bound on any instance that did stay warm.
 */
const getCachedCuratedPicks = unstable_cache(
  generateCuratedPicks,
  ["curated-picks"],
  { revalidate: 3600, tags: [CACHE_TAGS.books] }
);

export async function GET(request: NextRequest) {
  try {
    // Block cross-site requests farming this LLM-backed endpoint
    if (isForeignOrigin(request)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Auth required. This endpoint spends LLM tokens per cache miss, and it was
    // previously reachable anonymously from the public homepage — an
    // unauthenticated cost-amplification vector. Anonymous visitors still see
    // the curated books (rendered server-side); they just don't get the
    // AI-written reason blurbs, which are a progressive enhancement.
    const { data: { user } } = await getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit per user (20/min) rather than per IP, so shared NATs don't
    // throttle each other.
    const { allowed } = await checkRateLimit(`ai-curated:${user.id}`, 20, 60000);

    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment." },
        { status: 429 }
      );
    }

    const picks = await getCachedCuratedPicks(user.id);

    if (picks.length === 0) {
      return NextResponse.json({ picks: [], error: "No books found" });
    }

    return NextResponse.json({ picks });
  } catch (error) {
    logError("Curated picks error", error);
    return NextResponse.json(
      { error: "Failed to generate picks", picks: [] },
      { status: 500 }
    );
  }
}
