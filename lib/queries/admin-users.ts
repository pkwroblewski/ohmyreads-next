// Admin user reads (filtered list, single user, stats).
// Read-only; moved out of the "use server" file in Phase 2 Task 22 so it is a
// plain server function instead of a public POST endpoint.

import { requireAdmin } from "@/lib/auth/require-admin";
import { sanitizePostgrestValue } from "@/lib/utils/sanitize";
import { adminUserIdSchema } from "@/lib/validation/admin";
import { PROFILE_PUBLIC_COLUMNS } from "./columns";
import { logError } from "@/lib/utils/log";

// User filters
export interface UserFilters {
  search?: string;
  isAdmin?: boolean;
  sortBy?: "username" | "created_at" | "books_count" | "reviews_count";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

// User with stats
export interface UserWithStats {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  disabled_at: string | null;
  created_at: string;
  books_count: number;
  reviews_count: number;
}

// Get users with filters
export async function adminGetUsers(filters: UserFilters = {}) {
  try {
    const { supabase } = await requireAdmin();

    const {
      search = "",
      isAdmin,
      sortBy = "created_at",
      sortOrder = "desc",
      page = 1,
      limit = 50,
    } = filters;

    // Build query for profiles with stats
    let query = supabase
      .from("profiles")
      .select(`
        id,
        username,
        display_name,
        avatar_url,
        is_admin,
        disabled_at,
        created_at,
        user_books(count),
        reviews(count)
      `, { count: "exact" });

    // Search filter (sanitize input to prevent PostgREST query manipulation)
    if (search) {
      const safeSearch = sanitizePostgrestValue(search);
      query = query.or(`username.ilike.%${safeSearch}%,display_name.ilike.%${safeSearch}%`);
    }

    // Admin filter
    if (isAdmin !== undefined) {
      query = query.eq("is_admin", isAdmin);
    }

    // Sorting - only direct columns can be sorted
    if (sortBy === "username" || sortBy === "created_at") {
      query = query.order(sortBy, { ascending: sortOrder === "asc" });
    } else {
      query = query.order("created_at", { ascending: sortOrder === "asc" });
    }

    // Pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) throw error;

    // Transform data to include counts
    const users: UserWithStats[] = (data || []).map((user) => ({
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
      is_admin: user.is_admin ?? false,
      disabled_at: user.disabled_at ?? null,
      created_at: user.created_at,
      books_count: Array.isArray(user.user_books)
        ? user.user_books[0]?.count || 0
        : 0,
      reviews_count: Array.isArray(user.reviews)
        ? user.reviews[0]?.count || 0
        : 0,
    }));

    // Sort by computed fields if needed
    if (sortBy === "books_count") {
      users.sort((a, b) =>
        sortOrder === "asc"
          ? a.books_count - b.books_count
          : b.books_count - a.books_count
      );
    } else if (sortBy === "reviews_count") {
      users.sort((a, b) =>
        sortOrder === "asc"
          ? a.reviews_count - b.reviews_count
          : b.reviews_count - a.reviews_count
      );
    }

    return {
      success: true,
      users,
      total: count || 0,
      page,
      totalPages: Math.ceil((count || 0) / limit),
    };
  } catch (error) {
    logError("Error fetching users", error);
    return { success: false, error: "Failed to fetch users" };
  }
}

// Get single user detail
export async function adminGetUser(userId: string) {
  try {
    const { supabase } = await requireAdmin();

    // Read-only: validate id param only
    if (!adminUserIdSchema.safeParse(userId).success) {
      return { success: false, error: "Invalid user ID" };
    }

    // Get profile with stats. Since 065 `*` on profiles is refused for the
    // authenticated role (the admin's session client included), so this reads
    // the public projection, which carries disabled_at.
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select(`
        ${PROFILE_PUBLIC_COLUMNS},
        reading_stats(*),
        user_books(count),
        reviews(count)
      `)
      .eq("id", userId)
      .single();

    if (profileError) throw profileError;

    // Get recent activity
    const [recentBooks, recentReviews] = await Promise.all([
      supabase
        .from("user_books")
        .select("id, status, created_at, book:books(id, title, author, slug)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("reviews")
        .select("id, rating, summary, created_at, book:books(id, title, slug)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    return {
      success: true,
      user: {
        ...profile,
        books_count: Array.isArray(profile.user_books)
          ? profile.user_books[0]?.count || 0
          : 0,
        reviews_count: Array.isArray(profile.reviews)
          ? profile.reviews[0]?.count || 0
          : 0,
        recent_books: recentBooks.data || [],
        recent_reviews: recentReviews.data || [],
      },
    };
  } catch (error) {
    logError("Error fetching user", error);
    return { success: false, error: "Failed to fetch user" };
  }
}

// Get user stats summary
export async function adminGetUserStats() {
  try {
    const { supabase } = await requireAdmin();

    const [totalUsers, adminUsers, newUsersToday] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_admin", true),
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .gte("created_at", new Date().toISOString().split("T")[0]),
    ]);

    return {
      success: true,
      stats: {
        total: totalUsers.count || 0,
        admins: adminUsers.count || 0,
        newToday: newUsersToday.count || 0,
      },
    };
  } catch (error) {
    logError("Error fetching user stats", error);
    return { success: false, error: "Failed to fetch stats" };
  }
}
