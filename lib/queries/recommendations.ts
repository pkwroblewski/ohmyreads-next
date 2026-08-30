import { unstable_cache } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache/tags";
import { createClient, createPublicClient } from "@/lib/supabase/server";
import { BOOK_CARD_COLUMNS } from "./columns";
import type { BookSummary, UserTasteProfile } from "@/types/database";

// Recommendation reason types
export type RecommendationReasonType =
  | "genre_match"
  | "vibe_match"
  | "similar_to_loved"
  | "popular_in_genre"
  | "highly_rated"
  | "trending";

export interface RecommendationReason {
  type: RecommendationReasonType;
  label: string;
  relatedBookTitle?: string;
  relatedGenre?: string;
  relatedVibe?: string;
}

export interface RecommendedBook extends BookSummary {
  score: number;
  reason: RecommendationReason;
}

export interface TrendingMetrics {
  recentReviews: number;
  recentAdds: number;
}

export interface TrendingBook extends BookSummary {
  score: number;
  rank: number;
  metrics: TrendingMetrics;
  reason: RecommendationReason;
}

// Scoring weights
const WEIGHTS = {
  GENRE_MATCH: 30, // Points per matching genre with taste profile
  VIBE_MATCH: 25, // Points per matching vibe tag
  SIMILAR_TO_LOVED: 40, // Points for sharing genre with a highly-rated book
  HIGH_RATING: 10, // Bonus for high average rating (>= 4.0)
  POPULAR: 5, // Small bonus for popular books
};

/**
 * Get personalized book recommendations for a user
 */
