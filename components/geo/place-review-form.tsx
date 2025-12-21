"use client";

import { useState } from "react";
import { Star, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const ATMOSPHERE_TAGS = [
  { id: "cozy", label: "Cozy" },
  { id: "quiet", label: "Quiet" },
  { id: "busy", label: "Busy" },
  { id: "well-lit", label: "Well-lit" },
  { id: "good-coffee", label: "Good Coffee" },
  { id: "great-selection", label: "Great Selection" },
  { id: "helpful-staff", label: "Helpful Staff" },
  { id: "good-for-reading", label: "Good for Reading" },
  { id: "power-outlets", label: "Power Outlets" },
  { id: "wifi", label: "WiFi" },
  { id: "outdoor-seating", label: "Outdoor Seating" },
  { id: "pet-friendly", label: "Pet Friendly" },
];

interface PlaceReviewFormProps {
  placeId: string;
  existingReview?: {
    rating: number;
    content: string | null;
    atmosphere_tags: string[];
  };
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function PlaceReviewForm({
  placeId,
  existingReview,
  onSuccess,
  onCancel,
}: PlaceReviewFormProps) {
  const [rating, setRating] = useState(existingReview?.rating || 0);
  const [hoverRating, setHoverRating] = useState(0);
  const [content, setContent] = useState(existingReview?.content || "");
  const [selectedTags, setSelectedTags] = useState<string[]>(
    existingReview?.atmosphere_tags || []
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTagToggle = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId)
        ? prev.filter((t) => t !== tagId)
        : [...prev, tagId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (rating === 0) {
      setError("Please select a rating");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/geo/places/${placeId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          content: content.trim() || null,
          atmosphereTags: selectedTags,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to submit review");
      }

      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit review");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Rating Stars */}
      <div>
        <label className="text-sm font-medium mb-2 block">Your Rating</label>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              className="p-1 hover:scale-110 transition-transform"
            >
              <Star
                className={cn(
                  "h-7 w-7 transition-colors",
                  (hoverRating || rating) >= star
                    ? "fill-yellow-400 text-yellow-400"
                    : "text-muted-foreground"
                )}
              />
            </button>
          ))}
          <span className="ml-2 text-sm text-muted-foreground">
            {rating > 0 && `${rating} star${rating !== 1 ? "s" : ""}`}
          </span>
        </div>
      </div>

      {/* Review Content */}
      <div>
        <label htmlFor="review-content" className="text-sm font-medium mb-2 block">
          Your Review <span className="text-muted-foreground">(optional)</span>
        </label>
        <Textarea
          id="review-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Share your experience at this place..."
          rows={4}
          maxLength={1000}
        />
        <p className="text-xs text-muted-foreground mt-1">
          {content.length}/1000 characters
        </p>
      </div>

      {/* Atmosphere Tags */}
      <div>
        <label className="text-sm font-medium mb-2 block">
          Atmosphere <span className="text-muted-foreground">(optional)</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {ATMOSPHERE_TAGS.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => handleTagToggle(tag.id)}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm transition-colors",
                selectedTags.includes(tag.id)
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80 text-muted-foreground"
              )}
            >
              {tag.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={isSubmitting || rating === 0}>
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Submitting...
            </>
          ) : existingReview ? (
            "Update Review"
          ) : (
            "Submit Review"
          )}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
