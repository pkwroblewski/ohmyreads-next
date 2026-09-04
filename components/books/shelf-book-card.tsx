"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  BookOpen,
  Check,
  Bookmark,
  MoreVertical,
  Trash2,
  Star,
  FolderPlus,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RatingDisplay } from "@/components/ui/rating-display";
import { CoverImage } from "@/components/books/cover-image";
import { addToShelf, removeFromShelf } from "@/lib/actions/books";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AddToShelfModal } from "@/components/shelves/add-to-shelf-modal";
import { UpdateProgressDialog } from "@/components/books/update-progress-dialog";
import type { BookSummary, UserBook } from "@/types/database";

interface ShelfBookCardProps {
  userBook: UserBook;
  book: BookSummary | null;
}

type ShelfStatus = "want_to_read" | "reading" | "read";

const statusConfig: Record<
  ShelfStatus,
  { label: string; icon: typeof BookOpen; color: string }
> = {
  want_to_read: {
    label: "Want to Read",
    icon: Bookmark,
    color: "text-muted-foreground",
  },
  reading: {
    label: "Reading",
    icon: BookOpen,
    color: "text-accent",
  },
  read: {
    label: "Read",
    icon: Check,
    color: "text-primary",
  },
};

export function ShelfBookCard({ userBook, book }: ShelfBookCardProps) {
  const [isPending, startTransition] = useTransition();
  const [currentStatus, setCurrentStatus] = useState<ShelfStatus>(
    userBook.status as ShelfStatus
  );
  const [isShelfModalOpen, setIsShelfModalOpen] = useState(false);
  const [isProgressOpen, setIsProgressOpen] = useState(false);
  // Optimistic progress state, reconciled by revalidation on refresh
  const [progress, setProgress] = useState<{
    page: number | null;
    total: number | null;
    pct: number | null;
  }>({
    page: userBook.current_page ?? null,
    total: userBook.total_pages ?? null,
    pct: userBook.progress_percentage ?? null,
  });
  if (!book) return null;

  const config = statusConfig[currentStatus];
  const StatusIcon = config.icon;

  const handleStatusChange = (newStatus: ShelfStatus) => {
    // Optimistic update
    const previousStatus = currentStatus;
    setCurrentStatus(newStatus);

    startTransition(async () => {
      const result = await addToShelf(book.id, newStatus);

      if (!result.success) {
        // Revert on error
        setCurrentStatus(previousStatus);
        toast.error(result.error);
      } else {
        toast.success(`Moved to "${statusConfig[newStatus].label}"`);
        result.newBadges?.forEach((badge) => {
          toast.success(`Badge unlocked: ${badge.icon ?? "🏅"} ${badge.name}`);
        });
      }
    });
  };

  const handleRemove = () => {
    startTransition(async () => {
      const result = await removeFromShelf(book.id);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Removed from shelf");
        // The page will revalidate and remove this card
      }
    });
  };

  return (
    <div
      className={cn(
        "group relative rounded-xl overflow-hidden",
        "bg-card border border-border",
        "transition-all hover:shadow-lg hover:border-primary/30",
        isPending && "opacity-50 pointer-events-none"
      )}
    >
      {/* Book Cover */}
      <Link href={`/books/${book.slug}`} className="block relative group">
        <div className="relative aspect-[2/3]">
          <CoverImage
            book={book}
            fill={true}
            className="rounded-none rounded-t-xl"
          />

          {/* Status Badge */}
          <div
            className={cn(
              "absolute top-2 left-2 flex items-center gap-1 z-10",
              "px-2 py-1 rounded-full text-xs font-medium",
              "bg-background/90 backdrop-blur-sm",
              config.color
            )}
          >
            <StatusIcon className="h-3 w-3" aria-hidden="true" />
            {config.label}
          </div>

          {/* Rating Badge — bottom corner, clear of the always-visible menu button */}
          {userBook.rating && (
            <div className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-background/90 backdrop-blur-sm z-10">
              <Star className="h-3 w-3 fill-star text-star" aria-hidden="true" />
              <span className="sr-only">Your rating:</span>
              {userBook.rating}
            </div>
          )}
        </div>
      </Link>

      {/* Book Info */}
      <div className="p-3">
        <Link href={`/books/${book.slug}`}>
          <h3 className="font-medium text-sm line-clamp-2 mb-1 hover:text-primary transition-colors">
            {book.title}
          </h3>
        </Link>
        <p className="text-xs text-muted-foreground line-clamp-1 mb-2">
          {book.author}
        </p>

        {/* Book Rating — this site's own when readers here have rated it,
            otherwise the labelled Open Library figure (same rule as BookCard) */}
        {book.local_average_rating != null && book.local_ratings_count > 0 ? (
          <div className="mb-2">
            <RatingDisplay
              rating={book.local_average_rating}
              count={book.local_ratings_count}
              size="sm"
              source="local"
            />
          </div>
        ) : book.average_rating ? (
          <div className="mb-2">
            <RatingDisplay
              rating={book.average_rating}
              count={book.ratings_count ?? undefined}
              size="sm"
              source="external"
            />
          </div>
        ) : null}

        {/* Date Info */}
        <p className="text-xs text-muted-foreground">
          {currentStatus === "read" && userBook.finished_at
            ? `Finished ${formatDate(userBook.finished_at)}`
            : currentStatus === "reading" && userBook.started_at
              ? `Started ${formatDate(userBook.started_at)}`
              : `Added ${formatDate(userBook.created_at)}`}
        </p>

        {/* Reading Progress */}
        {currentStatus === "reading" && (
          <button
            type="button"
            onClick={() => setIsProgressOpen(true)}
            aria-label={`Update reading progress for ${book.title}`}
            className="mt-2 w-full text-left group/progress cursor-pointer"
          >
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span className="flex items-center gap-1">
                {progress.page !== null
                  ? `Page ${progress.page}${progress.total ? ` of ${progress.total}` : ""}`
                  : "Update progress"}
                <Pencil
                  className="h-3 w-3 opacity-0 group-hover/progress:opacity-100 transition-opacity"
                  aria-hidden="true"
                />
              </span>
              {progress.pct !== null && <span>{progress.pct}%</span>}
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all"
                style={{ width: `${progress.pct ?? 0}%` }}
              />
            </div>
          </button>
        )}
      </div>

      {/* Menu Button. Always visible below lg (touch has no hover); on
          desktop it appears on hover or when anything in the card has focus,
          and it never hides from its own keyboard focus. */}
      <div className="absolute top-2 right-2 z-10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-10 w-10 bg-background/80 backdrop-blur-sm",
                "lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100",
                "focus-visible:opacity-100 lg:data-[state=open]:opacity-100 transition-opacity"
              )}
              aria-label={`Book options for ${book.title}`}
            >
              <MoreVertical className="h-4 w-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuLabel>Move to...</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={currentStatus}
              onValueChange={(value) => handleStatusChange(value as ShelfStatus)}
            >
              {(Object.keys(statusConfig) as ShelfStatus[]).map((status) => {
                const { label, icon: Icon } = statusConfig[status];
                return (
                  <DropdownMenuRadioItem key={status} value={status}>
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {label}
                  </DropdownMenuRadioItem>
                );
              })}
            </DropdownMenuRadioGroup>

            <DropdownMenuSeparator />

            <DropdownMenuItem onSelect={() => setIsShelfModalOpen(true)}>
              <FolderPlus className="h-4 w-4" aria-hidden="true" />
              Add to Custom Shelf
            </DropdownMenuItem>

            <DropdownMenuItem variant="destructive" onSelect={handleRemove}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Remove from Shelf
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Add to Shelf Modal */}
      <AddToShelfModal
        open={isShelfModalOpen}
        onOpenChange={setIsShelfModalOpen}
        userBookId={userBook.id}
        bookTitle={book.title}
      />

      {/* Update Progress Dialog */}
      <UpdateProgressDialog
        bookId={book.id}
        bookTitle={book.title}
        currentPage={progress.page}
        totalPages={progress.total}
        open={isProgressOpen}
        onOpenChange={setIsProgressOpen}
        onUpdated={(page, total, pct) => setProgress({ page, total, pct })}
      />
    </div>
  );
}

