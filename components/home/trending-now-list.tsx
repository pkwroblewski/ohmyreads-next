"use client";

import Link from "next/link";
import { Star, TrendingUp, Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { CoverImage } from "@/components/books/cover-image";
import type { Book } from "@/types/database";

interface TrendingNowListProps {
  books: Book[];
  title?: string;
  maxItems?: number;
  variant?: "sidebar" | "panel";
}

export function TrendingNowList({
  books,
  title = "Trending Now",
  maxItems = 5,
  variant = "panel",
}: TrendingNowListProps) {
  const displayBooks = books.slice(0, maxItems);

  if (displayBooks.length === 0) {
    return null;
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold font-serif flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-accent" />
          {title}
        </h3>
        <Link
          href="/books?sort=trending"
          className="text-xs text-primary hover:text-primary/80 transition-colors"
        >
          See all
        </Link>
      </div>

      {/* Book list */}
      <div className="flex-1 space-y-2">
        {displayBooks.map((book, index) => (
          <TrendingBookItem
            key={book.id}
            book={book}
            rank={index + 1}
            compact={variant === "panel"}
          />
        ))}
      </div>
    </div>
  );
}

function TrendingBookItem({
  book,
  rank,
  compact,
}: {
  book: Book;
  rank: number;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "group flex gap-2 p-1.5 -mx-1.5 rounded-lg",
        "transition-all duration-200",
        "hover:bg-muted/50"
      )}
    >
      {/* Rank number */}
      <div className="flex-shrink-0 w-5 flex items-start justify-center pt-1">
        <span
          className={cn(
            "text-sm font-bold",
            rank <= 3 ? "text-accent" : "text-muted-foreground"
          )}
        >
          {rank}
        </span>
      </div>

      {/* Book cover */}
      <Link href={`/books/${book.slug}`} className="flex-shrink-0 group">
        <CoverImage
          book={book}
          width={compact ? 32 : 40}
          height={compact ? 48 : 60}
          hover={true}
          className={cn(
            "transition-transform duration-200",
            "group-hover:scale-105"
          )}
        />
      </Link>

      {/* Book info */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <Link href={`/books/${book.slug}`}>
          <p className="text-xs font-medium leading-tight line-clamp-1 group-hover:text-primary transition-colors">
            {book.title}
          </p>
        </Link>
        <p className="text-[10px] text-muted-foreground truncate">
          {book.author}
        </p>
        {book.average_rating !== null && (
          <div className="flex items-center gap-0.5 mt-0.5">
            <Star className="w-2.5 h-2.5 fill-accent text-accent" />
            <span className="text-[10px] font-medium">
              {book.average_rating.toFixed(1)}
            </span>
          </div>
        )}
      </div>

      {/* Compact action */}
      <button
        className={cn(
          "flex-shrink-0 self-center",
          "p-1.5 rounded-md",
          "text-muted-foreground hover:text-primary hover:bg-primary/10",
          "transition-colors"
        )}
        title="Add to shelf"
      >
        <Bookmark className="w-4 h-4" />
      </button>
    </div>
  );
}
