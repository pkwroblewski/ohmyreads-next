"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { BookOpen, Heart, MessageCircle, Share2, Star, MoreHorizontal, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage, getInitials } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CoverImage } from "@/components/books/cover-image";
import { cn } from "@/lib/utils";
import { toggleReviewLike } from "@/lib/actions/reviews";
import type { ActivityFeedItemWithRelations } from "@/types/database";

interface ActivityCardProps {
  item: ActivityFeedItemWithRelations;
  isAuthenticated?: boolean;
  initialHasLiked?: boolean;
}

export function ActivityCard({ item, isAuthenticated = false, initialHasLiked = false }: ActivityCardProps) {
  const displayName = item.user.display_name || item.user.username || "Reader";
  const timeAgo = formatDistanceToNow(new Date(item.created_at), { addSuffix: true });

  if (item.type === "started_reading") {
    return <StartedReadingCard item={item} displayName={displayName} timeAgo={timeAgo} />;
  }

  if (item.type === "checkin") {
    return <CheckinCard item={item} displayName={displayName} timeAgo={timeAgo} />;
  }

  return (
    <ReviewCard
      item={item}
      displayName={displayName}
      timeAgo={timeAgo}
      isAuthenticated={isAuthenticated}
      initialHasLiked={initialHasLiked}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Started Reading Card
// ─────────────────────────────────────────────────────────────────────────
function StartedReadingCard({
  item,
  displayName,
  timeAgo,
}: {
  item: ActivityFeedItemWithRelations;
  displayName: string;
  timeAgo: string;
}) {
  const book = item.book;
  if (!book) return null;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <Link href={`/users/${item.user.username || item.user.id}`}>
            <Avatar size="md">
              {item.user.avatar_url ? (
                <AvatarImage src={item.user.avatar_url} alt={displayName} />
              ) : (
                <AvatarFallback initials={getInitials(displayName)} />
              )}
            </Avatar>
          </Link>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={`/users/${item.user.username || item.user.id}`}
                className="font-medium hover:text-primary transition-colors"
              >
                {displayName}
              </Link>
              <span className="text-muted-foreground">started reading</span>
            </div>
            <p className="text-xs text-muted-foreground">{timeAgo}</p>
          </div>

          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>

        {/* Book Card */}
        <Link
          href={`/books/${book.slug}`}
          className="mt-3 flex gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors group"
        >
          {/* Cover */}
          <CoverImage
            book={book}
            size="xs"
            width={48}
            height={72}
            hover={false}
            className="flex-shrink-0"
          />

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm line-clamp-2 group-hover:text-primary transition-colors">
              {book.title}
            </h4>
            <p className="text-xs text-muted-foreground truncate">{book.author}</p>
          </div>
        </Link>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Check-in Card
// ─────────────────────────────────────────────────────────────────────────
function CheckinCard({
  item,
  displayName,
  timeAgo,
}: {
  item: ActivityFeedItemWithRelations;
  displayName: string;
  timeAgo: string;
}) {
  const place = item.place;
  const checkin = item.checkin;

  if (!place) return null;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <Link href={`/users/${item.user.username || item.user.id}`}>
            <Avatar size="md">
              {item.user.avatar_url ? (
                <AvatarImage src={item.user.avatar_url} alt={displayName} />
              ) : (
                <AvatarFallback initials={getInitials(displayName)} />
              )}
            </Avatar>
          </Link>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={`/users/${item.user.username || item.user.id}`}
                className="font-medium hover:text-primary transition-colors"
              >
                {displayName}
              </Link>
              <span className="text-muted-foreground">checked in at</span>
              <Link
                href="/community/map"
                className="font-medium hover:text-primary transition-colors truncate max-w-[200px]"
              >
                {place.name}
              </Link>
            </div>
            <p className="text-xs text-muted-foreground">{timeAgo}</p>
          </div>

          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>

        {/* Place Card */}
        <div className="mt-3 p-3 rounded-lg bg-muted/50">
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-primary" />
            <span className="font-medium">{place.name}</span>
            <span className="text-muted-foreground capitalize">({place.place_type})</span>
          </div>

          {/* Note if present */}
          {checkin?.note && (
            <p className="mt-2 text-sm text-muted-foreground">{checkin.note}</p>
          )}

          {/* Book if attached */}
          {item.book && (
            <Link
              href={`/books/${item.book.slug}`}
              className="mt-3 flex gap-3 p-2 rounded-lg bg-background hover:bg-muted/50 transition-colors group"
            >
              <CoverImage
                book={item.book}
                size="xs"
                width={40}
                height={60}
                hover={false}
                className="flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-0.5">Currently reading</p>
                <h4 className="font-medium text-sm line-clamp-1 group-hover:text-primary transition-colors">
                  {item.book.title}
                </h4>
                <p className="text-xs text-muted-foreground truncate">{item.book.author}</p>
              </div>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Review Card
// ─────────────────────────────────────────────────────────────────────────
function ReviewCard({
  item,
  displayName,
  timeAgo,
  isAuthenticated = false,
  initialHasLiked = false,
}: {
  item: ActivityFeedItemWithRelations;
  displayName: string;
  timeAgo: string;
  isAuthenticated?: boolean;
  initialHasLiked?: boolean;
}) {
  const review = item.review;
  const book = item.book;

  const [hasLiked, setHasLiked] = useState(initialHasLiked);
  const [likesCount, setLikesCount] = useState(review?.likes_count || 0);
  const [isPending, startTransition] = useTransition();

  if (!book) return null;

  const handleLike = () => {
    console.log("handleLike called", { isAuthenticated, reviewId: review?.id });
    if (!isAuthenticated) {
      console.log("Not authenticated, showing toast");
      toast.error("Please sign in to like reviews");
      return;
    }
    if (!review?.id) {
      console.log("No review.id, showing error toast");
      toast.error("Unable to like this review");
      return;
    }
    console.log("Calling toggleReviewLike with id:", review.id);

    startTransition(async () => {
      const result = await toggleReviewLike(review.id);
      console.log("toggleReviewLike result:", result);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setHasLiked(result.liked);
      setLikesCount((prev) => (result.liked ? prev + 1 : prev - 1));
      toast.success(result.liked ? "Liked!" : "Unliked");
    });
  };

  const handleShare = async () => {
    console.log("handleShare called", { bookSlug: book.slug });
    const shareUrl = `${window.location.origin}/books/${book.slug}`;
    const shareData = {
      title: `Review of ${book.title}`,
      text: `Check out this review of "${book.title}" on OhMyReads`,
      url: shareUrl,
    };

    if (navigator.share && navigator.canShare?.(shareData)) {
      console.log("Using native share API");
      try {
        await navigator.share(shareData);
      } catch (err) {
        // User cancelled or share failed, fall back to clipboard
        if ((err as Error).name !== "AbortError") {
          copyToClipboard(shareUrl);
        }
      }
    } else {
      console.log("Falling back to clipboard copy");
      copyToClipboard(shareUrl);
    }
  };

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard!");
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <Link href={`/users/${item.user.username || item.user.id}`}>
            <Avatar size="md">
              {item.user.avatar_url ? (
                <AvatarImage src={item.user.avatar_url} alt={displayName} />
              ) : (
                <AvatarFallback initials={getInitials(displayName)} />
              )}
            </Avatar>
          </Link>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={`/users/${item.user.username || item.user.id}`}
                className="font-medium hover:text-primary transition-colors"
              >
                {displayName}
              </Link>
              <span className="text-muted-foreground">reviewed</span>
              <Link
                href={`/books/${book.slug}`}
                className="font-medium hover:text-primary transition-colors truncate max-w-[200px]"
              >
                {book.title}
              </Link>
            </div>
            <p className="text-xs text-muted-foreground">{timeAgo}</p>
          </div>

          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>

        {/* Review Content */}
        <div className="mt-3 flex gap-3">
          {/* Cover */}
          <Link href={`/books/${book.slug}`} className="flex-shrink-0 group">
            <CoverImage
              book={book}
              size="sm"
              width={64}
              height={96}
              hover={true}
            />
          </Link>

          {/* Review Text */}
          <div className="flex-1 min-w-0">
            {/* Rating */}
            {review && (
              <div className="flex items-center gap-0.5 mb-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={cn(
                      "w-4 h-4",
                      star <= review.rating
                        ? "fill-accent text-accent"
                        : "text-muted-foreground"
                    )}
                  />
                ))}
              </div>
            )}

            {/* Content */}
            {review?.content && (
              <p className="text-sm line-clamp-3">{review.content}</p>
            )}

            {/* Read more link */}
            <Link
              href={`/books/${book.slug}#reviews`}
              className="text-sm text-primary hover:underline mt-1 inline-block"
            >
              Read Full Review
            </Link>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-4 flex items-center gap-4 text-muted-foreground">
          <button
            type="button"
            onClick={handleLike}
            disabled={isPending}
            className={cn(
              "flex items-center gap-1.5 text-sm transition-colors",
              hasLiked ? "text-red-500" : "hover:text-primary",
              isPending && "opacity-50 cursor-not-allowed"
            )}
          >
            <Heart className={cn("w-4 h-4", hasLiked && "fill-current")} />
            <span>{likesCount > 0 ? likesCount : "Like"}</span>
          </button>
          <Link
            href={`/books/${book.slug}#reviews`}
            className="flex items-center gap-1.5 text-sm hover:text-primary transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Comment</span>
          </Link>
          <button
            type="button"
            onClick={handleShare}
            className="flex items-center gap-1.5 text-sm hover:text-primary transition-colors"
          >
            <Share2 className="w-4 h-4" />
            <span>Share</span>
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

