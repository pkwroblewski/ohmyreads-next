/**
 * "More like this" rating badge (shelf design plan, Task 11): Open Library
 * averages over a handful of ratings are mostly ★5.0, so the badge shows only
 * with at least 25 ratings behind it.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { RecommendedBooksRow } from "@/components/books/recommended-books-row";
import type { RecommendedBook } from "@/lib/queries/recommendations";

vi.mock("@/components/books/cover-image", () => ({ CoverImage: () => null }));

const book = (id: string, average_rating: number | null, ratings_count: number | null) =>
  ({
    id,
    slug: id,
    title: `Book ${id}`,
    author: "Someone",
    average_rating,
    ratings_count,
    score: 0,
    reason: { type: "popular_in_genre", label: "Also in Fantasy" },
  }) as unknown as RecommendedBook;

afterEach(cleanup);

describe("RecommendedBooksRow rating badge", () => {
  it("shows the badge only when 25 or more ratings back it", () => {
    render(
      <RecommendedBooksRow
        title="More like this"
        books={[book("few", 5, 2), book("edge", 4.6, 25), book("many", 4.2, 1411), book("none", null, 0)]}
      />
    );

    expect(screen.queryByText("★ 5.0")).toBeNull();
    expect(screen.getByText("★ 4.6")).toBeTruthy();
    expect(screen.getByText("★ 4.2")).toBeTruthy();
    expect(screen.getAllByText(/★/)).toHaveLength(2);
  });
});
