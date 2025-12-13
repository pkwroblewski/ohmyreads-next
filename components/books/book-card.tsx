import Link from "next/link";
import Image from "next/image";
import { Star, BookOpen, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { AddToShelfButton } from "./add-to-shelf-button";
import { buttonVariants } from "@/components/ui/button";

interface BookCardProps {
  book: {
    id: string;
    title: string;
    author: string;
    slug: string;
    cover_url: string | null;
    average_rating: number | null;
    ratings_count?: number;
  };
  showRating?: boolean;
  showActions?: boolean;
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
  showActions = false,
  size = "md",
}: BookCardProps) {
  const classes = sizeClasses[size];

  // Build external search URLs
  const amazonSearchUrl = `https://www.amazon.com/s?k=${encodeURIComponent(
    `${book.title} ${book.author}`
  )}`;
  const bookshopSearchUrl = `https://bookshop.org/search?keywords=${encodeURIComponent(
    `${book.title} ${book.author}`
  )}`;

  // Rating summary text
  const ratingSummary =
    book.average_rating !== null
      ? `${book.average_rating.toFixed(1)}/5 Stars${
          book.ratings_count !== undefined
            ? ` (${book.ratings_count.toLocaleString()} ratings)`
            : ""
        }`
      : "No ratings yet";

  // When actions are shown, keep buttons outside the Link
  if (showActions) {
    return (
      <div
        className={cn(
          "group flex flex-col",
          classes.container,
          "transition-transform duration-200"
        )}
      >
        <Link
          href={`/books/${book.slug}`}
          className="hover:-translate-y-1 transition-transform duration-200"
        >
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

          <div className="mt-2 space-y-0.5">
            <h3
              className={cn(
                "font-medium line-clamp-2 leading-tight",
                classes.title
              )}
            >
              {book.title}
            </h3>
            <p
              className={cn("text-muted-foreground truncate", classes.author)}
            >
              {book.author}
            </p>
          </div>
        </Link>

        <div
          className={cn(
            "flex items-center gap-1 mt-1",
            classes.rating,
            book.average_rating !== null ? "text-accent" : "text-muted-foreground"
          )}
        >
          <Star
            className={cn(
              "w-3 h-3",
              book.average_rating !== null && "fill-current"
            )}
          />
          <span>{ratingSummary}</span>
        </div>

        <div className="mt-3 space-y-2">
          <AddToShelfButton bookId={book.id} />
          <div className="flex gap-2">
            <a
              href={amazonSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "flex-1 text-xs"
              )}
            >
              Amazon
              <ExternalLink className="w-3 h-3 ml-1" />
            </a>
            <a
              href={bookshopSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "flex-1 text-xs"
              )}
            >
              Buy Local
              <ExternalLink className="w-3 h-3 ml-1" />
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Default compact card (no actions)
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
              size === "sm" ? "96px" : size === "md" ? "144px" : "192px"
            }
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <BookOpen className="w-8 h-8 text-muted-foreground/50" />
          </div>
        )}
      </div>

      <div className="mt-2 space-y-0.5">
        <h3
          className={cn("font-medium line-clamp-2 leading-tight", classes.title)}
        >
          {book.title}
        </h3>
        <p
          className={cn("text-muted-foreground truncate", classes.author)}
        >
          {book.author}
        </p>

        {showRating && book.average_rating !== null && (
          <div
            className={cn("flex items-center gap-1 text-accent", classes.rating)}
          >
            <Star className="w-3 h-3 fill-current" />
            <span>{book.average_rating.toFixed(1)}</span>
          </div>
        )}
      </div>
    </Link>
  );
}
