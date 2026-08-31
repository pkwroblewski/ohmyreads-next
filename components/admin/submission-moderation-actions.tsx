"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { moderateSubmission } from "@/lib/actions/book-submissions";

interface SubmissionModerationActionsProps {
  submissionId: string;
  title: string;
  coverUrl: string | null;
}

/**
 * Approve / reject for one pending submission. Kept as a per-row island so the
 * surrounding submission card can stay on the server.
 */
export function SubmissionModerationActions({
  submissionId,
  title,
  coverUrl,
}: SubmissionModerationActionsProps) {
  const router = useRouter();
  const [isRejecting, setIsRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleApprove = () => {
    startTransition(async () => {
      try {
        const result = await moderateSubmission({
          submissionId,
          action: "approve",
        });

        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success(`Approved "${title}" and added it to the catalog`);
          router.refresh();
        }
      } catch {
        toast.error("Failed to approve submission");
      }
    });
  };

  const handleReject = () => {
    startTransition(async () => {
      try {
        const result = await moderateSubmission({
          submissionId,
          action: "reject",
          rejectionReason: reason || undefined,
        });

        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success(`Rejected "${title}"`);
          setIsRejecting(false);
          setReason("");
          router.refresh();
        }
      } catch {
        toast.error("Failed to reject submission");
      }
    });
  };

  if (isRejecting) {
    return (
      <div className="space-y-3 p-4 bg-muted rounded-lg">
        <p className="text-sm font-medium">Rejection Reason (optional):</p>
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g., Duplicate entry, Incomplete information..."
          maxLength={500}
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="destructive"
            onClick={handleReject}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Confirm Rejection"
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setIsRejecting(false);
              setReason("");
            }}
            disabled={isPending}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        onClick={handleApprove}
        disabled={isPending}
        className="bg-green-600 hover:bg-green-700"
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <Check className="h-4 w-4 mr-2" />
        )}
        Approve
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setIsRejecting(true)}
        disabled={isPending}
        className="text-red-600 border-red-200 hover:bg-red-50"
      >
        <X className="h-4 w-4 mr-2" />
        Reject
      </Button>
      {coverUrl && (
        <a
          href={coverUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto"
        >
          <Button size="sm" variant="ghost">
            <ExternalLink className="h-4 w-4" />
          </Button>
        </a>
      )}
    </div>
  );
}
