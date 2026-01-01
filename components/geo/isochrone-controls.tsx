"use client";

import { useState, useCallback } from "react";
import {
  Footprints,
  Bike,
  Car,
  Clock,
  X,
  Loader2,
  Timer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TransportProfile = "walking" | "cycling" | "driving";

interface IsochroneControlsProps {
  onIsochroneChange: (data: {
    geometry: GeoJSON.Polygon;
    center: [number, number];
    minutes: number;
    profile: TransportProfile;
  } | null) => void;
  userLocation: { lat: number; lng: number } | null;
  className?: string;
}

const timeOptions = [5, 10, 15, 20, 30];

const profileConfig: Record<
  TransportProfile,
  { icon: typeof Footprints; label: string }
> = {
  walking: { icon: Footprints, label: "Walk" },
  cycling: { icon: Bike, label: "Bike" },
  driving: { icon: Car, label: "Drive" },
};

export function IsochroneControls({
  onIsochroneChange,
  userLocation,
  className,
}: IsochroneControlsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedMinutes, setSelectedMinutes] = useState<number | null>(null);
  const [selectedProfile, setSelectedProfile] =
    useState<TransportProfile>("walking");
  const [isLoading, setIsLoading] = useState(false);

  const fetchIsochrone = useCallback(
    async (minutes: number, profile: TransportProfile) => {
      if (!userLocation) return;

      setIsLoading(true);

      try {
        const params = new URLSearchParams({
          lat: userLocation.lat.toString(),
          lng: userLocation.lng.toString(),
          minutes: minutes.toString(),
          profile,
        });

        const res = await fetch(`/api/geo/isochrone?${params}`);
        const data = await res.json();

        if (res.ok && data.geometry) {
          onIsochroneChange({
            geometry: data.geometry,
            center: data.center,
            minutes: data.minutes,
            profile: data.profile,
          });
        } else {
          onIsochroneChange(null);
        }
      } catch {
        onIsochroneChange(null);
      } finally {
        setIsLoading(false);
      }
    },
    [userLocation, onIsochroneChange]
  );

  const handleTimeSelect = (minutes: number) => {
    if (selectedMinutes === minutes) {
      // Deselect
      setSelectedMinutes(null);
      onIsochroneChange(null);
    } else {
      setSelectedMinutes(minutes);
      fetchIsochrone(minutes, selectedProfile);
    }
  };

  const handleProfileChange = (profile: TransportProfile) => {
    setSelectedProfile(profile);
    if (selectedMinutes) {
      fetchIsochrone(selectedMinutes, profile);
    }
  };

  const clearIsochrone = () => {
    setSelectedMinutes(null);
    onIsochroneChange(null);
  };

  if (!userLocation) {
    return null;
  }

  // Collapsed state - just show a toggle button
  if (!isExpanded) {
    return (
      <Button
        variant="outline"
        size="sm"
        className={cn(
          "bg-white/95 dark:bg-card/95 backdrop-blur-sm shadow-lg",
          className
        )}
        onClick={() => setIsExpanded(true)}
      >
        <Timer className="h-4 w-4 mr-1.5" />
        Travel Time
      </Button>
    );
  }

  return (
    <div
      className={cn(
        "bg-white/95 dark:bg-card/95 backdrop-blur-sm rounded-xl shadow-lg border border-border/50 p-3",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium flex items-center gap-1.5">
          <Timer className="h-4 w-4 text-primary" />
          Travel Time Filter
        </span>
        <div className="flex items-center gap-1">
          {selectedMinutes && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={clearIsochrone}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setIsExpanded(false)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Transport Mode Selector */}
      <div className="flex gap-1 mb-3">
        {(Object.keys(profileConfig) as TransportProfile[]).map((profile) => {
          const config = profileConfig[profile];
          const Icon = config.icon;
          const isSelected = selectedProfile === profile;

          return (
            <button
              key={profile}
              onClick={() => handleProfileChange(profile)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium transition-colors",
                isSelected
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/60 hover:bg-muted text-muted-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{config.label}</span>
            </button>
          );
        })}
      </div>

      {/* Time Buttons */}
      <div className="flex gap-1.5">
        {timeOptions.map((minutes) => {
          const isSelected = selectedMinutes === minutes;

          return (
            <button
              key={minutes}
              onClick={() => handleTimeSelect(minutes)}
              disabled={isLoading}
              className={cn(
                "flex-1 py-2 rounded-lg text-xs font-medium transition-colors",
                isSelected
                  ? "bg-primary/10 border-2 border-primary text-primary"
                  : "bg-muted/40 hover:bg-muted border-2 border-transparent text-muted-foreground"
              )}
            >
              {isLoading && isSelected ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mx-auto" />
              ) : (
                `${minutes}m`
              )}
            </button>
          );
        })}
      </div>

      {/* Status */}
      {selectedMinutes && (
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          Showing places within {selectedMinutes} min{" "}
          {selectedProfile === "walking"
            ? "walk"
            : selectedProfile === "cycling"
              ? "bike ride"
              : "drive"}
        </p>
      )}
    </div>
  );
}
