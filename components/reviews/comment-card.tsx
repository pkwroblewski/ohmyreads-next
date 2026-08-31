"use client";

import Link from "next/link";
import { Reply, Trash2 } from "lucide-react";
import { ReportButton } from "@/components/reports/report-dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { formatRelativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

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

interface CommentCardProps {
  comment: CommentWithUser;
  currentUserId?: string;
  onReply?: () => void;
  onDelete?: () => void;
  isReply?: boolean;
}

export function CommentCard({
  comment,
  currentUserId,
  onReply,
  onDelete,
  isReply = false,
}: CommentCardProps) {
  const isOwner = currentUserId === comment.user_id;
  const userName =
    comment.user?.display_name || comment.user?.username || "Anonymous";
  const userInitial = userName[0]?.toUpperCase() || "?";
  const userLink = comment.user?.username
    ? `/users/${comment.user.username}`
    : "#";

  return (
    <div
      className={cn(
        "py-3",
        isReply && "ml-8 pl-4 border-l-2 border-border"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <Link href={userLink}>
          <Avatar className={cn("h-6 w-6", isReply && "h-5 w-5")}>
            {comment.user?.avatar_url && (
              <AvatarImage src={comment.user.avatar_url} alt={userName} />
            )}
            <AvatarFallback
              className={cn(
                "bg-gradient-to-br from-primary to-accent text-white",
                isReply ? "text-[10px]" : "text-xs"
              )}
            >
              {userInitial}
            </AvatarFallback>
          </Avatar>
        </Link>
        <Link
          href={userLink}
          className={cn(
            "font-medium hover:text-primary transition-colors",
            isReply ? "text-xs" : "text-sm"
          )}
        >
          {userName}
        </Link>
        <span
          className={cn(
            "text-muted-foreground",
            isReply ? "text-[10px]" : "text-xs"
          )}
        >
          · {formatRelativeTime(comment.created_at)}
        </span>
      </div>

      {/* Content */}
      <p
        className={cn(
          "text-muted-foreground mb-2",
          isReply ? "text-xs" : "text-sm"
        )}
      >
        {comment.content}
      </p>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Reply button - only for top-level comments */}
        {!isReply && onReply && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReply}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <Reply className="h-3 w-3 mr-1" />
            Reply
          </Button>
        )}

        {/* Delete button - only for owner */}
        {isOwner && onDelete && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-3 w-3 mr-1" aria-hidden="true" />
            Delete
          </Button>
        )}

        {/* Report - for signed-in readers who did not write it */}
        {!isOwner && currentUserId && (
          <ReportButton
            targetType="comment"
            targetId={comment.id}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          />
        )}
      </div>
    </div>
  );
}

