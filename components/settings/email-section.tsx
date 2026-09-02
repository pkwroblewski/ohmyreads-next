"use client";

import { useState, useTransition } from "react";
import { Mail, MailX, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { updateEmailPreferences } from "@/lib/actions/privacy";

interface EmailSectionProps {
  initialDigestEnabled: boolean;
}

/**
 * The digest opt-out (Phase 2, Task 9). Before this, every account received
 * the weekly digest with no way to stop it short of emailing support.
 */
export function EmailSection({ initialDigestEnabled }: EmailSectionProps) {
  const [isPending, startTransition] = useTransition();
  const [digestEnabled, setDigestEnabled] = useState(initialDigestEnabled);

  const handleToggle = (checked: boolean) => {
    setDigestEnabled(checked);
    startTransition(async () => {
      const result = await updateEmailPreferences({ digestEnabled: checked });
      if (!result.success) {
        toast.error(result.error || "Failed to update email preferences");
        setDigestEnabled(!checked); // Revert on error
      } else {
        toast.success(
          checked
            ? "You will receive the weekly reading digest"
            : "You will no longer receive the weekly digest"
        );
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50 border">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            {digestEnabled ? (
              <Mail className="h-5 w-5 text-primary" aria-hidden="true" />
            ) : (
              <MailX className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            )}
          </div>
          <div>
            <Label htmlFor="digest-toggle" className="text-base font-medium cursor-pointer">
              Weekly reading digest
            </Label>
            <p className="text-sm text-muted-foreground">
              {digestEnabled
                ? "A summary of your week, your friends' activity and your challenge, once a week"
                : "You will not receive the weekly digest"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isPending && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
          )}
          <Switch
            id="digest-toggle"
            checked={digestEnabled}
            onCheckedChange={handleToggle}
            disabled={isPending}
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Every digest also carries an unsubscribe link that works without signing in.
        Account emails such as password resets are always sent.
      </p>
    </div>
  );
}
