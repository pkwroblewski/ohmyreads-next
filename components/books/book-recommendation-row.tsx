import Link from "next/link";
import Image from "next/image";
import { BookOpen, Star, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Book } from "@/types/database";

interface BookRecommendationRowProps {
  title: string;
  subtitle?: string;
  books: Book[];
  viewAllHref?: string;
}

export function BookRecommendationRow({
  title,
  subtitle,
  books,
  viewAllHref,
}: BookRecommendationRowProps) {
  if (books.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-end justify-between px-4 sm:px-6 lg:px-8">
        <div>
          <h2 className="text-2xl font-bold font-serif">{title}</h2>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className={cn(
              "flex items-center gap-1 text-sm font-medium",
              "text-primary hover:text-primary/80 transition-colors",
              "group"
            )}
          >
            View All
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}
      </div>

      {/* Scrollable Book Row */}
      <div className="relative">
        <div
          className={cn(
            "flex gap-4 overflow-x-auto scroll-smooth",
            "px-4 sm:px-6 lg:px-8",
            "pb-4", // Space for shadow
            "snap-x snap-mandatory",
            "scrollbar-hide"
          )}
        >
          {books.map((book) => (
            <Link
              key={book.id}
              href={`/books/${book.slug}`}
              className={cn(
                "flex-shrink-0 snap-start",
                "w-28 sm:w-36 md:w-40",
                "group"
              )}
            >
              {/* Book Cover */}
              <div
                className={cn(
                  "relative w-full rounded-lg overflow-hidden",
                  "bg-gradient-to-br from-muted to-muted-foreground/20",
                  "transition-all duration-300",
                  // Light mode
                  "shadow-md group-hover:shadow-xl group-hover:shadow-primary/10",
                  // Dark mode
                  "dark:shadow-none dark:group-hover:shadow-[0_0_30px_rgba(139,92,246,0.15)]",
                  // Scale on hover
                  "group-hover:scale-[1.02]"
                )}
                style={{ aspectRatio: "2/3" }}
              >
                {book.cover_url ? (
                  <Image
                    src={book.cover_url}
                    alt={book.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 112px, (max-width: 768px) 144px, 160px"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center p-2">
                    <BookOpen className="w-8 h-8 text-muted-foreground/50" />
                  </div>
                )}
              </div>

              {/* Book Info */}
              <div className="mt-2 space-y-0.5">
                <h3 className="text-sm font-medium line-clamp-2 leading-tight group-hover:text-primary transition-colors">
                  {book.title}
                </h3>
                <p className="text-xs text-muted-foreground truncate">
                  {book.author}
                </p>
                {book.average_rating !== null && (
                  <div className="flex items-center gap-1 text-xs text-accent">
                    <Star className="w-3 h-3 fill-current" />
                    <span>{book.average_rating.toFixed(1)}</span>
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

