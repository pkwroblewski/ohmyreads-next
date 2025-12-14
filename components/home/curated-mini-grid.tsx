"use client";

import Image from "next/image";
import Link from "next/link";
import { BookOpen, Sparkles, Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { AddToShelfButton } from "@/components/books/add-to-shelf-button";
import type { Book } from "@/types/database";

interface CuratedMiniGridProps {
  books: Book[];
  title?: string;
  isLoggedIn?: boolean;
}

// Placeholder blur
const BLUR_DATA_URL =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iOTAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iIzMzMyIvPjwvc3ZnPg==";

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

export function CuratedMiniGrid({
  books,
  title = "Personalized Recommendations",
  isLoggedIn,
}: CuratedMiniGridProps) {
  // Only show first 4 books
  const displayBooks = books.slice(0, 4);

  if (displayBooks.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <h3 className="text-lg font-semibold font-serif mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-accent" />
          {title}
        </h3>
        <div className="flex-1 flex items-center justify-center text-center">
          <div>
            <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No recommendations yet
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold font-serif flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-accent" />
          {title}
        </h3>
        <Link
          href="/books"
          className="text-xs text-primary hover:text-primary/80 transition-colors"
        >
          See more
        </Link>
      </div>

      {/* 2x2 grid */}
      <div className="flex-1 grid grid-cols-2 gap-3">
        {displayBooks.map((book) => (
          <MiniBookCard key={book.id} book={book} />
        ))}
      </div>
    </div>
  );
}

function MiniBookCard({ book }: { book: Book }) {
  const coverUrl = getHighResCoverUrl(book.cover_url);

  return (
    <div className="group flex flex-col">
      {/* Cover */}
      <Link href={`/books/${book.slug}`}>
        <div
          className={cn(
            "relative w-full rounded-lg overflow-hidden mb-2",
            "bg-muted shadow-sm",
            "transition-all duration-200",
            "group-hover:shadow-md group-hover:scale-[1.02]"
          )}
          style={{ aspectRatio: "2/3" }}
        >
          {coverUrl ? (
            <Image
              src={coverUrl}
              alt={book.title}
              fill
              quality={80}
              placeholder="blur"
              blurDataURL={BLUR_DATA_URL}
              className="object-cover"
              sizes="(max-width: 640px) 100px, 120px"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-muted-foreground" />
            </div>
          )}

          {/* Rating badge */}
          {book.average_rating !== null && (
            <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded bg-background/90 text-xs font-medium">
              ★ {book.average_rating.toFixed(1)}
            </div>
          )}
        </div>
      </Link>

      {/* Info */}
      <Link href={`/books/${book.slug}`}>
        <p className="text-xs font-medium line-clamp-1 group-hover:text-primary transition-colors">
          {book.title}
        </p>
        <p className="text-[10px] text-muted-foreground truncate">
          {book.author}
        </p>
      </Link>

      {/* Compact action */}
      <button
        className={cn(
          "mt-1.5 flex items-center justify-center gap-1 w-full",
          "text-[10px] font-medium py-1 px-2 rounded",
          "bg-primary/10 text-primary hover:bg-primary/20",
          "transition-colors"
        )}
      >
        <Bookmark className="w-3 h-3" />
        Want to Read
      </button>
    </div>
  );
}

