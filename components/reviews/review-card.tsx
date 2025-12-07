"use client";

import { useState } from "react";
import Link from "next/link";
import { Edit2, Trash2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { RatingDisplay } from "@/components/ui/rating-display";
import { formatRelativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface ReviewUser {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface ReviewWithUser {
  id: string;
  user_id: string;
  book_id: string;
  content: string;
  rating: number;
  likes_count: number;
  is_spoiler: boolean;
  created_at: string;
  updated_at: string;
  profile?: ReviewUser | null;
}

interface ReviewCardProps {
  review: ReviewWithUser;
  currentUserId?: string;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function ReviewCard({
  review,
  currentUserId,
  onEdit,
  onDelete,
}: ReviewCardProps) {
  const [showSpoiler, setShowSpoiler] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const isOwner = currentUserId === review.user_id;
  const isLongContent = review.content.length > 500;
  const displayContent =
    isLongContent && !isExpanded
      ? review.content.slice(0, 500) + "..."
      : review.content;

  const userName =
    review.profile?.display_name || review.profile?.username || "Anonymous";
  const userInitial = userName[0]?.toUpperCase() || "?";
  const userLink = review.profile?.username
    ? `/users/${review.profile.username}`
    : "#";

  return (
    <div
      className={cn(
        "p-6 rounded-xl",
        "bg-card border border-border",
        "transition-shadow hover:shadow-md"
      )}
    >
      {/* Header Row */}
      <div className="flex items-start justify-between mb-4">
        {/* Left side: User info */}
        <div className="flex items-center gap-3">
          <Link href={userLink}>
            <Avatar className="h-10 w-10">
              {review.profile?.avatar_url && (
                <AvatarImage src={review.profile.avatar_url} alt={userName} />
              )}
              <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white">
                {userInitial}
              </AvatarFallback>
            </Avatar>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <Link
                href={userLink}
                className="font-medium hover:text-primary transition-colors"
              >
                {userName}
              </Link>
              <RatingDisplay rating={review.rating} size="sm" showCount={false} />
            </div>
            <p className="text-xs text-muted-foreground">
              {formatRelativeTime(review.created_at)}
              {review.updated_at !== review.created_at && " (edited)"}
            </p>
          </div>
        </div>

        {/* Right side: Edit/Delete buttons */}
        {isOwner && (
          <div className="flex items-center gap-1">
            {onEdit && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onEdit}
                className="h-8 w-8"
                aria-label="Edit review"
              >
                <Edit2 className="h-4 w-4" />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onDelete}
                className="h-8 w-8 hover:text-destructive hover:bg-destructive/10"
                aria-label="Delete review"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Spoiler Warning */}
      {review.is_spoiler && !showSpoiler ? (
        <div className="relative">
          <div className="blur-sm select-none pointer-events-none">
            <p className="text-muted-foreground whitespace-pre-line">
              {displayContent}
            </p>
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/80 backdrop-blur-sm rounded-lg">
            <p className="text-sm font-medium mb-2">
              This review contains spoilers
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSpoiler(true)}
            >
              <Eye className="h-4 w-4 mr-2" />
              Show anyway
            </Button>
          </div>
        </div>
      ) : (
        /* Review Content */
        <div>
          <p className="text-muted-foreground whitespace-pre-line leading-relaxed">
            {displayContent}
          </p>
          {isLongContent && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="mt-2 text-sm text-primary hover:underline"
            >
              {isExpanded ? "Show less" : "Read more"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

