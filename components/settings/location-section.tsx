"use client";

import { useState, useTransition } from "react";
import { MapPin, Search, Loader2, Globe, Shield, X } from "lucide-react";
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
  updateLocationFromGeohash,
  toggleLocationSharing,
  updateLocationPrecision,
  clearLocation,
} from "@/lib/actions/location";

interface LocationSectionProps {
  initialLocation: {
    enabled: boolean;
    label: string | null;
    precision: number;
  } | null;
}

interface SearchResult {
  id: number;
  lat: number;
  lng: number;
  label: string;
  city: string | null;
  country: string | null;
  geohash: string;
}

const PRECISION_OPTIONS = [
  { value: "4", label: "~20 km (very approximate)", description: "Maximum privacy" },
  { value: "5", label: "~2.4 km (approximate)", description: "Recommended" },
  { value: "6", label: "~1.2 km (neighborhood)", description: "Good balance" },
];

export function LocationSection({ initialLocation }: LocationSectionProps) {
  const [isPending, startTransition] = useTransition();
  const [enabled, setEnabled] = useState(initialLocation?.enabled ?? false);
  const [label, setLabel] = useState(initialLocation?.label ?? "");
  const [precision, setPrecision] = useState(
    String(initialLocation?.precision ?? 5)
  );
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  // Handle toggle
  const handleToggle = (checked: boolean) => {
    setEnabled(checked);
    startTransition(async () => {
      const result = await toggleLocationSharing(checked);
      if (result.error) {
        toast.error(result.error);
        setEnabled(!checked); // Revert on error
      } else {
        toast.success(checked ? "Location sharing enabled" : "Location sharing disabled");
      }
    });
  };

  // Handle precision change
  const handlePrecisionChange = (value: string) => {
    setPrecision(value);
    startTransition(async () => {
      const result = await updateLocationPrecision(parseInt(value, 10));
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Privacy level updated");
      }
    });
  };

  // Search for cities
  const handleSearch = async () => {
    if (!searchQuery || searchQuery.length < 2) return;
    
    setIsSearching(true);
    try {
      const response = await fetch(
        `/api/geo/search?q=${encodeURIComponent(searchQuery)}`
      );
      const data = await response.json();
      
      if (data.results) {
        setSearchResults(data.results);
      }
    } catch {
      toast.error("Search failed. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  // Select a search result
  const handleSelectLocation = (result: SearchResult) => {
    startTransition(async () => {
      const displayLabel = result.city && result.country
        ? `${result.city}, ${result.country}`
        : result.label.split(",").slice(0, 2).join(",");
      
      const res = await updateLocationFromGeohash({
        geohash: result.geohash,
        label: displayLabel,
        precision: parseInt(precision, 10),
      });
      
      if (res.error) {
        toast.error(res.error);
      } else {
        setLabel(displayLabel);
        setEnabled(true);
        setShowSearch(false);
        setSearchQuery("");
        setSearchResults([]);
        toast.success("Location updated!");
      }
    });
  };

  // Use device location
  const handleUseDeviceLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }

    startTransition(() => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          
          // Reverse geocode to get city name
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
              {
                headers: {
                  "User-Agent": "OhMyReads/1.0",
                },
              }
            );
            const data = await response.json();
            
            const city = data.address?.city || 
                        data.address?.town || 
                        data.address?.village ||
                        data.address?.municipality ||
                        "Unknown";
            const country = data.address?.country || "";
            const displayLabel = `${city}, ${country}`;
            
            const result = await updateLocation({
              lat: latitude,
              lng: longitude,
              label: displayLabel,
              precision: parseInt(precision, 10),
            });
            
            if (result.error) {
              toast.error(result.error);
            } else {
              setLabel(displayLabel);
              setEnabled(true);
              toast.success("Location set from device!");
            }
          } catch {
            toast.error("Could not get location name");
          }
        },
        () => {
          toast.error("Could not get your location. Please enable location access.");
        },
        { enableHighAccuracy: false, timeout: 10000 }
      );
    });
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
        toast.success("Location cleared");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Enable/Disable Toggle */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="location-toggle" className="text-base font-medium">
            Share my location
          </Label>
          <p className="text-sm text-muted-foreground">
            Show your approximate location on the Reader Map
          </p>
        </div>
        <Switch
          id="location-toggle"
          checked={enabled}
          onCheckedChange={handleToggle}
          disabled={isPending}
        />
      </div>

      {/* Current Location Display */}
      {label && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
          <MapPin className="h-5 w-5 text-primary flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{label}</p>
            <p className="text-xs text-muted-foreground">
              Your approximate location
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClearLocation}
            disabled={isPending}
            title="Clear location"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Set Location Options */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Set your location</Label>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleUseDeviceLocation}
            disabled={isPending}
          >
            <Globe className="h-4 w-4 mr-2" />
            Use device location
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSearch(!showSearch)}
            disabled={isPending}
          >
            <Search className="h-4 w-4 mr-2" />
            Search for city
          </Button>
        </div>

        {/* City Search */}
        {showSearch && (
          <div className="space-y-2 p-3 rounded-lg border bg-card">
            <div className="flex gap-2">
              <Input
                placeholder="Enter city name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="flex-1"
              />
              <Button
                size="sm"
                onClick={handleSearch}
                disabled={isSearching || searchQuery.length < 2}
              >
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Search"
                )}
              </Button>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {searchResults.map((result) => (
                  <button
                    key={result.id}
                    onClick={() => handleSelectLocation(result)}
                    className="w-full text-left p-2 rounded hover:bg-muted text-sm transition-colors"
                    disabled={isPending}
                  >
                    <span className="font-medium">
                      {result.city || result.label.split(",")[0]}
                    </span>
                    {result.country && (
                      <span className="text-muted-foreground">
                        , {result.country}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Privacy Level */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <Label className="text-sm font-medium">Privacy level</Label>
        </div>
        <Select value={precision} onValueChange={handlePrecisionChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select privacy level" />
          </SelectTrigger>
          <SelectContent>
            {PRECISION_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <div>
                  <span>{option.label}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    ({option.description})
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Your exact coordinates are never stored. Only an approximate area is saved.
        </p>
      </div>
    </div>
  );
}

