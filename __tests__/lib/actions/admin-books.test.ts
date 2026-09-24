// @vitest-environment node
/**
 * Tests for the admin book mutations (Phase 2, Task 6).
 *
 * `requireAdmin()` hands back the caller's *session* client, so RLS still
 * applies to every write these actions make. Before migration 064 there was no
 * admin policy on `books`, and a delete or update simply matched zero rows:
 * PostgREST answers `error: null` for that, the action reported success, and an
 * audit row was written for a change that never happened. The row count is now
 * checked, and these cases pin that down: zero rows must be a failure, and it
 * must never reach `createAuditLog`.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const requireAdmin = vi.fn();
const checkRateLimit = vi.fn();
const createAuditLog = vi.fn();

const bookSingle = vi.fn();
const deleteSelect = vi.fn();
const updateSelect = vi.fn();
const update = vi.fn();
const from = vi.fn();

vi.mock("@/lib/auth/require-admin", () => ({
  requireAdmin: () => requireAdmin(),
}));

vi.mock("@/lib/utils/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimit(...args),
}));

vi.mock("@/lib/utils/audit-log", () => ({
  createAuditLog: (...args: unknown[]) => createAuditLog(...args),
}));

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...a: unknown[]) => revalidatePath(...a) }));

const invalidateTags = vi.fn();
const BOOK_CATALOG_TAGS = ["books"];
vi.mock("@/lib/cache/tags", () => ({
  BOOK_CATALOG_TAGS: ["books"],
  invalidateTags: (...a: unknown[]) => invalidateTags(...a),
}));

import { adminCreateBook, adminDeleteBook, adminUpdateBook } from "@/lib/actions/admin-books";

const ADMIN = { id: "11111111-1111-4111-8111-111111111111" };
const BOOK = "550e8400-e29b-41d4-a716-446655440000";

/** Wire the session client so the read succeeds and the write returns `rows`. */
function arrange(rows: Array<{ id: string; slug?: string }>) {
  bookSingle.mockResolvedValue({
    data: { title: "Dune", author: "Frank Herbert" },
    error: null,
  });
  deleteSelect.mockResolvedValue({ data: rows, error: null });
  updateSelect.mockResolvedValue({ data: rows, error: null });
  update.mockReturnValue({ eq: () => ({ select: updateSelect }) });

  from.mockImplementation((table: string) => {
    if (table !== "books") throw new Error(`unexpected table ${table}`);
    return {
      select: () => ({ eq: () => ({ single: bookSingle }) }),
      delete: () => ({ eq: () => ({ select: deleteSelect }) }),
      update,
    };
  });

  requireAdmin.mockResolvedValue({ supabase: { from }, user: ADMIN });
  checkRateLimit.mockResolvedValue({ allowed: true, remaining: 29, resetIn: 60000 });
  createAuditLog.mockResolvedValue(undefined);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("adminDeleteBook", () => {
  it("fails, and writes no audit row, when the delete touched no row", async () => {
    arrange([]);

    const result = await adminDeleteBook(BOOK);

    expect(result).toEqual({ success: false, error: "Nothing was changed" });
    expect(createAuditLog).not.toHaveBeenCalled();
  });

  it("succeeds and records the deletion when a row was removed", async () => {
    arrange([{ id: BOOK }]);

    const result = await adminDeleteBook(BOOK);

    expect(result).toEqual({ success: true });
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "admin.book.delete",
        targetId: BOOK,
        userId: ADMIN.id,
        metadata: { title: "Dune", author: "Frank Herbert" },
      })
    );
    expect(invalidateTags).toHaveBeenCalledWith(...BOOK_CATALOG_TAGS);
    expect(revalidatePath).toHaveBeenCalledWith("/admin/books");
    expect(revalidatePath).toHaveBeenCalledWith("/books");
  });

  it("does not claim success on a database error either", async () => {
    arrange([]);
    deleteSelect.mockResolvedValue({ data: null, error: { message: "boom" } });

    const result = await adminDeleteBook(BOOK);

    expect(result.success).toBe(false);
    expect(createAuditLog).not.toHaveBeenCalled();
  });
});

