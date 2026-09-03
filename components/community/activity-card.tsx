"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Heart, MessageCircle, Share2, Star, MoreHorizontal, MapPin, Link2, Flag } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage, getInitials } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CoverImage } from "@/components/books/cover-image";
import { RelativeTime } from "@/components/ui/relative-time";
import { cn } from "@/lib/utils";
import { toggleReviewLike } from "@/lib/actions/reviews";
import { ReportDialog } from "@/components/reports/report-dialog";
import type { ActivityFeedItemWithRelations } from "@/types/database";

interface ActivityCardProps {
  item: ActivityFeedItemWithRelations;
  isAuthenticated?: boolean;
  initialHasLiked?: boolean;
  /** Signed-in reader, so their own review does not offer "Report". */
  currentUserId?: string;
}

export function ActivityCard({
  item,
  isAuthenticated = false,
  initialHasLiked = false,
  currentUserId,
}: ActivityCardProps) {
  const displayName = item.user.display_name || item.user.username || "Reader";
  const createdAt = item.created_at;

  if (item.type === "started_reading") {
    return <StartedReadingCard item={item} displayName={displayName} createdAt={createdAt} />;
  }

  if (item.type === "checkin") {
    return <CheckinCard item={item} displayName={displayName} createdAt={createdAt} />;
  }

  return (
    <ReviewCard
      item={item}
      displayName={displayName}
      createdAt={createdAt}
      isAuthenticated={isAuthenticated}
      initialHasLiked={initialHasLiked}
      currentUserId={currentUserId}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Started Reading Card
// ─────────────────────────────────────────────────────────────────────────
function StartedReadingCard({
  item,
  displayName,
  createdAt,
}: {
  item: ActivityFeedItemWithRelations;
  displayName: string;
  createdAt: string;
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
            <RelativeTime date={createdAt} className="text-xs text-muted-foreground" />
          </div>

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
  createdAt,
}: {
  item: ActivityFeedItemWithRelations;
  displayName: string;
  createdAt: string;
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
            <RelativeTime date={createdAt} className="text-xs text-muted-foreground" />
          </div>

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
  createdAt,
  isAuthenticated = false,
  initialHasLiked = false,
  currentUserId,
}: {
  item: ActivityFeedItemWithRelations;
  displayName: string;
  createdAt: string;
  isAuthenticated?: boolean;
  initialHasLiked?: boolean;
  currentUserId?: string;
}) {
  const review = item.review;
  const book = item.book;

  const [hasLiked, setHasLiked] = useState(initialHasLiked);
  const [likesCount, setLikesCount] = useState(review?.likes_count || 0);
  const [reportOpen, setReportOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!book) return null;

  // Only a review has a reportable target. The server refuses self-reports
  // too; hiding the item just saves the reader a pointless dialog.
  const reviewId = review?.id;
  const isOwn = Boolean(currentUserId && item.user_id === currentUserId);
  const canReport = Boolean(reviewId && (isAuthenticated || currentUserId) && !isOwn);

  const reviewUrl = () => `${window.location.origin}/books/${book.slug}#reviews`;

  const handleLike = () => {
    if (!isAuthenticated) {
      toast.error("Please sign in to like reviews");
      return;
    }
    if (!review?.id) {
      toast.error("Unable to like this review");
      return;
    }

    startTransition(async () => {
      const result = await toggleReviewLike(review.id);
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
    const shareUrl = `${window.location.origin}/books/${book.slug}`;
    const shareData = {
      title: `Review of ${book.title}`,
      text: `Check out this review of "${book.title}" on OhMyReads`,
      url: shareUrl,
    };

    if (navigator.share && navigator.canShare?.(shareData)) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        // User cancelled or share failed, fall back to clipboard
        if ((err as Error).name !== "AbortError") {
          copyToClipboard(shareUrl);
        }
      }
    } else {
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
            <RelativeTime date={createdAt} className="text-xs text-muted-foreground" />
          </div>

          {/* Overflow menu: copy link for everyone, report for signed-in
              readers looking at someone else's review. Started-reading and
              check-in cards have no reportable target, so they carry no menu. */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                aria-label="More options"
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={4}
                className="w-36 py-1 bg-popover border rounded-md shadow-md z-50"
              >
                <DropdownMenu.Item
                  onSelect={() => copyToClipboard(reviewUrl())}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-muted outline-none cursor-pointer"
                >
                  <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Copy link
                </DropdownMenu.Item>
                {canReport && (
                  <DropdownMenu.Item
                    onSelect={() => setReportOpen(true)}
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-destructive hover:bg-muted outline-none cursor-pointer"
                  >
                    <Flag className="h-3.5 w-3.5" aria-hidden="true" />
                    Report
                  </DropdownMenu.Item>
                )}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>

        {canReport && reviewId && (
          <ReportDialog
            targetType="review"
            targetId={reviewId}
            open={reportOpen}
            onOpenChange={setReportOpen}
          />
        )}

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
            {review && review.rating != null && (
              <div
                className="flex items-center gap-0.5 mb-2"
                role="img"
                aria-label={`${review.rating} out of 5`}
              >
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    aria-hidden="true"
                    className={cn(
                      "w-4 h-4",
                      star <= review.rating!
                        ? "fill-star text-star"
                        : "text-muted-foreground/30"
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

        {/* Actions. Same heart + "Like" + liked colour as ReviewCard, so the
            one action reads the same in the feed and under a review. */}
        <div className="mt-4 flex items-center gap-4 text-muted-foreground">
          <button
            type="button"
            onClick={handleLike}
            disabled={isPending}
            aria-pressed={hasLiked}
            className={cn(
              "flex items-center gap-1.5 text-sm transition-colors",
              hasLiked ? "text-primary" : "hover:text-foreground",
              isPending && "opacity-50 cursor-not-allowed"
            )}
          >
            <Heart className={cn("w-4 h-4", hasLiked && "fill-current")} aria-hidden="true" />
            <span>
              {likesCount > 0
                ? `${likesCount} ${likesCount === 1 ? "like" : "likes"}`
                : "Like"}
            </span>
          </button>
          <Link
            href={`/books/${book.slug}#reviews`}
            className="flex items-center gap-1.5 text-sm hover:text-foreground transition-colors"
          >
            <MessageCircle className="w-4 h-4" aria-hidden="true" />
            <span>Comment</span>
          </Link>
          <button
            type="button"
            onClick={handleShare}
            className="flex items-center gap-1.5 text-sm hover:text-foreground transition-colors"
          >
            <Share2 className="w-4 h-4" aria-hidden="true" />
            <span>Share</span>
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

