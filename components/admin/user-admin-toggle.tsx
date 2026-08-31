"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Shield, ShieldOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { adminToggleAdmin } from "@/lib/actions/admin-users";

interface UserAdminToggleProps {
  userId: string;
  username: string;
  isAdmin: boolean;
}

/**
 * The grant/revoke-admin control for one row.
 *
 * The version this replaces did `if (result.success) { ...refetch }` with no
 * `else`: a failed toggle closed nothing, said nothing, and left the row
 * showing the old value, so the admin had no way to tell a refused write from
 * a slow one. Both outcomes now surface, and the refresh goes through
 * `router.refresh()` so the server component re-reads rather than the page
 * keeping a private copy of the list.
 */
export function UserAdminToggle({
  userId,
  username,
  isAdmin,
}: UserAdminToggleProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    startTransition(async () => {
      const result = await adminToggleAdmin(userId);

      if (result.success) {
        toast.success(
          isAdmin
            ? `Removed admin rights from @${username}`
            : `Granted admin rights to @${username}`
        );
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error || "Could not change admin rights");
      }
    });
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        title={isAdmin ? "Remove Admin" : "Make Admin"}
      >
        {isAdmin ? (
          <ShieldOff className="h-4 w-4 text-orange-500" />
        ) : (
          <Shield className="h-4 w-4" />
        )}
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {isAdmin ? (
                <>
                  <ShieldOff className="h-5 w-5 text-orange-500" />
                  Remove Admin Rights
                </>
              ) : (
                <>
                  <Shield className="h-5 w-5 text-primary" />
                  Grant Admin Rights
                </>
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isAdmin ? (
                <>
                  Are you sure you want to remove admin rights from{" "}
                  <strong>{username}</strong>? They will lose access to the
                  admin dashboard.
                </>
              ) : (
                <>
                  Are you sure you want to grant admin rights to{" "}
                  <strong>{username}</strong>? They will have full access to
                  manage books, users, and site settings.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                // Keep the dialog up while the action runs, so a failure can
                // be reported against it instead of into a closed dialog.
                e.preventDefault();
                handleToggle();
              }}
              disabled={isPending}
              className={isAdmin ? "bg-orange-500 hover:bg-orange-600" : ""}
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : isAdmin ? (
                "Remove Admin"
              ) : (
                "Grant Admin"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
