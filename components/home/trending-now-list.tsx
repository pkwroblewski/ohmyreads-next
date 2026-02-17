"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Star, TrendingUp, Bookmark, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { CoverImage } from "@/components/books/cover-image";
import type { Book } from "@/types/database";

interface TrendingInsight {
  bookId: string;
  insight: string;
  keywords: string[];
}

interface TrendingNowListProps {
  books: Book[];
  title?: string;
  maxItems?: number;
  variant?: "sidebar" | "panel";
}

export function TrendingNowList({
  books,
  title = "Trending Now",
  maxItems = 7,
  variant = "panel",
}: TrendingNowListProps) {
  const displayBooks = books.slice(0, maxItems);
  const [insights, setInsights] = useState<Map<string, TrendingInsight>>(new Map());
  const [, setLoadingInsights] = useState(false);

  // Fetch AI insights on mount
  useEffect(() => {
    if (displayBooks.length === 0) return;

    const fetchInsights = async () => {
      setLoadingInsights(true);
      try {
        const response = await fetch("/api/ai/trending-insights");
        if (response.ok) {
          const data = await response.json();
          const insightsMap = new Map<string, TrendingInsight>();
          for (const insight of data.insights || []) {
            insightsMap.set(insight.bookId, insight);
          }
          setInsights(insightsMap);
        }
      } catch (error) {
        console.error("Failed to fetch trending insights:", error);
      } finally {
        setLoadingInsights(false);
      }
    };

    fetchInsights();
  }, [displayBooks.length]);

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
          href="/trending"
          className="text-xs text-primary hover:text-primary/80 transition-colors"
        >
          See all
        </Link>
      </div>

      {/* Book list */}
      <div className="flex-1 space-y-3">
        {displayBooks.map((book, index) => (
          <TrendingBookItem
            key={book.id}
            book={book}
            rank={index + 1}
            compact={variant === "panel"}
            insight={insights.get(book.id)}
          />
        ))}
      </div>

      {/* Community Badge */}
      {insights.size > 0 && (
        <div className="mt-3 pt-2 border-t border-border/50">
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <MessageCircle className="w-3 h-3" />
            What readers are saying
          </p>
        </div>
      )}
    </div>
  );
}

function TrendingBookItem({
  book,
  rank,
  insight,
}: {
  book: Book;
  rank: number;
  compact?: boolean;
  insight?: TrendingInsight;
}) {
  return (
    <div
      className={cn(
        "group flex gap-3 p-2 -mx-2 rounded-lg",
        "transition-all duration-200",
        "hover:bg-muted/50"
      )}
    >
      {/* Rank badge */}
      <div
        className={cn(
          "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold",
          rank <= 3
            ? "bg-gradient-to-br from-accent to-primary text-white"
            : "bg-muted text-muted-foreground"
        )}
      >
        {rank}
      </div>

      {/* Book cover */}
      <Link href={`/books/${book.slug}`} className="flex-shrink-0 group">
        <CoverImage
          book={book}
          width={48}
          height={72}
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
          <p className="text-sm font-medium leading-tight line-clamp-2 group-hover:text-primary transition-colors">
            {book.title}
          </p>
        </Link>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {book.author}
        </p>

        {/* AI Insight or Rating */}
        {insight ? (
          <p className="text-xs text-primary/80 line-clamp-1 mt-1 italic">
            {insight.insight}
          </p>
        ) : book.average_rating !== null ? (
          <div className="flex items-center gap-1 mt-1">
            <Star className="w-3 h-3 fill-accent text-accent" />
            <span className="text-xs font-medium">
              {book.average_rating.toFixed(1)}
            </span>
          </div>
        ) : null}
      </div>

      {/* Compact action */}
      <button
        className={cn(
          "flex-shrink-0 self-center",
          "p-2 rounded-md",
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
