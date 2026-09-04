"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import {
  MapPin,
  Search,
  Loader2,
  Navigation,
  Shield,
  X,
  Check,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  updateLocation,
  toggleLocationSharing,
  updateLocationPrecision,
  clearLocation,
} from "@/lib/actions/location";
import { decodeGeohash } from "@/lib/utils/geohash";

// Dynamic import for mini-map (client-only)
const LocationMiniMap = dynamic(
  () => import("./location-mini-map").then((m) => m.LocationMiniMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-48 rounded-xl bg-muted animate-pulse flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

interface LocationSectionProps {
  initialLocation: {
    enabled: boolean;
    label: string | null;
    precision: number;
    geohash: string | null;
  } | null;
}

interface SearchResult {
  place_name: string;
  center: [number, number];
}

type LocationMode = "idle" | "detecting" | "searching" | "confirming";

export function LocationSection({ initialLocation }: LocationSectionProps) {
  const [isPending, startTransition] = useTransition();
  const [enabled, setEnabled] = useState(initialLocation?.enabled ?? false);
  const [label, setLabel] = useState(initialLocation?.label ?? "");
  const [precision, setPrecision] = useState(initialLocation?.precision ?? 5);

  // Location coordinates (derived from geohash or new selection)
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(() => {
    if (initialLocation?.geohash) {
      const { lat, lng } = decodeGeohash(initialLocation.geohash);
      return { lat, lng };
    }
    return null;
  });

  // UI state
  const [mode, setMode] = useState<LocationMode>("idle");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [pendingLocation, setPendingLocation] = useState<{
    lat: number;
    lng: number;
    label: string;
  } | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Handle toggle on/off
  const handleToggle = (checked: boolean) => {
    if (checked && !coordinates) {
      // If turning on but no location set, prompt to set location
      setMode("idle");
      return;
    }

    setEnabled(checked);
    startTransition(async () => {
      const result = await toggleLocationSharing(checked);
      if (result.error) {
        toast.error(result.error);
        setEnabled(!checked);
      } else {
        toast.success(checked ? "You're now visible on the Reader Map" : "Location sharing disabled");
      }
    });
  };

  // Use current device location
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }

    setMode("detecting");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        // Reverse geocode to get place name
        try {
          const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
          let placeName = "Your location";

          if (mapboxToken) {
            const res = await fetch(
              `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${mapboxToken}&types=place,locality,neighborhood&limit=1`
            );
            const data = await res.json();
            if (data.features?.[0]) {
              placeName = data.features[0].place_name.split(",").slice(0, 2).join(",");
            }
          } else {
            // Fallback to Nominatim
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
              { headers: { "User-Agent": "OhMyReads/1.0" } }
            );
            const data = await res.json();
            const city = data.address?.city || data.address?.town || data.address?.village || "Unknown";
            const country = data.address?.country || "";
            placeName = `${city}, ${country}`;
          }

          setPendingLocation({ lat: latitude, lng: longitude, label: placeName });
          setMode("confirming");
        } catch {
          toast.error("Could not determine your location name");
          setMode("idle");
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
        toast.error("Could not get your location. Please enable location access or search manually.");
        setMode("idle");
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  };

  // Search for places
  const handleSearch = async () => {
    if (!searchQuery || searchQuery.length < 2) return;

    setIsSearching(true);
    try {
      const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

      if (mapboxToken) {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json?access_token=${mapboxToken}&limit=5&types=place,locality,neighborhood,address`
        );
        const data = await res.json();
        setSearchResults(
          data.features?.map((f: { place_name: string; center: [number, number] }) => ({
            place_name: f.place_name,
            center: f.center,
          })) || []
        );
      } else {
        // Fallback to Nominatim
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5`
        );
        const data = await res.json();
        setSearchResults(
          data.map((item: { display_name: string; lon: string; lat: string }) => ({
            place_name: item.display_name,
            center: [parseFloat(item.lon), parseFloat(item.lat)] as [number, number],
          }))
        );
      }
    } catch (error) {
      console.error("Search error:", error);
      toast.error("Search failed. Please try again.");
    }
    setIsSearching(false);
  };

  // Select a search result
  const handleSelectResult = (result: SearchResult) => {
    const shortLabel = result.place_name.split(",").slice(0, 2).join(",").trim();
    setPendingLocation({
      lat: result.center[1],
      lng: result.center[0],
      label: shortLabel,
    });
    setMode("confirming");
    setSearchQuery("");
    setSearchResults([]);
  };

  // Confirm and save location
  const handleConfirmLocation = () => {
    if (!pendingLocation) return;

    startTransition(async () => {
      const result = await updateLocation({
        lat: pendingLocation.lat,
        lng: pendingLocation.lng,
        label: pendingLocation.label,
        precision,
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        setLabel(pendingLocation.label);
        setCoordinates({ lat: pendingLocation.lat, lng: pendingLocation.lng });
        setEnabled(true);
        setPendingLocation(null);
        setMode("idle");
        toast.success("Location saved! You're now on the Reader Map");
      }
    });
  };

  // Cancel pending location
  const handleCancelPending = () => {
    setPendingLocation(null);
    setMode("idle");
  };

  // Clear location
  const handleClearLocation = () => {
    startTransition(async () => {
      const result = await clearLocation();
      if (result.error) {
        toast.error(result.error);
      } else {
        setEnabled(false);
        setLabel("");
        setCoordinates(null);
        toast.success("Location cleared");
      }
    });
  };

  // Handle precision change
  const handlePrecisionChange = (value: string) => {
    const newPrecision = parseInt(value, 10);
    setPrecision(newPrecision);

    if (coordinates && enabled) {
      startTransition(async () => {
        const result = await updateLocationPrecision(newPrecision);
        if (result.error) {
          toast.error(result.error);
        }
      });
    }
  };

  // Focus search input when mode changes
  useEffect(() => {
    if (mode === "searching" && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [mode]);

  // User has location set
  const hasLocation = coordinates && label;

  return (
    <div className="space-y-6">
      {/* Enable Toggle - Only show if location is set */}
      {hasLocation && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50 border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <MapPin className="h-5 w-5 text-primary" />
            </div>
            <div>
              <Label htmlFor="location-toggle" className="text-base font-medium cursor-pointer">
                Show on Reader Map
              </Label>
              <p className="text-sm text-muted-foreground">
                {enabled ? "Others can see your approximate location" : "Your location is hidden"}
              </p>
            </div>
          </div>
          <Switch
            id="location-toggle"
            checked={enabled}
            onCheckedChange={handleToggle}
            disabled={isPending}
          />
        </div>
      )}

      {/* Current Location Display with Mini Map */}
      {hasLocation && (
        <div className="space-y-3">
          <LocationMiniMap lat={coordinates.lat} lng={coordinates.lng} precision={precision} />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <span className="font-medium">{label}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearLocation}
              disabled={isPending}
              className="text-muted-foreground hover:text-destructive"
            >
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Set Location Options - Show if no location or in confirming mode */}
      {(!hasLocation || mode === "confirming") && (
        <div className="space-y-4">
          {/* Pending Location Confirmation */}
          {mode === "confirming" && pendingLocation && (
            <div className="space-y-4 p-4 rounded-xl border-2 border-primary/50 bg-primary/5">
              <div className="flex items-center gap-2 text-primary">
                <MapPin className="h-5 w-5" />
                <span className="font-medium">Confirm Your Location</span>
              </div>

              <LocationMiniMap
                lat={pendingLocation.lat}
                lng={pendingLocation.lng}
                precision={precision}
              />

              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{pendingLocation.label}</span>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleConfirmLocation}
                  disabled={isPending}
                  className="flex-1"
                >
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Confirm Location
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCancelPending}
                  disabled={isPending}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Location Options - Show when idle */}
          {mode === "idle" && !hasLocation && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Set your location to appear on the Reader Map and connect with nearby book lovers.
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                {/* Use Current Location */}
                <Button
                  variant="outline"
                  onClick={handleUseCurrentLocation}
                  disabled={isPending}
                  className="h-auto py-4 px-4 flex flex-col items-center gap-2 hover:border-primary hover:bg-primary/5"
                >
                  <div className="p-2 rounded-full bg-primary/10">
                    <Navigation className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-center">
                    <div className="font-medium">Use Current Location</div>
                    <div className="text-xs text-muted-foreground">Auto-detect via browser</div>
                  </div>
                </Button>

                {/* Search for Place */}
                <Button
                  variant="outline"
                  onClick={() => setMode("searching")}
                  disabled={isPending}
                  className="h-auto py-4 px-4 flex flex-col items-center gap-2 hover:border-primary hover:bg-primary/5"
                >
                  <div className="p-2 rounded-full bg-primary/10">
                    <Search className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-center">
                    <div className="font-medium">Search for a Place</div>
                    <div className="text-xs text-muted-foreground">Find your city or area</div>
                  </div>
                </Button>
              </div>
            </div>
          )}

          {/* Detecting Location */}
          {mode === "detecting" && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
              <p className="font-medium">Detecting your location...</p>
              <p className="text-sm text-muted-foreground">
                Please allow location access when prompted
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMode("idle")}
                className="mt-4"
              >
                Cancel
              </Button>
            </div>
          )}

          {/* Search Mode */}
          {mode === "searching" && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    ref={searchInputRef}
                    placeholder="Search for a city, neighborhood, or place..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    className="pl-9"
                  />
                </div>
                <Button onClick={handleSearch} disabled={isSearching || searchQuery.length < 2}>
                  {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
                </Button>
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="border rounded-xl overflow-hidden divide-y">
                  {searchResults.map((result) => (
                    <button
                      key={`${result.place_name}:${result.center.join(",")}`}
                      onClick={() => handleSelectResult(result)}
                      className="w-full text-left p-3 hover:bg-muted/50 transition-colors flex items-center gap-3"
                    >
                      <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate">{result.place_name}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Back button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setMode("idle");
                  setSearchQuery("");
                  setSearchResults([]);
                }}
              >
                <ChevronDown className="h-4 w-4 mr-1 rotate-90" />
                Back
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Privacy Level - Always visible when location is set or being set */}
      {(hasLocation || mode === "confirming") && (
        <div className="space-y-4 pt-4 border-t">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <Label className="font-medium">Privacy Level</Label>
          </div>

          <Select
            value={String(precision)}
            onValueChange={handlePrecisionChange}
            disabled={isPending}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select privacy level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="4">
                <div className="flex flex-col">
                  <span>City area (~20 km)</span>
                  <span className="text-xs text-muted-foreground">Maximum privacy</span>
                </div>
              </SelectItem>
              <SelectItem value="5">
                <div className="flex flex-col">
                  <span>District (~2.4 km)</span>
                  <span className="text-xs text-muted-foreground">Recommended</span>
                </div>
              </SelectItem>
              <SelectItem value="6">
                <div className="flex flex-col">
                  <span>Neighborhood (~1.2 km)</span>
                  <span className="text-xs text-muted-foreground">More precise</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          <p className="text-xs text-muted-foreground">
            Your exact location is never stored. Only an approximate area is saved.
          </p>
        </div>
      )}
    </div>
  );
}
