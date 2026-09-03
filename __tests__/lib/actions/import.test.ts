/**
 * Goodreads import (Phase 2, Task 21, T7).
 *
 * Auth and rate limit first; the CSV is parsed then bounded by the Zod row
 * schema; ISBN lookups go to the catalog in chunks of 500; books already on
 * the shelf are skipped; matched rows become one batch insert with the
 * Goodreads shelf mapped to a status, a 0 rating stored as null and dates
 * normalised; then the three pages that show shelf data are revalidated.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase, type MockSupabase } from "../../helpers/mock-supabase";

const { revalidatePath, checkRateLimit } = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  checkRateLimit: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/utils/rate-limit", () => ({ checkRateLimit }));
vi.mock("@/lib/utils/log", () => ({ reportError: (msg: string) => msg }));

let mock: MockSupabase;
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => mock,
  getUser: () => mock.auth.getUser(),
}));

import { importFromGoodreads } from "@/lib/actions/import";

const ME = { id: "550e8400-e29b-41d4-a716-446655440000" };
const HEADER =
  "Book Id,Title,Author,ISBN,ISBN13,My Rating,Average Rating,Number of Pages,Date Read,Date Added,Bookshelves,Exclusive Shelf";

function csv(rows: string[]) {
  return [HEADER, ...rows].join("\n");
}

/** `user_books.select().eq()` (existing shelf) and `books.select().in()` (ISBN lookup) are awaited directly. */
function arrange({
  existing = [] as string[],
  catalog = [] as Array<{ id: string; title: string; author: string; isbn: string | null }>,
} = {}) {
  mock.eq.mockResolvedValueOnce({ data: existing.map((book_id) => ({ book_id })), error: null });
  mock.in.mockResolvedValue({ data: catalog, error: null });
  mock.limit.mockResolvedValue({ data: catalog, error: null }); // title-match load
  mock.insert.mockResolvedValue({ error: null });
}

beforeEach(() => {
  vi.clearAllMocks();
  mock = createMockSupabase(ME);
  checkRateLimit.mockResolvedValue({ allowed: true });
});

describe("importFromGoodreads guards", () => {
  it("refuses an anonymous caller", async () => {
    mock = createMockSupabase(null);
    const result = await importFromGoodreads(csv(["1,Dune,Frank Herbert,,,5,0,0,,2024/01/01,,read"]));
    expect(result.success).toBe(false);
    expect(result.errors).toEqual(["Not authenticated"]);
    expect(mock.from).not.toHaveBeenCalled();
  });

  it("is rate limited at 3 per minute", async () => {
    checkRateLimit.mockResolvedValue({ allowed: false });
    const result = await importFromGoodreads(csv(["1,Dune,Frank Herbert,,,5,0,0,,2024/01/01,,read"]));
    expect(result.errors[0]).toMatch(/too many imports/i);
    expect(checkRateLimit).toHaveBeenCalledWith(`import:${ME.id}`, 3, 60000);
  });

  it("reports a parse failure and an empty file as errors, not exceptions", async () => {
    expect((await importFromGoodreads("")).errors[0]).toMatch(/failed to parse/i);
    // A row with no title is dropped by the parser, leaving nothing to import.
    expect((await importFromGoodreads(csv(["1,,Author,,,0,0,0,,2024/01/01,,read"]))).errors).toEqual([
      "No books found in CSV",
    ]);
  });

  it("caps an import at 1000 rows through the row schema", async () => {
    const rows = Array.from({ length: 1001 }, (_, i) => `${i},Book ${i},Author,,,0,0,0,,2024/01/01,,to-read`);
    const result = await importFromGoodreads(csv(rows));
    expect(result.success).toBe(false);
    expect(result.errors[0]).toMatch(/1000/);
    expect(mock.from).not.toHaveBeenCalled();
  });
});

