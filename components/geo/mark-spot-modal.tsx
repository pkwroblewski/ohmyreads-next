"use client";

import { useState } from "react";
import { Clock, Star, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { setPresence } from "@/lib/actions/location";
import { cn } from "@/lib/utils";

interface MarkSpotModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  locationLabel?: string;
}

export function MarkSpotModal({ open, onClose, onSuccess, locationLabel }: MarkSpotModalProps) {
  const [presenceType, setPresenceType] = useState<"temporary" | "recommended">("temporary");
  const [duration, setDuration] = useState<1 | 2 | 4>(2);
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    const result = await setPresence({
      type: presenceType,
      durationHours: presenceType === "temporary" ? duration : undefined,
      note: note.trim() || undefined,
    });

    setIsSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    onSuccess();
    onClose();
    // Reset form
    setPresenceType("temporary");
    setDuration(2);
    setNote("");
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative bg-background rounded-lg shadow-xl w-full max-w-md mx-4 p-6 z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">Mark this spot</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground mb-6">
          {locationLabel || "Let other readers know about this location"}
        </p>

        <div className="space-y-6">
          {/* Presence Type Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium">What do you want to share?</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPresenceType("temporary")}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                  presenceType === "temporary"
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                    : "border-border hover:border-muted-foreground/30"
                )}
              >
                <div className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center",
                  presenceType === "temporary"
                    ? "bg-emerald-500 text-white"
                    : "bg-muted text-muted-foreground"
                )}>
                  <Clock className="w-6 h-6" />
                </div>
                <span className="font-medium text-sm">I'm here now</span>
                <span className="text-xs text-muted-foreground text-center">
                  Temporary - auto expires
                </span>
              </button>

              <button
                type="button"
                onClick={() => setPresenceType("recommended")}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                  presenceType === "recommended"
                    ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30"
                    : "border-border hover:border-muted-foreground/30"
                )}
              >
                <div className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center",
                  presenceType === "recommended"
                    ? "bg-amber-400 text-white"
                    : "bg-muted text-muted-foreground"
                )}>
                  <Star className="w-6 h-6" />
                </div>
                <span className="font-medium text-sm">Recommend spot</span>
                <span className="text-xs text-muted-foreground text-center">
                  Visible for 7 days
                </span>
              </button>
            </div>
          </div>

          {/* Duration Selection (only for temporary) */}
          {presenceType === "temporary" && (
            <div className="space-y-3">
              <label className="text-sm font-medium">How long will you be here?</label>
              <div className="flex gap-2">
                {[1, 2, 4].map((hours) => (
                  <button
                    key={hours}
                    type="button"
                    onClick={() => setDuration(hours as 1 | 2 | 4)}
                    className={cn(
                      "flex-1 py-2 px-4 rounded-lg border transition-all text-sm font-medium",
                      duration === hours
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300"
                        : "border-border hover:border-muted-foreground/30"
                    )}
                  >
                    {hours}h
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Note Input */}
          <div className="space-y-3">
            <label className="text-sm font-medium">
              Add a note <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 140))}
              placeholder={
                presenceType === "temporary"
                  ? "Reading by the window..."
                  : "Great coffee and quiet atmosphere!"
              }
              className="resize-none"
              rows={2}
            />
            <p className="text-xs text-muted-foreground text-right">
              {note.length}/140
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className={cn(
                "flex-1",
                presenceType === "recommended"
                  ? "bg-amber-500 hover:bg-amber-600"
                  : "bg-emerald-500 hover:bg-emerald-600"
              )}
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              {presenceType === "temporary" ? "I'm here" : "Recommend"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
