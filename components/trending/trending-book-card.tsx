import Link from "next/link";
import { Star, Bookmark, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { CoverImage } from "@/components/books/cover-image";
import { AddToShelfButton } from "@/components/books/add-to-shelf-button";
import type { TrendingBook } from "@/lib/queries/recommendations";

interface TrendingBookCardProps {
  book: TrendingBook;
}

export function TrendingBookCard({ book }: TrendingBookCardProps) {
  const isTopThree = book.rank <= 3;

  return (
    <div
      className={cn(
        "group relative flex flex-col bg-card rounded-xl border transition-all duration-200",
        "hover:shadow-lg hover:border-primary/30",
        isTopThree && "ring-2 ring-accent/30"
      )}
    >
      {/* Rank Badge */}
      <div
        className={cn(
          "absolute -top-3 -left-3 z-10",
          "w-10 h-10 rounded-full flex items-center justify-center",
          "text-lg font-bold shadow-lg",
          book.rank === 1
            ? "bg-gradient-to-br from-yellow-400 to-amber-500 text-white"
            : book.rank === 2
            ? "bg-gradient-to-br from-slate-300 to-slate-400 text-slate-800"
            : book.rank === 3
            ? "bg-gradient-to-br from-amber-600 to-amber-700 text-white"
            : "bg-muted text-muted-foreground text-base"
        )}
      >
        {book.rank}
      </div>

      {/* Card Content */}
      <div className="p-5">
        {/* Cover and Info */}
        <div className="flex gap-4">
          {/* Cover */}
          <Link
            href={`/books/${book.slug}`}
            className="flex-shrink-0 transition-transform duration-200 group-hover:scale-[1.02]"
          >
            <CoverImage book={book} width={100} height={150} hover={false} />
          </Link>

          {/* Info */}
          <div className="flex-1 min-w-0 flex flex-col">
            <Link href={`/books/${book.slug}`}>
              <h3 className="font-semibold text-base leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                {book.title}
              </h3>
            </Link>
            <p className="text-sm text-muted-foreground mt-1">
              {book.author}
            </p>

            {/* Rating */}
            {book.average_rating && (
              <div className="flex items-center gap-1 mt-2">
                <Star className="w-4 h-4 fill-accent text-accent" />
                <span className="font-medium text-sm">
                  {book.average_rating.toFixed(1)}
                </span>
                {book.ratings_count && (
                  <span className="text-xs text-muted-foreground">
                    ({book.ratings_count.toLocaleString()})
                  </span>
                )}
              </div>
            )}

            {/* Genres */}
            {book.genres && book.genres.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {book.genres.slice(0, 2).map((genre) => (
                  <span
                    key={genre}
                    className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                  >
                    {genre}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Trending Metrics */}
        <div className="mt-4 pt-4 border-t border-border/50">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-sm">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <span className="font-medium text-green-600 dark:text-green-400">
                +{book.metrics.recentReviews}
              </span>
              <span className="text-muted-foreground">reviews</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <Bookmark className="w-4 h-4 text-blue-500" />
              <span className="font-medium text-blue-600 dark:text-blue-400">
                +{book.metrics.recentAdds}
              </span>
              <span className="text-muted-foreground">adds</span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="mt-4">
          <AddToShelfButton bookId={book.id} />
        </div>
      </div>
    </div>
  );
}
