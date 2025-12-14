"use client";

import { useState, useTransition } from "react";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { approvePlaceSubmission, rejectPlaceSubmission } from "@/lib/actions/places";

interface PlaceModerationActionsProps {
  submissionId: string;
}

export function PlaceModerationActions({ submissionId }: PlaceModerationActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [notes, setNotes] = useState("");
  const [isProcessed, setIsProcessed] = useState(false);

  const handleApprove = () => {
    startTransition(async () => {
      const result = await approvePlaceSubmission(submissionId, notes);
      
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Place approved and added to the map!");
        setIsProcessed(true);
      }
    });
  };

  const handleReject = () => {
    startTransition(async () => {
      const result = await rejectPlaceSubmission(submissionId, notes);
      
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Submission rejected");
        setIsProcessed(true);
      }
    });
  };

  if (isProcessed) {
    return (
      <div className="p-3 rounded-lg bg-muted text-center text-sm text-muted-foreground">
        Processed
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-3 border-t">
      <Input
        placeholder="Add a note (optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        disabled={isPending}
      />
      
      <div className="flex gap-2">
        <Button
          onClick={handleApprove}
          disabled={isPending}
          className="flex-1"
          variant="default"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              Approve
            </>
          )}
        </Button>
        
        <Button
          onClick={handleReject}
          disabled={isPending}
          className="flex-1"
          variant="destructive"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <XCircle className="h-4 w-4 mr-2" />
              Reject
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

