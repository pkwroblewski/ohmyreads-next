/**
 * Cover URL resolution (Phase 2, Task 13).
 *
 * Open Library candidates must carry `?default=false` so a missing cover is a
 * 404 (which the `<img>` error event can react to) rather than a 200 with a
 * 1×1 blank; the fallback order is what `useCoverSrc` walks on error.
 */

import { describe, it, expect } from "vitest";
import {
  getCoverUrlsWithFallbacks,
  getOpenLibraryCoverById,
  getOpenLibraryCoverByIsbn,
  isStoredCover,
  resolveCoverUrl,
  upgradeOpenLibraryCoverSize,
} from "@/lib/utils/covers";

const STORED =
  "https://bgczdbmqievfilvdzlgl.supabase.co/storage/v1/object/public/book-covers/550e8400-e29b-41d4-a716-446655440000.jpg?v=1757000000";

describe("stored covers (catalog Task 2)", () => {
  it("recognises only public book-covers objects on a supabase.co host", () => {
    expect(isStoredCover(STORED)).toBe(true);
    expect(
      isStoredCover(
        "https://bgczdbmqievfilvdzlgl.supabase.co/storage/v1/object/public/place-photos/x.jpg"
      )
    ).toBe(false);
    expect(isStoredCover("https://covers.openlibrary.org/b/id/1-L.jpg")).toBe(false);
    expect(isStoredCover(null)).toBe(false);
  });

  it("is the only candidate once a book has one, whatever else the row carries", () => {
    const book = {
      cover_url: STORED,
      isbn: "9780735211292",
      google_books_id: "abc",
      open_library_cover_id: 42,
    };
    expect(resolveCoverUrl(book)).toBe(STORED);
    expect(getCoverUrlsWithFallbacks(book)).toEqual([STORED]);
  });
});

describe("Open Library URLs", () => {
  it("asks Open Library to 404 instead of serving a blank placeholder", () => {
    expect(getOpenLibraryCoverById(123)).toBe(
      "https://covers.openlibrary.org/b/id/123-L.jpg?default=false"
    );
    expect(getOpenLibraryCoverByIsbn("978-0-7352-1129 2")).toBe(
      "https://covers.openlibrary.org/b/isbn/9780735211292-L.jpg?default=false"
    );
  });

  it("upgrades a stored -S/-M Open Library URL to -L and leaves others alone", () => {
    expect(
      upgradeOpenLibraryCoverSize("https://covers.openlibrary.org/b/id/1-M.jpg")
    ).toBe("https://covers.openlibrary.org/b/id/1-L.jpg");
    expect(upgradeOpenLibraryCoverSize("https://example.com/x-M.jpg")).toBe(
      "https://example.com/x-M.jpg"
    );
  });
});

describe("getCoverUrlsWithFallbacks", () => {
  it("orders candidates: OL cover id, OL isbn, stored cover_url, Google Books", () => {
    const urls = getCoverUrlsWithFallbacks({
      open_library_cover_id: 42,
      isbn: "9780735211292",
      cover_url: "https://books.google.com/books/content?id=x&printsec=frontcover&img=1&zoom=1",
      google_books_id: "gbid",
    });
    expect(urls).toEqual([
      "https://covers.openlibrary.org/b/id/42-L.jpg?default=false",
      "https://covers.openlibrary.org/b/isbn/9780735211292-L.jpg?default=false",
      "https://books.google.com/books/content?id=x&printsec=frontcover&img=1&zoom=1",
      "https://books.google.com/books/content?id=gbid&printsec=frontcover&img=1&zoom=3&source=gbs_api",
    ]);
  });

  it("returns an empty chain when the book has no cover data", () => {
    expect(getCoverUrlsWithFallbacks({})).toEqual([]);
    expect(resolveCoverUrl({})).toBeNull();
  });

  it("resolveCoverUrl is the head of the chain", () => {
    const book = { isbn: "1234567890", google_books_id: "g" };
    expect(resolveCoverUrl(book)).toBe(getCoverUrlsWithFallbacks(book)[0]);
  });
});
