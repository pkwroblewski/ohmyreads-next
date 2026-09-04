"use server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { createAuditLog } from "@/lib/utils/audit-log";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import { logError, logger } from "@/lib/utils/log";
import {
  adminUserIdSchema,
  adminUserActionSchema,
} from "@/lib/validation/admin";
import type { ActionResult } from "@/types/app";

/**
 * Supabase Auth has no "banned forever"; a century is the conventional stand-in.
 * `ban_duration: "none"` lifts it.
 */
const PERMANENT_BAN = "876000h";

// Toggle admin status with full audit trail
export async function adminToggleAdmin(
  userId: string,
  reason?: string
): Promise<ActionResult<{ isAdmin: boolean; message: string }>> {
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
export async function adminDisableUser(userId: string, reason?: string): Promise<ActionResult<{ message: string }>> {
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
      .select("username, is_admin, disabled_at")
      .eq("id", userId)
      .single();

    if (!profile) {
      return { success: false, error: "User not found" };
    }

    // Cannot disable other admins
    if (profile.is_admin) {
      return { success: false, error: "Cannot disable admin accounts" };
    }

    if (profile.disabled_at) {
      return { success: false, error: "This account is already disabled" };
    }

    // disabled_at is frozen by protect_admin_columns() for every JWT role
    // except service_role (migration 066), so the write goes through the
    // service-role client exactly like is_admin does. Authorization has
    // already been enforced above by requireAdmin() + the guards.
    const adminClient = createAdminClient();
    const { data: disabled, error } = await adminClient
      .from("profiles")
      .update({ disabled_at: new Date().toISOString() })
      .eq("id", userId)
      .select("id");

    if (error) throw error;
    if (!disabled || disabled.length === 0) {
      logger.error("Admin disable changed no rows", { userId });
      return { success: false, error: "Nothing was changed" };
    }

    // Refuse new sessions too, so the flag is not only enforced by the app.
    const { error: banError } = await adminClient.auth.admin.updateUserById(
      userId,
      { ban_duration: PERMANENT_BAN }
    );
    if (banError) {
      logError("Disable: auth ban failed after disabled_at was set", banError, {
        userId,
      });
    }

    // Audit log
    await createAuditLog({
      action: "admin.user.disable",
      targetType: "user",
      targetId: userId,
      userId: user.id,
      metadata: {
        username: profile.username,
        reason: reason || "No reason provided",
        banApplied: !banError,
      },
    });

    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${userId}`);

    if (banError) {
      return {
        success: false,
        error:
          "Account marked disabled, but existing sign-ins could not be revoked. Enable and disable it again to retry.",
      };
    }

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
export async function adminEnableUser(userId: string): Promise<ActionResult<{ message: string }>> {
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
      .select("username, disabled_at")
      .eq("id", userId)
      .single();

    if (!profile) {
      return { success: false, error: "User not found" };
    }

    if (!profile.disabled_at) {
      return { success: false, error: "This account is not disabled" };
    }

    // Same service-role path as adminDisableUser (see the note there).
    const adminClient = createAdminClient();
    const { data: enabled, error } = await adminClient
      .from("profiles")
      .update({ disabled_at: null })
      .eq("id", userId)
      .select("id");

    if (error) throw error;
    if (!enabled || enabled.length === 0) {
      logger.error("Admin enable changed no rows", { userId });
      return { success: false, error: "Nothing was changed" };
    }

    const { error: banError } = await adminClient.auth.admin.updateUserById(
      userId,
      { ban_duration: "none" }
    );
    if (banError) {
      logError("Enable: lifting the auth ban failed after disabled_at was cleared", banError, {
        userId,
      });
    }

    // Audit log
    await createAuditLog({
      action: "admin.user.enable",
      targetType: "user",
      targetId: userId,
      userId: user.id,
      metadata: { username: profile.username, banLifted: !banError },
    });

    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${userId}`);

    if (banError) {
      return {
        success: false,
        error:
          "Account re-enabled, but the sign-in block could not be lifted. Disable and enable it again to retry.",
      };
    }

    return {
      success: true,
      message: `${profile.username} has been enabled`,
    };
  } catch (error) {
    logError("Error enabling user", error);
    return { success: false, error: "Failed to enable user" };
  }
}