export async function getPersonalizedRecommendations(
  userId: string,
  limit: number = 10
): Promise<RecommendedBook[]> {
  const supabase = await createClient();

  // 1. Get user's taste profile
  const { data: tasteProfile } = await supabase
    .from("user_taste_profiles")
    .select("*")
    .eq("user_id", userId)
    .single();

  // 2. Get user's books (to exclude from recommendations)
  const { data: userBooks } = await supabase
    .from("user_books")
    .select("book_id")
    .eq("user_id", userId);

  const excludedBookIds = new Set((userBooks || []).map((ub) => ub.book_id));

  // 3. Get user's highly-rated books (4+ stars) for similarity matching
  const { data: lovedBooks } = await supabase
    .from("user_books")
    .select("book_id, rating, book:books(id, title, genres)")
    .eq("user_id", userId)
    .gte("rating", 4)
    .not("rating", "is", null);

  // Extract genres from loved books
  const lovedGenres = new Map<string, string>(); // genre -> book title
  for (const ub of lovedBooks || []) {
    const book = ub.book;
    if (book?.genres) {
      for (const genre of book.genres) {
        if (!lovedGenres.has(genre)) {
          lovedGenres.set(genre, book.title);
        }
      }
    }
  }

  // 4. Get reviews with vibe tags from user's reviews
  const { data: userReviews } = await supabase
    .from("reviews")
    .select("book_id, vibe_tags")
    .eq("user_id", userId)
    .not("vibe_tags", "eq", "{}");

  // Collect vibe tags user has used
  const usedVibeTags = new Set<string>();
  for (const review of userReviews || []) {
    for (const tag of review.vibe_tags || []) {
      usedVibeTags.add(tag);
    }
  }

  // 5. Get candidate books (excluding user's books)
  // First, get all books with their aggregate vibe tags from reviews
  const { data: allBooks } = await supabase
    .from("books")
    .select(BOOK_CARD_COLUMNS)
    .order("ratings_count", { ascending: false, nullsFirst: false })
    .limit(200); // Get a pool of books to score

  if (!allBooks || allBooks.length === 0) {
    return [];
  }

  // Get aggregate vibe tags for these books from reviews
  const bookIds = allBooks.map((b) => b.id);
  const { data: bookReviews } = await supabase
    .from("reviews")
    .select("book_id, vibe_tags")
    .in("book_id", bookIds)
    .not("vibe_tags", "eq", "{}");

  // Build a map of book_id -> vibe tags
  const bookVibeTags = new Map<string, string[]>();
  for (const review of bookReviews || []) {
    const existing = bookVibeTags.get(review.book_id) || [];
    for (const tag of review.vibe_tags || []) {
      if (!existing.includes(tag)) {
        existing.push(tag);
      }
    }
    bookVibeTags.set(review.book_id, existing);
  }

  // 6. Score and rank books
  const scoredBooks: RecommendedBook[] = [];

  for (const book of allBooks as BookSummary[]) {
    // Skip books already on shelf
    if (excludedBookIds.has(book.id)) {
      continue;
    }

    let score = 0;
    let bestReason: RecommendationReason | null = null;

    const bookGenres = book.genres || [];
    const bookVibes = bookVibeTags.get(book.id) || [];

    // Score: Genre match with taste profile
    if (tasteProfile?.preferred_genres?.length) {
      for (const genre of bookGenres) {
        if (tasteProfile.preferred_genres.includes(genre)) {
          score += WEIGHTS.GENRE_MATCH;
          if (!bestReason || bestReason.type !== "genre_match") {
            bestReason = {
              type: "genre_match",
              label: `Matches your taste for ${genre}`,
              relatedGenre: genre,
            };
          }
        }
      }
    }

    // Score: Similar to loved books (genre overlap)
    for (const genre of bookGenres) {
      if (lovedGenres.has(genre)) {
        score += WEIGHTS.SIMILAR_TO_LOVED;
        const relatedTitle = lovedGenres.get(genre)!;
        // Prefer this reason if score is higher
        if (!bestReason || score > WEIGHTS.SIMILAR_TO_LOVED) {
          bestReason = {
            type: "similar_to_loved",
            label: `Similar to "${relatedTitle}"`,
            relatedBookTitle: relatedTitle,
            relatedGenre: genre,
          };
        }
        break; // Only count once per book
      }
    }

    // Score: Vibe tag match with taste profile
    if (tasteProfile?.preferred_vibes?.length && bookVibes.length > 0) {
      for (const vibe of bookVibes) {
        if (tasteProfile.preferred_vibes.includes(vibe)) {
          score += WEIGHTS.VIBE_MATCH;
          if (!bestReason || bestReason.type === "popular_in_genre") {
            bestReason = {
              type: "vibe_match",
              label: `Has "${vibe.replace("-", " ")}" vibe you like`,
              relatedVibe: vibe,
            };
          }
        }
      }
    }

    // Score: Vibe match with user's review patterns
    if (usedVibeTags.size > 0 && bookVibes.length > 0) {
      for (const vibe of bookVibes) {
        if (usedVibeTags.has(vibe)) {
          score += Math.floor(WEIGHTS.VIBE_MATCH / 2); // Half weight for implicit vibes
        }
      }
    }

    // Score: High average rating
    if (book.average_rating && book.average_rating >= 4.0) {
      score += WEIGHTS.HIGH_RATING;
      if (!bestReason) {
        bestReason = {
          type: "highly_rated",
          label: `Highly rated (${book.average_rating.toFixed(1)}★)`,
        };
      }
    }

    // Score: Popularity bonus (small)
    if (book.ratings_count && book.ratings_count >= 10) {
      score += WEIGHTS.POPULAR;
    }

    // Only include books with some relevance
    if (score > 0 && bestReason) {
      scoredBooks.push({
        ...book,
        score,
        reason: bestReason,
      });
    }
  }

  // Sort by score descending
  scoredBooks.sort((a, b) => b.score - a.score);

  // Return top N
  return scoredBooks.slice(0, limit);
}

/**
 * Get recommendations for a specific book ("readers also enjoyed")
 * Works for both logged-in and anonymous users
 */
