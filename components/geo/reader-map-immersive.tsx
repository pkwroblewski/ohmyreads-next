"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Loader2, Locate, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { encodeGeohash, decodeGeohash } from "@/lib/utils/geohash";
import { MapLayerControls } from "./map-layer-controls";
import { MapDetailPanel } from "./map-detail-panel";

export interface ReaderPin {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  locationLabel: string | null;
  geohashPrefix: string | null;
}

export interface PlacePin {
  id: string;
  name: string;
  type: string;
  source: "community" | "osm";
  address: string | null;
  lat: number | null;
  lng: number | null;
  website: string | null;
}

export type MapItem = ReaderPin | PlacePin;

interface ReaderMapImmersiveProps {
  className?: string;
}

export function ReaderMapImmersive({ className }: ReaderMapImmersiveProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [readers, setReaders] = useState<ReaderPin[]>([]);
  const [places, setPlaces] = useState<{ community: PlacePin[]; osm: PlacePin[] }>({
    community: [],
    osm: [],
  });
  const [selectedItem, setSelectedItem] = useState<MapItem | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ place_name: string; center: [number, number] }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  // Layer visibility state
  const [layers, setLayers] = useState({
    readers: true,
    bookstores: true,
    libraries: true,
    cafes: false,
  });

  // Fetch data for a location
  const fetchDataForLocation = async (lat: number, lng: number) => {
    const geohash = encodeGeohash(lat, lng, 4);

    const types: string[] = [];
    if (layers.bookstores) types.push("bookstore");
    if (layers.libraries) types.push("library");
    if (layers.cafes) types.push("cafe");

    try {
      const [readersRes, placesRes] = await Promise.all([
        layers.readers
          ? fetch(`/api/geo/readers?geohash=${geohash}`)
          : Promise.resolve(null),
        types.length > 0
          ? fetch(`/api/geo/places?geohash=${geohash}&types=${types.join(",")}`)
          : Promise.resolve(null),
      ]);

      if (readersRes) {
        const readersData = await readersRes.json();
        setReaders(readersData.readers || []);
      }

      if (placesRes) {
        const placesData = await placesRes.json();
        setPlaces({
          community: placesData.community || [],
          osm: placesData.osm || [],
        });
      }
    } catch (error) {
      console.error("Error fetching map data:", error);
    }
  };

  // Initialize map - exactly like the working ReaderMap
  useEffect(() => {
    if (!mapContainer.current) return;

    // Get Mapbox token
    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

    // Build style - use Mapbox raster tiles if token available
    const style: maplibregl.StyleSpecification = mapboxToken
      ? {
          version: 8,
          sources: {
            "mapbox-streets": {
              type: "raster",
              tiles: [
                `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${mapboxToken}`,
              ],
              tileSize: 512,
              attribution: '© <a href="https://www.mapbox.com/">Mapbox</a>',
            },
          },
          layers: [
            {
              id: "mapbox-streets-layer",
              type: "raster",
              source: "mapbox-streets",
            },
          ],
        }
      : {
          version: 8,
          sources: {
            osm: {
              type: "raster",
              tiles: [
                "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
                "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
                "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
              ],
              tileSize: 256,
              attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            },
          },
          layers: [
            {
              id: "osm",
              type: "raster",
              source: "osm",
            },
          ],
        };

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style,
      center: [-74.006, 40.7128], // NYC default
      zoom: 10,
    });

    map.current.addControl(new maplibregl.NavigationControl(), "top-right");

    map.current.on("load", () => {
      setIsLoading(false);
    });

    map.current.on("moveend", () => {
      if (map.current) {
        const center = map.current.getCenter();
        fetchDataForLocation(center.lat, center.lng);
      }
    });

    // Try to get user's location - first browser, then IP fallback
    const getIPLocation = async () => {
      try {
        // Use ip-api.com for free IP geolocation
        const res = await fetch("http://ip-api.com/json/?fields=lat,lon,city,country");
        const data = await res.json();
        if (data.lat && data.lon) {
          map.current?.setCenter([data.lon, data.lat]);
          map.current?.setZoom(11);
          fetchDataForLocation(data.lat, data.lon);
        } else {
          fetchDataForLocation(40.7128, -74.006);
        }
      } catch {
        fetchDataForLocation(40.7128, -74.006);
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation({ lat: latitude, lng: longitude });
          map.current?.setCenter([longitude, latitude]);
          map.current?.setZoom(12);
          fetchDataForLocation(latitude, longitude);
        },
        () => {
          // Browser geolocation denied - try IP geolocation
          getIPLocation();
        }
      );
    } else {
      // No browser geolocation - try IP geolocation
      getIPLocation();
    }

    return () => {
      map.current?.remove();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update markers when data changes
  useEffect(() => {
    if (!map.current) return;

    // Clear existing markers
    markers.current.forEach((marker) => marker.remove());
    markers.current = [];

    // Add reader markers
    if (layers.readers) {
      readers.forEach((reader) => {
        if (!reader.geohashPrefix) return;

        const { lat, lng } = decodeGeohash(reader.geohashPrefix);

        const el = document.createElement("div");
        el.className = "reader-marker";
        el.innerHTML = `
          <div class="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow-lg cursor-pointer hover:scale-110 transition-transform border-2 border-white">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
        `;
        el.addEventListener("click", () => setSelectedItem(reader));

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([lng, lat])
          .addTo(map.current!);
        markers.current.push(marker);
      });
    }

    // Add place markers
    const allPlaces = [...places.community, ...places.osm];
    allPlaces.forEach((place) => {
      if (!place.lat || !place.lng) return;
      if (place.type === "bookstore" && !layers.bookstores) return;
      if (place.type === "library" && !layers.libraries) return;
      if (place.type === "cafe" && !layers.cafes) return;

      const el = document.createElement("div");
      el.className = "place-marker";

      const bgColor =
        place.type === "bookstore"
          ? "bg-amber-500"
          : place.type === "library"
            ? "bg-blue-500"
            : "bg-orange-500";

      const icon =
        place.type === "bookstore"
          ? '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>'
          : place.type === "library"
            ? '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="3" x2="21" y1="9" y2="9"/><line x1="9" x2="9" y1="21" y2="9"/></svg>'
            : '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" x2="6" y1="2" y2="4"/><line x1="10" x2="10" y1="2" y2="4"/><line x1="14" x2="14" y1="2" y2="4"/></svg>';

      el.innerHTML = `
        <div class="w-9 h-9 rounded-full ${bgColor} flex items-center justify-center text-white shadow-lg cursor-pointer hover:scale-110 transition-transform border-2 border-white">
          ${icon}
        </div>
      `;
      el.addEventListener("click", () => setSelectedItem(place));

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([place.lng, place.lat])
        .addTo(map.current!);
      markers.current.push(marker);
    });
  }, [readers, places, layers]);

  // Center on user location
  const handleCenterOnUser = () => {
    if (userLocation && map.current) {
      map.current.flyTo({
        center: [userLocation.lng, userLocation.lat],
        zoom: 13,
      });
    }
  };

  // Handle layer toggle
  const handleLayerToggle = (layer: keyof typeof layers) => {
    setLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  };

  // Search for places using Mapbox Geocoding
  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    if (!mapboxToken) {
      // Fallback: use Nominatim (OSM) geocoding
      setIsSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`
        );
        const data = await res.json();
        setSearchResults(
          data.map((item: { display_name: string; lon: string; lat: string }) => ({
            place_name: item.display_name,
            center: [parseFloat(item.lon), parseFloat(item.lat)] as [number, number],
          }))
        );
      } catch (error) {
        console.error("Search error:", error);
      }
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxToken}&limit=5&types=place,locality,neighborhood`
      );
      const data = await res.json();
      setSearchResults(
        data.features?.map((f: { place_name: string; center: [number, number] }) => ({
          place_name: f.place_name,
          center: f.center,
        })) || []
      );
    } catch (error) {
      console.error("Search error:", error);
    }
    setIsSearching(false);
  };

  // Handle search result selection
  const handleSelectPlace = (center: [number, number], placeName: string) => {
    if (map.current) {
      map.current.flyTo({
        center,
        zoom: 12,
      });
      fetchDataForLocation(center[1], center[0]);
    }
    setSearchQuery(placeName.split(",")[0]); // Just show city name
    setSearchResults([]);
    setShowSearch(false);
  };

  // Refetch when layers change
  useEffect(() => {
    if (map.current && !isLoading) {
      const center = map.current.getCenter();
      fetchDataForLocation(center.lat, center.lng);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers.readers, layers.bookstores, layers.libraries, layers.cafes]);

  return (
    <div className={cn("relative w-full", className)} style={{ height: "calc(100vh - 4rem)" }}>
      {/* Map Container */}
      <div ref={mapContainer} className="w-full h-full" />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-50">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading map...</p>
          </div>
        </div>
      )}

      {/* Search Bar - Top Center */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 w-full max-w-md px-4">
        <div className="relative">
          <div className="flex items-center gap-2 bg-card/95 backdrop-blur-sm rounded-full shadow-lg border px-4 py-2">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              type="text"
              placeholder="Search city or location..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                handleSearch(e.target.value);
              }}
              onFocus={() => setShowSearch(true)}
              className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 p-0 h-auto text-sm"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => {
                  setSearchQuery("");
                  setSearchResults([]);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Search Results Dropdown */}
          {showSearch && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-card rounded-lg shadow-lg border overflow-hidden">
              {searchResults.map((result, index) => (
                <button
                  key={index}
                  className="w-full px-4 py-3 text-left text-sm hover:bg-muted transition-colors border-b last:border-0"
                  onClick={() => handleSelectPlace(result.center, result.place_name)}
                >
                  {result.place_name}
                </button>
              ))}
            </div>
          )}

          {/* Searching indicator */}
          {isSearching && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-card rounded-lg shadow-lg border p-4 text-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
              Searching...
            </div>
          )}
        </div>
      </div>

      {/* Layer Controls - Below search */}
      <MapLayerControls
        layers={layers}
        onToggle={handleLayerToggle}
        className="absolute top-20 left-4 z-10"
      />

      {/* Center on User Button - Bottom Right */}
      {userLocation && (
        <Button
          size="icon"
          variant="secondary"
          className="absolute bottom-6 right-6 z-10 shadow-lg h-12 w-12 rounded-full"
          onClick={handleCenterOnUser}
          title="Center on my location"
        >
          <Locate className="h-5 w-5" />
        </Button>
      )}

      {/* Detail Panel - Bottom (mobile) / Right (desktop) */}
      <MapDetailPanel
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
      />
    </div>
  );
}
