/**
 * updateReadingProgress() — pages and percent (UX fixes Task 8).
 *
 * Progress now arrives either way round, because an audiobook or an e-reader
 * gives a reader no page to type. The action has to derive the missing side
 * from the effective total (passed in, then stored, then `books.page_count`),
 * refuse a row that is not on the currently-reading shelf, and store a bare
 * percentage when nothing knows the page count.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { thenableQuery, type QueryCall } from "../../helpers/mock-supabase";
import { updateReadingProgressSchema } from "@/lib/validation/book-action";

const { revalidatePath, checkRateLimit } = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  checkRateLimit: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/cache/tags", () => ({
  invalidateTags: vi.fn(),
  CACHE_TAGS: { activity: "activity-feed", trending: "trending", books: "books" },
  BOOK_CATALOG_TAGS: ["books", "genres", "authors"],
}));
vi.mock("@/lib/actions/badges", () => ({ syncUserBadges: vi.fn() }));
vi.mock("@/lib/actions/challenges", () => ({ syncChallengeProgress: vi.fn() }));
vi.mock("@/lib/utils/rate-limit", () => ({ checkRateLimit }));
vi.mock("@/lib/utils/log", () => ({
  logError: vi.fn(),
  reportError: (msg: string) => msg,
}));

/**
 * The action reads the shelf row and then writes it, both through
 * `from("user_books")`. One builder answers both: the write is the query
 * whose recorded calls include `update`.
 */
let user: { id: string } | null;
let row: Record<string, unknown> | null;
let updateResult: { data: unknown; error: unknown };
let queries: QueryCall[][];

function makeClient() {
  return {
    from: () => {
      const calls: QueryCall[] = [];
      queries.push(calls);
      return thenableQuery(
        (recorded: QueryCall[]) =>
          recorded.some(([method]) => method === "update")
            ? updateResult
            : { data: row, error: null },
        calls
      );
    },
  };
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => makeClient(),
  getUser: async () => ({ data: { user }, error: null }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => makeClient() }));

import { updateReadingProgress } from "@/lib/actions/books";

const USER = { id: "550e8400-e29b-41d4-a716-446655440000" };
const BOOK = "550e8400-e29b-41d4-a716-446655440001";

/** The shelf row the action reads before it writes. */
function shelfRow(fields: {
  status?: string;
  total_pages?: number | null;
  page_count?: number | null;
}) {
  row = {
    status: fields.status ?? "reading",
    total_pages: fields.total_pages ?? null,
    book: { page_count: fields.page_count ?? null },
  };
}

/** The columns handed to `.update()`. */
function written(): Record<string, unknown> {
  for (const calls of queries) {
    const update = calls.find(([method]) => method === "update");
    if (update) return update[1][0] as Record<string, unknown>;
  }
  throw new Error("no update was issued");
}

function updateIssued(): boolean {
  return queries.some((calls) => calls.some(([method]) => method === "update"));
}

beforeEach(() => {
  vi.clearAllMocks();
  user = USER;
  queries = [];
  updateResult = { data: [{ book_id: BOOK }], error: null };
  checkRateLimit.mockResolvedValue({ allowed: true });
  shelfRow({ total_pages: 300 });
});

describe("updateReadingProgressSchema", () => {
  it("accepts a page alone, a percent alone, and rejects neither", () => {
    expect(updateReadingProgressSchema.safeParse({ bookId: BOOK, currentPage: 40 }).success).toBe(true);
    expect(updateReadingProgressSchema.safeParse({ bookId: BOOK, percent: 40 }).success).toBe(true);
    expect(updateReadingProgressSchema.safeParse({ bookId: BOOK }).success).toBe(false);
  });

  it("bounds the percentage to 0-100 and the page to 0-50000", () => {
    expect(updateReadingProgressSchema.safeParse({ bookId: BOOK, percent: 101 }).success).toBe(false);
    expect(updateReadingProgressSchema.safeParse({ bookId: BOOK, percent: -1 }).success).toBe(false);
    expect(updateReadingProgressSchema.safeParse({ bookId: BOOK, percent: 0 }).success).toBe(true);
    expect(updateReadingProgressSchema.safeParse({ bookId: BOOK, percent: 12.5 }).success).toBe(false);
    expect(updateReadingProgressSchema.safeParse({ bookId: BOOK, currentPage: 50001 }).success).toBe(false);
    expect(updateReadingProgressSchema.safeParse({ bookId: BOOK, currentPage: -1 }).success).toBe(false);
  });

  it("rejects a malformed book id and a zero total", () => {
    expect(updateReadingProgressSchema.safeParse({ bookId: "nope", currentPage: 1 }).success).toBe(false);
    expect(
      updateReadingProgressSchema.safeParse({ bookId: BOOK, currentPage: 1, totalPages: 0 }).success
    ).toBe(false);
  });
});

