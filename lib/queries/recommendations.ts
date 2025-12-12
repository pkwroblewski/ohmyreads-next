import { createClient } from "@/lib/supabase/server";
import type { Book, UserTasteProfile } from "@/types/database";

// Recommendation reason types
export type RecommendationReasonType =
  | "genre_match"
  | "vibe_match"
  | "similar_to_loved"
  | "popular_in_genre"
  | "highly_rated";

export interface RecommendationReason {
  type: RecommendationReasonType;
  label: string;
  relatedBookTitle?: string;
  relatedGenre?: string;
  relatedVibe?: string;
}

export interface RecommendedBook extends Book {
  score: number;
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
    const book = ub.book as unknown as Book | null;
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
    .select("*")
    .order("ratings_count", { ascending: false })
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

  for (const book of allBooks) {
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
    .select("*")
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

    tasteProfile = profileResult.data;
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
      .select("*")
      .neq("id", bookId)
      .order("ratings_count", { ascending: false })
      .limit(limit);

    return (popularBooks || []).map((book) => ({
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
    .select("*")
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

  for (const book of similarBooks) {
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

  // Fallback: get popular highly-rated books
  const { data: books, error } = await supabase
    .from("books")
    .select("*")
    .gte("average_rating", 3.5)
    .order("ratings_count", { ascending: false })
    .limit(limit);

  if (error || !books) {
    return [];
  }

  return books.map((book) => ({
    ...book,
    score: book.ratings_count || 0,
    reason: {
      type: "highly_rated" as RecommendationReasonType,
      label: `${book.average_rating?.toFixed(1) || "N/A"}★ rating`,
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
    .select("book_id, book:books(*)")
    .order("created_at", { ascending: false })
    .limit(100);

  if (activityError || !recentActivity) {
    return [];
  }

  // Count occurrences and dedupe
  const bookCounts = new Map<string, { book: Book; count: number }>();
  for (const item of recentActivity) {
    const book = item.book as unknown as Book | null;
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

  // Get most popular books by ratings count
  const { data: books, error } = await supabase
    .from("books")
    .select("*")
    .not("average_rating", "is", null)
    .order("ratings_count", { ascending: false })
    .limit(limit);

  if (error || !books) {
    return [];
  }

  return books.map((book) => ({
    ...book,
    score: book.ratings_count || 0,
    reason: {
      type: "popular_in_genre" as RecommendationReasonType,
      label: `${book.ratings_count || 0} ratings`,
    },
  }));
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
    tasteProfile?.preferred_genres?.length >= 3 ||
    tasteProfile?.seed_book_ids?.length >= 2
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
