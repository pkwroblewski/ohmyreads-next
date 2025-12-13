"use client";

import Image from "next/image";
import Link from "next/link";
import { BookOpen, Sparkles, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { RecommendationReason } from "./recommendation-reason";
import type { RecommendedBook } from "@/lib/queries/recommendations";

interface RecommendedBooksRowProps {
  books: RecommendedBook[];
  title?: string;
  viewAllHref?: string;
  className?: string;
}

export function RecommendedBooksRow({
  books,
  title = "Recommended for You",
  viewAllHref,
  className,
}: RecommendedBooksRowProps) {
  if (books.length === 0) {
    return null;
  }

  return (
    <section className={cn("mb-8", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-accent" />
          <h2 className="text-xl font-semibold font-serif">{title}</h2>
        </div>
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
          >
            See all
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>

      {/* Horizontal Scroll Container */}
      <div className="relative -mx-6 px-6 sm:-mx-10 sm:px-10 lg:-mx-16 lg:px-16">
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory">
          {books.map((book) => (
            <RecommendedBookCard key={book.id} book={book} />
          ))}
        </div>
      </div>
    </section>
  );
}

function RecommendedBookCard({ book }: { book: RecommendedBook }) {
  return (
    <Link
      href={`/books/${book.slug}`}
      className={cn(
        "flex-shrink-0 w-[140px] sm:w-[160px] snap-start group"
      )}
    >
      {/* Book Cover */}
      <div
        className={cn(
          "relative aspect-[2/3] rounded-lg overflow-hidden mb-2",
          "bg-muted shadow-md",
          "group-hover:shadow-lg group-hover:scale-[1.02]",
          "transition-all duration-200"
        )}
      >
        {book.cover_url ? (
          <Image
            src={book.cover_url}
            alt={book.title}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 140px, 160px"
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full">
            <BookOpen className="w-8 h-8 text-muted-foreground" />
          </div>
        )}

        {/* Rating Badge */}
        {book.average_rating && (
          <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/70 text-white text-xs font-medium">
            ★ {book.average_rating.toFixed(1)}
          </div>
        )}
      </div>

      {/* Book Info */}
      <div className="space-y-1">
        <h3 className="font-medium text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">
          {book.title}
        </h3>
        <p className="text-xs text-muted-foreground truncate">{book.author}</p>

        {/* Recommendation Reason */}
        <RecommendationReason
          type={book.reason.type}
          label={book.reason.label}
          size="sm"
        />
      </div>
    </Link>
  );
}

