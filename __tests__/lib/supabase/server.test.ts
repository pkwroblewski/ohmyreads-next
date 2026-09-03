import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `getUser()` must make one `/auth/v1/user` round-trip per request, including
 * from route handlers and Server Actions where React `cache()` has no scope.
 * The memo is keyed on the object `cookies()` resolves to, which Next creates
 * once per request.
 */

const authGetUser = vi.fn();
let cookieStore: object = {};

vi.mock("next/headers", () => ({
  cookies: async () => cookieStore,
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getUser: () => authGetUser() } }),
}));

// React's `cache()` is a pass-through without an RSC dispatcher, exactly as in
// a route handler; the test exercises the WeakMap layer underneath it.
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";

const { getUser } = await import("@/lib/supabase/server");

describe("getUser request memo", () => {
  beforeEach(() => {
    authGetUser.mockReset();
    authGetUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    cookieStore = {};
  });

  it("calls GoTrue once for concurrent and sequential callers in one request", async () => {
    const [a, b] = await Promise.all([getUser(), getUser()]);
    const c = await getUser();

    expect(authGetUser).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
    expect(c).toBe(a);
    expect(a.data.user?.id).toBe("u1");
  });

  it("does not share the result across requests", async () => {
    await getUser();
    cookieStore = {}; // a new request resolves cookies() to a new object
    authGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const next = await getUser();

    expect(authGetUser).toHaveBeenCalledTimes(2);
    expect(next.data.user).toBeNull();
  });
});
