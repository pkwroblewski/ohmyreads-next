import { generateText, stepCountIs } from "ai";
import { google } from "@ai-sdk/google";
import { NextRequest, NextResponse } from "next/server";
import { createPublicClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/utils/rate-limit";

// Simple in-memory cache for trending insights (24 hour TTL)
const insightsCache = new Map<string, { data: TrendingInsight[]; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

interface TrendingInsight {
  bookId: string;
  insight: string;
  keywords: string[];
}

function getModel() {
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return google("gemini-2.0-flash");
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    // Check cache first
    const cacheKey = "trending-insights";
    const cached = insightsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({ insights: cached.data, cached: true });
    }

    // Rate limiting: 10 requests per minute
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
    const { allowed } = await checkRateLimit(`ai-trending:${ip}`, 10, 60000);

    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment." },
        { status: 429 }
      );
    }

    const supabase = createPublicClient();

    // Get trending books with their recent reviews
    const { data: trendingBooks, error: booksError } = await supabase
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
      return NextResponse.json({ insights: [], error: "No trending books found" });
    }

    // Get recent reviews for these books
    const bookIds = trendingBooks.map((b) => b.id);
    const { data: reviews } = await supabase
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
    const insights: TrendingInsight[] = [];

    // If no AI model available, return simple insights without AI
    if (!model) {
      for (const book of trendingBooks) {
        insights.push({
          bookId: book.id,
          insight: `Popular ${book.genres?.[0] || "fiction"} by ${book.author}`,
          keywords: book.genres?.slice(0, 3) || [],
        });
      }
      return NextResponse.json({ insights, cached: false, aiEnabled: false });
    }

    for (const book of trendingBooks) {
      const bookReviews = reviewsByBook.get(book.id) || [];

      if (bookReviews.length === 0) {
        // No reviews, generate a generic insight based on book info
        insights.push({
          bookId: book.id,
          insight: `Popular ${book.genres?.[0] || "fiction"} by ${book.author}`,
          keywords: book.genres?.slice(0, 3) || [],
        });
        continue;
      }

      // Prepare review context for AI - minimize PII by using summary and limiting content
      const reviewContext = bookReviews
        .slice(0, 5)
        .map((r) => {
          // Prefer summary over content, limit to 140 chars for PII minimization
          const text = (r.content || "").slice(0, 140);
          return `${r.rating}/5 stars. ${text}${text.length >= 140 ? "..." : ""}`;
        })
        .join("\n");

      try {
        const result = await generateText({
          model,
          system: `You are a book trend analyst. Generate a very short (15-25 words max) insight about why a book is trending based on recent reader reviews. Focus on themes, emotions, or qualities readers mention. Be specific and engaging. Do not use generic phrases like "readers love" - be more creative.`,
          prompt: `Book: "${book.title}" by ${book.author}
Genres: ${book.genres?.join(", ") || "Unknown"}

Recent Reviews:
${reviewContext}

Generate a brief trending insight and 2-3 keywords that capture why this book resonates. Format as JSON: {"insight": "...", "keywords": ["...", "..."]}`,
          stopWhen: stepCountIs(1),
        });

        // Parse AI response
        try {
          const responseText = result.text.trim();
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            insights.push({
              bookId: book.id,
              insight: parsed.insight || `Trending ${book.genres?.[0] || "book"}`,
              keywords: parsed.keywords || [],
            });
          } else {
            insights.push({
              bookId: book.id,
              insight: responseText.slice(0, 100),
              keywords: book.genres?.slice(0, 2) || [],
            });
          }
        } catch {
          insights.push({
            bookId: book.id,
            insight: `Popular choice in ${book.genres?.[0] || "fiction"}`,
            keywords: book.genres?.slice(0, 2) || [],
          });
        }
      } catch (aiError) {
        console.error("AI error for book:", book.id, aiError);
        insights.push({
          bookId: book.id,
          insight: `Trending in ${book.genres?.[0] || "fiction"}`,
          keywords: book.genres?.slice(0, 2) || [],
        });
      }
    }

    // Cache the results
    insightsCache.set(cacheKey, { data: insights, timestamp: Date.now() });

    return NextResponse.json({ insights, cached: false });
  } catch (error) {
    console.error("Trending insights error:", error);
    return NextResponse.json(
      { error: "Failed to generate insights", insights: [] },
      { status: 500 }
    );
  }
}
