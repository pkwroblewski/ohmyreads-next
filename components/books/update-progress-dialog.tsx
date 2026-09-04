"use client";

import { useState, useTransition } from "react";
import { Loader2, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { updateReadingProgress } from "@/lib/actions/books";

interface UpdateProgressDialogProps {
  bookId: string;
  bookTitle: string;
  currentPage: number | null;
  totalPages: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (page: number, total: number | null, pct: number | null) => void;
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
  onOpenChange,
  onUpdated,
}: Omit<UpdateProgressDialogProps, "open" | "returnFocusTo">) {
  const [page, setPage] = useState<string>(String(currentPage ?? ""));
  const [total, setTotal] = useState<string>(String(totalPages ?? ""));
  const [isPending, startTransition] = useTransition();

  const totalKnown = totalPages !== null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const pageNum = Number(page);
    if (!Number.isInteger(pageNum) || pageNum < 0) {
      toast.error("Enter a valid page number");
      return;
    }

    let totalNum: number | undefined;
    if (!totalKnown) {
      if (total.trim() !== "") {
        totalNum = Number(total);
        if (!Number.isInteger(totalNum) || totalNum <= 0) {
          toast.error("Enter a valid total page count");
          return;
        }
      }
    }

    startTransition(async () => {
      const result = await updateReadingProgress(bookId, pageNum, totalNum);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      onUpdated(
        result.currentPage,
        result.totalPages,
        result.progressPercentage
      );
      toast.success(
        result.progressPercentage !== null
          ? `Progress updated — ${result.progressPercentage}%`
          : "Progress updated"
      );
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

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isPending || page.trim() === ""}>
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Save"
            )}
          </Button>
        </div>
      </form>
    </>
  );
}
