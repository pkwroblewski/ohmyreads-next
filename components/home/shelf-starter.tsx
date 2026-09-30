"use client";

import { useEffect, useId, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowRight, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shelf, type ShelfBook } from "@/components/shelf/shelf";
import type {
  InstantSearchResponse,
  InstantSearchResult,
} from "@/app/api/books/instant-search/route";
import {
  MAX_STARTER_PICKS,
  parseStarterPicks,
  starterPicksSnapshot,
  subscribeStarterPicks,
  writeStarterPicks,
} from "@/lib/starter-picks";

const toShelfBook = (b: InstantSearchResult): ShelfBook => ({
  id: b.id,
  slug: b.slug,
  title: b.title,
  author: b.author,
  pageCount: b.pageCount,
  genre: b.genre,
  spineColor: b.spineColor,
  spineInk: b.spineInk,
});

/**
 * Homepage, signed out: a visitor names up to three books they loved and
 * sees them on a shelf before signing up. The picks stay in this browser
 * (`lib/starter-picks.ts`) and go on the real shelf at first sign-in.
 */
export function ShelfStarter() {
  const inputId = useId();
  const raw = useSyncExternalStore(subscribeStarterPicks, starterPicksSnapshot, () => "[]");
  const picks = useMemo(() => parseStarterPicks(raw), [raw]);
  const full = picks.length >= MAX_STARTER_PICKS;

  const [query, setQuery] = useState("");
  const q = query.trim();
  // Results remember the query they answer, so stale ones never show.
  const [found, setFound] = useState<{ q: string; books: InstantSearchResult[] }>({ q: "", books: [] });
  const results = found.q === q ? found.books.filter((b) => !picks.some((p) => p.id === b.id)) : [];

  useEffect(() => {
    if (q.length < 2 || full) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/books/instant-search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then((res) => (res.ok ? (res.json() as Promise<InstantSearchResponse>) : null))
        .then((data) => setFound({ q, books: data?.books ?? [] }))
        .catch(() => {
          // Aborted or offline: keep whatever is showing.
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, full]);

  const add = (book: InstantSearchResult) => {
    writeStarterPicks([...picks, toShelfBook(book)].slice(0, MAX_STARTER_PICKS));
    setQuery("");
  };
  const remove = (id: string) => writeStarterPicks(picks.filter((p) => p.id !== id));

  return (
    <div className="rounded-md border border-border bg-card p-4 sm:p-5">
      <label htmlFor={inputId} className="block font-serif text-lg font-semibold mb-1">
        Three books you loved
      </label>
      <p className="text-sm text-muted-foreground mb-3">
        Watch your shelf start. Sign up to keep it.
      </p>

      {!full && (
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            id={inputId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Title or author"
            autoComplete="off"
            className="pl-9"
          />
        </div>
      )}

      {results.length > 0 && (
        <ul className="mb-3 divide-y divide-border rounded-md border border-border" aria-label="Search results">
          {results.map((book) => (
            <li key={book.id}>
              <button
                type="button"
                onClick={() => add(book)}
                className="w-full px-3 py-2 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
              >
                <span className="block text-sm font-medium leading-snug">{book.title}</span>
                <span className="block text-xs text-muted-foreground">{book.author}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {found.q === q && q.length >= 2 && !full && results.length === 0 && (
        <p className="mb-3 text-sm text-muted-foreground" role="status">
          No books match &ldquo;{q}&rdquo; yet.
        </p>
      )}

      <Shelf books={picks} label="Your starter shelf" bookend={!full} leanLast listView={false} />

      {picks.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Your picks">
          {picks.map((book) => (
            <li key={book.id}>
              <button
                type="button"
                onClick={() => remove(book.id)}
                className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs hover:border-foreground/40"
                aria-label={`Remove ${book.title}`}
              >
                <span className="max-w-[12rem] truncate">{book.title}</span>
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs tabular-nums text-muted-foreground" aria-live="polite">
          {picks.length} of {MAX_STARTER_PICKS}
        </p>
        {picks.length > 0 && (
          <Link href="/signup">
            <Button>
              Keep your shelf
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}