export async function getSimilarBookRecommendations(
  bookId: string,
  userId: string | null,
  limit: number = 6
): Promise<RecommendedBook[]> {
  const supabase = await createClient();

  // 1. Get the current book
  const { data: currentBook } = await supabase
    .from("books")
    .select(BOOK_CARD_COLUMNS)
    .eq("id", bookId)
    .single();

  if (!currentBook) {
    return [];
  }

  // 2. Get vibe tags for this book from reviews
  const { data: bookReviews } = await supabase
    .from("reviews")
    .select("vibe_tags")
    .eq("book_id", bookId)
    .not("vibe_tags", "eq", "{}");

  const currentBookVibes = new Set<string>();
  for (const review of bookReviews || []) {
    for (const tag of review.vibe_tags || []) {
      currentBookVibes.add(tag);
    }
  }

  // 3. Get user's taste profile and excluded books (if logged in)
  let tasteProfile: UserTasteProfile | null = null;
  const excludedBookIds = new Set<string>([bookId]); // Always exclude current book

  if (userId) {
    const [profileResult, userBooksResult] = await Promise.all([
      supabase
        .from("user_taste_profiles")
        .select("*")
        .eq("user_id", userId)
        .single(),
      supabase.from("user_books").select("book_id").eq("user_id", userId),
    ]);

    tasteProfile = profileResult.data as UserTasteProfile | null;
    for (const ub of userBooksResult.data || []) {
      excludedBookIds.add(ub.book_id);
    }
  }

  // 4. Find similar books by genre
  const currentGenres = currentBook.genres || [];
  if (currentGenres.length === 0) {
    // Fallback: just get popular books
    const { data: popularBooks } = await supabase
      .from("books")
      .select(BOOK_CARD_COLUMNS)
      .neq("id", bookId)
      .order("ratings_count", { ascending: false, nullsFirst: false })
      .limit(limit);

    return ((popularBooks as BookSummary[]) || []).map((book) => ({
      ...book,
      score: 1,
      reason: {
        type: "popular_in_genre" as RecommendationReasonType,
        label: "Popular book",
      },
    }));
  }

  // Get books that share genres
  const { data: similarBooks } = await supabase
    .from("books")
    .select(BOOK_CARD_COLUMNS)
    .neq("id", bookId)
    .overlaps("genres", currentGenres)
    .order("average_rating", { ascending: false, nullsFirst: false })
    .limit(50);

  if (!similarBooks || similarBooks.length === 0) {
    return [];
  }

  // Get vibe tags for similar books
  const similarBookIds = similarBooks.map((b) => b.id);
  const { data: similarReviews } = await supabase
    .from("reviews")
    .select("book_id, vibe_tags")
    .in("book_id", similarBookIds)
    .not("vibe_tags", "eq", "{}");

  const similarBookVibes = new Map<string, string[]>();
  for (const review of similarReviews || []) {
    const existing = similarBookVibes.get(review.book_id) || [];
    for (const tag of review.vibe_tags || []) {
      if (!existing.includes(tag)) {
        existing.push(tag);
      }
    }
    similarBookVibes.set(review.book_id, existing);
  }

  // 5. Score similar books
  const scoredBooks: RecommendedBook[] = [];

  for (const book of similarBooks as BookSummary[]) {
    if (excludedBookIds.has(book.id)) {
      continue;
    }

    let score = 0;
    let bestReason: RecommendationReason = {
      type: "popular_in_genre",
      label: `Also in ${currentGenres[0]}`,
      relatedGenre: currentGenres[0],
    };

    const bookGenres = book.genres || [];
    const bookVibes = similarBookVibes.get(book.id) || [];

    // Score: Genre overlap with current book
    const genreOverlap = bookGenres.filter((g: string) =>
      currentGenres.includes(g)
    ).length;
    score += genreOverlap * 20;

    // Score: Vibe tag overlap with current book
    const vibeOverlap = bookVibes.filter((v) => currentBookVibes.has(v)).length;
    if (vibeOverlap > 0) {
      score += vibeOverlap * 15;
      const matchingVibe = bookVibes.find((v) => currentBookVibes.has(v));
      if (matchingVibe) {
        bestReason = {
          type: "vibe_match",
          label: `Similar "${matchingVibe.replace("-", " ")}" vibe`,
          relatedVibe: matchingVibe,
        };
      }
    }

    // Score: User taste profile match (if logged in)
    if (tasteProfile?.preferred_genres?.length) {
      for (const genre of bookGenres) {
        if (tasteProfile.preferred_genres.includes(genre)) {
          score += 10;
        }
      }
    }

    if (tasteProfile?.preferred_vibes?.length) {
      for (const vibe of bookVibes) {
        if (tasteProfile.preferred_vibes.includes(vibe)) {
          score += 8;
        }
      }
    }

    // Score: High rating bonus
    if (book.average_rating && book.average_rating >= 4.0) {
      score += 5;
    }

    scoredBooks.push({
      ...book,
      score,
      reason: bestReason,
    });
  }

  // Sort by score and return top N
  scoredBooks.sort((a, b) => b.score - a.score);
  return scoredBooks.slice(0, limit);
}

