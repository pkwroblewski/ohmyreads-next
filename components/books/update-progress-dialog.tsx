"use client";

import { useState, useTransition } from "react";
import { Loader2, BookOpen, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { addToShelf, updateReadingProgress } from "@/lib/actions/books";

type ProgressMode = "pages" | "percent";

interface UpdateProgressDialogProps {
  bookId: string;
  bookTitle: string;
  currentPage: number | null;
  totalPages: number | null;
  /** Stored percentage, which is all an audiobook or e-reader reader has. */
  percent?: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (page: number | null, total: number | null, pct: number | null) => void;
  /** Called after "Mark as finished" moves the book to the Read shelf. */
  onFinished?: () => void;
  /** The control that opened the dialog; focus goes back there on close. */
  returnFocusTo?: React.RefObject<HTMLElement | null>;
}

export function UpdateProgressDialog({
  open,
  onOpenChange,
  returnFocusTo,
  ...formProps
}: UpdateProgressDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm p-0" returnFocusTo={returnFocusTo}>
        {/* Radix unmounts the content when closed, so the form mounts fresh
            each time and its inputs re-seed from props without effects */}
        <UpdateProgressForm {...formProps} onOpenChange={onOpenChange} />
      </DialogContent>
    </Dialog>
  );
}

function UpdateProgressForm({
  bookId,
  bookTitle,
  currentPage,
  totalPages,
  percent = null,
  onOpenChange,
  onUpdated,
  onFinished,
}: Omit<UpdateProgressDialogProps, "open" | "returnFocusTo">) {
  const totalKnown = totalPages !== null;
  const [mode, setMode] = useState<ProgressMode>(
    // Percent is the only thing a reader without a page count can enter, and
    // so the only thing they can have stored.
    !totalKnown && percent !== null ? "percent" : "pages"
  );
  const [page, setPage] = useState<string>(String(currentPage ?? ""));
  const [total, setTotal] = useState<string>(String(totalPages ?? ""));
  const [pct, setPct] = useState<string>(String(percent ?? ""));
  const [isPending, startTransition] = useTransition();

  const pctNum = Number(pct);
  const derivedPage =
    mode === "percent" && totalKnown && pct.trim() !== "" && Number.isFinite(pctNum)
      ? Math.round((totalPages * Math.min(100, Math.max(0, pctNum))) / 100)
      : null;

  const save = (
    values: Parameters<typeof updateReadingProgress>[0],
    successMessage?: string
  ) => {
    startTransition(async () => {
      const result = await updateReadingProgress(values);

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      onUpdated(result.currentPage, result.totalPages, result.progressPercentage);
      toast.success(
        successMessage ??
          (result.progressPercentage !== null
            ? `Progress updated — ${result.progressPercentage}%`
            : "Progress updated")
      );
      onOpenChange(false);
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === "percent") {
      if (!Number.isInteger(pctNum) || pctNum < 0 || pctNum > 100) {
        toast.error("Enter a percentage between 0 and 100");
        return;
      }
      save({ bookId, percent: pctNum });
      return;
    }

    const pageNum = Number(page);
    if (!Number.isInteger(pageNum) || pageNum < 0) {
      toast.error("Enter a valid page number");
      return;
    }

    let totalNum: number | undefined;
    if (!totalKnown && total.trim() !== "") {
      totalNum = Number(total);
      if (!Number.isInteger(totalNum) || totalNum <= 0) {
        toast.error("Enter a valid total page count");
        return;
      }
    }

    save({ bookId, currentPage: pageNum, totalPages: totalNum });
  };

  // Percent 0 clears both sides: the action derives the page from it, so a
  // book with no page count ends up back at "no progress" as well.
  const handleClear = () => save({ bookId, percent: 0 }, "Progress cleared");

  const handleFinished = () => {
    startTransition(async () => {
      const result = await addToShelf(bookId, "read");

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      onFinished?.();
      toast.success("Marked as finished");
      result.newBadges?.forEach((badge) => {
        toast.success(`Badge unlocked: ${badge.icon ?? "🏅"} ${badge.name}`);
      });
      onOpenChange(false);
    });
  };

  return (
    <>
      <DialogHeader className="p-4 border-b space-y-0">
        <DialogTitle className="flex items-center gap-2 text-base">
          <BookOpen className="h-5 w-5 text-primary" aria-hidden="true" />
          Update Progress
        </DialogTitle>
      </DialogHeader>

      <div className="px-4 py-2 bg-muted/50 border-b">
        <DialogDescription className="truncate">
          <span className="font-medium text-foreground">{bookTitle}</span>
        </DialogDescription>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        {/* Pages or percent. Two toggles rather than a select: there are only
            ever two, and one tap has to switch between them. */}
        <div
          role="group"
          aria-label="Track progress by"
          className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1"
        >
          {(["pages", "percent"] as ProgressMode[]).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={mode === option}
              onClick={() => setMode(option)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                mode === option
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {option === "pages" ? "Pages" : "Percent"}
            </button>
          ))}
        </div>

        {mode === "pages" ? (
          <>
            <div className="space-y-1">
              <label htmlFor="current-page" className="text-sm font-medium">
                Current page
              </label>
              <input
                id="current-page"
                type="number"
                min={0}
                max={50000}
                value={page}
                onChange={(e) => setPage(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {totalKnown && (
                <p className="text-xs text-muted-foreground">
                  of {totalPages} pages
                </p>
              )}
            </div>

            {!totalKnown && (
              <div className="space-y-1">
                <label htmlFor="total-pages" className="text-sm font-medium">
                  Total pages{" "}
                  <span className="text-muted-foreground font-normal">
                    (optional)
                  </span>
                </label>
                <input
                  id="total-pages"
                  type="number"
                  min={1}
                  max={50000}
                  value={total}
                  onChange={(e) => setTotal(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            )}
          </>
        ) : (
          <div className="space-y-1">
            <label htmlFor="progress-percent" className="text-sm font-medium">
              Progress
            </label>
            <div className="flex items-center gap-2">
              <input
                id="progress-percent"
                type="number"
                min={0}
                max={100}
                value={pct}
                onChange={(e) => setPct(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <span className="text-sm text-muted-foreground" aria-hidden="true">
                %
              </span>
            </div>
            {derivedPage !== null && (
              <p className="text-xs text-muted-foreground">
                about page {derivedPage} of {totalPages}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleFinished}
            disabled={isPending}
            className="w-full justify-center"
          >
            <Check className="h-4 w-4" aria-hidden="true" />
            Mark as finished
          </Button>

          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              disabled={isPending}
              className="text-muted-foreground"
            >
              Clear progress
            </Button>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  isPending || (mode === "pages" ? page.trim() === "" : pct.trim() === "")
                }
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </>
  );
}
