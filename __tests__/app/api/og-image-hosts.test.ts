// @vitest-environment node
/**
 * Tests for the OG image routes' server-side image fetch (Phase 2, Task 5).
 *
 * `@vercel/og` fetches every `<img src>` in the tree from our infrastructure.
 * These routes used to pass `cover_url` / `avatar_url` straight through, so a
 * profile whose avatar pointed at an internal address turned a public share
 * card into an SSRF. Now only allow-listed hosts become an `<img>`; anything
 * else renders the placeholder.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";

let rendered: ReactElement | null = null;

vi.mock("@vercel/og", () => ({
  ImageResponse: class {
    status = 200;
    constructor(element: ReactElement) {
      rendered = element;
    }
  },
}));

const rows: Record<string, unknown> = {};

vi.mock("@/lib/supabase/server", () => {
  const single = (table: string) => async () => ({
    data: rows[table] ?? null,
    error: rows[table] ? null : { message: "not found" },
  });
  const client = {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({ single: single(table), eq: () => ({ single: single(table) }) }),
      }),
    }),
  };
  return {
    createPublicClient: () => client,
    createClient: async () => client,
  };
});
vi.mock("@/lib/utils/log", () => ({ logError: vi.fn() }));

import { GET as reviewGET } from "@/app/api/og/review/route";
import { GET as bookGET } from "@/app/api/og/book/route";

/** Collect every `<img src>` in a React element tree. */
function imgSrcs(node: ReactNode, out: string[] = []): string[] {
  if (!node || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    node.forEach((child) => imgSrcs(child, out));
    return out;
  }
  const el = node as ReactElement<{ src?: string; children?: ReactNode }>;
  if (el.type === "img" && el.props.src) out.push(el.props.src);
  imgSrcs(el.props?.children, out);
  return out;
}

beforeEach(() => {
  rendered = null;
  for (const key of Object.keys(rows)) delete rows[key];
});

describe("GET /api/og/review", () => {
  const request = new Request(
    "https://ohmyreads-next.vercel.app/api/og/review?id=550e8400-e29b-41d4-a716-446655440000"
  );

  it("renders allow-listed cover and avatar URLs as images", async () => {
    rows.reviews = { content: "Great", summary: null, rating: 4, user_id: "u", book_id: "b" };
    rows.books = {
      title: "Dune",
      author: "Frank Herbert",
      cover_url: "https://covers.openlibrary.org/b/id/1-L.jpg",
    };
    rows.profiles = {
      username: "ada",
      display_name: "Ada",
      avatar_url: "https://lh3.googleusercontent.com/a/x=s96-c",
    };

    await reviewGET(request);

    expect(imgSrcs(rendered)).toEqual([
      "https://covers.openlibrary.org/b/id/1-L.jpg",
      "https://lh3.googleusercontent.com/a/x=s96-c",
    ]);
  });

  it("never fetches an avatar or cover that points off the allow-list", async () => {
    rows.reviews = { content: "Great", summary: null, rating: 4, user_id: "u", book_id: "b" };
    rows.books = {
      title: "Dune",
      author: "Frank Herbert",
      cover_url: "http://169.254.169.254/latest/meta-data/",
    };
    rows.profiles = {
      username: "ada",
      display_name: "Ada",
      avatar_url: "https://10.0.0.5/internal.png",
    };

    const response = await reviewGET(request);

    expect(response.status).toBe(200);
    expect(imgSrcs(rendered)).toEqual([]);
  });
});

describe("GET /api/og/book", () => {
  const request = new Request(
    "https://ohmyreads-next.vercel.app/api/og/book?slug=dune"
  );

  it("renders an allow-listed cover", async () => {
    rows.books = {
      title: "Dune",
      author: "Frank Herbert",
      cover_url: "https://books.google.com/books/content?id=x&img=1",
      genres: [],
      average_rating: null,
      ratings_count: 0,
      page_count: 412,
    };

    await bookGET(request);

    expect(imgSrcs(rendered)).toEqual([
      "https://books.google.com/books/content?id=x&img=1",
    ]);
  });

  it("falls back to the placeholder for a cover on an unknown host", async () => {
    rows.books = {
      title: "Dune",
      author: "Frank Herbert",
      cover_url: "https://evil.example/cover.jpg",
      genres: [],
      average_rating: null,
      ratings_count: 0,
      page_count: 412,
    };

    const response = await bookGET(request);

    expect(response.status).toBe(200);
    expect(imgSrcs(rendered)).toEqual([]);
  });
});