/**
 * Get curated books for the home page
 * If user is logged in, returns personalized recommendations
 * Otherwise returns popular highly-rated books
 */
export async function getCuratedBooks(
  userId: string | undefined,
  limit: number = 12
): Promise<RecommendedBook[]> {
  const supabase = await createClient();

  // If user is logged in, try to get personalized recommendations
  if (userId) {
    const hasSignals = await hasEnoughSignals(userId);
    if (hasSignals) {
      return getPersonalizedRecommendations(userId, limit);
    }
  }

  // Fallback: get diverse highly-rated books across different genres
  // This provides a better "curated" experience than just newest books
  const { data: books, error } = await supabase
    .from("books")
    .select(BOOK_CARD_COLUMNS)
    .gte("average_rating", 3.8) // Only well-rated books
    .gte("ratings_count", 5) // With enough reviews to be reliable
    .order("ratings_count", { ascending: false, nullsFirst: false })
    .limit(limit * 3); // Get more to allow for genre diversity

  if (error || !books || books.length === 0) {
    // Ultimate fallback: just get popular books
    const { data: fallbackBooks } = await supabase
      .from("books")
      .select(BOOK_CARD_COLUMNS)
      .order("ratings_count", { ascending: false, nullsFirst: false })
      .limit(limit);

    return ((fallbackBooks as BookSummary[]) || []).map((book) => ({
      ...book,
      score: book.ratings_count || 0,
      reason: {
        type: "popular_in_genre" as RecommendationReasonType,
        label: "Popular choice",
      },
    }));
  }

  // Ensure genre diversity - pick books from different genres
  const selectedBooks: BookSummary[] = [];
  const usedGenres = new Set<string>();

  for (const book of books as BookSummary[]) {
    if (selectedBooks.length >= limit) break;

    // Get primary genre
    const primaryGenre = book.genres?.[0];

    // If we haven't selected from this genre yet, prefer it
    if (primaryGenre && !usedGenres.has(primaryGenre)) {
      selectedBooks.push(book);
      usedGenres.add(primaryGenre);
    } else if (selectedBooks.length < limit / 2) {
      // For the first half, prioritize diversity
      continue;
    } else {
      // After half filled, allow repeats
      selectedBooks.push(book);
    }
  }

  // Fill remaining slots if needed
  for (const book of books as BookSummary[]) {
    if (selectedBooks.length >= limit) break;
    if (!selectedBooks.includes(book)) {
      selectedBooks.push(book);
    }
  }

  return selectedBooks.map((book) => ({
    ...book,
    score: (book.average_rating || 0) * 20 + (book.ratings_count || 0),
    reason: {
      type: "highly_rated" as RecommendationReasonType,
      label: book.average_rating
        ? `${book.average_rating.toFixed(1)}★ curated pick`
        : "Staff pick",
    },
  }));
}

