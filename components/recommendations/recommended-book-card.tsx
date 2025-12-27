import Link from "next/link";
import { Star, Sparkles, Heart, BookMarked, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { CoverImage } from "@/components/books/cover-image";
import { AddToShelfButton } from "@/components/books/add-to-shelf-button";
import type { RecommendedBook } from "@/lib/queries/recommendations";

interface RecommendedBookCardProps {
  book: RecommendedBook;
}

const REASON_ICONS = {
  genre_match: Sparkles,
  vibe_match: Heart,
  similar_to_loved: BookMarked,
  popular_in_genre: TrendingUp,
  highly_rated: Star,
  trending: TrendingUp,
};

const REASON_COLORS = {
  genre_match: "text-primary bg-primary/10",
  vibe_match: "text-pink-500 bg-pink-500/10",
  similar_to_loved: "text-amber-500 bg-amber-500/10",
  popular_in_genre: "text-blue-500 bg-blue-500/10",
  highly_rated: "text-yellow-500 bg-yellow-500/10",
  trending: "text-orange-500 bg-orange-500/10",
};

export function RecommendedBookCard({ book }: RecommendedBookCardProps) {
  const ReasonIcon = REASON_ICONS[book.reason.type] || Sparkles;
  const reasonColorClass = REASON_COLORS[book.reason.type] || "text-primary bg-primary/10";

  return (
    <div
      className={cn(
        "group relative flex flex-col bg-card rounded-xl border transition-all duration-200",
        "hover:shadow-lg hover:border-primary/30"
      )}
    >
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
            <p className="text-sm text-muted-foreground mt-1">{book.author}</p>

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

        {/* Recommendation Reason */}
        <div className="mt-4 pt-4 border-t border-border/50">
          <div
            className={cn(
              "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm",
              reasonColorClass
            )}
          >
            <ReasonIcon className="w-4 h-4" />
            <span className="font-medium">{book.reason.label}</span>
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
