import "server-only";

import type { User } from "@supabase/supabase-js";
import { createClient, getUser } from "@/lib/supabase/server";
import { logError } from "@/lib/utils/log";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * The one place that answers "is the caller an admin?".
 *
 * Eight private helpers used to answer it — seven `requireAdmin`s and one
 * `isAdmin` — plus six checks written inline, and they had already drifted:
 * `.single()` against `.maybeSingle()`, two different pairs of error strings,
 * and only one of the fourteen logged a profile read that failed. Divergent
 * copies of an authorization check are where a hole eventually opens, so there
 * is now one query, one set of messages, and one place to audit.
 *
 * The check runs through the caller's own session client, never the
 * service-role one, so RLS still applies to everything it hands back.
 */
export type AdminCheck =
  | { ok: true; supabase: ServerClient; user: User }
  | {
      ok: false;
      reason: "unauthenticated" | "unauthorized";
      /** Client-safe copy — says nothing beyond which of the two it was. */
      error: string;
    };

/**
 * Non-throwing form, for call sites that answer with `{ error }` or a redirect
 * rather than an exception. Branch on `reason` when the two cases differ.
 */
export async function checkAdmin(): Promise<AdminCheck> {
  const {
    data: { user },
  } = await getUser();

  if (!user) {
    return {
      ok: false,
      reason: "unauthenticated",
      error: "Not authenticated",
    };
  }

  const supabase = await createClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    // A read that fails is not the same as a profile that says "not an admin",
    // and only the admin layout used to say so. Denial is the same either way.
    logError("Admin check: profile fetch failed", error, { userId: user.id });
  }

  if (!profile?.is_admin) {
    return { ok: false, reason: "unauthorized", error: "Not authorized" };
  }

  return { ok: true, supabase, user };
}

/**
 * Throwing form. Use it at the top of an admin action whose `catch` already
 * turns a failure into a client-safe result.
 *
 * @throws when the caller is not signed in, or is signed in but not an admin.
 */
export async function requireAdmin(): Promise<{
  supabase: ServerClient;
  user: User;
}> {
  const result = await checkAdmin();

  if (!result.ok) {
    throw new Error(result.error);
  }

  return { supabase: result.supabase, user: result.user };
}
