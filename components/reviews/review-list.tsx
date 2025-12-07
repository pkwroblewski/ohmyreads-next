"use client";

import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { ReviewCard } from "./review-card";
import { ReviewForm } from "./review-form";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { deleteReview } from "@/lib/actions/reviews";
import { toast } from "sonner";
import type { Review } from "@/types/database";

interface ReviewUser {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface ReviewWithUser extends Review {
  profile?: ReviewUser | null;
}

interface ReviewListProps {
  reviews: ReviewWithUser[];
  currentUserId?: string;
  emptyMessage?: string;
  bookId?: string;
  bookTitle?: string;
  onReviewUpdated?: () => void;
}

export function ReviewList({
  reviews,
  currentUserId,
  emptyMessage = "No reviews yet. Be the first to review!",
  bookId,
  bookTitle,
  onReviewUpdated,
}: ReviewListProps) {
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null);

  const handleEdit = (reviewId: string) => {
    setEditingReviewId(reviewId);
  };

  const handleCancelEdit = () => {
    setEditingReviewId(null);
  };

  const handleEditSuccess = () => {
    setEditingReviewId(null);
    onReviewUpdated?.();
  };

  const handleDelete = async (reviewId: string) => {
    if (deletingReviewId) return;

    const confirmed = window.confirm(
      "Are you sure you want to delete this review? This action cannot be undone."
    );

    if (!confirmed) return;

    setDeletingReviewId(reviewId);

    try {
      const result = await deleteReview(reviewId);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Review deleted");
        onReviewUpdated?.();
      }
    } catch {
      toast.error("Failed to delete review");
    } finally {
      setDeletingReviewId(null);
    }
  };

  if (reviews.length === 0) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="No reviews yet"
        description={emptyMessage}
      />
    );
  }

  return (
    <div className="space-y-4">
      {reviews.map((review) => {
        const isEditing = editingReviewId === review.id;

        if (isEditing && bookId && bookTitle) {
          return (
            <div
              key={review.id}
              className="p-6 rounded-xl bg-card border border-border"
            >
              <ReviewForm
                bookId={bookId}
                bookTitle={bookTitle}
                existingReview={review}
                onSuccess={handleEditSuccess}
              />
              <div className="mt-4 flex justify-end">
                <Button variant="ghost" onClick={handleCancelEdit}>
                  Cancel
                </Button>
              </div>
            </div>
          );
        }

        return (
          <ReviewCard
            key={review.id}
            review={review}
            currentUserId={currentUserId}
            onEdit={() => handleEdit(review.id)}
            onDelete={() => handleDelete(review.id)}
          />
        );
      })}
    </div>
  );
}

