"use client";

import { useState, useEffect } from "react";
import {
  Footprints,
  Bike,
  Car,
  Clock,
  MapPin,
  Navigation,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DirectionsDisplayProps {
  destination: {
    lat: number;
    lng: number;
    name: string;
  };
  origin?: {
    lat: number;
    lng: number;
  };
  className?: string;
}

interface DirectionsData {
  profile: string;
  duration: number;
  duration_text: string;
  distance: number;
  distance_text: string;
  steps?: Array<{
    instruction: string;
    distance: number;
    duration: number;
  }>;
}

type TransportMode = "walking" | "cycling" | "driving";

const modeConfig: Record<
  TransportMode,
  { icon: typeof Footprints; label: string; color: string }
> = {
  walking: {
    icon: Footprints,
    label: "Walk",
    color: "text-emerald-600 dark:text-emerald-400",
  },
  cycling: {
    icon: Bike,
    label: "Bike",
    color: "text-sky-600 dark:text-sky-400",
  },
  driving: {
    icon: Car,
    label: "Drive",
    color: "text-amber-600 dark:text-amber-400",
  },
};

export function DirectionsDisplay({
  destination,
  origin,
  className,
}: DirectionsDisplayProps) {
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(origin || null);
  const [selectedMode, setSelectedMode] = useState<TransportMode>("walking");
  const [directions, setDirections] = useState<Record<
    TransportMode,
    DirectionsData | null
  > | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get user location if not provided
  useEffect(() => {
    if (origin) {
      setUserLocation(origin);
      return;
    }

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        () => {
          setError("Enable location to see directions");
        }
      );
    }
  }, [origin]);

  // Fetch directions for all modes when user location is available
  useEffect(() => {
    if (!userLocation) return;

    const fetchDirections = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const modes: TransportMode[] = ["walking", "cycling", "driving"];
        const results = await Promise.all(
          modes.map(async (mode) => {
            const params = new URLSearchParams({
              origin_lat: userLocation.lat.toString(),
              origin_lng: userLocation.lng.toString(),
              dest_lat: destination.lat.toString(),
              dest_lng: destination.lng.toString(),
              profile: mode,
            });

            const res = await fetch(`/api/geo/directions?${params}`);
            if (!res.ok) return null;
            return res.json();
          })
        );

        setDirections({
          walking: results[0],
          cycling: results[1],
          driving: results[2],
        });
      } catch {
        setError("Could not fetch directions");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDirections();
  }, [userLocation, destination.lat, destination.lng]);

  // Open directions in external maps app
  const openInMaps = () => {
    const encodedName = encodeURIComponent(destination.name);

    // Try to detect platform for best maps experience
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);

    if (isIOS) {
      // Apple Maps
      window.open(
        `maps://maps.apple.com/?daddr=${destination.lat},${destination.lng}&q=${encodedName}`,
        "_blank"
      );
    } else if (isAndroid) {
      // Google Maps app
      window.open(
        `geo:${destination.lat},${destination.lng}?q=${destination.lat},${destination.lng}(${encodedName})`,
        "_blank"
      );
    } else {
      // Google Maps web
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}&destination_place_id=${encodedName}`,
        "_blank"
      );
    }
  };

  if (error && !userLocation) {
    return (
      <div
        className={cn(
          "rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground",
          className
        )}
      >
        <div className="flex items-center gap-2">
          <Navigation className="h-4 w-4" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (isLoading || !directions) {
    return (
      <div className={cn("rounded-lg bg-muted/50 p-3", className)}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Calculating directions...</span>
        </div>
      </div>
    );
  }

  const currentDirections = directions[selectedMode];

  return (
    <div className={cn("space-y-3", className)}>
      {/* Mode selector with times */}
      <div className="flex gap-1.5">
        {(Object.keys(modeConfig) as TransportMode[]).map((mode) => {
          const config = modeConfig[mode];
          const Icon = config.icon;
          const data = directions[mode];
          const isSelected = selectedMode === mode;

          return (
            <button
              key={mode}
              onClick={() => setSelectedMode(mode)}
              className={cn(
                "flex-1 flex flex-col items-center gap-1 p-2 rounded-lg transition-colors",
                isSelected
                  ? "bg-primary/10 border border-primary/20"
                  : "bg-muted/50 hover:bg-muted border border-transparent"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4",
                  isSelected ? config.color : "text-muted-foreground"
                )}
              />
              <span
                className={cn(
                  "text-xs font-medium",
                  isSelected ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {data?.duration_text || "—"}
              </span>
            </button>
          );
        })}
      </div>

      {/* Current route details */}
      {currentDirections && (
        <div className="rounded-lg bg-muted/50 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-sm">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">
                  {currentDirections.duration_text}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                <span>{currentDirections.distance_text}</span>
              </div>
            </div>
          </div>

          {/* Step-by-step directions (expandable) */}
          {currentDirections.steps && currentDirections.steps.length > 0 && (
            <div>
              <button
                onClick={() => setShowSteps(!showSteps)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {showSteps ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
                <span>{showSteps ? "Hide" : "Show"} directions</span>
              </button>

              {showSteps && (
                <ol className="mt-2 space-y-2 text-xs">
                  {currentDirections.steps.map((step, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-medium">
                        {i + 1}
                      </span>
                      <span className="text-muted-foreground flex-1">
                        {step.instruction}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>
      )}

      {/* Open in Maps button */}
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={openInMaps}
      >
        <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
        Open in Maps
      </Button>
    </div>
  );
}
