// @vitest-environment node
/**
 * Audit 2026-09-24, Task 5: the admin CSV import looked up and wrote an
 * `isbn13` column that `books` doesn't have, so every insert failed. ISBNs now
 * go into `isbn` as ISBN-13, and the duplicate check uses that column.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const requireAdmin = vi.fn();
vi.mock("@/lib/auth/require-admin", () => ({ requireAdmin: () => requireAdmin() }));
vi.mock("@/lib/utils/rate-limit", () => ({
  checkRateLimit: () => Promise.resolve({ allowed: true, remaining: 29, resetIn: 60000 }),
}));
vi.mock("@/lib/utils/audit-log", () => ({ createAuditLog: () => Promise.resolve() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/cache/tags", () => ({ BOOK_CATALOG_TAGS: ["books"], invalidateTags: vi.fn() }));

import { importBooksFromCSV } from "@/lib/actions/admin-import";
import type { ParsedBookRow } from "@/lib/utils/book-csv-parser";

const isbnLookups: string[] = [];
const insert = vi.fn();
let existingIsbns: string[] = [];

function none() {
  return Promise.resolve({ data: null, error: null });
}

beforeEach(() => {
  vi.clearAllMocks();
  isbnLookups.length = 0;
  existingIsbns = [];
  insert.mockReturnValue({
    select: () => ({ single: () => Promise.resolve({ data: { id: "new-id" }, error: null }) }),
  });
  const from = () => ({
    select: () => ({
      eq: (col: string, value: string) => {
        if (col === "isbn") isbnLookups.push(value);
        const hit = col === "isbn" && existingIsbns.includes(value);
        return {
          maybeSingle: () =>
            Promise.resolve({ data: hit ? { id: "old-id", title: "Dune" } : null, error: null }),
          single: none,
        };
      },
      ilike: () => ({ ilike: () => ({ limit: () => ({ maybeSingle: none }) }) }),
    }),
    insert,
  });
  requireAdmin.mockResolvedValue({ supabase: { from }, user: { id: "admin" } });
});

const row = (over: Partial<ParsedBookRow>): ParsedBookRow => ({
  title: "Dune",
  author: "Frank Herbert",
  genres: [],
  rowNumber: 2,
  errors: [],
  ...over,
});

describe("importBooksFromCSV", () => {
  it("inserts the ISBN-10 as ISBN-13 in `isbn`, with no isbn13 column", async () => {
    const result = await importBooksFromCSV([row({ isbn: "0441013597" })]);

    expect(result.imported).toBe(1);
    expect(isbnLookups).toEqual(["9780441013593"]);
    const payload = insert.mock.calls[0][0];
    expect(payload).not.toHaveProperty("isbn13");
    expect(payload.isbn).toBe("9780441013593");
  });

  it("skips a row whose ISBN-13 already exists", async () => {
    existingIsbns = ["9780441013593"];

    const result = await importBooksFromCSV([row({ isbn13: "9780441013593" })]);

    expect(result).toMatchObject({ imported: 0, skipped: 1, failed: 0 });
    expect(insert).not.toHaveBeenCalled();
  });
});
