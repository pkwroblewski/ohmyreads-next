"use client";

import { CommentCard } from "./comment-card";
import { CommentForm } from "./comment-form";

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

interface CommentListProps {
  comments: CommentWithUser[];
  currentUserId?: string;
  onReplyClick: (commentId: string) => void;
  replyingTo: string | null;
  reviewId: string;
  onCommentAdded: () => void;
  onCommentDeleted: (commentId: string) => void;
}

export function CommentList({
  comments,
  currentUserId,
  onReplyClick,
  replyingTo,
  reviewId,
  onCommentAdded,
  onCommentDeleted,
}: CommentListProps) {
  // Separate top-level comments and replies
  const topLevelComments = comments.filter((c) => !c.parent_id);
  const repliesByParent = comments.reduce<Record<string, CommentWithUser[]>>(
    (acc, comment) => {
      if (comment.parent_id) {
        if (!acc[comment.parent_id]) {
          acc[comment.parent_id] = [];
        }
        acc[comment.parent_id].push(comment);
      }
      return acc;
    },
    {}
  );

  if (comments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No comments yet. Be the first to comment!
      </p>
    );
  }

  return (
    <div className="divide-y divide-border">
      {topLevelComments.map((comment) => (
        <div key={comment.id}>
          {/* Top-level comment */}
          <CommentCard
            comment={comment}
            currentUserId={currentUserId}
            onReply={() => onReplyClick(comment.id)}
            onDelete={() => onCommentDeleted(comment.id)}
          />

          {/* Reply form */}
          {replyingTo === comment.id && (
            <div className="ml-8 pl-4 border-l-2 border-border pb-3">
              <CommentForm
                reviewId={reviewId}
                parentId={comment.id}
                placeholder={`Reply to ${comment.user?.display_name || comment.user?.username || "this comment"}...`}
                onSuccess={() => {
                  onCommentAdded();
                  onReplyClick(""); // Clear replyingTo
                }}
                onCancel={() => onReplyClick("")}
              />
            </div>
          )}

          {/* Replies */}
          {repliesByParent[comment.id]?.map((reply) => (
            <CommentCard
              key={reply.id}
              comment={reply}
              currentUserId={currentUserId}
              onDelete={() => onCommentDeleted(reply.id)}
              isReply
            />
          ))}
        </div>
      ))}
    </div>
  );
}

