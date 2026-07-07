"use client";

import { useState, useTransition } from "react";
import { X, Loader2, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
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
}

export function UpdateProgressDialog(props: UpdateProgressDialogProps) {
  // The form mounts fresh each time the dialog opens, so its inputs
  // re-seed from props without effect-driven setState
  if (!props.open) return null;
  return <UpdateProgressForm {...props} />;
}

function UpdateProgressForm({
  bookId,
  bookTitle,
  currentPage,
  totalPages,
  onOpenChange,
  onUpdated,
}: UpdateProgressDialogProps) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      {/* Modal */}
      <div className="relative bg-background rounded-xl shadow-2xl w-full max-w-sm z-10 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Update Progress</h2>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-4 py-2 bg-muted/50 border-b">
          <p className="text-sm text-muted-foreground truncate">
            <span className="font-medium text-foreground">{bookTitle}</span>
          </p>
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
              autoFocus
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
      </div>
    </div>
  );
}