/**
 * Get trending books on the platform (most recently added/reviewed)
 */
export async function getTrendingOnPlatform(
  limit: number = 12
): Promise<RecommendedBook[]> {
  const supabase = await createClient();

  // Get books that have been recently added to shelves
  const { data: recentActivity, error: activityError } = await supabase
    .from("user_books")
    .select(`book_id, book:books(${BOOK_CARD_COLUMNS})`)
    .order("created_at", { ascending: false })
    .limit(100);

  if (activityError || !recentActivity) {
    return [];
  }

  // Count occurrences and dedupe
  const bookCounts = new Map<string, { book: BookSummary; count: number }>();
  for (const item of recentActivity) {
    // The embedded join returns the generated row; narrow cover_source at the boundary
    const book = item.book as BookSummary | null;
    if (!book) continue;

    const existing = bookCounts.get(book.id);
    if (existing) {
      existing.count++;
    } else {
      bookCounts.set(book.id, { book, count: 1 });
    }
  }

  // Sort by count and take top N
  const sorted = Array.from(bookCounts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

  return sorted.map(({ book, count }) => ({
    ...book,
    score: count,
    reason: {
      type: "popular_in_genre" as RecommendationReasonType,
      label: `${count} readers added recently`,
    },
  }));
}

/**
 * Get globally trending/popular books
 */
export async function getTrendingGlobally(
  limit: number = 12
): Promise<RecommendedBook[]> {
  const supabase = await createClient();

  // Get most popular books - prioritize those with ratings, then by creation date
  const { data: books, error } = await supabase
    .from("books")
    .select(BOOK_CARD_COLUMNS)
    .order("ratings_count", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !books) {
    return [];
  }

  return (books as BookSummary[]).map((book) => ({
    ...book,
    score: book.ratings_count || 0,
    reason: {
      type: "popular_in_genre" as RecommendationReasonType,
      label: book.ratings_count
        ? `${book.ratings_count} ratings`
        : "Recently added",
    },
  }));
}

/**
 * Fetch truly trending books based on recent activity.
 * Uses createPublicClient (no cookies) so it can be wrapped with unstable_cache.
 */
async function fetchTrulyTrending(
  limit: number,
  daysWindow: number,
  genre: string
): Promise<TrendingBook[]> {
  const supabase = createPublicClient();
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - daysWindow);
  const windowStartISO = windowStart.toISOString();

  // Counted in SQL (migration 058). Fetching every review and shelf add in the
  // window truncated at PostgREST's 1000-row cap on a busy window. The RPC is
  // SECURITY INVOKER, so it still honours the discovery_visible gate on
  // user_books from migration 056.
  const { data: activity } = await supabase.rpc("get_trending_activity", {
    p_since: windowStartISO,
  });

  const reviewCounts = new Map<string, number>();
  const addCounts = new Map<string, number>();

  for (const row of activity || []) {
    if (row.review_count) reviewCounts.set(row.book_id, Number(row.review_count));
    if (row.add_count) addCounts.set(row.book_id, Number(row.add_count));
  }

  // Calculate trending scores (reviews worth more than adds)
  const scores = new Map<string, number>();
  const allBookIds = new Set([...reviewCounts.keys(), ...addCounts.keys()]);

  for (const bookId of allBookIds) {
    const reviews = reviewCounts.get(bookId) || 0;
    const adds = addCounts.get(bookId) || 0;
    scores.set(bookId, reviews * 10 + adds * 3);
  }

  // Get top scoring book IDs
  const topEntries = [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit * 2); // Get more to allow for genre filtering

  const topIds = topEntries.map(([id]) => id);

  // Fetch book details for books with recent activity
  let trendingBooks: TrendingBook[] = [];

  if (topIds.length > 0) {
    let query = supabase.from("books").select(BOOK_CARD_COLUMNS).in("id", topIds);

    if (genre) {
      query = query.contains("genres", [genre]);
    }

    const { data: books } = await query;

    // Sort by score, add rank and metrics
    trendingBooks = ((books as BookSummary[]) || [])
      .sort((a, b) => (scores.get(b.id) || 0) - (scores.get(a.id) || 0))
      .map((book) => ({
        ...book,
        score: scores.get(book.id) || 0,
        rank: 0, // Will be set below
        metrics: {
          recentReviews: reviewCounts.get(book.id) || 0,
          recentAdds: addCounts.get(book.id) || 0,
        },
        reason: {
          type: "trending" as RecommendationReasonType,
          label: daysWindow === 7 ? "Trending this week" :
                 daysWindow === 30 ? "Trending this month" : "Popular all time",
        },
      }));
  }

  // If we don't have enough trending books, fill with popular books
  if (trendingBooks.length < limit) {
    const existingIds = new Set(trendingBooks.map((b) => b.id));
    const needed = limit - trendingBooks.length;

    // Get popular books to fill the gap
    let popularQuery = supabase
      .from("books")
      .select(BOOK_CARD_COLUMNS)
      .order("ratings_count", { ascending: false, nullsFirst: false })
      .limit(needed + 10); // Get extra in case some are already included

    if (genre) {
      popularQuery = popularQuery.contains("genres", [genre]);
    }

    const { data: popularBooks } = await popularQuery;

    // Add popular books that aren't already in the list
    const fillerBooks = ((popularBooks as BookSummary[]) || [])
      .filter((b) => !existingIds.has(b.id))
      .slice(0, needed)
      .map((book) => ({
        ...book,
        score: 0,
        rank: 0,
        metrics: { recentReviews: 0, recentAdds: 0 },
        reason: {
          type: "popular_in_genre" as RecommendationReasonType,
          label: book.ratings_count
            ? `${book.ratings_count.toLocaleString()} ratings`
            : "Popular",
        },
      }));

    trendingBooks = [...trendingBooks, ...fillerBooks];
  }

  // Assign ranks and limit to requested amount
  return trendingBooks.slice(0, limit).map((book, index) => ({
    ...book,
    rank: index + 1,
  }));
}

