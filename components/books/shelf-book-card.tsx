"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import Link from "next/link";
import {
  BookOpen,
  Check,
  Bookmark,
  MoreVertical,
  Trash2,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { RatingDisplay } from "@/components/ui/rating-display";
import { CoverImage } from "@/components/books/cover-image";
import { addToShelf, removeFromShelf } from "@/lib/actions/books";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Book, UserBook } from "@/types/database";

interface ShelfBookCardProps {
  userBook: UserBook;
  book: Book | null;
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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [currentStatus, setCurrentStatus] = useState<ShelfStatus>(
    userBook.status as ShelfStatus
  );
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }

    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isMenuOpen]);

  if (!book) return null;

  const config = statusConfig[currentStatus];
  const StatusIcon = config.icon;

  const handleStatusChange = (newStatus: ShelfStatus) => {
    setIsMenuOpen(false);

    // Optimistic update
    const previousStatus = currentStatus;
    setCurrentStatus(newStatus);

    startTransition(async () => {
      const result = await addToShelf(book.id, newStatus);

      if (result.error) {
        // Revert on error
        setCurrentStatus(previousStatus);
        toast.error(result.error);
      } else {
        toast.success(`Moved to "${statusConfig[newStatus].label}"`);
      }
    });
  };

  const handleRemove = () => {
    setIsMenuOpen(false);

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
            className="absolute inset-0 w-full h-full rounded-none rounded-t-xl"
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
            <StatusIcon className="h-3 w-3" />
            {config.label}
          </div>

          {/* Rating Badge */}
          {userBook.rating && (
            <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-background/90 backdrop-blur-sm z-10">
              <Star className="h-3 w-3 fill-accent text-accent" />
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

        {/* Book Rating */}
        {book.average_rating && (
          <div className="mb-2">
            <RatingDisplay
              rating={book.average_rating}
              count={book.ratings_count}
              size="sm"
            />
          </div>
        )}

        {/* Progress Bar (for reading status) */}
        {currentStatus === "reading" && (
          <div className="mb-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>
                {userBook.current_page ?? 0} / {userBook.total_pages ?? book.page_count ?? "?"} pages
              </span>
              <span className="font-medium">
                {userBook.progress_percentage ?? 0}%
              </span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-300"
                style={{ width: `${userBook.progress_percentage ?? 0}%` }}
              />
            </div>
          </div>
        )}

        {/* Date Info */}
        <p className="text-xs text-muted-foreground">
          {currentStatus === "read" && userBook.finished_at
            ? `Finished ${formatDate(userBook.finished_at)}`
            : currentStatus === "reading" && userBook.started_at
              ? `Started ${formatDate(userBook.started_at)}`
              : `Added ${formatDate(userBook.created_at)}`}
        </p>
      </div>

      {/* Menu Button */}
      <div className="absolute top-2 right-2 z-10" ref={menuRef}>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-7 w-7 bg-background/80 backdrop-blur-sm",
            "opacity-0 group-hover:opacity-100 transition-opacity",
            isMenuOpen && "opacity-100"
          )}
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          <MoreVertical className="h-4 w-4" />
        </Button>

        {/* Dropdown Menu */}
        {isMenuOpen && (
          <div
            className={cn(
              "absolute right-0 top-full mt-1 w-44 z-50",
              "rounded-lg border border-border bg-card shadow-lg",
              "py-1 animate-in fade-in-0 zoom-in-95"
            )}
          >
            <p className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
              Move to...
            </p>
            {(Object.keys(statusConfig) as ShelfStatus[]).map((status) => {
              const { label, icon: Icon } = statusConfig[status];
              const isSelected = currentStatus === status;

              return (
                <button
                  key={status}
                  onClick={() => handleStatusChange(status)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 text-sm",
                    "hover:bg-muted transition-colors text-left",
                    isSelected && "text-primary"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                  {isSelected && <Check className="h-4 w-4 ml-auto" />}
                </button>
              );
            })}

            <div className="my-1 border-t border-border" />

            <button
              onClick={handleRemove}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 text-sm",
                "hover:bg-destructive/10 text-destructive transition-colors text-left"
              )}
            >
              <Trash2 className="h-4 w-4" />
              Remove from Shelf
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

