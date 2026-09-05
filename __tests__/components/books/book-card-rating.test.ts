import { describe, expect, it } from "vitest";
import { LOCAL_RATING_THRESHOLD, pickRating } from "@/components/books/book-card";

/**
 * Which figure a card shows. The site's own average only outranks Open
 * Library once enough readers here have rated (one 5★ must not beat a
 * thousand OL votes), so the home rail, Browse and trending agree.
 */
const base = {
  id: "b1",
  title: "Atomic Habits",
  author: "James Clear",
  slug: "atomic-habits",
  cover_url: null,
};

describe("pickRating", () => {
  it("shows Open Library while local ratings are below the threshold", () => {
    const picked = pickRating({
      ...base,
      average_rating: 4.3,
      ratings_count: 1200,
      local_average_rating: 5,
      local_ratings_count: LOCAL_RATING_THRESHOLD - 1,
    });

    expect(picked).toEqual({ rating: 4.3, count: 1200, external: true });
  });

  it("switches to the local average exactly at the threshold", () => {
    const picked = pickRating({
      ...base,
      average_rating: 4.3,
      ratings_count: 1200,
      local_average_rating: 4.8,
      local_ratings_count: LOCAL_RATING_THRESHOLD,
    });

    expect(picked).toEqual({ rating: 4.8, count: LOCAL_RATING_THRESHOLD, external: false });
  });

  it("falls back to Open Library, then to nothing, when there is no local average", () => {
    expect(
      pickRating({ ...base, average_rating: 3.9, ratings_count: null, local_ratings_count: 0 })
    ).toEqual({ rating: 3.9, count: null, external: true });
    expect(pickRating({ ...base, average_rating: null })).toBeNull();
  });

  it("never shows a local average whose count is missing", () => {
    expect(
      pickRating({ ...base, average_rating: null, local_average_rating: 5 })
    ).toBeNull();
  });
});
