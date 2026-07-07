import { generateText, stepCountIs } from "ai";
import { google } from "@ai-sdk/google";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/server";
import { checkRateLimit, getClientIp } from "@/lib/utils/rate-limit";

// Simple in-memory cache for curated picks (1 hour TTL per user)
const curatedCache = new Map<string, { data: CuratedPick[]; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

interface CuratedPick {
  bookId: string;
  reason: string;
  matchType: "mood" | "theme" | "author" | "genre" | "vibe";
}

function getModel() {
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return google("gemini-2.0-flash");
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    // Rate limiting: 20 requests per minute
    const ip = getClientIp(request);
    const { allowed } = await checkRateLimit(`ai-curated:${ip}`, 20, 60000);

    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment." },
        { status: 429 }
      );
    }

    // Check if user is authenticated
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Use different cache keys for logged in vs anonymous users
    const cacheKey = user ? `curated:${user.id}` : "curated:anonymous";
    const cached = curatedCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({ picks: cached.data, cached: true });
    }

    const publicClient = createPublicClient();

    // Get user's taste profile if logged in
    let tasteProfile = null;
    let recentBooks: { title: string; author: string; rating?: number }[] = [];

    if (user) {
      // Fetch taste profile (correct table and column names)
      const { data: profile } = await publicClient
        .from("user_taste_profiles")
        .select("preferred_genres, preferred_vibes, preferred_pace, preferred_length")
        .eq("user_id", user.id)
        .single();

      tasteProfile = profile;

      // Fetch recent books the user has read or rated
      const { data: userBooks } = await publicClient
        .from("user_books")
        .select("rating, books(title, author)")
        .eq("user_id", user.id)
        .not("books", "is", null)
        .order("updated_at", { ascending: false })
        .limit(10);

      if (userBooks) {
        recentBooks = userBooks.flatMap((ub) =>
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
      }
    }

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
      return NextResponse.json({ picks: [], error: "No books found" });
    }

    // Generate AI explanations for each book
    const model = getModel();
    const picks: CuratedPick[] = [];

    // If no AI model available, return simple picks without AI-generated reasons
    if (!model) {
      for (const book of recommendedBooks) {
        picks.push({
          bookId: book.id,
          reason: `Popular ${book.genres?.[0] || "read"} pick`,
          matchType: "genre",
        });
      }
      return NextResponse.json({ picks, cached: false, aiEnabled: false });
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

    for (const book of recommendedBooks) {
      try {
        const result = await generateText({
          model,
          system: `You are a personal book recommender. Generate a very short (10-20 words max) personalized reason why this specific reader might love this book. Be warm, specific, and avoid generic phrases. Focus on emotional appeal or thematic connection. Also classify the match type.`,
          prompt: `Reader profile: ${userContext}

Book: "${book.title}" by ${book.author}
Genres: ${book.genres?.join(", ") || "Unknown"}
Description: ${book.description?.slice(0, 200) || "No description"}

Generate a brief, personalized recommendation reason. Format as JSON: {"reason": "...", "matchType": "mood|theme|author|genre|vibe"}`,
          stopWhen: stepCountIs(1),
        });

        try {
          const responseText = result.text.trim();
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            picks.push({
              bookId: book.id,
              reason: parsed.reason || "A great read for you",
              matchType: parsed.matchType || "genre",
            });
          } else {
            picks.push({
              bookId: book.id,
              reason: responseText.slice(0, 80),
              matchType: "genre",
            });
          }
        } catch {
          picks.push({
            bookId: book.id,
            reason: `Popular ${book.genres?.[0] || "read"} pick`,
            matchType: "genre",
          });
        }
      } catch (aiError) {
        console.error("AI error for book:", book.id, aiError);
        picks.push({
          bookId: book.id,
          reason: `Highly rated ${book.genres?.[0] || "book"}`,
          matchType: "genre",
        });
      }
    }

    // Cache the results
    curatedCache.set(cacheKey, { data: picks, timestamp: Date.now() });

    return NextResponse.json({ picks, cached: false });
  } catch (error) {
    console.error("Curated picks error:", error);
    return NextResponse.json(
      { error: "Failed to generate picks", picks: [] },
      { status: 500 }
    );
  }
}
