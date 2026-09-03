// @vitest-environment node
/**
 * The OG book card used to print `books.average_rating` (Open Library) as if
 * it were this site's own figure. Since Task 19 it prefers the local pair
 * (migration 063) and labels whichever source it shows.
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

let book: Record<string, unknown> | null = null;

vi.mock("@/lib/supabase/server", () => {
  const single = async () => ({ data: book, error: book ? null : { message: "not found" } });
  const client = { from: () => ({ select: () => ({ eq: () => ({ single }) }) }) };
  return { createPublicClient: () => client, createClient: async () => client };
});
vi.mock("@/lib/utils/log", () => ({ logError: vi.fn() }));

import { GET } from "@/app/api/og/book/route";

/** Every string leaf in a React element tree, joined. */
function text(node: ReactNode, out: string[] = []): string {
  if (node === null || node === undefined || typeof node === "boolean") return out.join(" ");
  if (typeof node === "string" || typeof node === "number") {
    out.push(String(node));
    return out.join(" ");
  }
  if (Array.isArray(node)) {
    node.forEach((c) => text(c, out));
    return out.join(" ");
  }
  const el = node as ReactElement<{ children?: ReactNode }>;
  text(el.props?.children, out);
  return out.join(" ");
}

const base = {
  title: "A Book",
  author: "Ann Author",
  cover_url: null,
  genres: [],
  page_count: null,
};

describe("GET /api/og/book — rating source", () => {
  beforeEach(() => {
    rendered = null;
  });

  it("shows the local rating with its reader count when this site has one", async () => {
    book = {
      ...base,
      average_rating: 3.9,
      ratings_count: 12000,
      local_average_rating: 4.5,
      local_ratings_count: 3,
    };
    await GET(new Request("https://x.test/api/og/book?slug=a-book"));
    const t = text(rendered);
    expect(t).toContain("4.5");
    expect(t).toContain("from 3 readers on OhMyReads");
    expect(t).not.toContain("3.9");
  });

  it("labels the Open Library figure when there is no local rating", async () => {
    book = {
      ...base,
      average_rating: 3.9,
      ratings_count: 12000,
      local_average_rating: null,
      local_ratings_count: 0,
    };
    await GET(new Request("https://x.test/api/og/book?slug=a-book"));
    const t = text(rendered);
    expect(t).toContain("3.9");
    expect(t).toContain("12000 ratings on Open Library");
  });

  it("shows no rating row when neither source has one", async () => {
    book = {
      ...base,
      average_rating: null,
      ratings_count: 0,
      local_average_rating: null,
      local_ratings_count: 0,
    };
    await GET(new Request("https://x.test/api/og/book?slug=a-book"));
    const t = text(rendered);
    expect(t).not.toContain("Open Library");
    expect(t).not.toContain("readers");
  });
});
