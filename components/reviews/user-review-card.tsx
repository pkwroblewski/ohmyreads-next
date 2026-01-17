"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ReviewCard } from "./review-card";
import { ReviewForm } from "./review-form";
import { deleteReview } from "@/lib/actions/reviews";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { ReviewWithUser } from "@/types/database";

interface UserReviewCardProps {
  review: ReviewWithUser;
  userId: string;
  bookId: string;
  bookTitle: string;
}

export function UserReviewCard({ review, userId, bookId, bookTitle }: UserReviewCardProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const result = await deleteReview(review.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Review deleted");
        router.refresh();
      }
    } catch {
      toast.error("Failed to delete review");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  if (isEditing) {
    return (
      <div className="p-6 rounded-xl border border-border bg-card">
        <ReviewForm
          bookId={bookId}
          bookTitle={bookTitle}
          existingReview={review}
          onCancel={() => setIsEditing(false)}
          onSuccess={() => {
            setIsEditing(false);
            router.refresh();
          }}
        />
      </div>
    );
  }

  return (
    <>
      <ReviewCard
        review={{
          ...review,
          profile: review.profile || undefined,
        }}
        currentUserId={userId}
        isAuthenticated={true}
        onEdit={() => setIsEditing(true)}
        onDelete={() => setShowDeleteDialog(true)}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Review</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete your review? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
