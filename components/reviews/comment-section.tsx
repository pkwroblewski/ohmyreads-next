"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { CommentForm } from "./comment-form";
import { CommentList } from "./comment-list";
import { deleteComment } from "@/lib/actions/comments";
import { toast } from "sonner";

interface CommentUser {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface CommentWithUser {
  id: string;
  review_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  user?: CommentUser | null;
}

interface CommentSectionProps {
  reviewId: string;
  initialComments: CommentWithUser[];
  currentUserId?: string;
}

export function CommentSection({
  reviewId,
  initialComments,
  currentUserId,
}: CommentSectionProps) {
  const [comments, setComments] = useState<CommentWithUser[]>(initialComments);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(initialComments.length > 0);

  const handleCommentAdded = () => {
    // In a real app, you'd refetch comments here
    // For now, the page will revalidate on next navigation
    // We could also optimistically add the comment
    window.location.reload();
  };

  const handleCommentDeleted = async (commentId: string) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this comment?"
    );
    if (!confirmed) return;

    try {
      const result = await deleteComment(commentId);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Comment deleted");
        setComments((prev) =>
          prev.filter(
            (c) => c.id !== commentId && c.parent_id !== commentId
          )
        );
      }
    } catch {
      toast.error("Failed to delete comment");
    }
  };

  const handleReplyClick = (commentId: string) => {
    setReplyingTo(commentId === replyingTo ? null : commentId);
  };

  return (
    <div className="mt-4 pt-4 border-t border-border">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
      >
        <MessageCircle className="h-4 w-4" />
        <span>
          {comments.length} comment{comments.length !== 1 ? "s" : ""}
        </span>
      </button>

      {isExpanded && (
        <>
          {/* New comment form */}
          {currentUserId && (
            <div className="mb-4">
              <CommentForm
                reviewId={reviewId}
                onSuccess={handleCommentAdded}
                placeholder="Add a comment..."
              />
            </div>
          )}

          {/* Comments list */}
          <CommentList
            comments={comments}
            currentUserId={currentUserId}
            onReplyClick={handleReplyClick}
            replyingTo={replyingTo}
            reviewId={reviewId}
            onCommentAdded={handleCommentAdded}
            onCommentDeleted={handleCommentDeleted}
          />
        </>
      )}
    </div>
  );
}

