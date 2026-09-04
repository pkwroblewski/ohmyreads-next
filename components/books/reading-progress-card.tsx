"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { UpdateProgressDialog } from "@/components/books/update-progress-dialog";

interface ReadingProgressCardProps {
  bookId: string;
  bookTitle: string;
  currentPage: number | null;
  /** The reader's own total, if they set one. */
  totalPages: number | null;
  percent: number | null;
  /** `books.page_count`, the fallback total when the reader set none. */
  pageCount?: number | null;
  /**
   * `row` is the wide line under the book page's action buttons; `compact`
   * is the one that sits under a cover in the dashboard rail.
   */
  variant?: "row" | "compact";
  className?: string;
}

/**
 * The bar, the position and the one control that opens the progress dialog.
 *
 * Progress used to be reachable only from a shelf card (dashboard, then
 * Shelf, then the card, then the dialog). This is the same island wherever a
 * currently-reading book appears, so the book page and the dashboard both
 * reach it in one tap.
 */
export function ReadingProgressCard({
  bookId,
  bookTitle,
  currentPage,
  totalPages,
  percent,
  pageCount = null,
  variant = "row",
  className,
}: ReadingProgressCardProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // Optimistic, reconciled by revalidation on the next server render.
  const [progress, setProgress] = useState({
    page: currentPage,
    total: totalPages,
    pct: percent,
  });
  const [finished, setFinished] = useState(false);

  // A finished book is no longer in progress, so the row retires itself
  // until the revalidated page arrives and drops it for good.
  if (finished) return null;

  const effectiveTotal = progress.total ?? pageCount;
  const isCompact = variant === "compact";

  const position =
    progress.page !== null
      ? `p. ${progress.page}${effectiveTotal !== null ? ` of ${effectiveTotal}` : ""}`
      : null;
  const label =
    position !== null && progress.pct !== null
      ? `${position} · ${progress.pct}%`
      : (position ?? (progress.pct !== null ? `${progress.pct}%` : "No progress yet"));

  return (
    <div className={cn("w-full", className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label={`Update reading progress for ${bookTitle}. ${label}`}
        className={cn(
          "group/progress w-full text-left rounded-md",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        )}
      >
        <div
          className={cn(
            "flex items-center justify-between gap-2 mb-1 text-muted-foreground",
            isCompact ? "text-[11px]" : "text-xs"
          )}
        >
          <span className="truncate">{label}</span>
          <span className="flex items-center gap-1 flex-shrink-0 text-primary">
            {!isCompact && <span className="font-medium">Update progress</span>}
            <Pencil
              className={cn(
                "h-3 w-3",
                isCompact &&
                  "opacity-0 group-hover/progress:opacity-100 group-focus-visible/progress:opacity-100 transition-opacity"
              )}
              aria-hidden="true"
            />
          </span>
        </div>
        <div
          className={cn(
            "rounded-full bg-muted overflow-hidden",
            isCompact ? "h-1.5" : "h-2"
          )}
        >
          <div
            className="h-full bg-accent rounded-full transition-all"
            style={{ width: `${progress.pct ?? 0}%` }}
          />
        </div>
      </button>

      <UpdateProgressDialog
        bookId={bookId}
        bookTitle={bookTitle}
        currentPage={progress.page}
        totalPages={effectiveTotal}
        percent={progress.pct}
        open={isOpen}
        onOpenChange={setIsOpen}
        onUpdated={(page, total, pct) => setProgress({ page, total, pct })}
        onFinished={() => {
          setFinished(true);
          // The shelf button next to this row reads the status from the
          // server; refresh so it stops saying "Reading".
          router.refresh();
        }}
        returnFocusTo={triggerRef}
      />
    </div>
  );
}