describe("importFromGoodreads matching", () => {
  it("looks ISBNs up in chunks of 500", async () => {
    arrange({ catalog: [] });
    const rows = Array.from(
      { length: 600 },
      (_, i) => `${i},Book ${i},Author,,="${String(9780000000000 + i)}",0,0,0,,2024/01/01,,to-read`
    );

    const result = await importFromGoodreads(csv(rows));

    expect(result.success).toBe(true);
    expect(result.notFound).toBe(600);
    const inCalls = mock.in.mock.calls.filter(([column]) => column === "isbn");
    expect(inCalls.map(([, list]) => (list as string[]).length)).toEqual([500, 100]);
  });

  it("matches by ISBN-13, maps the shelf, dates and rating, and inserts one batch", async () => {
    arrange({
      catalog: [
        { id: "b-dune", title: "Dune", author: "Frank Herbert", isbn: "978-0-441-01359-3" },
        { id: "b-emma", title: "Emma", author: "Jane Austen", isbn: "9780141439587" },
      ],
    });

    const result = await importFromGoodreads(
      csv([
        `1,Dune,Frank Herbert,="0441013597",="9780441013593",5,4.2,412,2024/01/15,2023/12/01,,read`,
        `2,Emma,Jane Austen,,="9780141439587",0,3.9,474,,01/02/2024,,currently-reading`,
      ])
    );

    expect(result).toMatchObject({ success: true, matched: 2, notFound: 0, skipped: 0, errors: [] });
    expect(result.matchedBooks).toEqual([
      { title: "Dune", author: "Frank Herbert", status: "read" },
      { title: "Emma", author: "Jane Austen", status: "reading" },
    ]);
    expect(mock.insert).toHaveBeenCalledTimes(1);
    expect(mock.insert).toHaveBeenCalledWith([
      {
        user_id: ME.id,
        book_id: "b-dune",
        status: "read",
        rating: 5,
        started_at: null,
        finished_at: "2024-01-15",
      },
      {
        user_id: ME.id,
        book_id: "b-emma",
        status: "reading",
        rating: null, // Goodreads 0 = unrated
        started_at: "2024-01-02", // MM/DD/YYYY date_added for a book in progress
        finished_at: null,
      },
    ]);
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(revalidatePath).toHaveBeenCalledWith("/my-shelf");
    expect(revalidatePath).toHaveBeenCalledWith("/stats");
  });

  it("skips books already on the shelf and reports the ones it cannot find", async () => {
    arrange({
      existing: ["b-dune"],
      catalog: [{ id: "b-dune", title: "Dune", author: "Frank Herbert", isbn: "9780441013593" }],
    });

    const result = await importFromGoodreads(
      csv([
        `1,Dune,Frank Herbert,,="9780441013593",5,0,0,,2024/01/01,,read`,
        `2,Unknown Book,Nobody,,="9780000000009",0,0,0,,2024/01/01,,to-read`,
      ])
    );

    expect(result).toMatchObject({ success: true, matched: 0, skipped: 1, notFound: 1 });
    expect(result.notFoundBooks).toEqual([{ title: "Unknown Book", author: "Nobody", isbn13: "9780000000009" }]);
    expect(mock.insert).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/my-shelf");
  });

  it("falls back to a normalised title + author match when there is no ISBN", async () => {
    arrange({ catalog: [{ id: "b-dune", title: "Dune", author: "Frank Herbert", isbn: null }] });

    const result = await importFromGoodreads(csv([`1,DUNE!,Herbert Frank,,,4,0,0,,2024/01/01,,to-read`]));

    // Title normalises to "dune"; author "Herbert Frank" is not contained in
    // "frank herbert", so the exact-title candidate is rejected and the row is
    // unmatched. A contained author matches.
    expect(result.notFound).toBe(1);

    arrange({ catalog: [{ id: "b-dune", title: "Dune", author: "Frank Herbert", isbn: null }] });
    const ok = await importFromGoodreads(csv([`1,dune,Herbert,,,4,0,0,,2024/01/01,,to-read`]));
    expect(ok.matched).toBe(1);
    expect(ok.matchedBooks[0]).toEqual({ title: "Dune", author: "Frank Herbert", status: "want_to_read" });
  });

  it("reports a failed batch insert without claiming success or revalidating", async () => {
    arrange({ catalog: [{ id: "b-dune", title: "Dune", author: "Frank Herbert", isbn: "9780441013593" }] });
    mock.insert.mockResolvedValue({ error: { message: "boom" } });

    const result = await importFromGoodreads(csv([`1,Dune,Frank Herbert,,="9780441013593",5,0,0,,2024/01/01,,read`]));

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(["Failed to add books. Please try again."]);
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
