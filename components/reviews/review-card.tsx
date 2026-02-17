"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Star,
  ThumbsUp,
  MessageCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  Edit,
  Trash2,
} from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { RelativeTime } from "@/components/ui/relative-time";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { toggleReviewLike } from "@/lib/actions/reviews";
import type { Review } from "@/types/database";

interface ReviewUser {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  is_admin?: boolean;
}

interface ReviewCardProps {
  review: Review & {
    profile?: ReviewUser | null;
    hasLiked?: boolean;
  };
  showBookInfo?: {
    title: string;
    slug: string;
  };
  onCommentClick?: () => void;
  isAuthenticated?: boolean;
  currentUserId?: string;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function ReviewCard({
  review,
  showBookInfo,
  onCommentClick,
  isAuthenticated = false,
  currentUserId,
  onEdit,
  onDelete,
}: ReviewCardProps) {
  const [likesCount, setLikesCount] = useState(review.likes_count);
  const [hasLiked, setHasLiked] = useState(review.hasLiked || false);
  const [isLiking, setIsLiking] = useState(false);
  const [showSpoiler, setShowSpoiler] = useState(false);
  const [showFullReview, setShowFullReview] = useState(false);


  const profile = review.profile;
  const displayName = profile?.display_name || profile?.username || "Anonymous";

  const isOwner = currentUserId && review.user_id === currentUserId;

  // Check if review has structured content
  const hasStructuredContent =
    review.summary || review.liked || review.disliked || review.takeaway;

  // Calculate if content is long
  const totalContentLength =
    (review.summary?.length || 0) +
    (review.liked?.length || 0) +
    (review.disliked?.length || 0) +
    (review.takeaway?.length || 0) +
    (review.content?.length || 0);
  const isLongContent = totalContentLength > 500;

  const handleLike = async () => {
    if (!isAuthenticated && !currentUserId) {
      toast.error("Please sign in to like reviews");
      return;
    }

    setIsLiking(true);
    try {
      const result = await toggleReviewLike(review.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        setHasLiked(result.liked);
        setLikesCount((prev) => (result.liked ? prev + 1 : prev - 1));
      }
    } catch {
      toast.error("Failed to update like");
    } finally {
      setIsLiking(false);
    }
  };

  // Render spoiler warning
  if (review.is_spoiler && !showSpoiler) {
    return (
      <div className="p-6 rounded-xl border bg-card">
        <div className="flex items-center gap-3 text-amber-600 dark:text-amber-500">
          <AlertTriangle className="h-5 w-5" />
          <span className="font-medium">This review contains spoilers</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowSpoiler(true)}
          className="mt-3"
        >
          Show Review
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 rounded-xl border bg-card">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          {profile ? (
            <Link href={`/users/${profile.username}`}>
              <Avatar className="h-10 w-10">
                {profile.avatar_url && (
                  <AvatarImage src={profile.avatar_url} alt={displayName} />
                )}
                <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white">
                  {displayName[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </Link>
          ) : (
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-muted">?</AvatarFallback>
            </Avatar>
          )}
          <div>
            {profile ? (
              <Link
                href={`/users/${profile.username}`}
                className="font-medium hover:text-primary transition-colors"
              >
                {displayName}
              </Link>
            ) : (
              <span className="font-medium text-muted-foreground">Anonymous</span>
            )}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RelativeTime date={review.created_at} />
              {review.is_spoiler && (
                <span className="text-amber-600 dark:text-amber-500 text-xs">
                  • Contains spoilers
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Rating */}
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={cn(
                  "h-4 w-4",
                  star <= review.rating
                    ? "text-accent fill-accent"
                    : "text-muted-foreground/30"
                )}
              />
            ))}
          </div>

          {/* Owner menu */}
          {isOwner && (onEdit || onDelete) && (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={4}
                  className="w-32 py-1 bg-popover border rounded-md shadow-md z-50"
                >
                  {onEdit && (
                    <DropdownMenu.Item
                      onSelect={onEdit}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-muted outline-none cursor-pointer"
                    >
                      <Edit className="h-3.5 w-3.5" />
                      Edit
                    </DropdownMenu.Item>
                  )}
                  {onDelete && (
                    <DropdownMenu.Item
                      onSelect={onDelete}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-destructive hover:bg-muted outline-none cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </DropdownMenu.Item>
                  )}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          )}
        </div>
      </div>

      {/* Book info if provided */}
      {showBookInfo && (
        <Link
          href={`/books/${showBookInfo.slug}`}
          className="inline-block mb-3 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          Review for: <span className="font-medium">{showBookInfo.title}</span>
        </Link>
      )}

      {/* Review Content */}
      <div
        className={cn(
          "space-y-4",
          isLongContent && !showFullReview && "max-h-[300px] overflow-hidden relative"
        )}
      >
        {/* Structured Review Fields */}
        {hasStructuredContent ? (
          <>
            {review.summary && (
              <div>
                <p className="text-foreground whitespace-pre-wrap">
                  {review.summary}
                </p>
              </div>
            )}

            {review.liked && (
              <div className="pl-4 border-l-2 border-green-500/30">
                <p className="text-sm font-medium text-green-600 dark:text-green-500 mb-1">
                  What I liked
                </p>
                <p className="text-muted-foreground text-sm whitespace-pre-wrap">
                  {review.liked}
                </p>
              </div>
            )}

            {review.disliked && (
              <div className="pl-4 border-l-2 border-red-500/30">
                <p className="text-sm font-medium text-red-600 dark:text-red-500 mb-1">
                  What I didn&apos;t like
                </p>
                <p className="text-muted-foreground text-sm whitespace-pre-wrap">
                  {review.disliked}
                </p>
              </div>
            )}

            {review.takeaway && (
              <div className="pl-4 border-l-2 border-primary/30">
                <p className="text-sm font-medium text-primary mb-1">
                  Key Takeaway
                </p>
                <p className="text-muted-foreground text-sm whitespace-pre-wrap">
                  {review.takeaway}
                </p>
              </div>
            )}
          </>
        ) : (
          // Legacy content field
          review.content && (
            <p className="text-foreground whitespace-pre-wrap">{review.content}</p>
          )
        )}

        {/* Gradient overlay for long content */}
        {isLongContent && !showFullReview && (
          <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-card to-transparent" />
        )}
      </div>

      {/* Show more/less button */}
      {isLongContent && (
        <button
          onClick={() => setShowFullReview(!showFullReview)}
          className="flex items-center gap-1 text-sm text-primary hover:underline mt-2"
        >
          {showFullReview ? (
            <>
              <ChevronUp className="h-4 w-4" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4" />
              Read full review
            </>
          )}
        </button>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 mt-4 pt-4 border-t">
        <button
          onClick={handleLike}
          disabled={isLiking}
          className={cn(
            "flex items-center gap-2 text-sm transition-colors",
            hasLiked
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <ThumbsUp
            className={cn("h-4 w-4", hasLiked && "fill-current")}
          />
          <span>
            {likesCount > 0 ? `${likesCount} helpful` : "Helpful"}
          </span>
        </button>

        {onCommentClick && (
          <button
            onClick={onCommentClick}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <MessageCircle className="h-4 w-4" />
            <span>Comment</span>
          </button>
        )}
      </div>
    </div>
  );
}
