import { createClient } from "@/lib/supabase/server";
import { unstable_cache } from "next/cache";
import { sanitizePostgrestValue } from "@/lib/utils/sanitize";
import { getFollowingIds } from "./follows";
import type {
  CompatibilityLevel,
  ReaderWithCompatibility,
  ReaderTasteData,
  ReaderSearchFilters,
} from "@/types/database";

// ============================================
// COMPATIBILITY ALGORITHM
// ============================================

/**
 * Compute compatibility score and level between two taste profiles
 * Algorithm weights:
 * - Shared Books: 40%
 * - Shared Genres: 35%
 * - Shared Vibes: 25%
 */
function computeCompatibilityScore(
  userTaste: ReaderTasteData,
  targetTaste: ReaderTasteData
): { score: number; level: CompatibilityLevel; sharedBooks: number; sharedGenres: string[]; sharedVibes: string[] } {
  // Calculate shared books
  const userBookSet = new Set(userTaste.bookIds);
  const sharedBookIds = targetTaste.bookIds.filter((id) => userBookSet.has(id));
  const sharedBooks = sharedBookIds.length;

  // Calculate shared genres
  const userGenreSet = new Set(userTaste.genres);
  const sharedGenres = targetTaste.genres.filter((g) => userGenreSet.has(g));

  // Calculate shared vibes
  const userVibeSet = new Set(userTaste.vibes);
  const sharedVibes = targetTaste.vibes.filter((v) => userVibeSet.has(v));

  // Normalize each component to 0-100
  // Book score: more shared books = higher score (capped at 10 shared books = 100%)
  const bookScore = Math.min(100, (sharedBooks / Math.max(10, 1)) * 100);

  // Genre score: percentage of overlap
  const totalGenres = Math.max(userTaste.genres.length, 1);
  const genreScore = Math.min(100, (sharedGenres.length / totalGenres) * 100);

  // Vibe score: percentage of overlap
  const totalVibes = Math.max(userTaste.vibes.length, 1);
  const vibeScore = Math.min(100, (sharedVibes.length / totalVibes) * 100);

  // Weighted average
  const score = Math.round(bookScore * 0.4 + genreScore * 0.35 + vibeScore * 0.25);

  // Determine level
  const level: CompatibilityLevel =
    score >= 70 ? "high" : score >= 30 ? "medium" : "low";

  return { score, level, sharedBooks, sharedGenres, sharedVibes };
}

// ============================================
// TASTE DATA QUERIES
// ============================================

/**
 * Get a user's taste data (genres, vibes, book IDs) for compatibility matching
 */
export async function getReaderTasteData(userId: string): Promise<ReaderTasteData> {
  const supabase = await createClient();

  // Fetch user's books (read or reading) with genres
  const { data: userBooks } = await supabase
    .from("user_books")
    .select(`
      book_id,
      book:books(genres)
    `)
    .eq("user_id", userId)
    .in("status", ["read", "reading"]);

  // Fetch user's review vibe tags
  const { data: reviews } = await supabase
    .from("reviews")
    .select("vibe_tags")
    .eq("user_id", userId);

  // Extract book IDs
  const bookIds = (userBooks || []).map((ub) => ub.book_id);

  // Extract and flatten genres
  const genresSet = new Set<string>();
  (userBooks || []).forEach((ub) => {
    const book = Array.isArray(ub.book) ? ub.book[0] : ub.book;
    if (book?.genres) {
      book.genres.forEach((g: string) => genresSet.add(g));
    }
  });

  // Extract and flatten vibes
  const vibesSet = new Set<string>();
  (reviews || []).forEach((r) => {
    if (r.vibe_tags) {
      r.vibe_tags.forEach((v: string) => vibesSet.add(v));
    }
  });

  return {
    bookIds,
    genres: Array.from(genresSet),
    vibes: Array.from(vibesSet),
  };
}

/**
 * Cached version of getReaderTasteData
 */
export const getCachedReaderTasteData = unstable_cache(
  getReaderTasteData,
  ["reader-taste-data"],
  { revalidate: 3600 } // Cache for 1 hour
);

// ============================================
// SEARCH QUERIES
// ============================================

/**
 * Search readers by username or display name
 */
