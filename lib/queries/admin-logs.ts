"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuditLogs, type AuditAction, type AuditTargetType } from "@/lib/utils/audit-log";

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

export interface LogFilters {
  action?: AuditAction;
  targetType?: AuditTargetType;
  userId?: string;
  page?: number;
  limit?: number;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  user_id: string | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  user?: {
    username: string;
    display_name: string | null;
  };
}

export async function adminGetAuditLogs(filters: LogFilters = {}) {
  try {
    const { supabase } = await requireAdmin();

    const { page = 1, limit = 50, action, targetType, userId } = filters;
    const offset = (page - 1) * limit;

    const result = await getAuditLogs({
      action,
      targetType,
      userId,
      limit,
      offset,
    });

    // Enrich with user info
    const userIds = [...new Set(result.logs.map((log) => log.user_id).filter(Boolean))];
    const enrichedLogs: AuditLogEntry[] = [];

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, display_name")
        .in("id", userIds);

      const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

      for (const log of result.logs) {
        const user = log.user_id ? profileMap.get(log.user_id) : undefined;
        enrichedLogs.push({
          ...log,
          user: user ? { username: user.username, display_name: user.display_name } : undefined,
        });
      }
    } else {
      enrichedLogs.push(...result.logs);
    }

    return {
      success: true,
      logs: enrichedLogs,
      total: result.total,
      page,
      totalPages: Math.ceil(result.total / limit),
    };
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    return { success: false, error: "Failed to fetch audit logs" };
  }
}

// Get unique action types from logs
export async function adminGetLogActionTypes() {
  try {
    await requireAdmin();

    // Return all possible action types
    const actionTypes: AuditAction[] = [
      "moderation.book.approve",
      "moderation.book.reject",
      "moderation.place.approve",
      "moderation.place.reject",
      "admin.user.ban",
      "admin.user.unban",
      "admin.user.make_admin",
      "admin.user.remove_admin",
      "admin.user.disable",
      "admin.user.enable",
      "admin.user.toggle_admin",
      "moderation.review.delete",
      "moderation.comment.delete",
      "admin.book.create",
      "admin.book.update",
      "admin.book.delete",
      "admin.review.delete",
      "admin.review.flag",
      "admin.import.books",
    ];

    return { success: true, actionTypes };
  } catch (error) {
    console.error("Error fetching action types:", error);
    return { success: false, error: "Failed to fetch action types" };
  }
}
