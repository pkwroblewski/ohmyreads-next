"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { TrendingBookCard } from "./trending-book-card";
import type { TrendingBook } from "@/lib/queries/recommendations";

const TIME_PERIODS = [
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "all", label: "All Time" },
];

const GENRES = [
  "All Genres",
  "Fiction",
  "Fantasy",
  "Science Fiction",
  "Romance",
  "Mystery",
  "Thriller",
  "Horror",
  "Literary Fiction",
  "Historical Fiction",
  "Contemporary",
  "Young Adult",
  "Memoir",
  "Self-Help",
  "Biography",
];

interface TrendingGridProps {
  initialBooks: TrendingBook[];
  initialPeriod: string;
  initialGenre?: string;
}

export function TrendingGrid({
  initialBooks,
  initialPeriod,
  initialGenre,
}: TrendingGridProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [period, setPeriod] = useState(initialPeriod);
  const [genre, setGenre] = useState(initialGenre || "");

  const updateFilters = (newPeriod: string, newGenre: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (newPeriod && newPeriod !== "week") {
      params.set("period", newPeriod);
    } else {
      params.delete("period");
    }

    if (newGenre && newGenre !== "All Genres") {
      params.set("genre", newGenre);
    } else {
      params.delete("genre");
    }

    startTransition(() => {
      router.push(`/trending${params.toString() ? `?${params.toString()}` : ""}`);
    });
  };

  const handlePeriodChange = (newPeriod: string) => {
    setPeriod(newPeriod);
    updateFilters(newPeriod, genre);
  };

  const handleGenreChange = (newGenre: string) => {
    const normalizedGenre = newGenre === "All Genres" ? "" : newGenre;
    setGenre(normalizedGenre);
    updateFilters(period, normalizedGenre);
  };

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-8">
        {/* Time Period Tabs */}
        <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
          {TIME_PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => handlePeriodChange(p.value)}
              disabled={isPending}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-md transition-all",
                period === p.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Genre Dropdown */}
        <select
          value={genre || "All Genres"}
          onChange={(e) => handleGenreChange(e.target.value)}
          disabled={isPending}
          className={cn(
            "px-4 py-2 text-sm font-medium rounded-lg",
            "bg-muted border-none",
            "focus:outline-none focus:ring-2 focus:ring-primary/50",
            "cursor-pointer"
          )}
        >
          {GENRES.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>

        {/* Loading indicator */}
        {isPending && (
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Results */}
      {initialBooks.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground">
            No trending books found for this period.
            {genre && " Try a different genre or time period."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {initialBooks.map((book) => (
            <TrendingBookCard key={book.id} book={book} />
          ))}
        </div>
      )}
    </div>
  );
}
