"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, XCircle, Loader2, Ban } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resolveReport, dismissReport } from "@/lib/actions/reports";
import { adminDisableUser } from "@/lib/actions/admin-users";

interface ReportRowActionsProps {
  reportId: string;
  /** Author of the reported content, when it still exists. */
  author?: { id: string; username: string | null; isDisabled: boolean };
  /** Human label of the report reason; becomes the default disable reason. */
  reasonLabel?: string;
}

/**
 * Resolve / dismiss for one open report.
 *
 * Both outcomes surface — a refused close (someone else already handled it,
 * or the rate limit) toasts rather than leaving the row looking untouched —
 * and the refresh goes through `router.refresh()` so the server component
 * re-reads instead of the page keeping a private copy of the queue.
 */
export function ReportRowActions({
  reportId,
  author,
  reasonLabel,
}: ReportRowActionsProps) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();

  const authorName = author?.username ? `@${author.username}` : "the author";

  // The enforcement action the reports queue lacked (Task 7): disable the
  // account behind the content. The report itself stays open so the admin
  // can still resolve it with a note.
  const disableAuthor = () => {
    if (!author) return;
    startTransition(async () => {
      const result = await adminDisableUser(
        author.id,
        note.trim() || (reasonLabel ? `Reported: ${reasonLabel}` : undefined)
      );

      if (result.success) {
        toast.success(`${authorName} has been disabled`);
        router.refresh();
      } else {
        toast.error(result.error || `Could not disable ${authorName}`);
      }
    });
  };

  const close = (
    action: typeof resolveReport,
    successMessage: string,
    failureMessage: string
  ) => {
    startTransition(async () => {
      const result = await action(reportId, note.trim() || undefined);

      if (result.success) {
        toast.success(successMessage);
        setNote("");
        router.refresh();
      } else {
        toast.error(result.error || failureMessage);
      }
    });
  };

  return (
    <div className="space-y-3 pt-3 border-t">
      <Input
        placeholder="Note for the record (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        disabled={isPending}
        maxLength={1000}
        aria-label="Resolution note"
      />

      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() =>
            close(
              resolveReport,
              "Report resolved",
              "Could not resolve this report"
            )
          }
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
          ) : (
            <CheckCircle className="h-4 w-4 mr-2" aria-hidden="true" />
          )}
          Resolve
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            close(
              dismissReport,
              "Report dismissed",
              "Could not dismiss this report"
            )
          }
          disabled={isPending}
        >
          <XCircle className="h-4 w-4 mr-2" aria-hidden="true" />
          Dismiss
        </Button>

        {author &&
          (author.isDisabled ? (
            <span className="ml-auto self-center text-xs text-muted-foreground">
              {authorName} is already disabled
            </span>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="ml-auto text-destructive hover:text-destructive"
              onClick={disableAuthor}
              disabled={isPending}
            >
              <Ban className="h-4 w-4 mr-2" aria-hidden="true" />
              Disable {authorName}
            </Button>
          ))}
      </div>
    </div>
  );
}
