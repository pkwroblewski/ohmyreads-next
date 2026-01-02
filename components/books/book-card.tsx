import Link from "next/link";
import Image from "next/image";
import { Star, BookOpen, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveCoverUrl } from "@/lib/utils/covers";
import { AddToShelfButton } from "./add-to-shelf-button";
import { buttonVariants } from "@/components/ui/button";

interface BookCardProps {
  book: {
    id: string;
    title: string;
    author: string;
    slug: string;
    cover_url: string | null;
    google_books_id?: string | null;
    isbn?: string | null;
    average_rating: number | null;
    ratings_count?: number;
  };
  showRating?: boolean;
  showActions?: boolean;
  size?: "sm" | "md" | "lg";
  /** Use 'grid' for browse page grids (full-width, uniform height), 'rail' for horizontal carousels */
  variant?: "grid" | "rail";
}

const sizeClasses = {
  sm: {
    container: "w-24",
    title: "text-xs",
    author: "text-[10px]",
    rating: "text-[10px]",
  },
  md: {
    container: "w-36",
    title: "text-sm",
    author: "text-xs",
    rating: "text-xs",
  },
  lg: {
    container: "w-48",
    title: "text-base",
    author: "text-sm",
    rating: "text-sm",
  },
};

// Placeholder blur data URL for nicer loading
const BLUR_DATA_URL =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiMyYTJhMmEiLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiMxYTFhMWEiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2cpIi8+PC9zdmc+";

/**
 * Compact rating display: "4.6 ★ · 220"
 */
function formatCompactRating(
  rating: number | null,
  count?: number
): string | null {
  if (rating === null) return null;
  const ratingStr = rating.toFixed(1);
  if (count !== undefined && count > 0) {
    const countStr = count >= 1000 ? `${(count / 1000).toFixed(1)}k` : String(count);
    return `${ratingStr} ★ · ${countStr}`;
  }
  return `${ratingStr} ★`;
}

