/**
 * importAndAddToShelf() — the only path that creates catalog rows for a
 * non-admin reader (Task 4 of the phase-2 plan).
 *
 * The books INSERT policy is admin-only, so the catalog write must go through
 * the service-role client, and only after auth, rate limiting and validation.
 * Everything else — the duplicate lookups and the shelf upsert — must stay on
 * the session client so RLS still applies to the user's own rows.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/cache/tags", () => ({
  invalidateTags: vi.fn(),
  CACHE_TAGS: { activity: "activity", trending: "trending" },
  BOOK_CATALOG_TAGS: ["books"],
}));
vi.mock("@/lib/actions/badges", () => ({ syncUserBadges: vi.fn(async () => ({ newBadges: [] })) }));
vi.mock("@/lib/actions/challenges", () => ({ syncChallengeProgress: vi.fn(async () => ({})) }));
vi.mock("@/lib/utils/log", () => ({
  logError: vi.fn(),
  reportError: (msg: string) => msg,
}));

const checkRateLimit = vi.fn();
vi.mock("@/lib/utils/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimit(...args),
}));

// ---- session client ----
const USER = { id: "550e8400-e29b-41d4-a716-446655440000" };
let currentUser: { id: string } | null = USER;
let existingBook: { id: string; slug: string } | null = null;
const sessionBooksInsert = vi.fn();
const shelfUpsert = vi.fn<(row: Record<string, unknown>) => Promise<{ error: null }>>(async () => ({ error: null }));

function sessionFrom(table: string) {
  if (table === "books") {
    const lookup = {
      select: () => lookup,
      eq: () => lookup,
      limit: () => lookup,
      single: async () => ({ data: existingBook, error: null }),
      insert: sessionBooksInsert,
    };
    return lookup;
  }
  if (table === "user_books") {
    return { upsert: shelfUpsert };
  }
  throw new Error(`unexpected table ${table}`);
}

vi.mock("@/lib/supabase/server", () => {
  const getUser = async () =>
    currentUser
      ? { data: { user: currentUser }, error: null }
      : { data: { user: null }, error: { message: "nope" } };
  return {
    createClient: async () => ({ auth: { getUser }, from: sessionFrom }),
    getUser,
  };
});

// ---- service-role client ----
type InsertResult = { data: { id: string; slug: string } | null; error: { code?: string; message?: string } | null };
const adminInsertResults: InsertResult[] = [];
const adminInsertedRows: Array<Record<string, unknown>> = [];
const adminInsert = vi.fn((row: Record<string, unknown>) => {
  adminInsertedRows.push(row);
  const next = adminInsertResults.shift() ?? {
    data: { id: "book-1", slug: String(row.slug) },
    error: null,
  };
  return { select: () => ({ single: async () => next }) };
});
const adminFrom = vi.fn((table: string) => {
  if (table !== "books") throw new Error(`admin client touched ${table}`);
  return { insert: adminInsert };
});
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: adminFrom }),
}));

const { importAndAddToShelf } = await import("@/lib/actions/books");

const SLUG_COLLISION = { code: "23505", message: 'duplicate key value violates unique constraint "books_slug_key"' };
const NEW_BOOK = {
  title: "The New Book",
  author: "Someone New",
  isbn: "9780000000001",
  coverUrl: "https://covers.example/1.jpg",
};

describe("importAndAddToShelf", () => {
  beforeEach(() => {
    currentUser = USER;
    existingBook = null;
    adminInsertResults.length = 0;
    adminInsertedRows.length = 0;
    adminInsert.mockClear();
    adminFrom.mockClear();
    sessionBooksInsert.mockClear();
    shelfUpsert.mockClear();
    checkRateLimit.mockReset();
    checkRateLimit.mockResolvedValue({ allowed: true });
  });

  it("refuses an unauthenticated caller before touching either client", async () => {
    currentUser = null;

    const result = await importAndAddToShelf(NEW_BOOK, "want_to_read");

    expect(result).toEqual({ success: false, error: "Not authenticated" });
    expect(adminFrom).not.toHaveBeenCalled();
    expect(checkRateLimit).not.toHaveBeenCalled();
  });

  it("creates an uncatalogued book through the service-role client for a plain reader", async () => {
    const result = await importAndAddToShelf(NEW_BOOK, "want_to_read");

    expect(result).toEqual({ success: true, bookId: "book-1", slug: "the-new-book" });

    // The catalog write bypasses the admin-only INSERT policy...
    expect(adminInsert).toHaveBeenCalledTimes(1);
    expect(adminInsertedRows[0]).toMatchObject({
      title: "The New Book",
      author: "Someone New",
      isbn: "9780000000001",
      slug: "the-new-book",
      average_rating: null,
      ratings_count: 0,
      local_average_rating: null,
      local_ratings_count: 0,
    });
    // ...and never happens on the session client
    expect(sessionBooksInsert).not.toHaveBeenCalled();

    // The shelf row stays on the session client under the user's own id
    expect(shelfUpsert).toHaveBeenCalledTimes(1);
    expect(shelfUpsert.mock.calls[0][0]).toMatchObject({ user_id: USER.id, book_id: "book-1", status: "want_to_read" });
  });

  it("rate-limits catalog inserts at 10 per hour on top of the shelf limit", async () => {
    await importAndAddToShelf(NEW_BOOK, "read");

    expect(checkRateLimit).toHaveBeenCalledWith(`book:${USER.id}`, 20, 60000);
    expect(checkRateLimit).toHaveBeenCalledWith(`catalog-insert:${USER.id}`, 10, 3600000);
  });

  it("refuses the insert when the catalog limit is exhausted", async () => {
    checkRateLimit.mockImplementation(async (key: string) => ({ allowed: !key.startsWith("catalog-insert:") }));

    const result = await importAndAddToShelf(NEW_BOOK, "want_to_read");

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/new books/i);
    expect(adminInsert).not.toHaveBeenCalled();
    expect(shelfUpsert).not.toHaveBeenCalled();
  });

  it("reuses an existing catalog row without any insert or catalog limit", async () => {
    existingBook = { id: "book-existing", slug: "the-new-book" };

    const result = await importAndAddToShelf(NEW_BOOK, "reading");

    expect(result).toEqual({ success: true, bookId: "book-existing", slug: "the-new-book" });
    expect(adminFrom).not.toHaveBeenCalled();
    expect(checkRateLimit).not.toHaveBeenCalledWith(expect.stringMatching(/^catalog-insert:/), expect.anything(), expect.anything());
    expect(shelfUpsert.mock.calls[0][0]).toMatchObject({ book_id: "book-existing", status: "reading" });
  });

  it("retries with a random suffix on a slug collision", async () => {
    adminInsertResults.push({ data: null, error: SLUG_COLLISION }, { data: null, error: SLUG_COLLISION });

    const result = await importAndAddToShelf(NEW_BOOK, "want_to_read");

    expect(result.success).toBe(true);
    expect(adminInsert).toHaveBeenCalledTimes(3);
    expect(adminInsertedRows[0].slug).toBe("the-new-book");
    expect(adminInsertedRows[1].slug).toMatch(/^the-new-book-[0-9a-f]{6}$/);
    expect(adminInsertedRows[2].slug).toMatch(/^the-new-book-[0-9a-f]{6}$/);
    expect(result.slug).toBe(adminInsertedRows[2].slug);
  });

  it("falls back to a timestamp slug after ten collisions", async () => {
    for (let i = 0; i < 10; i++) adminInsertResults.push({ data: null, error: SLUG_COLLISION });

    const result = await importAndAddToShelf(NEW_BOOK, "want_to_read");

    expect(result.success).toBe(true);
    expect(adminInsert).toHaveBeenCalledTimes(11);
    expect(adminInsertedRows[10].slug).toMatch(/^the-new-book-\d{13}$/);
  });

  it("surfaces a non-collision insert error and never touches the shelf", async () => {
    adminInsertResults.push({ data: null, error: { code: "23502", message: "null value in column" } });

    const result = await importAndAddToShelf(NEW_BOOK, "want_to_read");

    expect(result).toEqual({ success: false, error: "Error inserting book" });
    expect(adminInsert).toHaveBeenCalledTimes(1);
    expect(shelfUpsert).not.toHaveBeenCalled();
  });
});
