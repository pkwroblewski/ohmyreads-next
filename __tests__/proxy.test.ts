// @vitest-environment node
/**
 * Tests for `proxy.ts` — the request-level auth gate (Task 28).
 *
 * This is the file every authenticated and admin route depends on, and it had
 * no tests at all. The cases below are the four decisions it makes (protected,
 * admin, auth-only, everything else), both fail-closed paths, and the matcher,
 * which is the part that silently decides whether the gate runs for a URL at
 * all.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const getUser = vi.fn();
const single = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser },
    from: () => ({
      select: () => ({
        eq: () => ({ single }),
      }),
    }),
  }),
}));

import { proxy, config } from "@/proxy";

const SITE = "https://ohmyreads-next.vercel.app";

function request(path: string): NextRequest {
  return new NextRequest(new URL(path, SITE));
}

/** Where a response redirects to, or `null` if it lets the request through. */
function redirectTarget(response: Response): string | null {
  const location = response.headers.get("location");
  return location ? new URL(location).pathname + new URL(location).search : null;
}

function signedOut() {
  getUser.mockResolvedValue({ data: { user: null } });
}

function signedIn(isAdmin: boolean, id = "user-1") {
  getUser.mockResolvedValue({ data: { user: { id } } });
  single.mockResolvedValue({ data: { is_admin: isAdmin } });
}

describe("proxy: environment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", `${SITE}/supabase`);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
  });

  it("fails closed with 503 in production when Supabase is not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NODE_ENV", "production");

    const response = await proxy(request("/dashboard"));

    expect(response.status).toBe(503);
    // Never a silent pass-through: an unconfigured gate must not admit anyone.
    expect(redirectTarget(response)).toBeNull();
  });

  it("lets requests through when Supabase is not configured outside production", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    vi.stubEnv("NODE_ENV", "development");

    const response = await proxy(request("/dashboard"));

    expect(response.status).toBe(200);
  });
});

describe("proxy: protected routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", `${SITE}/supabase`);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
  });

  it("sends an anonymous visitor to login and remembers where they were going", async () => {
    signedOut();

    expect(redirectTarget(await proxy(request("/dashboard")))).toBe(
      "/login?redirect=%2Fdashboard"
    );
  });

  it("protects nested paths under a protected route", async () => {
    signedOut();

    expect(redirectTarget(await proxy(request("/settings/privacy")))).toBe(
      "/login?redirect=%2Fsettings%2Fprivacy"
    );
  });

  it("matches on segment boundaries, not string prefixes", async () => {
    signedOut();

    // "/clubs/create" is protected; the public "/clubs" listing is not, and
    // neither is a route that merely starts with the same letters.
    expect(redirectTarget(await proxy(request("/clubs/create")))).toBe(
      "/login?redirect=%2Fclubs%2Fcreate"
    );
    expect(redirectTarget(await proxy(request("/clubs")))).toBeNull();
    expect(redirectTarget(await proxy(request("/clubs-directory")))).toBeNull();
  });

  it("lets a signed-in user through", async () => {
    signedIn(false);

    expect(redirectTarget(await proxy(request("/dashboard")))).toBeNull();
  });

  it("leaves public routes alone for anonymous visitors", async () => {
    signedOut();

    for (const path of ["/", "/books", "/discover", "/community", "/about"]) {
      expect(redirectTarget(await proxy(request(path)))).toBeNull();
    }
  });
});

describe("proxy: admin routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", `${SITE}/supabase`);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
  });

  it("sends an anonymous visitor to login, not to the dashboard", async () => {
    signedOut();

    expect(redirectTarget(await proxy(request("/admin/users")))).toBe(
      "/login?redirect=%2Fadmin%2Fusers"
    );
  });

  it("turns a signed-in non-admin away", async () => {
    signedIn(false);

    expect(redirectTarget(await proxy(request("/admin")))).toBe("/dashboard");
    expect(redirectTarget(await proxy(request("/admin/books/123")))).toBe(
      "/dashboard"
    );
  });

  it("admits an admin", async () => {
    signedIn(true);

    expect(redirectTarget(await proxy(request("/admin/users")))).toBeNull();
  });

  it("turns away a signed-in user with no profile row", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "ghost" } } });
    single.mockResolvedValue({ data: null });

    expect(redirectTarget(await proxy(request("/admin")))).toBe("/dashboard");
  });

  it("fails closed to the dashboard when the admin check itself errors", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    single.mockRejectedValue(new Error("connection reset"));

    expect(redirectTarget(await proxy(request("/admin")))).toBe("/dashboard");
  });

  it("treats a failed session lookup as anonymous", async () => {
    getUser.mockRejectedValue(new Error("auth service down"));

    expect(redirectTarget(await proxy(request("/admin")))).toBe(
      "/login?redirect=%2Fadmin"
    );
  });
});

describe("proxy: auth-only routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", `${SITE}/supabase`);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
  });

  it("bounces a signed-in user off login and signup", async () => {
    signedIn(false);

    expect(redirectTarget(await proxy(request("/login")))).toBe("/dashboard");
    expect(redirectTarget(await proxy(request("/signup")))).toBe("/dashboard");
  });

  it("leaves them available to anonymous visitors", async () => {
    signedOut();

    expect(redirectTarget(await proxy(request("/login")))).toBeNull();
    expect(redirectTarget(await proxy(request("/signup")))).toBeNull();
  });
});

describe("proxy: matcher", () => {
  const matcher = new RegExp(`^${config.matcher[0]}$`);

  it("skips the paths that must never pay for an auth round-trip", () => {
    // `/api/health` is an uptime probe (Task 25): matching it would make the
    // health of the app depend on the health of the auth service.
    for (const path of [
      "/api/health",
      "/callback",
      "/favicon.ico",
      "/_next/static/chunk.js",
      "/_next/image",
      "/logo.png",
      "/hero.webp",
    ]) {
      expect(matcher.test(path)).toBe(false);
    }
  });

  it("still covers every route the gate is responsible for", () => {
    for (const path of [
      "/",
      "/dashboard",
      "/admin/users",
      "/login",
      "/settings/privacy",
      "/api/books/search",
      "/books/dune",
    ]) {
      expect(matcher.test(path)).toBe(true);
    }
  });
});
