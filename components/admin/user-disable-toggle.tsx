"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import { adminDisableUser, adminEnableUser } from "@/lib/actions/admin-users";

interface UserDisableToggleProps {
  userId: string;
  username: string;
  isDisabled: boolean;
  /** Admin accounts cannot be disabled; the control is not rendered. */
  isAdmin: boolean;
}

/**
 * Disable / enable one account.
 *
 * Disabling asks for a reason (it goes into the audit row), clears the
 * account's sessions and hides its content; enabling reverses all of it. Both
 * outcomes surface as toasts and the refresh goes through `router.refresh()`
 * so the server component re-reads.
 */
export function UserDisableToggle({
  userId,
  username,
  isDisabled,
  isAdmin,
}: UserDisableToggleProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  if (isAdmin) return null;

  const handleConfirm = () => {
    startTransition(async () => {
      const result = isDisabled
        ? await adminEnableUser(userId)
        : await adminDisableUser(userId, reason.trim() || undefined);

      if (result.success) {
        toast.success(
          isDisabled ? `@${username} is enabled again` : `@${username} has been disabled`
        );
        setOpen(false);
        setReason("");
        router.refresh();
      } else {
        toast.error(result.error || "Could not change this account");
      }
    });
  };

  return (
    <>
      <Button
        variant={isDisabled ? "outline" : "destructive"}
        size="sm"
        onClick={() => setOpen(true)}
      >
        {isDisabled ? (
          <CheckCircle className="h-4 w-4 mr-2" aria-hidden="true" />
        ) : (
          <Ban className="h-4 w-4 mr-2" aria-hidden="true" />
        )}
        {isDisabled ? "Enable account" : "Disable account"}
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {isDisabled ? (
                <>
                  <CheckCircle className="h-5 w-5 text-primary" aria-hidden="true" />
                  Enable @{username}
                </>
              ) : (
                <>
                  <Ban className="h-5 w-5 text-destructive" aria-hidden="true" />
                  Disable @{username}
                </>
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isDisabled ? (
                <>
                  They will be able to sign in again and their reviews, comments
                  and lists become visible to everyone.
                </>
              ) : (
                <>
                  They are signed out everywhere, cannot sign in again, their
                  profile stops resolving and their reviews, comments and lists
                  are hidden from other readers. Nothing is deleted; enabling
                  the account restores all of it.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {!isDisabled && (
            <Textarea
              placeholder="Reason for the record (optional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isPending}
              maxLength={1000}
              rows={3}
              aria-label="Reason for disabling"
            />
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                // Keep the dialog up while the action runs, so a failure can
                // be reported against it instead of into a closed dialog.
                e.preventDefault();
                handleConfirm();
              }}
              disabled={isPending}
              className={isDisabled ? "" : "bg-destructive hover:bg-destructive/90"}
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                  Processing...
                </>
              ) : isDisabled ? (
                "Enable account"
              ) : (
                "Disable account"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