export function BookCard({
  book,
  showRating = true,
  showActions = false,
  size = "md",
  variant = "rail",
}: BookCardProps) {
  const classes = sizeClasses[size];
  const isGrid = variant === "grid";

  // Build external search URLs
  const amazonSearchUrl = `https://www.amazon.com/s?k=${encodeURIComponent(
    `${book.title} ${book.author}`
  )}`;
  const bookshopSearchUrl = `https://bookshop.org/search?keywords=${encodeURIComponent(
    `${book.title} ${book.author}`
  )}`;

  // Resolve best available cover URL
  const coverUrl = resolveCoverUrl(book);

  // Compact rating for grid variant
  const compactRating = formatCompactRating(
    book.average_rating,
    book.ratings_count
  );

  // Responsive image sizes
  const imageSizes = isGrid
    ? "(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 20vw"
    : size === "sm"
    ? "96px"
    : size === "md"
    ? "144px"
    : "192px";

  // Grid variant with actions (for /books browse page)
  if (isGrid && showActions) {
    return (
      <div className="group flex flex-col w-full h-full focus-within:-translate-y-1 transition-transform duration-200">
        {/* Clickable area: cover + info */}
        <Link
          href={`/books/${book.slug}`}
          className="flex flex-col flex-1 hover:-translate-y-1 focus:-translate-y-1 transition-transform duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-lg"
        >
          {/* Book Cover */}
          <div
            className={cn(
              "relative w-full rounded-lg overflow-hidden",
              "bg-gradient-to-br from-muted to-muted-foreground/20",
              "shadow-md group-hover:shadow-xl group-focus-within:shadow-xl dark:group-hover:shadow-primary/10 dark:group-focus-within:shadow-primary/10",
              "transition-shadow duration-200"
            )}
            style={{ aspectRatio: "2/3" }}
          >
            {coverUrl ? (
              <Image
                src={coverUrl}
                alt={book.title}
                fill
                quality={85}
                placeholder="blur"
                blurDataURL={BLUR_DATA_URL}
                className="object-cover object-[center_top] transition-transform duration-300 group-hover:scale-[1.03]"
                sizes={imageSizes}
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-2 text-center">
                <BookOpen className="w-8 h-8 text-muted-foreground/40 mb-2" />
                <p className="text-xs text-muted-foreground/60 line-clamp-2">{book.title}</p>
              </div>
            )}
          </div>

          {/* Book Info - fixed height for alignment */}
          <div className="mt-2 min-h-[3.5rem]">
            <h3 className="font-medium text-sm leading-tight line-clamp-2">
              {book.title}
            </h3>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {book.author}
            </p>
          </div>
        </Link>

        {/* Rating - only show if book has ratings */}
        {compactRating && (
          <div className="flex items-center gap-1 text-xs whitespace-nowrap mt-1 text-accent">
            <Star className="w-3 h-3 flex-shrink-0 fill-current" />
            <span className="truncate">{compactRating}</span>
          </div>
        )}

        {/* Actions - anchored at bottom */}
        <div className="mt-auto pt-3 space-y-2">
          <AddToShelfButton bookId={book.id} />
          <div className="flex gap-2">
            <a
              href={amazonSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "flex-1 text-xs justify-center"
              )}
            >
              Amazon
              <ExternalLink className="w-3 h-3 ml-1 flex-shrink-0" />
            </a>
            <a
              href={bookshopSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "flex-1 text-xs justify-center"
              )}
            >
              Buy Local
              <ExternalLink className="w-3 h-3 ml-1 flex-shrink-0" />
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Rail variant with actions (horizontal carousels with actions)
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
              "bg-gradient-to-br from-muted to-muted-foreground/20",
              "shadow-md group-hover:shadow-lg dark:group-hover:shadow-primary/10",
              "transition-shadow duration-200"
            )}
            style={{ aspectRatio: "2/3" }}
          >
            {coverUrl ? (
              <Image
                src={coverUrl}
                alt={book.title}
                fill
                quality={85}
                placeholder="blur"
                blurDataURL={BLUR_DATA_URL}
                className="object-cover object-[center_top] transition-transform duration-300 group-hover:scale-[1.03]"
                sizes={imageSizes}
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-2 text-center">
                <BookOpen className="w-8 h-8 text-muted-foreground/40 mb-2" />
                <p className="text-xs text-muted-foreground/60 line-clamp-2">{book.title}</p>
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

        {/* Rating - only show if book has ratings */}
        {compactRating && (
          <div className={cn("flex items-center gap-1 mt-1 text-accent", classes.rating)}>
            <Star className="w-3 h-3 fill-current" />
            <span className="whitespace-nowrap truncate">{compactRating}</span>
          </div>
        )}

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

  // Default compact card (no actions) - rail or grid
  const containerClass = isGrid
    ? "w-full h-full"
    : classes.container;

  return (
    <Link
      href={`/books/${book.slug}`}
      className={cn(
        "group flex flex-col",
        containerClass,
        "transition-transform duration-200",
        "hover:-translate-y-1 focus:-translate-y-1",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-lg"
      )}
    >
      <div
        className={cn(
          "relative w-full rounded-lg overflow-hidden",
          "bg-gradient-to-br from-muted to-muted-foreground/20",
          "shadow-md group-hover:shadow-lg group-focus:shadow-lg dark:group-hover:shadow-primary/10 dark:group-focus:shadow-primary/10",
          "transition-shadow duration-200"
        )}
        style={{ aspectRatio: "2/3" }}
      >
        {coverUrl ? (
          <Image
            src={coverUrl}
            alt={book.title}
            fill
            quality={85}
            placeholder="blur"
            blurDataURL={BLUR_DATA_URL}
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            sizes={imageSizes}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <BookOpen className="w-8 h-8 text-muted-foreground/50" />
          </div>
        )}
      </div>

      <div className={cn("mt-2 space-y-0.5", isGrid && "min-h-[3rem]")}>
        <h3
          className={cn(
            "font-medium line-clamp-2 leading-tight",
            isGrid ? "text-sm" : classes.title
          )}
        >
          {book.title}
        </h3>
        <p
          className={cn(
            "text-muted-foreground truncate",
            isGrid ? "text-xs" : classes.author
          )}
        >
          {book.author}
        </p>

        {showRating && book.average_rating !== null && (
          <div
            className={cn(
              "flex items-center gap-1 text-accent",
              isGrid ? "text-xs" : classes.rating
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
