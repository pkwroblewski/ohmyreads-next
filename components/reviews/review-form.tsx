"use client";

import { useState } from "react";
import { Star, Loader2, ChevronDown, ChevronUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { createReview, updateReview } from "@/lib/actions/reviews";
import type { Review, VibeTag } from "@/types/database";
import { VIBE_TAGS, ALL_VIBE_TAGS } from "@/types/database";

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
  const [summary, setSummary] = useState(existingReview?.summary || "");
  const [liked, setLiked] = useState(existingReview?.liked || "");
  const [disliked, setDisliked] = useState(existingReview?.disliked || "");
  const [takeaway, setTakeaway] = useState(existingReview?.takeaway || "");
  const [vibeTags, setVibeTags] = useState<VibeTag[]>(
    (existingReview?.vibe_tags as VibeTag[]) || []
  );
  const [isSpoiler, setIsSpoiler] = useState(existingReview?.is_spoiler || false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOptionalFields, setShowOptionalFields] = useState(
    !!(existingReview?.liked || existingReview?.disliked || existingReview?.takeaway)
  );
  const [showVibeTags, setShowVibeTags] = useState(
    (existingReview?.vibe_tags?.length || 0) > 0
  );

  const isEditing = !!existingReview;
  const displayRating = hoverRating || rating;

  // Calculate total character count
  const totalCharCount =
    (summary?.length || 0) +
    (liked?.length || 0) +
    (disliked?.length || 0) +
    (takeaway?.length || 0);

  // Allow star-only ratings (quick rating mode)
  const canSubmit = rating > 0;

  const toggleVibeTag = (tag: VibeTag) => {
    if (vibeTags.includes(tag)) {
      setVibeTags(vibeTags.filter((t) => t !== tag));
    } else if (vibeTags.length < 10) {
      setVibeTags([...vibeTags, tag]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const result = isEditing
        ? await updateReview({
            reviewId: existingReview.id,
            rating,
            summary: summary || undefined,
            liked: liked || undefined,
            disliked: disliked || undefined,
            takeaway: takeaway || undefined,
            vibeTags: vibeTags.length > 0 ? vibeTags : undefined,
            isSpoiler,
          })
        : await createReview({
            bookId,
            rating,
            summary: summary || undefined,
            liked: liked || undefined,
            disliked: disliked || undefined,
            takeaway: takeaway || undefined,
            vibeTags,
            isSpoiler,
          });

      if (result.error) {
        setError(result.error);
        toast.error(result.error);
      } else {
        toast.success(isEditing ? "Review updated!" : "Review posted!");
        if (!isEditing) {
          setRating(0);
          setSummary("");
          setLiked("");
          setDisliked("");
          setTakeaway("");
          setVibeTags([]);
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
        <label className="text-sm font-medium">Your Rating *</label>
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
          {displayRating > 0 ? `${displayRating} out of 5 stars` : "Select to rate"}
        </p>
      </div>

      {/* Summary - Main Review Content */}
      <div className="space-y-2">
        <label htmlFor="review-summary" className="text-sm font-medium">
          Your Overall Thoughts <span className="text-muted-foreground font-normal">(optional)</span>
        </label>
        <textarea
          id="review-summary"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Share your overall impression of the book..."
          className={cn(
            "w-full min-h-[120px] p-4 rounded-lg",
            "bg-background border border-input",
            "focus:outline-none focus:ring-2 focus:ring-ring",
            "placeholder:text-muted-foreground",
            "resize-y",
            summary.length > 1900 && "border-destructive"
          )}
          maxLength={2000}
        />
        <p
          className={cn(
            "text-sm text-right",
            summary.length > 1900 ? "text-destructive" : "text-muted-foreground"
          )}
        >
          {summary.length}/2000
        </p>
      </div>

      {/* Optional Structured Fields Toggle */}
      <button
        type="button"
        onClick={() => setShowOptionalFields(!showOptionalFields)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        {showOptionalFields ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
        {showOptionalFields ? "Hide" : "Show"} additional fields (What you liked,
        didn&apos;t like, key takeaways)
      </button>

      {/* Optional Structured Fields */}
      {showOptionalFields && (
        <div className="space-y-4 pl-4 border-l-2 border-muted">
          {/* What I Liked */}
          <div className="space-y-2">
            <label htmlFor="review-liked" className="text-sm font-medium">
              What did you like?
            </label>
            <textarea
              id="review-liked"
              value={liked}
              onChange={(e) => setLiked(e.target.value)}
              placeholder="What aspects of the book stood out positively?"
              className={cn(
                "w-full min-h-[80px] p-3 rounded-lg",
                "bg-background border border-input",
                "focus:outline-none focus:ring-2 focus:ring-ring",
                "placeholder:text-muted-foreground",
                "resize-y"
              )}
              maxLength={1000}
            />
            <p className="text-xs text-right text-muted-foreground">
              {liked.length}/1000
            </p>
          </div>

          {/* What I Didn't Like */}
          <div className="space-y-2">
            <label htmlFor="review-disliked" className="text-sm font-medium">
              What didn&apos;t you like?
            </label>
            <textarea
              id="review-disliked"
              value={disliked}
              onChange={(e) => setDisliked(e.target.value)}
              placeholder="Were there any aspects that didn't work for you?"
              className={cn(
                "w-full min-h-[80px] p-3 rounded-lg",
                "bg-background border border-input",
                "focus:outline-none focus:ring-2 focus:ring-ring",
                "placeholder:text-muted-foreground",
                "resize-y"
              )}
              maxLength={1000}
            />
            <p className="text-xs text-right text-muted-foreground">
              {disliked.length}/1000
            </p>
          </div>

          {/* Key Takeaway */}
          <div className="space-y-2">
            <label htmlFor="review-takeaway" className="text-sm font-medium">
              Key Takeaway
            </label>
            <textarea
              id="review-takeaway"
              value={takeaway}
              onChange={(e) => setTakeaway(e.target.value)}
              placeholder="What's the one thing you'll remember from this book?"
              className={cn(
                "w-full min-h-[80px] p-3 rounded-lg",
                "bg-background border border-input",
                "focus:outline-none focus:ring-2 focus:ring-ring",
                "placeholder:text-muted-foreground",
                "resize-y"
              )}
              maxLength={1000}
            />
            <p className="text-xs text-right text-muted-foreground">
              {takeaway.length}/1000
            </p>
          </div>
        </div>
      )}

      {/* Character count hint - encouraging, not punitive */}
      {totalCharCount > 0 && (
        <p className="text-sm text-muted-foreground">
          {totalCharCount >= 50
            ? `${totalCharCount} characters - great detail!`
            : `${totalCharCount} characters. Adding 50+ characters helps other readers discover this book.`}
        </p>
      )}

      {/* Vibe Tags Toggle */}
      <button
        type="button"
        onClick={() => setShowVibeTags(!showVibeTags)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        {showVibeTags ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
        {showVibeTags ? "Hide" : "Add"} vibe tags (optional - helps others find similar books)
      </button>

      {/* Vibe Tags Selection */}
      {showVibeTags && (
        <div className="space-y-4 p-4 rounded-lg border border-input bg-muted/30">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              How would you describe this book&apos;s vibe? ({vibeTags.length}/10)
            </p>
            {vibeTags.length > 0 && (
              <button
                type="button"
                onClick={() => setVibeTags([])}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Selected Tags */}
          {vibeTags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {vibeTags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary text-primary-foreground"
                >
                  {tag.replace("-", " ")}
                  <button
                    type="button"
                    onClick={() => setVibeTags(vibeTags.filter((t) => t !== tag))}
                    className="hover:opacity-70"
                    aria-label={`Remove ${tag}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Tag Categories */}
          <div className="space-y-3">
            {/* Emotional Tone */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">Emotional Tone</p>
              <div className="flex flex-wrap gap-1.5">
                {VIBE_TAGS.emotional.map((tag) => (
                  <VibeTagButton
                    key={tag}
                    tag={tag}
                    isSelected={vibeTags.includes(tag)}
                    onToggle={() => toggleVibeTag(tag)}
                    disabled={vibeTags.length >= 10 && !vibeTags.includes(tag)}
                  />
                ))}
              </div>
            </div>

            {/* Style */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">Pacing & Style</p>
              <div className="flex flex-wrap gap-1.5">
                {VIBE_TAGS.style.map((tag) => (
                  <VibeTagButton
                    key={tag}
                    tag={tag}
                    isSelected={vibeTags.includes(tag)}
                    onToggle={() => toggleVibeTag(tag)}
                    disabled={vibeTags.length >= 10 && !vibeTags.includes(tag)}
                  />
                ))}
              </div>
            </div>

            {/* Character Focus */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">Focus</p>
              <div className="flex flex-wrap gap-1.5">
                {VIBE_TAGS.character.map((tag) => (
                  <VibeTagButton
                    key={tag}
                    tag={tag}
                    isSelected={vibeTags.includes(tag)}
                    onToggle={() => toggleVibeTag(tag)}
                    disabled={vibeTags.length >= 10 && !vibeTags.includes(tag)}
                  />
                ))}
              </div>
            </div>

            {/* Reading Experience */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">Reading Experience</p>
              <div className="flex flex-wrap gap-1.5">
                {VIBE_TAGS.experience.map((tag) => (
                  <VibeTagButton
                    key={tag}
                    tag={tag}
                    isSelected={vibeTags.includes(tag)}
                    onToggle={() => toggleVibeTag(tag)}
                    disabled={vibeTags.length >= 10 && !vibeTags.includes(tag)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

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

// Helper component for vibe tag buttons
function VibeTagButton({
  tag,
  isSelected,
  onToggle,
  disabled,
}: {
  tag: string;
  isSelected: boolean;
  onToggle: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        "px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
        isSelected
          ? "bg-primary text-primary-foreground"
          : "bg-muted hover:bg-muted/80 text-muted-foreground",
        disabled && !isSelected && "opacity-50 cursor-not-allowed"
      )}
    >
      {tag.replace("-", " ")}
    </button>
  );
}
