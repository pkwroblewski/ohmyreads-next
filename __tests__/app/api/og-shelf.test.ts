// @vitest-environment node
/**
 * /api/og/shelf (shelf design plan, Task 10): bad input is a 400, a hidden
 * or unknown reader and an empty year are a 404, and a real shelf is a PNG
 * the CDN may cache.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { getYearShelf } = vi.hoisted(() => ({ getYearShelf: vi.fn() }));
vi.mock("@/lib/queries/shelf", () => ({ getYearShelf }));
vi.mock("@/lib/brand/app-icon", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/brand/app-icon")>()),
  loadGoogleFont: vi.fn(async () => null),
}));
vi.mock("@/lib/utils/log", () => ({ logError: vi.fn() }));

import { GET } from "@/app/api/og/shelf/route";

const get = (query: string) => GET(new Request(`http://localhost/api/og/shelf?${query}`));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/og/shelf", () => {
  it.each([
    ["no user", "year=2026"],
    ["no year", "user=reader"],
    ["a non-numeric year", "user=reader&year=abc"],
    ["a far-future year", "user=reader&year=2999"],
    ["an unknown format", "user=reader&year=2026&format=banner"],
  ])("rejects %s with a 400", async (_, query) => {
    expect((await get(query)).status).toBe(400);
    expect(getYearShelf).not.toHaveBeenCalled();
  });

  it("404s for a hidden or unknown reader", async () => {
    getYearShelf.mockResolvedValue(null);
    expect((await get("user=hidden&year=2026")).status).toBe(404);
    expect(getYearShelf).toHaveBeenCalledWith("hidden", 2026);
  });

  it("404s for a year with no books", async () => {
    getYearShelf.mockResolvedValue({ username: "reader", name: "Reader", books: [], pages: 0 });
    expect((await get("user=reader&year=2026")).status).toBe(404);
  });

  it("renders a cacheable PNG for a real shelf", async () => {
    getYearShelf.mockResolvedValue({
      username: "reader",
      name: "Reader",
      pages: 412,
      books: [
        { id: "1", slug: "dune", title: "Dune", author: "Frank Herbert", pageCount: 412, genre: "Science Fiction", spineColor: "#c63c25", spineInk: null },
      ],
    });
    const res = await get("user=reader&year=2026&format=square");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toContain("s-maxage=3600");
    expect((await res.arrayBuffer()).byteLength).toBeGreaterThan(1000);
  });
});
