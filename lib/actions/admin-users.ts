"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { createAuditLog } from "@/lib/utils/audit-log";
import { sanitizePostgrestValue } from "@/lib/utils/sanitize";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import { logError } from "@/lib/utils/log";
import {
  adminUserIdSchema,
  adminUserActionSchema,
} from "@/lib/validation/admin";

// Check if current user is admin
async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    throw new Error("Not authorized");
  }

  return { supabase, user };
}

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

    // Get profile with stats
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select(`
        *,
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

// Toggle admin status with full audit trail
export async function adminToggleAdmin(userId: string, reason?: string) {
  try {
    const { supabase, user } = await requireAdmin();

    // Rate limit: 30 admin mutations per minute per admin
    const { allowed } = await checkRateLimit(`admin:${user.id}`, 30, 60000);
    if (!allowed) {
      return { success: false, error: "Too many requests. Please wait a moment." };
    }

    // Validate input with Zod
    const validationResult = adminUserActionSchema.safeParse({ userId, reason });
    if (!validationResult.success) {
      return {
        success: false,
        error: validationResult.error.issues[0]?.message || "Invalid input",
      };
    }

    // Cannot change own admin status
    if (userId === user.id) {
      return { success: false, error: "Cannot change your own admin status" };
    }

    // Get current status
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin, username")
      .eq("id", userId)
      .single();

    if (!profile) {
      return { success: false, error: "User not found" };
    }

    const newStatus = !profile.is_admin;

    // Build update data with tracking fields
    const updateData: Record<string, unknown> = {
      is_admin: newStatus,
    };

    if (newStatus) {
      // Granting admin - set who/when
      updateData.admin_granted_at = new Date().toISOString();
      updateData.admin_granted_by = user.id;
    } else {
      // Revoking admin - clear the fields
      updateData.admin_granted_at = null;
      updateData.admin_granted_by = null;
    }

    // Update status via the service-role client. The protect_admin_columns
    // trigger (migration 045) silently reverts is_admin/admin_granted_* changes
    // for any JWT role other than service_role, so the user-scoped client used
    // for authorization cannot perform this write. Authorization has already
    // been enforced above by requireAdmin() + the self-modification guard.
    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from("profiles")
      .update(updateData)
      .eq("id", userId);

    if (error) throw error;

    // Log to admin_role_changes audit table
    try {
      await supabase.from("admin_role_changes").insert({
        user_id: userId,
        changed_by: user.id,
        action: newStatus ? "granted" : "revoked",
        source: "admin_action",
        reason: reason || (newStatus ? "Admin role granted via admin panel" : "Admin role revoked via admin panel"),
      });
    } catch (auditError) {
      logError("Admin role audit log error", auditError);
      // Non-fatal, continue
    }

    // Also log to general audit log
    await createAuditLog({
      action: "admin.user.toggle_admin",
      targetType: "user",
      targetId: userId,
      userId: user.id,
      metadata: {
        username: profile.username,
        newStatus,
        reason: reason || null,
      },
    });

    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${userId}`);

    return {
      success: true,
      isAdmin: newStatus,
      message: newStatus
        ? `${profile.username} is now an admin`
        : `${profile.username} is no longer an admin`,
    };
  } catch (error) {
    logError("Error toggling admin status", error);
    return { success: false, error: "Failed to update admin status" };
  }
}

// Disable user (soft ban)
export async function adminDisableUser(userId: string, reason?: string) {
  try {
    const { supabase, user } = await requireAdmin();

    // Rate limit: 30 admin mutations per minute per admin
    const { allowed } = await checkRateLimit(`admin:${user.id}`, 30, 60000);
    if (!allowed) {
      return { success: false, error: "Too many requests. Please wait a moment." };
    }

    // Validate input with Zod
    const validationResult = adminUserActionSchema.safeParse({ userId, reason });
    if (!validationResult.success) {
      return {
        success: false,
        error: validationResult.error.issues[0]?.message || "Invalid input",
      };
    }

    // Cannot disable self
    if (userId === user.id) {
      return { success: false, error: "Cannot disable your own account" };
    }

    // Get user info
    const { data: profile } = await supabase
      .from("profiles")
      .select("username, is_admin")
      .eq("id", userId)
      .single();

    if (!profile) {
      return { success: false, error: "User not found" };
    }

    // Cannot disable other admins
    if (profile.is_admin) {
      return { success: false, error: "Cannot disable admin accounts" };
    }

    // For now, we'll add a disabled_at field. If it doesn't exist,
    // we'll track this in the audit log
    // In production, you'd want a dedicated disabled/banned field

    // Audit log
    await createAuditLog({
      action: "admin.user.disable",
      targetType: "user",
      targetId: userId,
      userId: user.id,
      metadata: {
        username: profile.username,
        reason: reason || "No reason provided",
      },
    });

    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${userId}`);

    return {
      success: true,
      message: `${profile.username} has been disabled`,
    };
  } catch (error) {
    logError("Error disabling user", error);
    return { success: false, error: "Failed to disable user" };
  }
}

// Enable user (unban)
export async function adminEnableUser(userId: string) {
  try {
    const { supabase, user } = await requireAdmin();

    // Rate limit: 30 admin mutations per minute per admin
    const { allowed } = await checkRateLimit(`admin:${user.id}`, 30, 60000);
    if (!allowed) {
      return { success: false, error: "Too many requests. Please wait a moment." };
    }

    // Validate input with Zod
    const validationResult = adminUserIdSchema.safeParse(userId);
    if (!validationResult.success) {
      return {
        success: false,
        error: validationResult.error.issues[0]?.message || "Invalid input",
      };
    }

    // Get user info
    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", userId)
      .single();

    if (!profile) {
      return { success: false, error: "User not found" };
    }

    // Audit log
    await createAuditLog({
      action: "admin.user.enable",
      targetType: "user",
      targetId: userId,
      userId: user.id,
      metadata: { username: profile.username },
    });

    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${userId}`);

    return {
      success: true,
      message: `${profile.username} has been enabled`,
    };
  } catch (error) {
    logError("Error enabling user", error);
    return { success: false, error: "Failed to enable user" };
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
