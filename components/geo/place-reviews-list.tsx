"use client";

import { useState, useEffect } from "react";
import { Star, Loader2, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PlaceReviewForm } from "./place-review-form";

interface Review {
  id: string;
  rating: number;
  content: string | null;
  atmosphere_tags: string[];
  created_at: string;
  updated_at: string;
  user: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface PlaceReviewsListProps {
  placeId: string;
  currentUserId?: string;
}

export function PlaceReviewsList({ placeId, currentUserId }: PlaceReviewsListProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<{ averageRating: number | null; reviewsCount: number }>({
    averageRating: null,
    reviewsCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [userReview, setUserReview] = useState<Review | null>(null);

  const fetchReviews = async () => {
    try {
      const response = await fetch(`/api/geo/places/${placeId}/reviews`);
      if (response.ok) {
        const data = await response.json();
        setReviews(data.reviews || []);
        setStats(data.stats || { averageRating: null, reviewsCount: 0 });

        // Find current user's review if any
        if (currentUserId) {
          const found = data.reviews?.find((r: Review) => r.user.id === currentUserId);
          setUserReview(found || null);
        }
      }
    } catch (error) {
      console.error("Error fetching reviews:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [placeId, currentUserId]);

  const handleReviewSuccess = () => {
    setShowReviewForm(false);
    fetchReviews();
  };

  const handleDeleteReview = async () => {
    if (!confirm("Are you sure you want to delete your review?")) return;

    try {
      const response = await fetch(`/api/geo/places/${placeId}/reviews`, {
        method: "DELETE",
      });
      if (response.ok) {
        fetchReviews();
      }
    } catch (error) {
      console.error("Error deleting review:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Summary */}
      {stats.reviewsCount > 0 && (
        <div className="flex items-center gap-3 pb-3 border-b">
          <div className="flex items-center gap-1">
            <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
            <span className="font-semibold text-lg">
              {stats.averageRating?.toFixed(1)}
            </span>
          </div>
          <span className="text-muted-foreground">
            {stats.reviewsCount} review{stats.reviewsCount !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* Add/Edit Review Button */}
      {currentUserId && !showReviewForm && (
        <div className="pb-3">
          {userReview ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowReviewForm(true)}
              >
                Edit Your Review
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={handleDeleteReview}
              >
                Delete
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowReviewForm(true)}
            >
              Write a Review
            </Button>
          )}
        </div>
      )}

      {/* Review Form */}
      {showReviewForm && currentUserId && (
        <div className="pb-4 border-b">
          <PlaceReviewForm
            placeId={placeId}
            existingReview={
              userReview
                ? {
                    rating: userReview.rating,
                    content: userReview.content,
                    atmosphere_tags: userReview.atmosphere_tags,
                  }
                : undefined
            }
            onSuccess={handleReviewSuccess}
            onCancel={() => setShowReviewForm(false)}
          />
        </div>
      )}

      {/* Reviews List */}
      {reviews.length === 0 ? (
        <p className="text-center text-muted-foreground py-6">
          No reviews yet. Be the first to share your experience!
        </p>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              isCurrentUser={review.user.id === currentUserId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewCard({
  review,
  isCurrentUser,
}: {
  review: Review;
  isCurrentUser: boolean;
}) {
  const displayName = review.user.display_name || review.user.username || "Anonymous";

  return (
    <div className={cn("space-y-2", isCurrentUser && "bg-muted/50 rounded-lg p-3 -mx-3")}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <Avatar className="h-9 w-9">
          {review.user.avatar_url && (
            <AvatarImage src={review.user.avatar_url} alt={displayName} />
          )}
          <AvatarFallback>
            <User className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">
              {displayName}
              {isCurrentUser && (
                <span className="text-muted-foreground font-normal"> (You)</span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={cn(
                    "h-3.5 w-3.5",
                    star <= review.rating
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-muted-foreground/30"
                  )}
                />
              ))}
            </div>
            <span className="text-xs text-muted-foreground">
              {new Date(review.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      {review.content && (
        <p className="text-sm text-muted-foreground pl-12">{review.content}</p>
      )}

      {/* Atmosphere Tags */}
      {review.atmosphere_tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pl-12">
          {review.atmosphere_tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 bg-muted rounded-full text-xs text-muted-foreground"
            >
              {tag.replace(/-/g, " ")}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
