"use client";

import { useState, useTransition } from "react";
import { Flag, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { submitReport } from "@/lib/actions/reports";
import {
  REPORT_REASONS,
  REPORT_REASON_LABELS,
  REPORT_TARGET_LABELS,
  type ReportReason,
  type ReportTargetType,
} from "@/lib/validation/report";

interface ReportDialogProps {
  targetType: ReportTargetType;
  targetId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Controlled report dialog.
 *
 * Controlled on purpose: the review card's trigger lives inside a Radix
 * dropdown, and a dialog nested in a menu item unmounts with the menu the
 * instant it is selected. The parent owns the open state and renders this
 * outside the menu.
 */
export function ReportDialog({
  targetType,
  targetId,
  open,
  onOpenChange,
}: ReportDialogProps) {
  const [reason, setReason] = useState<ReportReason | "">("");
  const [details, setDetails] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    if (!reason) return;

    startTransition(async () => {
      const result = await submitReport({
        targetType,
        targetId,
        reason,
        details: details.trim() || undefined,
      });

      if (result.success) {
        toast.success("Thanks — a moderator will take a look");
        onOpenChange(false);
        setReason("");
        setDetails("");
      } else {
        // Covers "you already reported this" and "you cannot report your own
        // content" as well as real failures: all of them are things the person
        // needs to read, not silently swallow.
        toast.error(result.error || "Could not submit that report");
      }
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-destructive" aria-hidden="true" />
            Report this {REPORT_TARGET_LABELS[targetType].toLowerCase()}
          </AlertDialogTitle>
          <AlertDialogDescription>
            Tell us what is wrong with it. Reports go to the moderation queue —
            the author is not told who reported them.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="report-reason">Reason</Label>
            <Select
              value={reason}
              onValueChange={(value) => setReason(value as ReportReason)}
              disabled={isPending}
            >
              <SelectTrigger id="report-reason">
                <SelectValue placeholder="Choose a reason" />
              </SelectTrigger>
              <SelectContent>
                {REPORT_REASONS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {REPORT_REASON_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="report-details">
              Anything else? <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="report-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Add any context that would help a moderator"
              maxLength={1000}
              rows={3}
              disabled={isPending}
            />
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              // Keep the dialog up while the action runs, so a refusal can be
              // reported against it instead of into a closed dialog.
              e.preventDefault();
              handleSubmit();
            }}
            disabled={isPending || !reason}
            className="bg-destructive hover:bg-destructive/90"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                Sending...
              </>
            ) : (
              "Send report"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface ReportButtonProps {
  targetType: ReportTargetType;
  targetId: string;
  /** Render just the flag, for tight rows like a photo lightbox. */
  iconOnly?: boolean;
  className?: string;
}

/**
 * Trigger + dialog together, for the places that do not already have a menu to
 * hang a report item on.
 */
export function ReportButton({
  targetType,
  targetId,
  iconOnly = false,
  className,
}: ReportButtonProps) {
  const [open, setOpen] = useState(false);
  const label = `Report this ${REPORT_TARGET_LABELS[targetType].toLowerCase()}`;

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className={className}
        aria-label={iconOnly ? label : undefined}
        title={iconOnly ? label : undefined}
      >
        <Flag className={iconOnly ? "h-3.5 w-3.5" : "h-3 w-3 mr-1"} aria-hidden="true" />
        {!iconOnly && "Report"}
      </Button>

      <ReportDialog
        targetType={targetType}
        targetId={targetId}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