export async function searchReaders(options: {
  query: string;
  limit?: number;
  offset?: number;
  excludeUserId?: string;
}): Promise<{ readers: ReaderWithCompatibility[]; total: number }> {
  const { query, limit = 20, offset = 0, excludeUserId } = options;

  if (!query || query.length < 2) {
    return { readers: [], total: 0 };
  }

  const supabase = await createClient();

  // Use ILIKE for case-insensitive search
  // Sanitized: `.` `,` `(` `)` are structural in PostgREST, so a raw term could
  // otherwise append filters to this profiles select.
  const safeQuery = sanitizePostgrestValue(query);

  let queryBuilder = supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, bio, followers_count, following_count", {
      count: "exact",
    })
    .eq("discovery_visible", true)
    .or(`username.ilike.%${safeQuery}%,display_name.ilike.%${safeQuery}%`)
    .order("followers_count", { ascending: false })
    .range(offset, offset + limit - 1);

  if (excludeUserId) {
    queryBuilder = queryBuilder.neq("id", excludeUserId);
  }

  const { data, error, count } = await queryBuilder;

  if (error) {
    console.error("Error searching readers:", error);
    return { readers: [], total: 0 };
  }

  // Get book counts for each user
  const userIds = (data || []).map((p) => p.id);

  const { data: bookCounts } = await supabase
    .from("user_books")
    .select("user_id")
    .in("user_id", userIds);

  const { data: reviewCounts } = await supabase
    .from("reviews")
    .select("user_id")
    .in("user_id", userIds);

  // Count per user
  const booksPerUser = new Map<string, number>();
  const reviewsPerUser = new Map<string, number>();

  (bookCounts || []).forEach((b) => {
    booksPerUser.set(b.user_id, (booksPerUser.get(b.user_id) || 0) + 1);
  });

  (reviewCounts || []).forEach((r) => {
    reviewsPerUser.set(r.user_id, (reviewsPerUser.get(r.user_id) || 0) + 1);
  });

  // Map to ReaderWithCompatibility (without compatibility for search)
  const readers: ReaderWithCompatibility[] = (data || []).map((p) => ({
    id: p.id,
    username: p.username,
    display_name: p.display_name,
    avatar_url: p.avatar_url,
    bio: p.bio,
    followers_count: p.followers_count || 0,
    following_count: p.following_count || 0,
    books_count: booksPerUser.get(p.id) || 0,
    reviews_count: reviewsPerUser.get(p.id) || 0,
    compatibility: "unknown" as CompatibilityLevel,
    compatibility_score: 0,
    shared_books: 0,
    shared_genres: [],
    shared_vibes: [],
  }));

  return { readers, total: count || 0 };
}

// ============================================
// RECOMMENDATION QUERIES
// ============================================

/**
 * Get recommended readers based on taste matching
 */
