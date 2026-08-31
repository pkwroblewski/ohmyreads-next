"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, Trash2, AlertTriangle, Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import { adminDeleteReview } from "@/lib/actions/admin-reviews";
import type { ReviewWithDetails } from "@/lib/actions/admin-reviews";

interface ReviewRowActionsProps {
  review: ReviewWithDetails;
}

/**
 * View + delete for one review. These stay together in one island because the
 * view dialog's primary action opens the delete dialog.
 *
 * The version this replaces did `if (result.success) { ...refetch }` with no
 * `else`, so a refused delete left the dialog open, the reason box filled, and
 * no message anywhere.
 */
export function ReviewRowActions({ review }: ReviewRowActionsProps) {
  const router = useRouter();
  const [viewOpen, setViewOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      const result = await adminDeleteReview(review.id, reason);

      if (result.success) {
        toast.success(`Deleted review of "${review.book.title}"`);
        setDeleteOpen(false);
        setReason("");
        router.refresh();
      } else {
        toast.error(result.error || "Could not delete this review");
      }
    });
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setViewOpen(true)}
          title="View review"
        >
          <Eye className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDeleteOpen(true)}
          className="text-destructive hover:text-destructive"
          title="Delete review"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* View Review Dialog */}
      <AlertDialog open={viewOpen} onOpenChange={setViewOpen}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Review Details</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-accent">
                {review.rating != null ? (
                  <>
                    <Star className="h-5 w-5 fill-current" />
                    <span className="font-bold text-lg">{review.rating}</span>
                  </>
                ) : (
                  <span className="text-muted-foreground">No rating</span>
                )}
              </div>
              {review.is_spoiler && (
                <Badge variant="destructive">Contains Spoilers</Badge>
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Book</p>
              <p className="font-medium">{review.book.title}</p>
              <p className="text-sm text-muted-foreground">
                by {review.book.author}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Reviewer</p>
              <p className="font-medium">
                {review.user.display_name || review.user.username}
              </p>
            </div>
            {review.summary && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Summary</p>
                <p>{review.summary}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground mb-1">Full Review</p>
              <div className="max-h-60 overflow-y-auto p-3 rounded-lg bg-muted/50">
                <p className="whitespace-pre-wrap">{review.content}</p>
              </div>
            </div>
            {review.vibe_tags.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Vibe Tags</p>
                <div className="flex flex-wrap gap-1">
                  {review.vibe_tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setViewOpen(false);
                setDeleteOpen(true);
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete Review
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Review
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this review by{" "}
              <strong>{review.user.username}</strong> for{" "}
              <strong>{review.book.title}</strong>? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium">
              Reason for deletion (optional)
            </label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Spam, inappropriate content, harassment..."
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Review"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
