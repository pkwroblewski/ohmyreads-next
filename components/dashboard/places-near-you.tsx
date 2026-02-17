"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  MapPin,
  BookMarked,
  Landmark,
  Coffee,
  Clock,
  ArrowRight,
  Loader2,
  MapPinOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NearbyPlace {
  id: string;
  name: string;
  type: string;
  address: string | null;
  lat: number;
  lng: number;
  distance: number | null;
  walking_time: number | null;
  driving_time: number | null;
  is_open: boolean | null;
  source: "community" | "osm";
}

const placeTypeConfig: Record<
  string,
  { icon: typeof BookMarked; color: string; bgColor: string }
> = {
  bookstore: {
    icon: BookMarked,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-500/15",
  },
  library: {
    icon: Landmark,
    color: "text-sky-600 dark:text-sky-400",
    bgColor: "bg-sky-500/15",
  },
  cafe: {
    icon: Coffee,
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-500/15",
  },
};

export function PlacesNearYou() {
  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);

  useEffect(() => {
    // Check if geolocation is available
    if (!("geolocation" in navigator)) {
      setError("Location not supported");
      setIsLoading(false);
      return;
    }

    // Get user's location
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        try {
          const params = new URLSearchParams({
            lat: latitude.toString(),
            lng: longitude.toString(),
            limit: "3",
          });

          const res = await fetch(`/api/geo/nearby-places?${params}`);
          const data = await res.json();

          if (res.ok && data.places) {
            setPlaces(data.places);
          } else {
            setError(data.error || "Could not fetch places");
          }
        } catch {
          setError("Could not fetch places");
        } finally {
          setIsLoading(false);
        }
      },
      () => {
        setLocationDenied(true);
        setIsLoading(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }, []);

  // Don't render anything if location is denied
  if (locationDenied) {
    return null;
  }

  // Loading state
  if (isLoading) {
    return (
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold font-serif flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Places Near You
          </h2>
        </div>
        <div className="p-6 rounded-xl bg-card border border-border flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">
            Finding nearby places...
          </span>
        </div>
      </section>
    );
  }

  // Error state
  if (error) {
    return (
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold font-serif flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Places Near You
          </h2>
        </div>
        <div className="p-6 rounded-xl bg-card border border-border text-center">
          <MapPinOff className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </section>
    );
  }

  // No places found
  if (places.length === 0) {
    return (
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold font-serif flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Places Near You
          </h2>
        </div>
        <div className="p-6 rounded-xl bg-card border border-border text-center">
          <MapPinOff className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground mb-3">
            No bookstores, libraries, or cafes found nearby
          </p>
          <Link href="/community/map">
            <Button variant="outline" size="sm">
              Explore the Map
            </Button>
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold font-serif flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          Places Near You
        </h2>
        <Link
          href="/community/map"
          className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
        >
          View Map
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid gap-3">
        {places.map((place) => {
          const config = placeTypeConfig[place.type] || {
            icon: MapPin,
            color: "text-muted-foreground",
            bgColor: "bg-muted",
          };
          const Icon = config.icon;

          return (
            <Link
              key={place.id}
              href={`/community/map?place=${place.id}&lat=${place.lat}&lng=${place.lng}`}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl",
                "bg-card border border-border",
                "hover:bg-muted/50 hover:border-primary/20 transition-all"
              )}
            >
              {/* Icon */}
              <div
                className={cn(
                  "flex-shrink-0 p-2 rounded-lg",
                  config.bgColor
                )}
              >
                <Icon className={cn("h-4 w-4", config.color)} />
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm truncate">{place.name}</h3>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  {/* Walking time */}
                  {place.walking_time !== null && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {place.walking_time} min walk
                    </span>
                  )}
                  {/* Open status */}
                  {place.is_open !== null && (
                    <span
                      className={cn(
                        "flex items-center gap-1",
                        place.is_open
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      )}
                    >
                      <span
                        className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          place.is_open ? "bg-green-500" : "bg-red-500"
                        )}
                      />
                      {place.is_open ? "Open" : "Closed"}
                    </span>
                  )}
                </div>
              </div>

              {/* Distance */}
              {place.distance !== null && (
                <div className="flex-shrink-0 text-xs text-muted-foreground">
                  {place.distance < 1000
                    ? `${place.distance} m`
                    : `${(place.distance / 1000).toFixed(1)} km`}
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