export async function getRecommendedReaders(
  userId: string,
  options: {
    limit?: number;
    excludeFollowing?: boolean;
  } = {}
): Promise<ReaderWithCompatibility[]> {
  const { limit = 10, excludeFollowing = true } = options;

  const supabase = await createClient();

  // Get current user's taste data
  const userTaste = await getCachedReaderTasteData(userId);

  // If user has no reading data, fall back to active readers
  if (userTaste.bookIds.length === 0 && userTaste.genres.length === 0) {
    return getActiveReaders(userId, limit);
  }

  // Get users who have read similar books
  const { data: sharedBooksData } = await supabase
    .from("user_books")
    .select("user_id")
    .in("book_id", userTaste.bookIds.slice(0, 50)) // Limit to 50 books for performance
    .neq("user_id", userId);

  if (!sharedBooksData || sharedBooksData.length === 0) {
    return getActiveReaders(userId, limit);
  }

  // Count shared books per user and get top candidates
  const sharedBooksCount = new Map<string, number>();
  sharedBooksData.forEach((row) => {
    sharedBooksCount.set(row.user_id, (sharedBooksCount.get(row.user_id) || 0) + 1);
  });

  // Get IDs of users already followed if excluding
  let excludeIds = new Set<string>();
  if (excludeFollowing) {
    const followingIds = await getFollowingIds(userId);
    excludeIds = new Set(followingIds);
  }

  // Sort by shared books and get top candidates
  const candidateIds = Array.from(sharedBooksCount.entries())
    .filter(([id]) => !excludeIds.has(id))
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit * 2) // Get extra for filtering
    .map(([id]) => id);

  if (candidateIds.length === 0) {
    return getActiveReaders(userId, limit);
  }

  // Fetch profiles for candidates
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, bio, followers_count, following_count")
    .in("id", candidateIds);

  if (!profiles) return [];

  // Get book and review counts
  const { data: bookCounts } = await supabase
    .from("user_books")
    .select("user_id")
    .in("user_id", candidateIds);

  const { data: reviewCounts } = await supabase
    .from("reviews")
    .select("user_id")
    .in("user_id", candidateIds);

  const booksPerUser = new Map<string, number>();
  const reviewsPerUser = new Map<string, number>();

  (bookCounts || []).forEach((b) => {
    booksPerUser.set(b.user_id, (booksPerUser.get(b.user_id) || 0) + 1);
  });

  (reviewCounts || []).forEach((r) => {
    reviewsPerUser.set(r.user_id, (reviewsPerUser.get(r.user_id) || 0) + 1);
  });

  // Calculate compatibility for each candidate
  const readersWithCompatibility: ReaderWithCompatibility[] = [];

  for (const profile of profiles) {
    const targetTaste = await getCachedReaderTasteData(profile.id);
    const compat = computeCompatibilityScore(userTaste, targetTaste);

    readersWithCompatibility.push({
      id: profile.id,
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      bio: profile.bio,
      followers_count: profile.followers_count || 0,
      following_count: profile.following_count || 0,
      books_count: booksPerUser.get(profile.id) || 0,
      reviews_count: reviewsPerUser.get(profile.id) || 0,
      compatibility: compat.level,
      compatibility_score: compat.score,
      shared_books: compat.sharedBooks,
      shared_genres: compat.sharedGenres,
      shared_vibes: compat.sharedVibes,
    });
  }

  // Sort by compatibility score and return top results
  return readersWithCompatibility
    .sort((a, b) => b.compatibility_score - a.compatibility_score)
    .slice(0, limit);
}

/**
 * Fallback: Get active readers when no taste data available
 */
async function getActiveReaders(
  excludeUserId: string,
  limit: number
): Promise<ReaderWithCompatibility[]> {
  const supabase = await createClient();

  // Get users with most activity (reviews + books)
  const { data: activeUsers } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, bio, followers_count, following_count")
    .eq("discovery_visible", true)
    .neq("id", excludeUserId)
    .order("followers_count", { ascending: false })
    .limit(limit);

  if (!activeUsers) return [];

  // Get book and review counts
  const userIds = activeUsers.map((u) => u.id);

  const { data: bookCounts } = await supabase
    .from("user_books")
    .select("user_id")
    .in("user_id", userIds);

  const { data: reviewCounts } = await supabase
    .from("reviews")
    .select("user_id")
    .in("user_id", userIds);

  const booksPerUser = new Map<string, number>();
  const reviewsPerUser = new Map<string, number>();

  (bookCounts || []).forEach((b) => {
    booksPerUser.set(b.user_id, (booksPerUser.get(b.user_id) || 0) + 1);
  });

  (reviewCounts || []).forEach((r) => {
    reviewsPerUser.set(r.user_id, (reviewsPerUser.get(r.user_id) || 0) + 1);
  });

  return activeUsers.map((u) => ({
    id: u.id,
    username: u.username,
    display_name: u.display_name,
    avatar_url: u.avatar_url,
    bio: u.bio,
    followers_count: u.followers_count || 0,
    following_count: u.following_count || 0,
    books_count: booksPerUser.get(u.id) || 0,
    reviews_count: reviewsPerUser.get(u.id) || 0,
    compatibility: "unknown" as CompatibilityLevel,
    compatibility_score: 0,
    shared_books: 0,
    shared_genres: [],
    shared_vibes: [],
  }));
}

// ============================================
// BROWSE DIRECTORY
// ============================================

/**
 * Browse reader directory with filters and pagination
 */
