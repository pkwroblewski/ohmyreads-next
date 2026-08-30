import { createClient, createPublicClient } from "@/lib/supabase/server";
import { getCuratedList, type CuratedList } from "@/lib/data/curated-lists";
import { BOOK_CARD_COLUMNS } from "./columns";
import type { BookSummary, ReadingListWithDetails, ReadingListBookWithBook } from "@/types/database";

export interface CuratedListWithBooks extends CuratedList {
  books: BookSummary[];
}

/**
 * Get a curated list with its books
 */
export async function getCuratedListWithBooks(
  slug: string
): Promise<CuratedListWithBooks | null> {
  const list = getCuratedList(slug);

  if (!list) {
    return null;
  }

  const supabase = createPublicClient();

  let books: BookSummary[] = [];

  // If explicit book slugs are provided, fetch those
  if (list.bookSlugs && list.bookSlugs.length > 0) {
    const { data, error } = await supabase
      .from("books")
      .select(BOOK_CARD_COLUMNS)
      .in("slug", list.bookSlugs)
      .order("ratings_count", { ascending: false, nullsFirst: false });

    if (error) {
      console.error("Error fetching books by slugs:", error);
    } else {
      books = (data || []) as BookSummary[];
    }
  }
  // Otherwise, fetch by genres
  else if (list.genres && list.genres.length > 0) {
    const { data, error } = await supabase
      .from("books")
      .select(BOOK_CARD_COLUMNS)
      .overlaps("genres", list.genres)
      .order("ratings_count", { ascending: false, nullsFirst: false })
      .limit(24);

    if (error) {
      console.error("Error fetching books by genres:", error);
    } else {
      books = (data || []) as BookSummary[];
    }
  }

  return {
    ...list,
    books,
  };
}

// ============================================
// User-Created Lists
// ============================================

interface GetListsOptions {
  page?: number;
  limit?: number;
  userId?: string; // Filter by owner
  search?: string;
}

/**
 * Get public user-created lists
 */
export async function getUserLists(options: GetListsOptions = {}): Promise<{
  lists: ReadingListWithDetails[];
  total: number;
}> {
  const { page = 1, limit = 12, userId, search } = options;
  const offset = (page - 1) * limit;

  const supabase = await createClient();

  // Get current user for like status
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Build query
  let query = supabase
    .from("reading_lists")
    .select(
      `
      *,
      owner:profiles!reading_lists_user_id_fkey(
        id, username, display_name, avatar_url
      )
    `,
      { count: "exact" }
    )
    .eq("visibility", "public")
    .order("likes_count", { ascending: false })
    .range(offset, offset + limit - 1);

  if (userId) {
    query = query.eq("user_id", userId);
  }

  if (search && search.length >= 2) {
    query = query.ilike("title", `%${search}%`);
  }

  const { data: lists, count, error } = await query;

  if (error) {
    console.error("Error fetching lists:", error);
    return { lists: [], total: 0 };
  }

  if (!lists || lists.length === 0) {
    return { lists: [], total: count || 0 };
  }

  // Get book counts for all lists
  const listIds = lists.map((l) => l.id);
  const { data: bookCounts } = await supabase
    .from("reading_list_books")
    .select("list_id")
    .in("list_id", listIds);

  const countMap = new Map<string, number>();
  bookCounts?.forEach((b) => {
    countMap.set(b.list_id, (countMap.get(b.list_id) || 0) + 1);
  });

  // Get user's likes if logged in
  const likedMap = new Map<string, boolean>();
  if (user) {
    const { data: likes } = await supabase
      .from("reading_list_likes")
      .select("list_id")
      .in("list_id", listIds)
      .eq("user_id", user.id);

    likes?.forEach((l) => {
      likedMap.set(l.list_id, true);
    });
  }

  // Transform to ReadingListWithDetails
  const listsWithDetails: ReadingListWithDetails[] = lists.map(
    (list) =>
      ({
        ...list,
        owner: Array.isArray(list.owner) ? list.owner[0] : list.owner,
        books: [],
        book_count: countMap.get(list.id) || 0,
        is_liked: likedMap.get(list.id) || false,
      }) as ReadingListWithDetails
  );

  return { lists: listsWithDetails, total: count || 0 };
}

