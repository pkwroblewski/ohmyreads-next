/**
 * Cover URL builders (Phase 2, Task 21). The fallback chain is covered in
 * covers.test.ts; these pin the individual builders and classifiers.
 */

import { describe, it, expect } from "vitest";
import {
  getGoogleBooksCoverUrl,
  getOpenLibraryCoverById,
  getOpenLibraryCoverByIsbn,
  isOpenLibraryCover,
  isGoogleBooksCover,
  getCoverSource,
  resolveCoverUrl,
} from "@/lib/utils/covers";

describe("cover URL builders", () => {
  it("builds a Google Books front-cover URL at the requested zoom", () => {
    const url = getGoogleBooksCoverUrl("abc123", 2);
    expect(url).toMatch(/^https:\/\/books\.google\.com\//);
    expect(url).toContain("id=abc123");
    expect(url).toContain("printsec=frontcover");
    expect(url).toContain("zoom=2");
    expect(getGoogleBooksCoverUrl("abc123")).toContain("zoom=3");
  });

  it("builds Open Library URLs by cover id and by ISBN, always asking for a 404 on a miss", () => {
    expect(getOpenLibraryCoverById(12345)).toBe(
      "https://covers.openlibrary.org/b/id/12345-L.jpg?default=false"
    );
    expect(getOpenLibraryCoverById("12345", "S")).toMatch(/\/12345-S\.jpg\?default=false$/);
    expect(getOpenLibraryCoverByIsbn("978-0-441-01359 3", "M")).toBe(
      "https://covers.openlibrary.org/b/isbn/9780441013593-M.jpg?default=false"
    );
  });

  it("classifies a URL by host", () => {
    const ol = getOpenLibraryCoverById(1);
    const gb = getGoogleBooksCoverUrl("x");
    expect(isOpenLibraryCover(ol)).toBe(true);
    expect(isGoogleBooksCover(ol)).toBe(false);
    expect(isGoogleBooksCover(gb)).toBe(true);
    expect(getCoverSource(ol)).toBe("openlibrary");
    expect(getCoverSource(gb)).toBe("google");
    expect(getCoverSource("https://cdn.example.com/c.jpg")).toBe("unknown");
    expect(getCoverSource(null)).toBeNull();
  });

  it("resolves in priority order: cover id, ISBN, stored URL (upgraded), Google Books", () => {
    const base = { cover_url: null, isbn: null, open_library_cover_id: null, google_books_id: null };
    expect(resolveCoverUrl({ ...base, open_library_cover_id: 7, isbn: "1", google_books_id: "g" })).toContain("/b/id/7-L");
    expect(resolveCoverUrl({ ...base, isbn: "9780441013593", google_books_id: "g" })).toContain("/b/isbn/9780441013593-L");
    expect(resolveCoverUrl({ ...base, cover_url: "https://covers.openlibrary.org/b/id/9-S.jpg" })).toBe(
      "https://covers.openlibrary.org/b/id/9-L.jpg"
    );
    expect(resolveCoverUrl({ ...base, google_books_id: "g" })).toContain("id=g");
    expect(resolveCoverUrl(base)).toBeNull();
  });
});
