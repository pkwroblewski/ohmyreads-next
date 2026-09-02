/**
 * Audit Logging Utility
 *
 * Provides immutable audit trail for sensitive actions.
 * Only admins can read logs, only service role can insert.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/utils/log";
import type { Json } from "@/types/database";

// Audit action types
export type AuditAction =
  // Moderation actions
  | "moderation.book.approve"
  | "moderation.book.reject"
  | "moderation.place.approve"
  | "moderation.place.reject"
  // User management
  | "admin.user.ban"
  | "admin.user.unban"
  | "admin.user.make_admin"
  | "admin.user.remove_admin"
  | "admin.user.disable"
  | "admin.user.enable"
  | "admin.user.toggle_admin"
  // Content moderation
  | "moderation.review.delete"
  | "moderation.comment.delete"
  // User reports (migration 062)
  | "moderation.report.resolve"
  | "moderation.report.dismiss"
  // Admin book management
  | "admin.book.create"
  | "admin.book.update"
  | "admin.book.delete"
  // Admin review management
  | "admin.review.delete"
  | "admin.review.flag"
  // Bulk import
  | "admin.import.books"
  // User actions (self)
  | "user.delete_account"
  | "user.export_data"
  // Authentication
  | "auth.login"
  | "auth.logout"
  | "auth.password_change"
  | "auth.password_reset";

// Target types
export type AuditTargetType =
  | "book_submission"
  | "place_submission"
  | "user"
  | "review"
  | "comment"
  | "book"
  | "place"
  | "report";

interface AuditLogEntry {
  action: AuditAction;
  targetType: AuditTargetType;
  targetId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Create an audit log entry
 *
 * Uses admin client (service role) to bypass RLS and ensure logs can always be written.
 *
 * @example
 * ```ts
 * await createAuditLog({
 *   action: "moderation.book.approve",
 *   targetType: "book_submission",
 *   targetId: submissionId,
 *   userId: adminUserId,
 *   metadata: { bookTitle: submission.title },
 * });
 * ```
 */
export async function createAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    const supabase = createAdminClient();

    const { error } = await supabase.from("audit_logs").insert({
      action: entry.action,
      target_type: entry.targetType,
      target_id: entry.targetId || null,
      user_id: entry.userId || null,
      metadata: (entry.metadata || {}) as Json,
      ip_address: entry.ipAddress || null,
      user_agent: entry.userAgent || null,
    });

    if (error) {
      // Log error but don't throw - audit logging should not break the main flow
      logger.error("Failed to create audit log", {
        error: error.message,
        entry,
      });
    } else {
      logger.debug("Audit log created", {
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
      });
    }
  } catch (error) {
    // Log error but don't throw - audit logging should not break the main flow
    logger.error("Unexpected error in createAuditLog", {
      error: error instanceof Error ? error.message : "Unknown error",
      entry,
    });
  }
}

/**
 * Get audit logs (admin only)
 *
 * @param options - Query options
 * @returns Paginated audit logs
 */
export async function getAuditLogs(options?: {
  userId?: string;
  action?: AuditAction;
  targetType?: AuditTargetType;
  targetId?: string;
  limit?: number;
  offset?: number;
}): Promise<{
  logs: Array<{
    id: string;
    action: string;
    target_type: string;
    target_id: string | null;
    user_id: string | null;
    metadata: Record<string, unknown>;
    ip_address: string | null;
    user_agent: string | null;
    created_at: string;
  }>;
  total: number;
}> {
  const supabase = createAdminClient();
  const limit = options?.limit || 50;
  const offset = options?.offset || 0;

  let query = supabase
    .from("audit_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (options?.userId) {
    query = query.eq("user_id", options.userId);
  }
  if (options?.action) {
    query = query.eq("action", options.action);
  }
  if (options?.targetType) {
    query = query.eq("target_type", options.targetType);
  }
  if (options?.targetId) {
    query = query.eq("target_id", options.targetId);
  }

  const { data, count, error } = await query;

  if (error) {
    logger.error("Failed to fetch audit logs", { error: error.message });
    return { logs: [], total: 0 };
  }

  return {
    // metadata is a Json column; the declared shape narrows it to an object
    logs: (data || []).map((log) => ({
      ...log,
      metadata: (log.metadata ?? {}) as Record<string, unknown>,
    })),
    total: count || 0,
  };
}
