"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { KeyRound, Loader2, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { createClient } from "@/lib/supabase/client";
import { changePassword, deleteAccount } from "@/lib/actions/account";
import { PASSWORD_MIN_LENGTH } from "@/lib/validation/user";

interface AccountSectionProps {
  username: string;
  email: string | null;
  /** True when the account has an email/password identity. */
  hasPassword: boolean;
}

/**
 * Account card (Phase 2, Task 11): change password, delete account. Replaces
 * the "coming soon" placeholder the settings page carried since launch.
 */
export function AccountSection({ username, email, hasPassword }: AccountSectionProps) {
  return (
    <div className="space-y-8">
      <PasswordForm hasPassword={hasPassword} email={email} />
      <DeleteAccount username={username} />
    </div>
  );
}

function PasswordForm({ hasPassword, email }: { hasPassword: boolean; email: string | null }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!hasPassword) {
    return (
      <section aria-labelledby="password-heading" className="space-y-2">
        <h3 id="password-heading" className="flex items-center gap-2 font-medium">
          <KeyRound className="h-4 w-4 text-primary" aria-hidden="true" />
          Password
        </h3>
        <p className="text-sm text-muted-foreground">
          You sign in with Google{email ? ` as ${email}` : ""}, so there is no OhMyReads
          password. Manage your password in your Google account.
        </p>
      </section>
    );
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      setError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    startTransition(async () => {
      const result = await changePassword({ currentPassword, newPassword });
      if (!result.success) {
        setError(result.error);
        return;
      }
      toast.success("Password changed");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    });
  };

  return (
    <section aria-labelledby="password-heading">
      <h3 id="password-heading" className="flex items-center gap-2 font-medium mb-3">
        <KeyRound className="h-4 w-4 text-primary" aria-hidden="true" />
        Change password
      </h3>
      <form onSubmit={handleSubmit} className="space-y-4 max-w-md" noValidate>
        {error && (
          <p
            role="alert"
            className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2"
          >
            {error}
          </p>
        )}
        <div className="space-y-2">
          <Label htmlFor="current-password">Current password</Label>
          <Input
            id="current-password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            disabled={isPending}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-password">New password</Label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={isPending}
            required
            minLength={PASSWORD_MIN_LENGTH}
            aria-describedby="new-password-hint"
          />
          <p id="new-password-hint" className="text-xs text-muted-foreground">
            At least {PASSWORD_MIN_LENGTH} characters.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-password">Confirm new password</Label>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={isPending}
            required
          />
        </div>
        <Button
          type="submit"
          disabled={isPending || !currentPassword || !newPassword || !confirmPassword}
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
              Saving...
            </>
          ) : (
            "Update password"
          )}
        </Button>
      </form>
    </section>
  );
}

function DeleteAccount({ username }: { username: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [staleSession, setStaleSession] = useState(false);
  const [isPending, startTransition] = useTransition();

  const matches = confirmation.trim().toLowerCase() === username.toLowerCase();

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setConfirmation("");
      setError(null);
      setStaleSession(false);
    }
  };

  const handleDelete = () => {
    setError(null);
    setStaleSession(false);
    startTransition(async () => {
      const result = await deleteAccount({ confirmation });
      if (!result.success) {
        setError(result.error);
        setStaleSession(result.code === "stale_session");
        return;
      }
      // The server already cleared its cookies; drop the browser's copy too.
      try {
        await createClient().auth.signOut({ scope: "local" });
      } catch {
        // Session is already gone server-side; nothing to recover here.
      }
      toast.success("Your account has been deleted");
      router.push("/");
      router.refresh();
    });
  };

  return (
    <section
      aria-labelledby="delete-account-heading"
      className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-3"
    >
      <h3
        id="delete-account-heading"
        className="flex items-center gap-2 font-medium text-destructive"
      >
        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        Delete account
      </h3>
      <p className="text-sm text-muted-foreground">
        Permanently removes your profile, shelves, reviews, comments, messages, follows,
        check-ins and reading stats. This cannot be undone. Reports you filed are kept for
        moderation without your name.
      </p>
      <AlertDialog open={open} onOpenChange={handleOpenChange}>
        <AlertDialogTrigger asChild>
          <Button
            variant="outline"
            className="border-destructive/40 text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4 mr-2" aria-hidden="true" />
            Delete my account
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              Everything you have added to OhMyReads will be deleted permanently. Type your
              username{" "}
              <span className="font-mono font-medium text-foreground">{username}</span> to
              confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2 py-2">
            <Label htmlFor="delete-confirmation">Username</Label>
            <Input
              id="delete-confirmation"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder={username}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              disabled={isPending}
            />
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
                {staleSession && (
                  <>
                    {" "}
                    <Link href="/signout" className="underline underline-offset-4">
                      Sign out now
                    </Link>
                  </>
                )}
              </p>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={isPending || !matches}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                  Deleting...
                </>
              ) : (
                "Delete account"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
