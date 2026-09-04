import "server-only";

import type { User } from "@supabase/supabase-js";
import { createClient, getUser } from "@/lib/supabase/server";
import type { Database } from "@/types/database.generated";
import { logError } from "@/lib/utils/log";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/** The caller's own row as `get_my_profile()` returns it (migration 065). */
export type MyProfile =
  Database["public"]["Functions"]["get_my_profile"]["Returns"][number];

/**
 * The one place that answers "who is calling this action?".
 *
 * Every Server Action used to open with the same eight lines — create a
 * client, read the user, return `{ error: "Not authenticated" }` when there
 * is none — and 84 copies had drifted into nine wordings and two ways of
 * checking the auth error. This is the counterpart of `checkAdmin()` in
 * `require-admin.ts`: same `ok` discriminant, same non-throwing shape, so an
 * action branches on `auth.ok` and hands `auth.error` straight to the client.
 *
 * `getUser()` is memoised per request (Task 14), so calling this in an action
 * that a page has already authenticated costs no extra round-trip. Pass
 * `{ withProfile: true }` when the action needs the caller's own profile row;
 * it comes through the `get_my_profile()` RPC because the private columns are
 * not directly selectable since migration 065.
 */
export type UserCheck<P = undefined> =
  | { ok: true; supabase: ServerClient; user: User; profile: P }
  | { ok: false; error: string };

export async function requireUser(): Promise<UserCheck>;
export async function requireUser(opts: {
  withProfile: true;
}): Promise<UserCheck<MyProfile | null>>;
export async function requireUser(opts?: {
  withProfile?: boolean;
}): Promise<UserCheck<MyProfile | null | undefined>> {
  const {
    data: { user },
  } = await getUser();

  if (!user) {
    return { ok: false, error: "Not authenticated" };
  }

  const supabase = await createClient();

  if (!opts?.withProfile) {
    return { ok: true, supabase, user, profile: undefined };
  }

  const { data: profile, error } = await supabase
    .rpc("get_my_profile")
    .maybeSingle();

  if (error) {
    logError("requireUser: get_my_profile failed", error, { userId: user.id });
  }

  return { ok: true, supabase, user, profile: profile ?? null };
}
