"use client";

import Image from "next/image";
import Link from "next/link";
import { Star, BookOpen, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { AddToShelfButton } from "@/components/books/add-to-shelf-button";
import type { Book } from "@/types/database";

interface TrendingNowListProps {
  books: Book[];
  title?: string;
  maxItems?: number;
}

// Placeholder blur data URL
const BLUR_DATA_URL =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iIzMzMyIvPjwvc3ZnPg==";

/**
 * Upgrade OpenLibrary cover URLs to -L for higher resolution
 */
function getHighResCoverUrl(url: string | null): string | null {
  if (!url) return null;
  if (url.includes("covers.openlibrary.org")) {
    return url.replace(/-[SM]\.jpg$/i, "-L.jpg");
  }
  return url;
}

export function TrendingNowList({
  books,
  title = "Trending Now",
  maxItems = 5,
}: TrendingNowListProps) {
  const displayBooks = books.slice(0, maxItems);

  if (displayBooks.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-accent" />
        <h3 className="text-lg font-semibold font-serif">{title}</h3>
      </div>

      {/* Book list */}
      <div className="space-y-3">
        {displayBooks.map((book, index) => (
          <TrendingBookItem key={book.id} book={book} rank={index + 1} />
        ))}
      </div>

      {/* View all link */}
      <Link
        href="/books?sort=trending"
        className="block text-sm text-primary hover:text-primary/80 transition-colors text-center pt-2"
      >
        View all trending books →
      </Link>
    </div>
  );
}

function TrendingBookItem({ book, rank }: { book: Book; rank: number }) {
  const coverUrl = getHighResCoverUrl(book.cover_url);

  return (
    <div
      className={cn(
        "group flex gap-3 p-2 -mx-2 rounded-lg",
        "transition-all duration-200",
        "hover:bg-muted/50"
      )}
    >
      {/* Rank number */}
      <div className="flex-shrink-0 w-6 flex items-center justify-center">
        <span
          className={cn(
            "text-lg font-bold",
            rank <= 3 ? "text-accent" : "text-muted-foreground"
          )}
        >
          {rank}
        </span>
      </div>

      {/* Book cover */}
      <Link href={`/books/${book.slug}`} className="flex-shrink-0">
        <div
          className={cn(
            "relative w-12 h-[72px] rounded overflow-hidden",
            "bg-muted shadow-sm",
            "transition-transform duration-200",
            "group-hover:scale-105"
          )}
        >
          {coverUrl ? (
            <Image
              src={coverUrl}
              alt={book.title}
              fill
              quality={75}
              placeholder="blur"
              blurDataURL={BLUR_DATA_URL}
              className="object-cover"
              sizes="48px"
            />
          ) : (
            <div className="flex items-center justify-center w-full h-full">
              <BookOpen className="w-5 h-5 text-muted-foreground" />
            </div>
          )}
        </div>
      </Link>

      {/* Book info */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <Link href={`/books/${book.slug}`}>
          <h4 className="font-medium text-sm leading-tight line-clamp-1 group-hover:text-primary transition-colors">
            {book.title}
          </h4>
        </Link>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {book.author}
        </p>
        {book.average_rating !== null && (
          <div className="flex items-center gap-1 mt-1">
            <Star className="w-3 h-3 fill-accent text-accent" />
            <span className="text-xs font-medium">
              {book.average_rating.toFixed(1)}
            </span>
          </div>
        )}
      </div>

      {/* Add to shelf button (compact) */}
      <div className="flex-shrink-0 flex items-center">
        <AddToShelfButton bookId={book.id} />
      </div>
    </div>
  );
}

