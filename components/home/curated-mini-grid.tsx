"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { BookOpen, Sparkles, Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { CoverImage } from "@/components/books/cover-image";
import type { Book } from "@/types/database";

interface CuratedPick {
  bookId: string;
  reason: string;
  matchType: "mood" | "theme" | "author" | "genre" | "vibe";
}

interface CuratedMiniGridProps {
  books: Book[];
  title?: string;
  isLoggedIn?: boolean;
}

export function CuratedMiniGrid({
  books,
  title = "Personalized Recommendations",
  isLoggedIn,
}: CuratedMiniGridProps) {
  // Only show first 4 books
  const displayBooks = books.slice(0, 4);
  const [picks, setPicks] = useState<Map<string, CuratedPick>>(new Map());

  // Fetch AI-generated reasons on mount
  useEffect(() => {
    if (displayBooks.length === 0) return;

    const fetchPicks = async () => {
      try {
        const response = await fetch("/api/ai/curated-picks");
        if (response.ok) {
          const data = await response.json();
          const picksMap = new Map<string, CuratedPick>();
          for (const pick of data.picks || []) {
            picksMap.set(pick.bookId, pick);
          }
          setPicks(picksMap);
        }
      } catch (error) {
        console.error("Failed to fetch curated picks:", error);
      }
    };

    fetchPicks();
  }, [displayBooks.length]);

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
          href="/recommendations"
          className="text-xs text-primary hover:text-primary/80 transition-colors"
        >
          See more
        </Link>
      </div>

      {/* 2x2 grid */}
      <div className="flex-1 grid grid-cols-2 gap-4">
        {displayBooks.map((book) => (
          <MiniBookCard key={book.id} book={book} pick={picks.get(book.id)} />
        ))}
      </div>

      {/* AI Badge */}
      {picks.size > 0 && (
        <div className="mt-3 pt-2 border-t border-border/50">
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            AI-personalized picks
          </p>
        </div>
      )}
    </div>
  );
}

function MiniBookCard({ book, pick }: { book: Book; pick?: CuratedPick }) {
  return (
    <div className="group flex flex-col">
      {/* Cover */}
      <Link href={`/books/${book.slug}`} className="relative">
        <div
          className={cn(
            "relative w-full mb-2",
            "transition-all duration-200",
            "group-hover:scale-[1.02]"
          )}
          style={{ aspectRatio: "2/3" }}
        >
          <CoverImage
            book={book}
            className="absolute inset-0 w-full h-full shadow-sm group-hover:shadow-md"
            hover={false}
          />

          {/* Rating badge */}
          {book.average_rating !== null && (
            <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded bg-background/90 text-xs font-medium z-10">
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

      {/* AI-generated reason */}
      {pick && (
        <p className="text-[10px] text-primary/80 line-clamp-2 mt-1 italic">
          {pick.reason}
        </p>
      )}

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

