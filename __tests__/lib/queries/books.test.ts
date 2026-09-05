import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The book page reads its public data through `unstable_cache` on the
 * cookie-less client. These tests pin the three things the page relies on:
 * which client is used, which tag each entry carries (so the review actions'
 * `invalidateTags` calls actually reach it), and how a review page maps to a
 * PostgREST range.
 */

type Call = { table: string; args: Record<string, unknown[]> };

const calls: Call[] = [];
let response: { data: unknown; error: unknown; count?: number | null } = {
  data: null,
  error: null,
};

/** Records every builder method so a test can assert the query shape. */
function builder(table: string) {
  const call: Call = { table, args: {} };
  calls.push(call);
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "neq", "order", "range", "limit", "overlaps", "overrideTypes", "maybeSingle", "single"]) {
    chain[m] = (...a: unknown[]) => {
      (call.args[m] ??= []).push(a);
      return chain;
    };
  }
  chain.then = (resolve: (v: unknown) => unknown) => resolve(response);
  return chain;
}

const publicClient = { from: (table: string) => builder(table) };
const createClient = vi.fn(async () => {
  throw new Error("cookie client must not be used for public catalog reads");
});

vi.mock("@/lib/supabase/server", () => ({
  createPublicClient: () => publicClient,
  createClient: () => createClient(),
}));

/** `unstable_cache` as a pass-through that remembers the options it was given. */
const cacheEntries: { keys: string[]; options: { tags?: string[]; revalidate?: number } }[] = [];
vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...a: unknown[]) => unknown, keys: string[], options: Record<string, unknown>) => {
    cacheEntries.push({ keys, options });
    return fn;
  },
}));

vi.mock("@/lib/utils/log", () => ({ logError: vi.fn() }));

const { getBookBySlug, getBookCount, getBookReviews, getRelatedBooks, REVIEWS_PAGE_SIZE } = await import(
  "@/lib/queries/books"
);

const entry = (key: string) => cacheEntries.find((e) => e.keys.includes(key));

describe("book page caches", () => {
  beforeEach(() => {
    calls.length = 0;
    response = { data: null, error: null };
  });

  it("tags the book, its review pages and related books so review actions expire them", () => {
    expect(entry("book-by-slug")?.options.tags).toEqual(["books"]);
    expect(entry("book-reviews-page")?.options.tags).toEqual(["reviews"]);
    expect(entry("related-books")?.options.tags).toEqual(["books"]);
    for (const key of ["book-by-slug", "book-reviews-page", "related-books"]) {
      expect(entry(key)?.options.revalidate).toBe(3600);
    }
  });

  it("reads the book on the public client and returns null for an unknown slug", async () => {
    const missing = await getBookBySlug("no-such-book");

    expect(missing).toBeNull();
    expect(createClient).not.toHaveBeenCalled();
    expect(calls[0]?.table).toBe("books");
    expect(calls[0]?.args.eq).toEqual([["slug", "no-such-book"]]);
    expect(calls[0]?.args.maybeSingle).toHaveLength(1);
  });

  it("maps a review page to a PostgREST range and returns the exact total", async () => {
    response = { data: [{ id: "r1" }, { id: "r2" }], error: null, count: 27 };

    const page = await getBookReviews("book-1", 3);

    expect(page.total).toBe(27);
    expect(page.reviews).toHaveLength(2);
    const reviewsCall = calls.find((c) => c.table === "reviews");
    expect(reviewsCall?.args.eq).toEqual([["book_id", "book-1"]]);
    expect(reviewsCall?.args.range).toEqual([[2 * REVIEWS_PAGE_SIZE, 3 * REVIEWS_PAGE_SIZE - 1]]);
    expect((reviewsCall?.args.select?.[0] as unknown[])[1]).toEqual({ count: "exact" });
  });

  it("treats page 0 and fractional pages as page 1", async () => {
    response = { data: [], error: null, count: 0 };

    await getBookReviews("book-1", 0);
    await getBookReviews("book-1", 1.9);

    const ranges = calls.filter((c) => c.table === "reviews").map((c) => c.args.range?.[0]);
    expect(ranges).toEqual([
      [0, REVIEWS_PAGE_SIZE - 1],
      [0, REVIEWS_PAGE_SIZE - 1],
    ]);
  });

  it("returns an empty page rather than throwing when the query fails", async () => {
    response = { data: null, error: { message: "boom" }, count: null };

    expect(await getBookReviews("book-1", 1)).toEqual({ reviews: [], total: 0 });
  });

  it("finds related books by overlapping genre on the public client", async () => {
    response = { data: [{ id: "b2" }], error: null };

    const related = await getRelatedBooks(["Fantasy"], "b1", 6);

    expect(related).toEqual([{ id: "b2" }]);
    const call = calls.find((c) => c.table === "books");
    expect(call?.args.overlaps).toEqual([["genres", ["Fantasy"]]]);
    expect(call?.args.neq).toEqual([["id", "b1"]]);
    expect(call?.args.limit).toEqual([[6]]);
    expect(createClient).not.toHaveBeenCalled();
  });
});

describe("getBookCount", () => {
  beforeEach(() => {
    calls.length = 0;
    response = { data: null, error: null, count: 312 };
  });

  it("is a HEAD count on the public client, cached under the books tag", async () => {
    const total = await getBookCount();

    expect(total).toBe(312);
    expect(createClient).not.toHaveBeenCalled();
    expect(calls[0]?.table).toBe("books");
    expect((calls[0]?.args.select?.[0] as unknown[])[1]).toEqual({ count: "exact", head: true });
    expect(entry("book-count")?.options.tags).toEqual(["books"]);
    expect(entry("book-count")?.options.revalidate).toBe(3600);
  });

  it("reports 0 rather than throwing when the count fails", async () => {
    response = { data: null, error: { message: "boom" }, count: null };

    expect(await getBookCount()).toBe(0);
  });
});
