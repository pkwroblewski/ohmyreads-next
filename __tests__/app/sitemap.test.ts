// @vitest-environment node
/**
 * Tests for app/sitemap.ts (Phase 2, Task 19).
 *
 * The sitemap used to submit /login and /signup (which robots.txt disallows),
 * list every profile with a username regardless of `discovery_visible`, and
 * stamp `new Date()` or `created_at` as lastModified. Now it lists only what a
 * crawler may index, filters profiles the way the profile page does, and only
 * carries a date when the row has one.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

type Row = Record<string, unknown>;

const rows: Record<string, Row[]> = {};
const calls: Record<string, Array<[string, unknown[]]>> = {};

vi.mock("@/lib/supabase/server", () => {
  const builder = (table: string) => {
    const b: Record<string, unknown> = {};
    const chain =
      (name: string) =>
      (...args: unknown[]) => {
        (calls[table] ??= []).push([name, args]);
        return b;
      };
    for (const m of ["select", "not", "eq", "is", "order", "limit"]) b[m] = chain(m);
    b.then = (resolve: (v: { data: Row[]; error: null }) => void) =>
      resolve({ data: rows[table] ?? [], error: null });
    return b;
  };
  return { createPublicClient: () => ({ from: builder }) };
});

vi.mock("@/lib/queries/authors", () => ({
  getAllAuthors: async () => [
    { name: "Ann Author", slug: "ann-author", bookCount: 2, avgRating: 4 },
    { name: "No Books Listed", slug: "no-books-listed", bookCount: 1, avgRating: null },
  ],
}));

vi.mock("@/lib/data/curated-lists", () => ({
  CURATED_LISTS: [
    { slug: "pinned-list", title: "Pinned", bookSlugs: ["book-a", "book-b"] },
    { slug: "genre-list", title: "By genre" },
  ],
}));

import sitemap from "@/app/sitemap";

const BASE = "https://ohmyreads.com";

function urls(entries: Awaited<ReturnType<typeof sitemap>>): string[] {
  return entries.map((e) => e.url.replace(BASE, ""));
}

describe("sitemap", () => {
  beforeEach(() => {
    for (const k of Object.keys(rows)) delete rows[k];
    for (const k of Object.keys(calls)) delete calls[k];
    rows.books = [
      { slug: "book-a", author_slug: "ann-author", updated_at: "2026-09-01T00:00:00.000Z", created_at: "2026-01-01T00:00:00.000Z" },
      { slug: "book-b", author_slug: "ann-author", updated_at: "2026-08-01T00:00:00.000Z", created_at: "2026-01-01T00:00:00.000Z" },
      { slug: "book-c", author_slug: "other", updated_at: null, created_at: "2026-02-01T00:00:00.000Z" },
    ];
    rows.profiles = [{ username: "visible-reader", updated_at: "2026-03-01T00:00:00.000Z" }];
    rows.book_clubs = [{ slug: "night-owls", updated_at: null, created_at: "2026-04-01T00:00:00.000Z" }];
    rows.reading_lists = [
      { id: "550e8400-e29b-41d4-a716-446655440000", updated_at: "2026-05-01T00:00:00.000Z", created_at: null },
    ];
  });

  it("submits only crawlable static routes: no auth pages, no noindex pages, the missing hubs added", async () => {
    const u = urls(await sitemap());
    expect(u).not.toContain("/login");
    expect(u).not.toContain("/signup");
    expect(u).not.toContain("/discover");
    expect(u).not.toContain("/recommendations");
    for (const p of ["/trending", "/clubs", "/community", "/books", "/authors", "/lists"]) {
      expect(u).toContain(p);
    }
  });

  it("lists only discoverable, non-disabled profiles", async () => {
    await sitemap();
    const profileCalls = calls.profiles.map(([m, a]) => [m, ...a]);
    expect(profileCalls).toContainEqual(["eq", "discovery_visible", true]);
    expect(profileCalls).toContainEqual(["is", "disabled_at", null]);
    expect(profileCalls).toContainEqual(["not", "username", "is", null]);
  });

  it("uses updated_at for books, falling back to created_at", async () => {
    const entries = await sitemap();
    const a = entries.find((e) => e.url.endsWith("/books/book-a"));
    const c = entries.find((e) => e.url.endsWith("/books/book-c"));
    expect(a?.lastModified).toEqual(new Date("2026-09-01T00:00:00.000Z"));
    expect(c?.lastModified).toEqual(new Date("2026-02-01T00:00:00.000Z"));
  });

  it("dates an author by their newest listed book and omits the date otherwise", async () => {
    const entries = await sitemap();
    const ann = entries.find((e) => e.url.endsWith("/authors/ann-author"));
    const none = entries.find((e) => e.url.endsWith("/authors/no-books-listed"));
    expect(ann?.lastModified).toEqual(new Date("2026-09-01T00:00:00.000Z"));
    expect(none).toBeDefined();
    expect(none).not.toHaveProperty("lastModified");
  });

  it("dates a curated list pinned to book slugs by its newest book; genre lists carry none", async () => {
    const entries = await sitemap();
    const pinned = entries.find((e) => e.url.endsWith("/lists/pinned-list"));
    const genre = entries.find((e) => e.url.endsWith("/lists/genre-list"));
    expect(pinned?.lastModified).toEqual(new Date("2026-09-01T00:00:00.000Z"));
    expect(genre).not.toHaveProperty("lastModified");
  });

  it("includes public clubs by slug and public community lists by id", async () => {
    const entries = await sitemap();
    const club = entries.find((e) => e.url.endsWith("/clubs/night-owls"));
    const list = entries.find((e) =>
      e.url.endsWith("/lists/550e8400-e29b-41d4-a716-446655440000")
    );
    expect(club?.lastModified).toEqual(new Date("2026-04-01T00:00:00.000Z"));
    expect(list?.lastModified).toEqual(new Date("2026-05-01T00:00:00.000Z"));
    expect(calls.book_clubs.map(([m, a]) => [m, ...a])).toContainEqual([
      "eq",
      "visibility",
      "public",
    ]);
    expect(calls.reading_lists.map(([m, a]) => [m, ...a])).toContainEqual([
      "eq",
      "visibility",
      "public",
    ]);
  });

  it("never stamps the current time on static entries", async () => {
    const entries = await sitemap();
    const about = entries.find((e) => e.url === `${BASE}/about`);
    expect(about).toBeDefined();
    expect(about).not.toHaveProperty("lastModified");
  });
});
