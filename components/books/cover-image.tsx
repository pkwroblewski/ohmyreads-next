"use client";

import { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getCoverUrlsWithFallbacks,
  findFirstValidCoverUrl,
  type BookCoverData,
} from "@/lib/utils/covers";

// Placeholder blur data URL (dark gradient)
const BLUR_DATA_URL =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImciIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPjxzdG9wIG9mZnNldD0iMCUiIHN0b3AtY29sb3I9IiMyYTJhMmEiLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0b3AtY29sb3I9IiMxYTFhMWEiLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2cpIi8+PC9zdmc+";

export type CoverSize = "xs" | "sm" | "md" | "lg" | "xl";

interface CoverImageProps {
  book: BookCoverData & {
    title: string;
    author?: string;
  };
  size?: CoverSize;
  /** Custom width in pixels (overrides size preset) */
  width?: number;
  /** Custom height in pixels (overrides size preset) */
  height?: number;
  /** 
   * Fill mode: image fills its parent container.
   * When true, width/height/size are ignored and parent must have position:relative.
   */
  fill?: boolean;
  /** Add hover animation */
  hover?: boolean;
  /** Custom className for the container */
  className?: string;
  /** Priority loading (for above-the-fold images) */
  priority?: boolean;
}

// Size presets (width x height)
const SIZE_PRESETS: Record<CoverSize, { width: number; height: number }> = {
  xs: { width: 40, height: 60 },
  sm: { width: 64, height: 96 },
  md: { width: 128, height: 192 },
  lg: { width: 160, height: 240 },
  xl: { width: 200, height: 300 },
};

/**
 * Unified book cover image component
 *
 * Features:
 * - Pre-load validation: images are tested in hidden elements before display
 * - Automatic cover URL resolution (Open Library → ISBN → cover_url → Google Books)
 * - Consistent styling with rounded corners, shadows, and optional hover effects
 * - Optimized blur placeholder for loading states
 * - Fallback to modern gradient placeholder with book icon when no valid cover
 * - Object-position top to crop barcodes on scanned covers
 * - Fill mode for responsive parent-sized layouts
 */
export function CoverImage({
  book,
  size = "md",
  width,
  height,
  fill = false,
  hover = true,
  className,
  priority = false,
}: CoverImageProps) {
  const [coverResult, setCoverResult] = useState<{
    urls: readonly string[];
    validatedUrl: string | null;
  } | null>(null);

  const dimensions = fill
    ? null
    : (width && height ? { width, height } : SIZE_PRESETS[size]);

  const coverUrls = useMemo(() => getCoverUrlsWithFallbacks(book), [book]);

  // Derive validation state: no URLs means nothing to validate
  const isValidating = coverUrls.length > 0 && (coverResult === null || coverResult.urls !== coverUrls);
  const validatedUrl = !isValidating && coverResult?.urls === coverUrls ? coverResult.validatedUrl : null;

  // Pre-load and validate URLs before displaying
  useEffect(() => {
    if (coverUrls.length === 0) return;

    const controller = new AbortController();

    findFirstValidCoverUrl(coverUrls, controller.signal).then((url) => {
      if (!controller.signal.aborted) {
        setCoverResult({ urls: coverUrls, validatedUrl: url });
      }
    });

    return () => {
      controller.abort();
    };
  }, [coverUrls]);

  const showPlaceholder = !isValidating && !validatedUrl;

  // Responsive sizes hint for next/image
  const sizes = fill
    ? "(max-width: 640px) 50vw, 200px"
    : `(max-width: 640px) ${dimensions?.width}px, ${(dimensions?.width || 128) * 1.5}px`;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg",
        "bg-gradient-to-br from-muted to-muted-foreground/20",
        "shadow-md",
        hover && "transition-all duration-300",
        hover && "group-hover:shadow-xl dark:group-hover:shadow-primary/10",
        fill && "w-full h-full",
        className
      )}
      style={dimensions ? { width: dimensions.width, height: dimensions.height } : undefined}
    >
      {isValidating ? (
        // Show blur placeholder while validating
        <div className="absolute inset-0 animate-pulse bg-muted" />
      ) : showPlaceholder ? (
        <PlaceholderCover title={book.title} author={book.author} />
      ) : (
        <Image
          src={validatedUrl!}
          alt={`Cover of ${book.title}`}
          fill
          sizes={sizes}
          quality={85}
          priority={priority}
          placeholder="blur"
          blurDataURL={BLUR_DATA_URL}
          className={cn(
            "object-cover",
            // Position top to crop barcodes that often appear at bottom
            "object-[center_top]",
            hover && "transition-transform duration-300",
            hover && "group-hover:scale-[1.03]"
          )}
        />
      )}
    </div>
  );
}

/**
 * Modern placeholder when no cover is available
 * Shows a gradient background with book icon and truncated title
 */
function PlaceholderCover({
  title,
  author,
}: {
  title: string;
  author?: string;
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center p-2 text-center">
      {/* Subtle pattern overlay */}
      <div className="absolute inset-0 opacity-5 bg-[radial-gradient(circle_at_1px_1px,currentColor_1px,transparent_0)] bg-[size:12px_12px]" />
      
      {/* Icon */}
      <div className="relative flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 mb-2">
        <BookOpen className="w-5 h-5 text-primary/60" />
      </div>

      {/* Title (truncated) */}
      <p className="relative text-xs font-medium text-muted-foreground/80 line-clamp-2 leading-tight px-1">
        {title}
      </p>

      {/* Author (if provided) */}
      {author && (
        <p className="relative text-[10px] text-muted-foreground/60 truncate mt-0.5 px-1 max-w-full">
          {author}
        </p>
      )}
    </div>
  );
}

/**
 * Minimal cover for tiny displays (e.g., activity feed)
 * Uses same pre-load validation as CoverImage
 */
export function CoverImageMini({
  book,
  className,
}: {
  book: BookCoverData & { title: string };
  className?: string;
}) {
  const [coverResult, setCoverResult] = useState<{
    urls: readonly string[];
    validatedUrl: string | null;
  } | null>(null);

  const coverUrls = useMemo(() => getCoverUrlsWithFallbacks(book), [book]);

  // Derive validation state: no URLs means nothing to validate
  const isValidating = coverUrls.length > 0 && (coverResult === null || coverResult.urls !== coverUrls);
  const validatedUrl = !isValidating && coverResult?.urls === coverUrls ? coverResult.validatedUrl : null;

  // Pre-load and validate URLs before displaying
  useEffect(() => {
    if (coverUrls.length === 0) return;

    const controller = new AbortController();

    findFirstValidCoverUrl(coverUrls, controller.signal).then((url) => {
      if (!controller.signal.aborted) {
        setCoverResult({ urls: coverUrls, validatedUrl: url });
      }
    });

    return () => {
      controller.abort();
    };
  }, [coverUrls]);

  const showPlaceholder = !isValidating && !validatedUrl;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded bg-muted",
        "w-10 h-[60px]",
        className
      )}
    >
      {isValidating ? (
        <div className="absolute inset-0 animate-pulse bg-muted" />
      ) : showPlaceholder ? (
        <div className="w-full h-full flex items-center justify-center">
          <BookOpen className="w-4 h-4 text-muted-foreground/50" />
        </div>
      ) : (
        <Image
          src={validatedUrl!}
          alt={book.title}
          fill
          sizes="40px"
          quality={75}
          className="object-cover object-[center_top]"
        />
      )}
    </div>
  );
}
