"use server";

import { createClient as createBareClient } from "@supabase/supabase-js";
import type { AMREntry, User } from "@supabase/supabase-js";
import { requireUser } from "@/lib/auth/require-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import { createAuditLog } from "@/lib/utils/audit-log";
import { logError, logger, reportError } from "@/lib/utils/log";
import {
  changePasswordSchema,
  deleteAccountSchema,
  SESSION_FRESHNESS_SECONDS,
  type ChangePasswordInput,
  type DeleteAccountInput,
} from "@/lib/validation/user";

/**
 * Account settings (Phase 2, Task 11): the two things the privacy page and
 * the settings placeholder promised and the app never had — changing the
 * password and deleting the account.
 */
/** An `ActionResult` whose failure branch also carries a machine-readable code. */
export type AccountActionResult =
  | { success: true }
  | {
      success: false;
      error: string;
      /** Lets the form react (offer a sign-out link) without parsing copy. */
      code?: "stale_session" | "wrong_password" | "no_password" | "mismatch";
    };

const PLACE_PHOTOS_BUCKET = "place-photos";

/** Only accounts with an email/password identity have a password to change. */
function hasPasswordIdentity(user: User): boolean {
  return user.identities?.some((identity) => identity.provider === "email") ?? false;
}

/**
 * When the reader last proved who they are, in epoch seconds. `amr` records
 * the authentication events of the session and is not touched by refreshes,
 * unlike `iat`. Null when the token carries no usable entry.
 */
function latestAuthTimestamp(amr: AMREntry[] | undefined): number | null {
  if (!amr || amr.length === 0) return null;
  const stamps = amr
    .map((entry) => entry.timestamp)
    .filter((t): t is number => typeof t === "number" && Number.isFinite(t));
  return stamps.length > 0 ? Math.max(...stamps) : null;
}

/**
 * Change the caller's password. The current password is verified by signing
 * in on a throwaway client so the caller's own session is never touched, and
 * that probe session is revoked straight after.
 */
export async function changePassword(input: ChangePasswordInput): Promise<AccountActionResult> {
  try {
    const auth = await requireUser();
    if (!auth.ok) {
      return { success: false, error: "Please sign in to change your password" };
    }
    const { supabase, user } = auth;

    if (!user.email || !hasPasswordIdentity(user)) {
      return {
        success: false,
        code: "no_password",
        error: "This account signs in with Google, so there is no OhMyReads password to change.",
      };
    }

    // 5 attempts per 15 minutes: a wrong current password is the only way to
    // brute-force from inside a session, and five is plenty for typos.
    const { allowed } = await checkRateLimit(`password-change:${user.id}`, 5, 15 * 60 * 1000);
    if (!allowed) {
      return { success: false, error: "Too many attempts. Please wait a few minutes." };
    }

    const parsed = changePasswordSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || "Invalid input" };
    }
    const { currentPassword, newPassword } = parsed.data;

    const probe = createBareClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(),
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const { data: probeData, error: probeError } = await probe.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (probeError || !probeData.session) {
      return { success: false, code: "wrong_password", error: "The current password is not right." };
    }
    // Revoke just the probe's own session; a global sign-out would log the
    // reader out of the browser they are using right now.
    const { error: probeSignOutError } = await probe.auth.signOut({ scope: "local" });
    if (probeSignOutError) {
      logger.warn("Could not revoke password-probe session", { error: probeSignOutError.message });
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      return {
        success: false,
        error: reportError("Error changing password", error, { userId: user.id }),
      };
    }

    await createAuditLog({
      action: "auth.password_change",
      targetType: "user",
      targetId: user.id,
      userId: user.id,
    });

    return { success: true };
  } catch (error) {
    logError("Unexpected error in changePassword", error);
    return { success: false, error: "Could not change your password" };
  }
}

/**
 * Delete the caller's account and everything it owns.
 *
 * Order matters: the audit row is written first (audit_logs.user_id sets NULL
 * on deletion, so the row survives with the id in target_id), then storage
 * objects that the database cascade cannot reach, then the auth user — which
 * cascades into profiles and from there into every owned table. Reports the
 * reader filed stay, anonymised (migration 067).
 */
export async function deleteAccount(input: DeleteAccountInput): Promise<AccountActionResult> {
  try {
    const auth = await requireUser();
    if (!auth.ok) {
      return { success: false, error: "Please sign in to delete your account" };
    }
    const { supabase, user } = auth;

    const { allowed } = await checkRateLimit(`delete-account:${user.id}`, 5, 10 * 60 * 1000);
    if (!allowed) {
      return { success: false, error: "Too many attempts. Please wait a few minutes." };
    }

    const parsed = deleteAccountSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        code: "mismatch",
        error: parsed.error.issues[0]?.message || "Type your username to confirm.",
      };
    }

    // No server-side re-authentication exists, so require a recent sign-in.
    const { data: claimsData } = await supabase.auth.getClaims();
    const authenticatedAt = latestAuthTimestamp(claimsData?.claims.amr);
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (authenticatedAt === null || nowSeconds - authenticatedAt > SESSION_FRESHNESS_SECONDS) {
      return {
        success: false,
        code: "stale_session",
        error:
          "For safety, deleting an account needs a recent sign-in. Sign out, sign back in, and try again.",
      };
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) {
      return {
        success: false,
        error: reportError("Error loading profile for deletion", profileError, { userId: user.id }),
      };
    }
    const username = profile?.username ?? null;
    if (!username || parsed.data.confirmation.toLowerCase() !== username.toLowerCase()) {
      return { success: false, code: "mismatch", error: "That does not match your username." };
    }

    const admin = createAdminClient();

    await createAuditLog({
      action: "user.delete_account",
      targetType: "user",
      targetId: user.id,
      userId: user.id,
      metadata: { username, providers: user.app_metadata?.providers ?? [] },
    });

    // Storage objects are outside the FK graph; the rows cascade, the files
    // would not. Failure here is logged, not fatal — an orphaned file is
    // better than an account the reader cannot delete.
    const { data: photos, error: photosError } = await admin
      .from("place_photos")
      .select("storage_path")
      .eq("user_id", user.id);
    if (photosError) {
      logError("Could not list place photos before account deletion", photosError, {
        userId: user.id,
      });
    } else if (photos && photos.length > 0) {
      const { error: storageError } = await admin.storage
        .from(PLACE_PHOTOS_BUCKET)
        .remove(photos.map((photo) => photo.storage_path));
      if (storageError) {
        logError("Could not remove place photos before account deletion", storageError, {
          userId: user.id,
          count: photos.length,
        });
      }
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) {
      return {
        success: false,
        error: reportError("Error deleting account", deleteError, { userId: user.id }),
      };
    }

    // The session is already dead server-side; this clears the cookies. The
    // sign-out request itself may 401/403 now, which auth-js tolerates.
    const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
    if (signOutError) {
      logger.warn("Sign-out after account deletion reported an error", {
        error: signOutError.message,
      });
    }

    return { success: true };
  } catch (error) {
    logError("Unexpected error in deleteAccount", error);
    return { success: false, error: "Could not delete your account" };
  }
}
