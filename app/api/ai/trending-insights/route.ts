import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { unstable_cache } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache/tags";
import { trendingInsightSchema } from "@/lib/ai/schemas";
import { NextResponse } from "next/server";
import { createPublicClient, createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import { logError } from "@/lib/utils/log";
interface TrendingInsight {
  bookId: string;
  insight: string;
  keywords: string[];
}

/** Caps one insight. 15-25 words asked for, so this only bounds a runaway. */
const MAX_INSIGHT_TOKENS = 150;

function getModel() {
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return google("gemini-2.0-flash");
  }
  return null;
}

/**
 * Generate trending insights (uncached core).
 * Uses createPublicClient so it's safe for unstable_cache.
 */
async function generateTrendingInsights(): Promise<TrendingInsight[]> {
  const publicClient = createPublicClient();

  // Get trending books with their recent reviews
  const { data: trendingBooks, error: booksError } = await publicClient
    .from("books")
    .select(`
      id,
      title,
      author,
      genres
    `)
    .order("ratings_count", { ascending: false, nullsFirst: false })
    .limit(7);

  if (booksError || !trendingBooks?.length) {
    return [];
  }

  // Get recent reviews for these books
  const bookIds = trendingBooks.map((b) => b.id);
  const { data: reviews } = await publicClient
    .from("reviews")
    .select("book_id, content, rating, vibe_tags")
    .in("book_id", bookIds)
    .order("created_at", { ascending: false })
    .limit(50);

  // Group reviews by book
  const reviewsByBook = new Map<string, typeof reviews>();
  for (const review of reviews || []) {
    const existing = reviewsByBook.get(review.book_id) || [];
    existing.push(review);
    reviewsByBook.set(review.book_id, existing);
  }

  // Generate insights for each book using AI
  const model = getModel();

  const withoutAi = (book: (typeof trendingBooks)[number]): TrendingInsight => ({
    bookId: book.id,
    insight: `Popular ${book.genres?.[0] || "fiction"} by ${book.author}`,
    keywords: book.genres?.slice(0, 3) || [],
  });

  // If no AI model available, return simple insights without AI
  if (!model) {
    return trendingBooks.map(withoutAi);
  }

  // One request per book, in parallel: they share no state, and run serially
  // this was seven sequential round-trips behind a single cache miss.
  return Promise.all(
    trendingBooks.map(async (book) => {
      const bookReviews = reviewsByBook.get(book.id) || [];

      if (bookReviews.length === 0) {
        return withoutAi(book);
      }

      // Prepare review context for AI - minimize PII by using summary and limiting content
      const reviewContext = bookReviews
        .slice(0, 5)
        .map((r) => {
          const text = (r.content || "").slice(0, 140);
          return `${r.rating}/5 stars. ${text}${text.length >= 140 ? "..." : ""}`;
        })
        .join("\n");

      try {
        const { object } = await generateObject({
          model,
          schema: trendingInsightSchema,
          maxOutputTokens: MAX_INSIGHT_TOKENS,
          system: `You are a book trend analyst. Generate a very short (15-25 words max) insight about why a book is trending based on recent reader reviews. Focus on themes, emotions, or qualities readers mention. Be specific and engaging. Do not use generic phrases like "readers love" - be more creative.`,
          prompt: `Book: "${book.title}" by ${book.author}
Genres: ${book.genres?.join(", ") || "Unknown"}

Recent Reviews:
${reviewContext}

Generate a brief trending insight and 2-3 keywords that capture why this book resonates.`,
        });

        return {
          bookId: book.id,
          insight: object.insight,
          keywords: object.keywords,
        };
      } catch (aiError) {
        // Covers both a provider failure and NoObjectGeneratedError (model
        // returned something the schema rejects).
        logError("AI generation failed for book", aiError, { bookId: book.id });
        return {
          bookId: book.id,
          insight: `Trending in ${book.genres?.[0] || "fiction"}`,
          keywords: book.genres?.slice(0, 2) || [],
        };
      }
    })
  );
}

const getCachedTrendingInsights = unstable_cache(
  generateTrendingInsights,
  ["trending-insights"],
  { revalidate: 86400, tags: [CACHE_TAGS.trending] } // 24 hours
);

export async function GET() {
  try {
    // Check authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Rate limiting: 10 requests per minute per user
    const { allowed } = await checkRateLimit(`ai-trending:${user.id}`, 10, 60000);

    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment." },
        { status: 429 }
      );
    }

    const insights = await getCachedTrendingInsights();

    if (insights.length === 0) {
      return NextResponse.json({ insights: [], error: "No trending books found" });
    }

    return NextResponse.json({ insights, cached: false });
  } catch (error) {
    logError("Trending insights error", error);
    return NextResponse.json(
      { error: "Failed to generate insights", insights: [] },
      { status: 500 }
    );
  }
}