describe("adminUpdateBook", () => {
  it("fails, and writes no audit row, when the update touched no row", async () => {
    arrange([]);

    const result = await adminUpdateBook(BOOK, { author: "F. Herbert" });

    expect(result).toEqual({ success: false, error: "Nothing was changed" });
    expect(update).toHaveBeenCalledWith({ author: "F. Herbert" });
    expect(createAuditLog).not.toHaveBeenCalled();
    expect(invalidateTags).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("returns the updated row and records which fields changed", async () => {
    arrange([{ id: BOOK, slug: "dune" }]);

    const result = await adminUpdateBook(BOOK, { author: "F. Herbert" });

    expect(result).toEqual({ success: true, book: { id: BOOK, slug: "dune" } });
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "admin.book.update",
        targetId: BOOK,
        metadata: { updates: ["author"] },
      })
    );
    expect(invalidateTags).toHaveBeenCalledWith(...BOOK_CATALOG_TAGS);
    expect(revalidatePath).toHaveBeenCalledWith(`/admin/books/${BOOK}`);
    expect(revalidatePath).toHaveBeenCalledWith("/books/dune");
  });
});

/**
 * Audit 2026-09-24, Task 5: the actions wrote an `isbn13` column that `books`
 * doesn't have, so every create failed; clearing a field on edit was dropped;
 * and every edit rebuilt the slug, breaking existing links.
 */
describe("adminCreateBook payload", () => {
  it("stores the ISBN as ISBN-13 in `isbn` and blanks as null", async () => {
    const insert = vi.fn().mockReturnValue({
      select: () => ({ single: () => Promise.resolve({ data: { id: BOOK }, error: null }) }),
    });
    from.mockImplementation(() => ({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
      insert,
    }));
    requireAdmin.mockResolvedValue({ supabase: { from }, user: ADMIN });
    checkRateLimit.mockResolvedValue({ allowed: true, remaining: 29, resetIn: 60000 });

    const result = await adminCreateBook({
      title: "Dune",
      author: "Frank Herbert",
      description: "",
      isbn: "0-441-01359-7",
      cover_url: "",
      page_count: null,
      published_date: "",
      genres: [],
    });

    expect(result.success).toBe(true);
    const row = insert.mock.calls[0][0];
    expect(row).not.toHaveProperty("isbn13");
    expect(row).toMatchObject({
      slug: "dune",
      isbn: "9780441013593",
      description: null,
      cover_url: null,
      page_count: null,
      published_date: null,
    });
  });

  it("says so when the ISBN is already in the catalog", async () => {
    from.mockImplementation(() => ({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
      insert: () => ({
        select: () => ({
          single: () =>
            Promise.resolve({
              data: null,
              error: { code: "23505", message: 'duplicate key value violates unique constraint "books_isbn_unique_idx"' },
            }),
        }),
      }),
    }));
    requireAdmin.mockResolvedValue({ supabase: { from }, user: ADMIN });
    checkRateLimit.mockResolvedValue({ allowed: true, remaining: 29, resetIn: 60000 });

    const result = await adminCreateBook({ title: "Dune", author: "Frank Herbert", isbn: "9780441013593" });

    expect(result).toEqual({ success: false, error: "A book with this ISBN already exists" });
    expect(createAuditLog).not.toHaveBeenCalled();
  });

  it("rejects a malformed ISBN before touching the database", async () => {
    arrange([]);

    const result = await adminCreateBook({ title: "Dune", author: "Frank Herbert", isbn: "12345" });

    expect(result).toEqual({ success: false, error: "ISBN must be 10 or 13 digits" });
    expect(from).not.toHaveBeenCalled();
  });
});

describe("adminUpdateBook edits", () => {
  it("clears blanked fields to null", async () => {
    arrange([{ id: BOOK, slug: "dune" }]);

    await adminUpdateBook(BOOK, { description: "", isbn: "", cover_url: "", page_count: null });

    expect(update).toHaveBeenCalledWith({
      description: null,
      isbn: null,
      cover_url: null,
      page_count: null,
    });
  });

  it("keeps the slug when the title is unchanged", async () => {
    arrange([{ id: BOOK, slug: "dune-frank-herbert" }]);
    bookSingle.mockResolvedValue({ data: { title: "Dune" }, error: null });

    await adminUpdateBook(BOOK, { title: "Dune ", author: "Frank Herbert" });

    expect(update).toHaveBeenCalledWith({ title: "Dune", author: "Frank Herbert" });
  });
});
