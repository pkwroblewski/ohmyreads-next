// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * `/api/shelf/books` feeds the "Load more" button on /my-shelf. It must be
 * same-origin, signed in, validate the status, and clamp paging to the page
 * size before it touches the query layer.
 */

const getUser = vi.fn();
const getUserBooks = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  getUser: () => getUser(),
  createClient: async () => ({}),
}));
vi.mock("@/lib/queries/users", () => ({
  getUserBooks: (...a: unknown[]) => getUserBooks(...a),
  SHELF_PAGE_SIZE: 48,
}));
vi.mock("@/lib/utils/log", () => ({ logError: vi.fn() }));

const { GET } = await import("@/app/api/shelf/books/route");

const SITE = "https://ohmyreads.test";
function req(query: string, headers: Record<string, string> = {}) {
  return new NextRequest(new URL(`/api/shelf/books${query}`, SITE), {
    headers: { "sec-fetch-site": "same-origin", ...headers },
  });
}

describe("GET /api/shelf/books", () => {
  beforeEach(() => {
    getUser.mockReset();
    getUserBooks.mockReset();
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    getUserBooks.mockResolvedValue({ userBooks: [{ id: "ub1" }], total: 99 });
  });

  it("refuses cross-site requests before looking at the session", async () => {
    const res = await GET(req("?offset=48", { "sec-fetch-site": "cross-site", origin: "https://evil.test" }));

    expect(res.status).toBe(403);
    expect(getUser).not.toHaveBeenCalled();
  });

  it("answers 401 when signed out", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    expect((await GET(req("?offset=48"))).status).toBe(401);
    expect(getUserBooks).not.toHaveBeenCalled();
  });

  it("rejects an unknown status", async () => {
    expect((await GET(req("?status=archived"))).status).toBe(400);
    expect(getUserBooks).not.toHaveBeenCalled();
  });

  it("pages the caller's own shelf, clamping limit to the page size", async () => {
    const res = await GET(req("?status=read&offset=96&limit=500"));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ books: [{ id: "ub1" }], total: 99 });
    expect(getUserBooks).toHaveBeenCalledWith("u1", {
      status: "read",
      shelfId: undefined,
      offset: 96,
      limit: 48,
    });
  });

  it("passes a custom shelf id through and defaults the paging", async () => {
    await GET(req("?shelf=shelf-9&offset=-5&limit=abc"));

    expect(getUserBooks).toHaveBeenCalledWith("u1", {
      status: undefined,
      shelfId: "shelf-9",
      offset: 0,
      limit: 48,
    });
  });
});
