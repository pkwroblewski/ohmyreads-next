"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createReview, updateReview } from "@/lib/actions/reviews";

interface QuickRatingProps {
  bookId: string;
  bookTitle: string;
  /** The reader's current star rating, if they have already reviewed. */
  initialRating: number | null;
  /** Their existing review, so a click updates it rather than creating one. */
  reviewId: string | null;
}

/**
 * Five stars next to "Add to Shelf" that post a rating-only review without
 * opening the full form (a review needs a rating OR 50+ characters, so a bare
 * star is a valid review). If the reader already has a review, the click
 * changes that review's rating instead.
 */
export function QuickRating({
  bookId,
  bookTitle,
  initialRating,
  reviewId: initialReviewId,
}: QuickRatingProps) {
  const router = useRouter();
  const [rating, setRating] = useState<number | null>(initialRating);
  const [reviewId, setReviewId] = useState<string | null>(initialReviewId);
  const [hover, setHover] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  const shown = hover ?? rating ?? 0;

  const rate = (value: number) => {
    if (isPending || value === rating) return;
    const previous = rating;
    setRating(value);

    startTransition(async () => {
      const result = reviewId
        ? await updateReview({ reviewId, rating: value })
        : await createReview({ bookId, rating: value, vibeTags: [], isSpoiler: false });

      if (result.error) {
        setRating(previous);
        toast.error(result.error);
        return;
      }
      const createdId = "reviewId" in result ? result.reviewId : undefined;
      if (!reviewId && typeof createdId === "string") {
        setReviewId(createdId);
      }
      toast.success(`Rated ${value} star${value === 1 ? "" : "s"}`);
      // The reviews section below renders from server data.
      router.refresh();
    });
  };

  return (
    <div
      role="radiogroup"
      aria-label={`Rate ${bookTitle}`}
      className="flex items-center gap-0.5"
      onMouseLeave={() => setHover(null)}
    >
      {[1, 2, 3, 4, 5].map((value) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={rating === value}
          aria-label={`${value} star${value === 1 ? "" : "s"}`}
          disabled={isPending}
          onClick={() => rate(value)}
          onMouseEnter={() => setHover(value)}
          onFocus={() => setHover(value)}
          onBlur={() => setHover(null)}
          className={cn(
            "h-10 w-8 flex items-center justify-center rounded-md",
            "transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            isPending && "opacity-60"
          )}
        >
          <Star
            aria-hidden="true"
            className={cn(
              "h-6 w-6 transition-colors",
              value <= shown ? "text-star fill-star" : "text-muted-foreground/40"
            )}
          />
        </button>
      ))}
      <span className="sr-only" aria-live="polite">
        {rating ? `Your rating: ${rating} out of 5` : "Not rated yet"}
      </span>
    </div>
  );
}
