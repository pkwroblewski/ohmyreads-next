"use client";

import { useMemo, useState, type SyntheticEvent } from "react";
import { getCoverUrlsWithFallbacks, type BookCoverData } from "@/lib/utils/covers";

/**
 * Picks the cover URL to render for a book and walks the fallback chain
 * when the browser reports the current one as broken.
 *
 * The first candidate is chosen during render, so the server HTML already
 * contains a real `<img>` (LCP preload works, crawlers see the cover) and the
 * browser never fetches the cover from Open Library directly — every
 * candidate goes through `/_next/image`. A missing cover surfaces as an
 * `error` event on that `<img>` (Open Library 404s thanks to `?default=false`;
 * the optimizer relays the failure), which moves to the next candidate.
 * `onLoad` additionally rejects tiny images (1×1 tracking-pixel style
 * placeholders). When the chain is exhausted `src` is `null` and the caller
 * shows its placeholder.
 */
export function useCoverSrc(book: BookCoverData) {
  // Keyed on the primitive fields so `urls` keeps its identity across parent
  // re-renders; a new identity is what resets the fallback position below.
  const urls = useMemo(
    () => getCoverUrlsWithFallbacks(book),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [book.open_library_cover_id, book.isbn, book.cover_url, book.google_books_id]
  );

  // Derived-state pattern: store the position together with the list it
  // belongs to, and start over whenever the list changes.
  const [position, setPosition] = useState<{ urls: string[]; index: number }>({
    urls,
    index: 0,
  });
  const index = position.urls === urls ? position.index : 0;
  const src = urls[index] ?? null;

  const advance = () => setPosition({ urls, index: index + 1 });

  const onError = () => advance();

  const onLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = event.currentTarget;
    // What loads is the optimizer's output, resized to the requested width
    // (a 40 px "xs" cover really is ~48 px wide), so the intrinsic size says
    // nothing about the source — except that the optimizer never upscales,
    // so a 1×1 blank (a stored Open Library URL without `?default=false`)
    // stays 1×1. 0 means "unknown" (not decoded, or a test DOM).
    if (naturalWidth > 0 && naturalWidth <= 1 && naturalHeight <= 1) {
      advance();
    }
  };

  return { src, onError, onLoad };
}
