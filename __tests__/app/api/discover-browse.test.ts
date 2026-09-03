// @vitest-environment node
/**
 * Tests for GET /api/discover/browse paging validation (Phase 2, Task 5).
 *
 * `parseInt` used to turn `?page=abc` into NaN and let `?page=-5` through;
 * both reached the query as an offset and came back as a 500.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const browseReaders = vi.fn();
const searchReaders = vi.fn();
const getUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser } }),
  getUser: () => getUser(),
}));
vi.mock("@/lib/queries/discover", () => ({
  browseReaders: (...args: unknown[]) => browseReaders(...args),
  searchReaders: (...args: unknown[]) => searchReaders(...args),
}));
vi.mock("@/lib/utils/rate-limit", () => ({
  checkRateLimit: async () => ({ allowed: true, remaining: 59 }),
  getClientIp: () => "203.0.113.5",
}));
vi.mock("@/lib/utils/log", () => ({ logError: vi.fn() }));

import { GET } from "@/app/api/discover/browse/route";

function req(query: string): NextRequest {
  return new NextRequest(
    new URL(`/api/discover/browse${query}`, "https://ohmyreads-next.vercel.app")
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: null } });
  browseReaders.mockResolvedValue({ readers: [], total: 0 });
  searchReaders.mockResolvedValue({ readers: [], total: 0 });
});

describe("GET /api/discover/browse", () => {
  it("returns 400, not 500, for a non-numeric page", async () => {
    const response = await GET(req("?page=abc"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid page or limit" });
    expect(browseReaders).not.toHaveBeenCalled();
  });

  it("returns 400 for a negative, zero or fractional page", async () => {
    for (const page of ["-5", "0", "1.5"]) {
      const response = await GET(req(`?page=${page}`));
      expect(response.status, page).toBe(400);
    }
    expect(browseReaders).not.toHaveBeenCalled();
  });

  it("returns 400 for a limit above the cap instead of silently clamping", async () => {
    const response = await GET(req("?limit=500"));

    expect(response.status).toBe(400);
  });

  it("defaults to page 1 / limit 20 when the params are absent", async () => {
    const response = await GET(req(""));

    expect(response.status).toBe(200);
    expect(browseReaders).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 20 })
    );
    expect(await response.json()).toMatchObject({ page: 1, limit: 20 });
  });

  it("passes a valid page and limit through as numbers", async () => {
    const response = await GET(req("?page=3&limit=10"));

    expect(response.status).toBe(200);
    expect(browseReaders).toHaveBeenCalledWith(
      expect.objectContaining({ page: 3, limit: 10 })
    );
  });

  it("uses the same paging for the search path", async () => {
    const response = await GET(req("?q=ada&page=2&limit=10"));

    expect(response.status).toBe(200);
    expect(searchReaders).toHaveBeenCalledWith(
      expect.objectContaining({ query: "ada", limit: 10, offset: 10 })
    );
  });
});
