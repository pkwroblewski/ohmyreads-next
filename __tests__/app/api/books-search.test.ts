// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { thenableQuery } from "@/__tests__/helpers/mock-supabase";

/**
 * `/api/books/search` feeds the Browse grid. Task 7 added the viewer's own
 * shelf status per result, which splits the response two ways: an anonymous
 * caller gets an empty map and the shared CDN cache, a signed-in caller gets
 * their statuses and a response that must never be cached for anyone else.
 */

const getUser = vi.fn();
const getShelfStatuses = vi.fn();
const checkRateLimit = vi.fn();
let queryResult: { data: unknown; count: number | null; error: unknown } = {
  data: [],
  count: 0,
  error: null,
};

vi.mock("@/lib/supabase/server", () => ({
  getUser: () => getUser(),
  createClient: async () => ({ from: () => thenableQuery(queryResult) }),
}));
vi.mock("@/lib/queries/users", () => ({
  getShelfStatuses: (...a: unknown[]) => getShelfStatuses(...a),
}));
vi.mock("@/lib/utils/rate-limit", () => ({
  checkRateLimit: (...a: unknown[]) => checkRateLimit(...a),
  getClientIp: () => "203.0.113.5",
}));
vi.mock("@/lib/utils/log", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
  extractErrorInfo: (e: unknown) => ({ e }),
  extractSupabaseErrorInfo: (e: unknown) => ({ e }),
}));

const { GET } = await import("@/app/api/books/search/route");

const SITE = "https://ohmyreads.test";
const BOOKS = [{ id: "book-1" }, { id: "book-2" }];

function req(query = "") {
  return new NextRequest(new URL(`/api/books/search${query}`, SITE));
}

describe("GET /api/books/search", () => {
  beforeEach(() => {
    getUser.mockReset();
    getShelfStatuses.mockReset();
    checkRateLimit.mockReset();
    checkRateLimit.mockResolvedValue({ allowed: true });
    queryResult = { data: BOOKS, count: 2, error: null };
    getUser.mockResolvedValue({ data: { user: null } });
  });

  it("returns an empty status map and stays publicly cacheable when signed out", async () => {
    const res = await GET(req("?q=dune"));

    expect(res.status).toBe(200);
    expect((await res.json()).shelfStatuses).toEqual({});
    expect(getShelfStatuses).not.toHaveBeenCalled();
    expect(res.headers.get("cache-control")).toContain("public");
  });

  it("returns the caller's own statuses and forbids a shared cache when signed in", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    getShelfStatuses.mockResolvedValue({ "book-1": "read" });

    const res = await GET(req("?q=dune"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.shelfStatuses).toEqual({ "book-1": "read" });
    expect(getShelfStatuses).toHaveBeenCalledWith("u1", ["book-1", "book-2"]);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  it("refuses over the rate limit before reading the session", async () => {
    checkRateLimit.mockResolvedValue({ allowed: false });

    expect((await GET(req())).status).toBe(429);
    expect(getUser).not.toHaveBeenCalled();
  });
});
