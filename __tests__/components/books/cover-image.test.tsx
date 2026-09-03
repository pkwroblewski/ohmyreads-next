/**
 * CoverImage / CoverImageMini (Phase 2, Task 13).
 *
 * The cover used to be resolved in an effect that probed each candidate with
 * `new Image()` straight from Open Library, so the server HTML held only a
 * pulsing div. Now the first candidate is rendered immediately (server HTML
 * has the `<img>`) and the chain advances on the image's own error / tiny
 * load events, with the placeholder only once every candidate has failed.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentProps } from "react";

// next/image's default loader rejects unconfigured hosts outside a Next
// runtime; a bare <img> that forwards src/alt/handlers is what we assert on.
vi.mock("next/image", () => ({
  default: (props: ComponentProps<"img"> & Record<string, unknown>) => {
    const { fill, priority, placeholder, blurDataURL, quality, sizes, ...rest } = props;
    void fill; void priority; void placeholder; void blurDataURL; void quality; void sizes;
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt="" {...(rest as ComponentProps<"img">)} />;
  },
}));

import { CoverImage, CoverImageMini } from "@/components/books/cover-image";

const OL_ID = "https://covers.openlibrary.org/b/id/42-L.jpg?default=false";
const OL_ISBN = "https://covers.openlibrary.org/b/isbn/9780735211292-L.jpg?default=false";
const GOOGLE =
  "https://books.google.com/books/content?id=gbid&printsec=frontcover&img=1&zoom=3&source=gbs_api";

const book = {
  title: "Atomic Habits",
  author: "James Clear",
  open_library_cover_id: 42,
  isbn: "9780735211292",
  cover_url: null,
  google_books_id: "gbid",
};

afterEach(cleanup);

describe("CoverImage", () => {
  it("server-renders the first candidate as a real <img> with alt text", () => {
    const html = renderToStaticMarkup(<CoverImage book={book} priority />);
    expect(html).toContain(`<img`);
    expect(html).toContain(`alt="Cover of Atomic Habits"`);
    expect(html).toContain(OL_ID.replace(/&/g, "&amp;"));
    expect(html).not.toContain("Loading book cover");
  });

  it("walks the fallback chain on error and ends at the placeholder", () => {
    render(<CoverImage book={book} />);

    const first = screen.getByAltText("Cover of Atomic Habits") as HTMLImageElement;
    expect(first.getAttribute("src")).toBe(OL_ID);

    fireEvent.error(first);
    expect(screen.getByAltText("Cover of Atomic Habits").getAttribute("src")).toBe(OL_ISBN);

    fireEvent.error(screen.getByAltText("Cover of Atomic Habits"));
    expect(screen.getByAltText("Cover of Atomic Habits").getAttribute("src")).toBe(GOOGLE);

    fireEvent.error(screen.getByAltText("Cover of Atomic Habits"));
    expect(screen.queryByRole("img")).toBeNull();
    // Placeholder shows title + author
    expect(screen.getByText("Atomic Habits")).toBeTruthy();
    expect(screen.getByText("James Clear")).toBeTruthy();
  });

  it("treats a decoded 1×1 image as missing and advances", () => {
    render(<CoverImage book={book} />);
    const img = screen.getByAltText("Cover of Atomic Habits") as HTMLImageElement;
    Object.defineProperty(img, "naturalWidth", { value: 1, configurable: true });
    Object.defineProperty(img, "naturalHeight", { value: 1, configurable: true });

    fireEvent.load(img);
    expect(screen.getByAltText("Cover of Atomic Habits").getAttribute("src")).toBe(OL_ISBN);
  });

  it("keeps a real image in place, whatever width the optimizer resized it to", () => {
    render(<CoverImage book={book} />);
    const img = screen.getByAltText("Cover of Atomic Habits") as HTMLImageElement;

    // happy-dom reports 0×0 — "unknown", must not count as a placeholder
    fireEvent.load(img);
    expect(screen.getByAltText("Cover of Atomic Habits").getAttribute("src")).toBe(OL_ID);

    // The "xs" preset asks /_next/image for a 48 px wide file: a small
    // intrinsic size is normal, not a sign of a blank cover.
    for (const [w, h] of [[48, 72], [300, 450]]) {
      Object.defineProperty(img, "naturalWidth", { value: w, configurable: true });
      Object.defineProperty(img, "naturalHeight", { value: h, configurable: true });
      fireEvent.load(img);
      expect(screen.getByAltText("Cover of Atomic Habits").getAttribute("src")).toBe(OL_ID);
    }
  });

  it("renders the placeholder straight away when the book has no cover data", () => {
    render(<CoverImage book={{ title: "No Cover", cover_url: null }} />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("No Cover")).toBeTruthy();
  });

  it("restarts the chain when the book changes", () => {
    const { rerender } = render(<CoverImage book={book} />);
    fireEvent.error(screen.getByAltText("Cover of Atomic Habits"));
    expect(screen.getByAltText("Cover of Atomic Habits").getAttribute("src")).toBe(OL_ISBN);

    rerender(
      <CoverImage book={{ ...book, title: "Deep Work", open_library_cover_id: 7, isbn: null }} />
    );
    expect(screen.getByAltText("Cover of Deep Work").getAttribute("src")).toBe(
      "https://covers.openlibrary.org/b/id/7-L.jpg?default=false"
    );
  });
});

describe("CoverImageMini", () => {
  it("renders the first candidate immediately and falls back on error", () => {
    render(<CoverImageMini book={{ title: "Mini", isbn: "1234567890", google_books_id: "g" }} />);
    const img = screen.getByAltText("Mini");
    expect(img.getAttribute("src")).toBe(
      "https://covers.openlibrary.org/b/isbn/1234567890-L.jpg?default=false"
    );
    fireEvent.error(img);
    expect(screen.getByAltText("Mini").getAttribute("src")).toContain("books.google.com");
    fireEvent.error(screen.getByAltText("Mini"));
    expect(screen.queryByAltText("Mini")).toBeNull();
  });
});