/**
 * Get a single list by ID with books
 */
export async function getListById(listId: string): Promise<ReadingListWithDetails | null> {
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch list
  const { data: list, error } = await supabase
    .from("reading_lists")
    .select(
      `
      *,
      owner:profiles!reading_lists_user_id_fkey(
        id, username, display_name, avatar_url
      )
    `
    )
    .eq("id", listId)
    .single();

  if (error || !list) {
    return null;
  }

  // Check visibility
  if (list.visibility === "private" && list.user_id !== user?.id) {
    return null;
  }

  // Get books
  const { data: books } = await supabase
    .from("reading_list_books")
    .select(
      `
      *,
      book:books(id, title, author, slug, cover_url)
    `
    )
    .eq("list_id", listId)
    .order("position", { ascending: true });

  // Check if liked
  let isLiked = false;
  if (user) {
    const { data: like } = await supabase
      .from("reading_list_likes")
      .select("list_id")
      .eq("list_id", listId)
      .eq("user_id", user.id)
      .single();

    isLiked = !!like;
  }

  return {
    ...list,
    owner: Array.isArray(list.owner) ? list.owner[0] : list.owner,
    books: (books || []).map((b) => ({
      ...b,
      book: Array.isArray(b.book) ? b.book[0] : b.book,
    })) as ReadingListBookWithBook[],
    book_count: books?.length || 0,
    is_liked: isLiked,
  } as ReadingListWithDetails;
}

/**
 * Get lists owned by current user
 */
export async function getMyLists(): Promise<ReadingListWithDetails[]> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  const { data: lists } = await supabase
    .from("reading_lists")
    .select(
      `
      *,
      owner:profiles!reading_lists_user_id_fkey(
        id, username, display_name, avatar_url
      )
    `
    )
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (!lists) {
    return [];
  }

  // Get book counts
  const listIds = lists.map((l) => l.id);
  const { data: bookCounts } = await supabase
    .from("reading_list_books")
    .select("list_id")
    .in("list_id", listIds);

  const countMap = new Map<string, number>();
  bookCounts?.forEach((b) => {
    countMap.set(b.list_id, (countMap.get(b.list_id) || 0) + 1);
  });

  return lists.map((list) => ({
    ...list,
    owner: Array.isArray(list.owner) ? list.owner[0] : list.owner,
    books: [],
    book_count: countMap.get(list.id) || 0,
    is_liked: false,
  })) as ReadingListWithDetails[];
}

/**
 * Get popular lists for homepage/discovery
 */
export async function getPopularLists(limit: number = 6): Promise<ReadingListWithDetails[]> {
  const supabase = await createClient();

  const { data: lists } = await supabase
    .from("reading_lists")
    .select(
      `
      *,
      owner:profiles!reading_lists_user_id_fkey(
        id, username, display_name, avatar_url
      )
    `
    )
    .eq("visibility", "public")
    .order("likes_count", { ascending: false })
    .limit(limit);

  if (!lists) {
    return [];
  }

  // Get book counts
  const listIds = lists.map((l) => l.id);
  const { data: bookCounts } = await supabase
    .from("reading_list_books")
    .select("list_id")
    .in("list_id", listIds);

  const countMap = new Map<string, number>();
  bookCounts?.forEach((b) => {
    countMap.set(b.list_id, (countMap.get(b.list_id) || 0) + 1);
  });

  return lists.map((list) => ({
    ...list,
    owner: Array.isArray(list.owner) ? list.owner[0] : list.owner,
    books: [],
    book_count: countMap.get(list.id) || 0,
    is_liked: false,
  })) as ReadingListWithDetails[];
}
