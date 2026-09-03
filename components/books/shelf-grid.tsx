"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShelfBookCard } from "@/components/books/shelf-book-card";
import type { BookSummary, UserBook } from "@/types/database";

export interface ShelfGridItem extends UserBook {
  book: BookSummary | null;
}

interface ShelfGridProps {
  /** The first page, rendered on the server. */
  initialBooks: ShelfGridItem[];
  /** Exact row count for this filter, so the button knows when to stop. */
  total: number;
  status?: string;
  shelfId?: string;
  pageSize: number;
}

/**
 * The bookshelf grid plus a "Load more" button. The server renders the first
 * page; later pages come from `/api/shelf/books`, offset by what is already
 * shown, so a 3,000-book Goodreads import no longer means a 3,000-row query
 * (capped at 1,000 by PostgREST) on every visit.
 */
export function ShelfGrid({ initialBooks, total, status, shelfId, pageSize }: ShelfGridProps) {
  const [books, setBooks] = useState(initialBooks);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasMore = books.length < total;

  const loadMore = () => {
    startTransition(async () => {
      setError(null);
      const params = new URLSearchParams({ offset: String(books.length), limit: String(pageSize) });
      if (shelfId) params.set("shelf", shelfId);
      else if (status && status !== "all") params.set("status", status);

      try {
        const response = await fetch(`/api/shelf/books?${params.toString()}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = (await response.json()) as { books: ShelfGridItem[] };
        setBooks((current) => {
          const seen = new Set(current.map((b) => b.id));
          return [...current, ...data.books.filter((b) => !seen.has(b.id))];
        });
      } catch {
        setError("Could not load more books. Please try again.");
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
        {books.map((userBook) => (
          <ShelfBookCard key={userBook.id} userBook={userBook} book={userBook.book} />
        ))}
      </div>

      {(hasMore || error) && (
        <div className="flex flex-col items-center gap-2">
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {hasMore && (
            <Button variant="outline" onClick={loadMore} disabled={isPending}>
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />}
              Load more
              <span className="ml-2 text-muted-foreground">
                ({books.length} of {total})
              </span>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
