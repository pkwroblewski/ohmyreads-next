"use client";

import { useState } from "react";
import { Clock, Star, X, Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { setPresence } from "@/lib/actions/location";
import { cn } from "@/lib/utils";
import { encodeGeohash } from "@/lib/utils/geohash";
import { toast } from "sonner";

export interface PlaceForMarkSpot {
  name: string;
  lat: number | null;
  lng: number | null;
  type?: string;
}

interface MarkSpotModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  locationLabel?: string;
  place?: PlaceForMarkSpot; // Optional place to mark at
  defaultPresenceType?: "temporary" | "recommended"; // Pre-select a type
}

export function MarkSpotModal({
  open,
  onClose,
  onSuccess,
  locationLabel,
  place,
  defaultPresenceType,
}: MarkSpotModalProps) {
  const [presenceType, setPresenceType] = useState<"temporary" | "recommended">(
    defaultPresenceType || "temporary"
  );
  const [duration, setDuration] = useState<1 | 2 | 4>(2);
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationConsent, setLocationConsent] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    // Compute geohash from place coordinates if place is provided
    let placeGeohash: string | undefined;
    if (place) {
      // Validate place has coordinates
      if (place.lat === null || place.lat === undefined || place.lng === null || place.lng === undefined) {
        setError("This place is missing coordinates. Please try a different location.");
        setIsSubmitting(false);
        return;
      }
      placeGeohash = encodeGeohash(place.lat, place.lng, 7); // Precision 7 = ~150m
    }

    const result = await setPresence({
      type: presenceType,
      durationHours: presenceType === "temporary" ? duration : undefined,
      note: note.trim() || undefined,
      placeName: place?.name,
      placeGeohash,
    });

    setIsSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    // Show success toast
    const locationName = place?.name || "this spot";
    if (presenceType === "temporary") {
      toast.success(`You're at ${locationName}!`, {
        description: `Your status will expire in ${duration} hour${duration > 1 ? "s" : ""}`,
      });
    } else {
      toast.success(`Recommended ${locationName}!`, {
        description: "Your recommendation will be visible for 7 days",
      });
    }

    onSuccess();
    onClose();
    // Reset form
    setPresenceType(defaultPresenceType || "temporary");
    setDuration(2);
    setNote("");
    setLocationConsent(false);
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
      <div className="relative bg-background rounded-lg shadow-xl w-full max-w-md mx-4 p-6 z-10 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">
            {place ? "Mark your spot" : "Mark this spot"}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Place info or description */}
        {place ? (
          <div className="flex items-center gap-3 p-3 mb-6 rounded-xl bg-muted/50 border border-border/50">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <MapPin className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{place.name}</p>
              {place.type && (
                <p className="text-xs text-muted-foreground capitalize">{place.type}</p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground mb-6">
            {locationLabel || "Let other readers know about this location"}
          </p>
        )}

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

          {/* Location Consent - Required when marking at a specific place */}
          {place && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <input
                type="checkbox"
                id="location-consent"
                checked={locationConsent}
                onChange={(e) => setLocationConsent(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500 focus:ring-offset-0"
              />
              <label htmlFor="location-consent" className="text-sm cursor-pointer">
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  Share your precise location
                </p>
                <p className="text-amber-700 dark:text-amber-300 text-xs mt-1">
                  Other readers will see that you&apos;re at {place.name}.
                  Your exact position (~150m) will be visible on the map.
                </p>
              </label>
            </div>
          )}

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
              disabled={isSubmitting || (place && !locationConsent)}
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
