import type { ShelfBook } from "@/components/shelf/shelf";

/**
 * The books a visitor picks on the homepage before signing up. They wait in
 * this browser's localStorage until the visitor signs in, when
 * `StarterPicksClaim` puts them on the new shelf. Storage can be missing or
 * blocked (private windows), so every access is guarded; without it the
 * picks last as long as the page.
 */
export const STARTER_PICKS_KEY = "ohmyreads:starter-picks";
export const MAX_STARTER_PICKS = 3;

const EMPTY = "[]";
const listeners = new Set<() => void>();
let fallback = EMPTY;

/** The stored picks as raw JSON; a string, so it is a stable snapshot. */
export function starterPicksSnapshot(): string {
  try {
    return localStorage.getItem(STARTER_PICKS_KEY) ?? EMPTY;
  } catch {
    return fallback;
  }
}

export function subscribeStarterPicks(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function parseStarterPicks(raw: string): ShelfBook[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (b): b is ShelfBook =>
          !!b && typeof b.id === "string" && typeof b.slug === "string" && typeof b.title === "string"
      )
      .slice(0, MAX_STARTER_PICKS);
  } catch {
    return [];
  }
}

export function readStarterPicks(): ShelfBook[] {
  return parseStarterPicks(starterPicksSnapshot());
}

export function writeStarterPicks(books: ShelfBook[]): void {
  fallback = books.length ? JSON.stringify(books) : EMPTY;
  try {
    if (books.length) localStorage.setItem(STARTER_PICKS_KEY, fallback);
    else localStorage.removeItem(STARTER_PICKS_KEY);
  } catch {
    // Storage blocked: `fallback` keeps them for this page.
  }
  listeners.forEach((listener) => listener());
}