export async function browseReaders(options: {
  currentUserId?: string;
  filters?: ReaderSearchFilters;
  page?: number;
  limit?: number;
}): Promise<{ readers: ReaderWithCompatibility[]; total: number }> {
  const { currentUserId, filters = {}, page = 1, limit = 20 } = options;
  const offset = (page - 1) * limit;

  const supabase = await createClient();

  // Build base query - only show users who opted into discovery
  let queryBuilder = supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, bio, followers_count, following_count", {
      count: "exact",
    })
    .eq("discovery_visible", true);

  // Apply search filter (sanitized — see searchReaders above)
  if (filters.query && filters.query.length >= 2) {
    const safeFilterQuery = sanitizePostgrestValue(filters.query);
    queryBuilder = queryBuilder.or(
      `username.ilike.%${safeFilterQuery}%,display_name.ilike.%${safeFilterQuery}%`
    );
  }

  // Exclude current user
  if (currentUserId) {
    queryBuilder = queryBuilder.neq("id", currentUserId);
  }

  // Apply sorting
  switch (filters.sortBy) {
    case "followers":
      queryBuilder = queryBuilder.order("followers_count", { ascending: false });
      break;
    case "recent":
      queryBuilder = queryBuilder.order("created_at", { ascending: false });
      break;
    default:
      // Default to followers for non-compatibility sorts
      queryBuilder = queryBuilder.order("followers_count", { ascending: false });
  }

  // Apply pagination
  queryBuilder = queryBuilder.range(offset, offset + limit - 1);

  const { data, error, count } = await queryBuilder;

  if (error) {
    console.error("Error browsing readers:", error);
    return { readers: [], total: 0 };
  }

  if (!data || data.length === 0) {
    return { readers: [], total: count || 0 };
  }

  // Get book and review counts
  const userIds = data.map((p) => p.id);

  const { data: bookCounts } = await supabase
    .from("user_books")
    .select("user_id")
    .in("user_id", userIds);

  const { data: reviewCounts } = await supabase
    .from("reviews")
    .select("user_id")
    .in("user_id", userIds);

  const booksPerUser = new Map<string, number>();
  const reviewsPerUser = new Map<string, number>();

  (bookCounts || []).forEach((b) => {
    booksPerUser.set(b.user_id, (booksPerUser.get(b.user_id) || 0) + 1);
  });

  (reviewCounts || []).forEach((r) => {
    reviewsPerUser.set(r.user_id, (reviewsPerUser.get(r.user_id) || 0) + 1);
  });

  // If currentUserId provided and sorting by compatibility, calculate scores
  let readers: ReaderWithCompatibility[];

  if (currentUserId && filters.sortBy === "compatibility") {
    const userTaste = await getCachedReaderTasteData(currentUserId);

    readers = await Promise.all(
      data.map(async (profile) => {
        const targetTaste = await getCachedReaderTasteData(profile.id);
        const compat = computeCompatibilityScore(userTaste, targetTaste);

        return {
          id: profile.id,
          username: profile.username,
          display_name: profile.display_name,
          avatar_url: profile.avatar_url,
          bio: profile.bio,
          followers_count: profile.followers_count || 0,
          following_count: profile.following_count || 0,
          books_count: booksPerUser.get(profile.id) || 0,
          reviews_count: reviewsPerUser.get(profile.id) || 0,
          compatibility: compat.level,
          compatibility_score: compat.score,
          shared_books: compat.sharedBooks,
          shared_genres: compat.sharedGenres,
          shared_vibes: compat.sharedVibes,
        };
      })
    );

    // Sort by compatibility score
    readers.sort((a, b) => b.compatibility_score - a.compatibility_score);
  } else {
    // Without compatibility calculation
    readers = data.map((profile) => ({
      id: profile.id,
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      bio: profile.bio,
      followers_count: profile.followers_count || 0,
      following_count: profile.following_count || 0,
      books_count: booksPerUser.get(profile.id) || 0,
      reviews_count: reviewsPerUser.get(profile.id) || 0,
      compatibility: "unknown" as CompatibilityLevel,
      compatibility_score: 0,
      shared_books: 0,
      shared_genres: [],
      shared_vibes: [],
    }));
  }

  return { readers, total: count || 0 };
}

// ============================================
// SIDEBAR RECOMMENDATIONS
// ============================================

/**
 * Get sidebar recommendations with compatibility (cached)
 */
export const getSidebarRecommendations = unstable_cache(
  async (userId: string) => {
    return getRecommendedReaders(userId, { limit: 5, excludeFollowing: true });
  },
  ["sidebar-recommendations"],
  { revalidate: 1800 } // Cache for 30 minutes
);
