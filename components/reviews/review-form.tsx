"use client";

import { useState } from "react";
import { Star, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { createReview, updateReview } from "@/lib/actions/reviews";
import type { Review } from "@/types/database";

interface ReviewFormProps {
  bookId: string;
  bookTitle: string;
  existingReview?: Review;
  onSuccess?: () => void;
}

export function ReviewForm({
  bookId,
  bookTitle,
  existingReview,
  onSuccess,
}: ReviewFormProps) {
  const [rating, setRating] = useState(existingReview?.rating || 0);
  const [hoverRating, setHoverRating] = useState(0);
  const [content, setContent] = useState(existingReview?.content || "");
  const [isSpoiler, setIsSpoiler] = useState(existingReview?.is_spoiler || false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!existingReview;
  const displayRating = hoverRating || rating;
  const canSubmit = rating > 0 && content.trim().length >= 10;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const result = isEditing
        ? await updateReview(existingReview.id, { content, rating, isSpoiler })
        : await createReview({ bookId, content, rating, isSpoiler });

      if (result.error) {
        setError(result.error);
        toast.error(result.error);
      } else {
        toast.success(isEditing ? "Review updated!" : "Review posted!");
        if (!isEditing) {
          setRating(0);
          setContent("");
          setIsSpoiler(false);
        }
        onSuccess?.();
      }
    } catch {
      setError("An unexpected error occurred");
      toast.error("Failed to submit review");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header */}
      <h3 className="text-lg font-semibold">
        {isEditing ? "Edit your review" : `Write a review for "${bookTitle}"`}
      </h3>

      {/* Star Rating Input */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Your Rating</label>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              className="p-1 transition-transform hover:scale-110 focus:outline-none"
              aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
            >
              <Star
                className={cn(
                  "w-8 h-8 transition-colors",
                  star <= displayRating
                    ? "text-accent fill-accent"
                    : "text-muted-foreground/30"
                )}
              />
            </button>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          {displayRating > 0
            ? `${displayRating} out of 5 stars`
            : "Click to rate"}
        </p>
      </div>

      {/* Review Content */}
      <div className="space-y-2">
        <label htmlFor="review-content" className="text-sm font-medium">
          Your Review
        </label>
        <textarea
          id="review-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Share your thoughts about this book..."
          className={cn(
            "w-full min-h-[150px] p-4 rounded-lg",
            "bg-background border border-input",
            "focus:outline-none focus:ring-2 focus:ring-ring",
            "placeholder:text-muted-foreground",
            "resize-y",
            content.length > 4500 && "border-destructive"
          )}
          maxLength={5000}
        />
        <p
          className={cn(
            "text-sm text-right",
            content.length > 4500
              ? "text-destructive"
              : "text-muted-foreground"
          )}
        >
          {content.length}/5000
        </p>
      </div>

      {/* Spoiler Checkbox */}
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          id="spoiler-checkbox"
          checked={isSpoiler}
          onChange={(e) => setIsSpoiler(e.target.checked)}
          className={cn(
            "mt-1 h-4 w-4 rounded border-input",
            "focus:ring-2 focus:ring-ring focus:ring-offset-2",
            "accent-primary"
          )}
        />
        <div>
          <label
            htmlFor="spoiler-checkbox"
            className="text-sm font-medium cursor-pointer"
          >
            This review contains spoilers
          </label>
          <p className="text-xs text-muted-foreground">
            Spoiler reviews will be hidden by default
          </p>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Submit Button */}
      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={!canSubmit || isSubmitting}
          className="min-w-[140px]"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isEditing ? "Updating..." : "Posting..."}
            </>
          ) : isEditing ? (
            "Update Review"
          ) : (
            "Post Review"
          )}
        </Button>
      </div>
    </form>
  );
}

