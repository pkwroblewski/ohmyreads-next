"use client";

import Link from "next/link";
import Image from "next/image";
import { Star, BookOpen, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCoverSrc } from "@/hooks/use-cover-src";
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
    open_library_cover_id?: number | null;
    average_rating: number | null;
    ratings_count?: number | null;
    local_average_rating?: number | null;
    local_ratings_count?: number | null;
  };
  showRating?: boolean;
  showActions?: boolean;
  size?: "sm" | "md" | "lg";
  /** Use 'grid' for browse page grids (full-width, uniform height), 'rail' for horizontal carousels */
  variant?: "grid" | "rail";
  /** Priority loading for above-the-fold images */
  priority?: boolean;
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
 * The rating a card shows. This site's own average wins when readers here
 * have rated the book; otherwise the Open Library figure, flagged as such so
 * the card and the detail page (which labels both) tell the same story.
 */
function pickRating(book: BookCardProps["book"]): {
  rating: number;
  count: number | null;
  external: boolean;
} | null {
  if (book.local_average_rating != null && (book.local_ratings_count ?? 0) > 0) {
    return {
      rating: book.local_average_rating,
      count: book.local_ratings_count ?? null,
      external: false,
    };
  }
  if (book.average_rating != null) {
    return { rating: book.average_rating, count: book.ratings_count ?? null, external: true };
  }
  return null;
}

function formatCount(count: number | null): string | null {
  if (count == null || count <= 0) return null;
  return count >= 1000 ? `${(count / 1000).toFixed(1)}k` : String(count);
}

/**
 * Star glyph + number + count + optional "OL" source tag. The star is the
 * contrast-checked gold; the number is body text, not gold (2.1:1 was the
 * old ratio). One accessible name covers the whole thing.
 */
function CardRating({
  picked,
  className,
}: {
  picked: NonNullable<ReturnType<typeof pickRating>>;
  className?: string;
}) {
  const countStr = formatCount(picked.count);
  const label = `${picked.rating.toFixed(1)} out of 5${
    countStr ? `, ${countStr} ratings` : ""
  }${picked.external ? " on Open Library" : ""}`;
  return (
    <div
      className={cn("flex items-center gap-1 whitespace-nowrap text-foreground", className)}
      role="img"
      aria-label={label}
    >
      <Star className="w-3 h-3 flex-shrink-0 text-star fill-star" aria-hidden="true" />
      <span className="truncate">
        {picked.rating.toFixed(1)}
        {countStr && <span className="text-muted-foreground"> · {countStr}</span>}
      </span>
      {picked.external && (
        <abbr
          title="Open Library rating"
          className="rounded bg-muted px-1 text-[9px] font-medium uppercase tracking-wide no-underline"
        >
          OL
        </abbr>
      )}
    </div>
  );
}

export function BookCard({
  book,
  showRating = true,
  showActions = false,
  size = "md",
  variant = "rail",
  priority = false,
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

  // Server-rendered cover with client-side fallback chain (see hooks/use-cover-src.ts)
  const { src: coverSrc, onError: onCoverError, onLoad: onCoverLoad } = useCoverSrc(book);

  const picked = pickRating(book);

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
            {coverSrc ? (
              <Image
                key={coverSrc}
                src={coverSrc}
                alt={book.title}
                fill
                quality={85}
                placeholder="blur"
                blurDataURL={BLUR_DATA_URL}
                priority={priority}
                onError={onCoverError}
                onLoad={onCoverLoad}
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
        {picked && <CardRating picked={picked} className="text-xs mt-1" />}

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
            {coverSrc ? (
              <Image
                key={coverSrc}
                src={coverSrc}
                alt={book.title}
                fill
                quality={85}
                placeholder="blur"
                blurDataURL={BLUR_DATA_URL}
                priority={priority}
                onError={onCoverError}
                onLoad={onCoverLoad}
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
        {picked && <CardRating picked={picked} className={cn("mt-1", classes.rating)} />}

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
        {coverSrc ? (
          <Image
            key={coverSrc}
            src={coverSrc}
            alt={book.title}
            fill
            quality={85}
            placeholder="blur"
            blurDataURL={BLUR_DATA_URL}
            priority={priority}
            onError={onCoverError}
            onLoad={onCoverLoad}
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

        {showRating && picked && (
          <CardRating
            picked={{ ...picked, count: null }}
            className={isGrid ? "text-xs" : classes.rating}
          />
        )}
      </div>
    </Link>
  );
}
