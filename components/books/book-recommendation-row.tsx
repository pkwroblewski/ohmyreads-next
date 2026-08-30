"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { Star, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { CoverImage } from "@/components/books/cover-image";
import type { BookSummary } from "@/types/database";

interface BookRecommendationRowProps {
  title: string;
  subtitle?: string;
  books: BookSummary[];
  viewAllHref?: string;
}

export function BookRecommendationRow({
  title,
  subtitle,
  books,
  viewAllHref,
}: BookRecommendationRowProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // Check scroll position to show/hide arrows
  const checkScrollPosition = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    setCanScrollLeft(scrollLeft > 20);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 20);
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    checkScrollPosition();
    container.addEventListener("scroll", checkScrollPosition, { passive: true });
    window.addEventListener("resize", checkScrollPosition);

    return () => {
      container.removeEventListener("scroll", checkScrollPosition);
      window.removeEventListener("resize", checkScrollPosition);
    };
  }, []);

  const scroll = (direction: "left" | "right") => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollAmount = container.clientWidth * 0.7;
    container.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  if (books.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between px-4 sm:px-6 lg:px-8">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold font-serif">{title}</h2>
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

      {/* Scrollable Book Row with edge fades and arrows */}
      <div className="relative group/carousel">
        {/* Left edge fade */}
        <div
          className={cn(
            "absolute left-0 top-0 bottom-4 w-12 sm:w-20 z-10 pointer-events-none",
            "bg-gradient-to-r from-background to-transparent",
            "transition-opacity duration-300",
            canScrollLeft ? "opacity-100" : "opacity-0"
          )}
        />

        {/* Right edge fade */}
        <div
          className={cn(
            "absolute right-0 top-0 bottom-4 w-12 sm:w-20 z-10 pointer-events-none",
            "bg-gradient-to-l from-background to-transparent",
            "transition-opacity duration-300",
            canScrollRight ? "opacity-100" : "opacity-0"
          )}
        />

        {/* Left arrow (desktop only) */}
        <button
          onClick={() => scroll("left")}
          aria-label="Scroll left"
          className={cn(
            "absolute left-2 top-1/2 -translate-y-1/2 z-20",
            "hidden md:flex items-center justify-center",
            "w-10 h-10 rounded-full",
            "bg-background/90 backdrop-blur-sm border border-border shadow-lg",
            "text-foreground hover:bg-muted transition-all duration-200",
            "opacity-0 group-hover/carousel:opacity-100",
            !canScrollLeft && "!opacity-0 pointer-events-none"
          )}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Right arrow (desktop only) */}
        <button
          onClick={() => scroll("right")}
          aria-label="Scroll right"
          className={cn(
            "absolute right-2 top-1/2 -translate-y-1/2 z-20",
            "hidden md:flex items-center justify-center",
            "w-10 h-10 rounded-full",
            "bg-background/90 backdrop-blur-sm border border-border shadow-lg",
            "text-foreground hover:bg-muted transition-all duration-200",
            "opacity-0 group-hover/carousel:opacity-100",
            !canScrollRight && "!opacity-0 pointer-events-none"
          )}
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        {/* Scrollable container */}
        <div
          ref={scrollContainerRef}
          className={cn(
            "flex gap-5 sm:gap-6 lg:gap-7 overflow-x-auto scroll-smooth",
            "px-4 sm:px-6 lg:px-8",
            "pb-4",
            "snap-x snap-mandatory",
            "scrollbar-hide"
          )}
        >
          {books.map((book) => (
            <PremiumBookCard key={book.id} book={book} />
          ))}
        </div>
      </div>
    </div>
  );
}

function PremiumBookCard({ book }: { book: BookSummary }) {
  return (
    <Link
      href={`/books/${book.slug}`}
      className={cn(
        "flex-shrink-0 snap-start",
        // Larger widths for premium feel
        "w-[160px] sm:w-[190px] lg:w-[220px]",
        "group"
      )}
    >
      {/* Framed Book Cover */}
      <div
        className={cn(
          "relative rounded-xl overflow-hidden",
          // Framed style: background + border + shadow
          "p-1.5 sm:p-2",
          "bg-gradient-to-br from-muted/80 to-muted/40",
          "border border-border/50",
          // Shadow styling
          "shadow-lg",
          "transition-all duration-300 ease-out",
          // Hover effects
          "group-hover:-translate-y-2",
          "group-hover:shadow-xl group-hover:shadow-primary/10",
          "dark:group-hover:shadow-[0_8px_40px_rgba(139,92,246,0.2)]",
          "group-hover:border-primary/30"
        )}
      >
        {/* Inner cover container */}
        <div
          className="relative w-full"
          style={{ aspectRatio: "2/3" }}
        >
          <CoverImage
            book={book}
            fill
            hover
            className="rounded-lg"
          />

          {/* Rating badge */}
          {book.average_rating !== null && (
            <div
              className={cn(
                "absolute top-2 right-2 z-10",
                "px-2 py-1 rounded-md",
                "bg-background/90 backdrop-blur-sm border border-border/50",
                "text-xs font-semibold",
                "flex items-center gap-1"
              )}
            >
              <Star className="w-3 h-3 fill-accent text-accent" />
              <span>{book.average_rating.toFixed(1)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Book Info */}
      <div className="mt-3 space-y-1 px-1">
        <h3
          className={cn(
            "font-semibold text-sm sm:text-base leading-tight line-clamp-2",
            "transition-colors duration-200",
            "group-hover:text-primary"
          )}
        >
          {book.title}
        </h3>
        <p className="text-xs sm:text-sm text-muted-foreground truncate">
          {book.author}
        </p>
      </div>
    </Link>
  );
}
