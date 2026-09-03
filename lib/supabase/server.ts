import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { cache } from "react";
import type { Database } from "@/types/database";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}

type UserResult = Awaited<ReturnType<SupabaseClient<Database>["auth"]["getUser"]>>;

/**
 * One GoTrue round-trip per request, keyed on the request's cookie store.
 *
 * React `cache()` only dedupes inside a Server Component render; route
 * handlers and Server Actions run without that scope, so a handler that calls
 * `getUser()` and then two queries that each call it again used to make three
 * `/auth/v1/user` requests. `cookies()` resolves to one object per request, so
 * a WeakMap on it memoises those callers too and is garbage-collected with the
 * request.
 */
const userByRequest = new WeakMap<object, Promise<UserResult>>();

/**
 * Request-memoized auth.getUser() — deduplicates the Supabase auth round-trip
 * across layout, page, nested server components, route handlers and actions
 * within a single request.
 */
export const getUser = cache(async (): Promise<UserResult> => {
  const cookieStore = await cookies();
  const pending = userByRequest.get(cookieStore);
  if (pending) return pending;

  const result = createClient().then((supabase) => supabase.auth.getUser());
  userByRequest.set(cookieStore, result);
  return result;
});

/**
 * Create a Supabase client for public/cached queries that don't need cookies.
 * Use this for queries inside unstable_cache or for public data.
 */
export function createPublicClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim()
  );
}

