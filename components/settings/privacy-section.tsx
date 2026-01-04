"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { updateDiscoveryVisibility } from "@/lib/actions/privacy";

interface PrivacySectionProps {
  initialDiscoveryVisible: boolean;
}

export function PrivacySection({ initialDiscoveryVisible }: PrivacySectionProps) {
  const [isPending, startTransition] = useTransition();
  const [discoveryVisible, setDiscoveryVisible] = useState(initialDiscoveryVisible);

  const handleToggle = (checked: boolean) => {
    setDiscoveryVisible(checked);
    startTransition(async () => {
      const result = await updateDiscoveryVisibility(checked);
      if (!result.success) {
        toast.error(result.error || "Failed to update privacy settings");
        setDiscoveryVisible(!checked); // Revert on error
      } else {
        toast.success(
          checked
            ? "You are now visible in reader discovery"
            : "You are now hidden from reader discovery"
        );
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50 border">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            {discoveryVisible ? (
              <Eye className="h-5 w-5 text-primary" />
            ) : (
              <EyeOff className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div>
            <Label htmlFor="discovery-toggle" className="text-base font-medium cursor-pointer">
              Appear in Reader Discovery
            </Label>
            <p className="text-sm text-muted-foreground">
              {discoveryVisible
                ? "Other readers can find you in recommendations and browse"
                : "You're hidden from discovery pages and recommendations"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <Switch
            id="discovery-toggle"
            checked={discoveryVisible}
            onCheckedChange={handleToggle}
            disabled={isPending}
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        When disabled, you won&apos;t appear on the Discover page, &ldquo;readers like you&rdquo; recommendations,
        or book club member suggestions. Your profile will still be accessible via direct link.
      </p>
    </div>
  );
}
