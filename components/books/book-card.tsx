import Link from "next/link";
import Image from "next/image";
import { Star, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface BookCardProps {
  book: {
    id: string;
    title: string;
    author: string;
    slug: string;
    cover_url: string | null;
    average_rating: number | null;
  };
  showRating?: boolean;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: {
    container: "w-24",
    cover: "h-36", // 24 * 1.5 = 36 (2:3 ratio)
    title: "text-xs",
    author: "text-[10px]",
    rating: "text-[10px]",
  },
  md: {
    container: "w-36",
    cover: "h-54", // 36 * 1.5 = 54
    title: "text-sm",
    author: "text-xs",
    rating: "text-xs",
  },
  lg: {
    container: "w-48",
    cover: "h-72", // 48 * 1.5 = 72
    title: "text-base",
    author: "text-sm",
    rating: "text-sm",
  },
};

export function BookCard({
  book,
  showRating = true,
  size = "md",
}: BookCardProps) {
  const classes = sizeClasses[size];

  return (
    <Link
      href={`/books/${book.slug}`}
      className={cn(
        "group flex flex-col",
        classes.container,
        "transition-transform duration-200",
        "hover:-translate-y-1"
      )}
    >
      {/* Book Cover */}
      <div
        className={cn(
          "relative w-full rounded-lg overflow-hidden",
          classes.cover,
          "bg-gradient-to-br from-muted to-muted-foreground/20",
          "shadow-md group-hover:shadow-lg dark:group-hover:shadow-primary/10",
          "transition-shadow duration-200"
        )}
        style={{ aspectRatio: "2/3" }}
      >
        {book.cover_url ? (
          <Image
            src={book.cover_url}
            alt={book.title}
            fill
            className="object-cover"
            sizes={
              size === "sm"
                ? "96px"
                : size === "md"
                ? "144px"
                : "192px"
            }
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <BookOpen className="w-8 h-8 text-muted-foreground/50" />
          </div>
        )}
      </div>

      {/* Book Info */}
      <div className="mt-2 space-y-0.5">
        {/* Title */}
        <h3
          className={cn(
            "font-medium line-clamp-2 leading-tight",
            classes.title
          )}
        >
          {book.title}
        </h3>

        {/* Author */}
        <p
          className={cn(
            "text-muted-foreground truncate",
            classes.author
          )}
        >
          {book.author}
        </p>

        {/* Rating */}
        {showRating && book.average_rating !== null && (
          <div
            className={cn(
              "flex items-center gap-1 text-accent",
              classes.rating
            )}
          >
            <Star className="w-3 h-3 fill-current" />
            <span>{book.average_rating.toFixed(1)}</span>
          </div>
        )}
      </div>
    </Link>
  );
}

