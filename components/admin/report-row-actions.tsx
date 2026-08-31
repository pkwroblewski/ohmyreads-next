"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resolveReport, dismissReport } from "@/lib/actions/reports";

interface ReportRowActionsProps {
  reportId: string;
}

/**
 * Resolve / dismiss for one open report.
 *
 * Both outcomes surface — a refused close (someone else already handled it,
 * or the rate limit) toasts rather than leaving the row looking untouched —
 * and the refresh goes through `router.refresh()` so the server component
 * re-reads instead of the page keeping a private copy of the queue.
 */
export function ReportRowActions({ reportId }: ReportRowActionsProps) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();

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
      </div>
    </div>
  );
}