describe("updateReadingProgress guards", () => {
  it("refuses an anonymous caller before the rate limiter or the database", async () => {
    user = null;

    expect(await updateReadingProgress({ bookId: BOOK, currentPage: 10 })).toEqual({
      success: false,
      error: "Not authenticated",
    });
    expect(checkRateLimit).not.toHaveBeenCalled();
  });

  it("stops at 20 shelf writes per minute per user", async () => {
    checkRateLimit.mockResolvedValue({ allowed: false });

    const result = await updateReadingProgress({ bookId: BOOK, currentPage: 10 });

    expect(result.success).toBe(false);
    expect(updateIssued()).toBe(false);
  });

  it("rejects input carrying neither a page nor a percentage", async () => {
    const result = await updateReadingProgress({ bookId: BOOK });

    expect(result.success).toBe(false);
    expect(updateIssued()).toBe(false);
  });

  it("refuses a book that is not on the currently-reading shelf", async () => {
    shelfRow({ status: "want_to_read" });

    const result = await updateReadingProgress({ bookId: BOOK, currentPage: 10 });

    expect(result).toEqual({
      success: false,
      error: "Book is not in your currently-reading shelf",
    });
    expect(updateIssued()).toBe(false);
  });
});

describe("updateReadingProgress derived fields", () => {
  it("derives the percentage from a page against the stored total", async () => {
    const result = await updateReadingProgress({ bookId: BOOK, currentPage: 120 });

    expect(result).toEqual({
      success: true,
      currentPage: 120,
      totalPages: 300,
      progressPercentage: 40,
    });
    expect(written()).toMatchObject({
      current_page: 120,
      total_pages: 300,
      progress_percentage: 40,
    });
  });

  it("falls back to books.page_count when the reader stored no total", async () => {
    shelfRow({ total_pages: null, page_count: 200 });

    const result = await updateReadingProgress({ bookId: BOOK, currentPage: 50 });

    expect(result).toMatchObject({ totalPages: 200, progressPercentage: 25 });
  });

  it("clamps a page past the end of the book", async () => {
    const result = await updateReadingProgress({ bookId: BOOK, currentPage: 999 });

    expect(result).toMatchObject({ currentPage: 300, progressPercentage: 100 });
  });

  it("derives the page from a percentage when a total is known", async () => {
    const result = await updateReadingProgress({ bookId: BOOK, percent: 39 });

    expect(result).toEqual({
      success: true,
      currentPage: 117,
      totalPages: 300,
      progressPercentage: 39,
    });
  });

  it("stores a bare percentage when nothing knows the page count", async () => {
    shelfRow({ total_pages: null, page_count: null });

    const result = await updateReadingProgress({ bookId: BOOK, percent: 39 });

    expect(result).toEqual({
      success: true,
      currentPage: null,
      totalPages: null,
      progressPercentage: 39,
    });
    expect(written()).toMatchObject({ current_page: null, progress_percentage: 39 });
  });

  it("leaves the percentage null when a page is entered without any total", async () => {
    shelfRow({ total_pages: null, page_count: null });

    const result = await updateReadingProgress({ bookId: BOOK, currentPage: 88 });

    expect(result).toMatchObject({ currentPage: 88, totalPages: null, progressPercentage: null });
  });

  it("takes a total passed in over the stored one and the book's", async () => {
    shelfRow({ total_pages: 300, page_count: 200 });

    const result = await updateReadingProgress({
      bookId: BOOK,
      currentPage: 25,
      totalPages: 100,
    });

    expect(result).toMatchObject({ totalPages: 100, progressPercentage: 25 });
  });

  it("lets a percentage win over a page when both arrive", async () => {
    const result = await updateReadingProgress({
      bookId: BOOK,
      currentPage: 10,
      percent: 50,
    });

    expect(result).toMatchObject({ currentPage: 150, progressPercentage: 50 });
  });

  it("clears both sides on percent 0", async () => {
    const result = await updateReadingProgress({ bookId: BOOK, percent: 0 });

    expect(result).toMatchObject({ currentPage: 0, progressPercentage: 0 });
  });

  it("revalidates the two pages that show progress", async () => {
    await updateReadingProgress({ bookId: BOOK, currentPage: 10 });

    expect(revalidatePath).toHaveBeenCalledWith("/my-shelf");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
  });
});
