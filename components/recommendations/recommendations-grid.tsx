"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, UserPlus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { RecommendedBookCard } from "./recommended-book-card";
import type { RecommendedBook } from "@/lib/queries/recommendations";

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

interface RecommendationsGridProps {
  initialBooks: RecommendedBook[];
  initialGenre?: string;
  isPersonalized: boolean;
  isLoggedIn: boolean;
}

export function RecommendationsGrid({
  initialBooks,
  initialGenre,
  isPersonalized,
  isLoggedIn,
}: RecommendationsGridProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [genre, setGenre] = useState(initialGenre || "");

  const handleGenreChange = (newGenre: string) => {
    const normalizedGenre = newGenre === "All Genres" ? "" : newGenre;
    setGenre(normalizedGenre);

    const params = new URLSearchParams(searchParams.toString());

    if (normalizedGenre) {
      params.set("genre", normalizedGenre);
    } else {
      params.delete("genre");
    }

    startTransition(() => {
      router.push(
        `/recommendations${params.toString() ? `?${params.toString()}` : ""}`
      );
    });
  };

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-8">
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

        {/* Personalization CTA */}
        {!isPersonalized && isLoggedIn && (
          <Link href="/onboarding/taste">
            <Button variant="outline" size="sm" className="gap-2">
              <Sparkles className="w-4 h-4" />
              Set up taste profile
            </Button>
          </Link>
        )}

        {!isLoggedIn && (
          <Link href="/signup">
            <Button variant="outline" size="sm" className="gap-2">
              <UserPlus className="w-4 h-4" />
              Sign up for personalized picks
            </Button>
          </Link>
        )}
      </div>

      {/* Results */}
      {initialBooks.length === 0 ? (
        <div className="text-center py-16">
          <Sparkles className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-lg">
            No recommendations found for this genre.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Try selecting a different genre or explore all recommendations.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {initialBooks.map((book) => (
            <RecommendedBookCard key={book.id} book={book} />
          ))}
        </div>
      )}
    </div>
  );
}