/**
 * Get truly trending books based on recent activity - cached for 1 hour.
 * Scores based on reviews and shelf adds in the time window.
 */
export async function getTrulyTrending(
  limit: number = 12,
  daysWindow: number = 7,
  genre?: string
): Promise<TrendingBook[]> {
  const cachedFn = unstable_cache(
    fetchTrulyTrending,
    ["truly-trending", String(limit), String(daysWindow), genre || "all"],
    // Scored from reviews + shelf adds over a rolling window.
    { revalidate: 3600, tags: [CACHE_TAGS.books, CACHE_TAGS.reviews, CACHE_TAGS.trending] } // 1 hour
  );
  return cachedFn(limit, daysWindow, genre || "");
}

/**
 * Check if user has enough signals for personalized recommendations
 */
export async function hasEnoughSignals(userId: string): Promise<boolean> {
  const supabase = await createClient();

  // Check taste profile
  const { data: tasteProfile } = await supabase
    .from("user_taste_profiles")
    .select("preferred_genres, preferred_vibes, seed_book_ids, onboarding_completed")
    .eq("user_id", userId)
    .single();

  if (tasteProfile?.onboarding_completed) {
    return true;
  }

  if (
    (tasteProfile?.preferred_genres?.length ?? 0) >= 3 ||
    (tasteProfile?.seed_book_ids?.length ?? 0) >= 2
  ) {
    return true;
  }

  // Check if user has rated any books
  const { count } = await supabase
    .from("user_books")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("rating", 1);

  return (count || 0) >= 3;
}
