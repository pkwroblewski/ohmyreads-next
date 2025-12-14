"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapPin, BookOpen, Building2, Coffee, Users, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { encodeGeohash, decodeGeohash } from "@/lib/utils/geohash";

interface ReaderMapProps {
  initialCenter?: { lat: number; lng: number };
  initialZoom?: number;
}

interface ReaderPin {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  locationLabel: string | null;
  geohashPrefix: string | null;
}

interface PlacePin {
  id: string;
  name: string;
  type: string;
  source: "community" | "osm";
  address: string | null;
  lat: number | null;
  lng: number | null;
  website: string | null;
}

export function ReaderMap({
  initialCenter = { lat: 40.7128, lng: -74.006 }, // NYC default
  initialZoom = 10,
}: ReaderMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [readers, setReaders] = useState<ReaderPin[]>([]);
  const [places, setPlaces] = useState<{ community: PlacePin[]; osm: PlacePin[] }>({
    community: [],
    osm: [],
  });
  const [selectedItem, setSelectedItem] = useState<ReaderPin | PlacePin | null>(null);
  
  // Layer visibility
  const [showReaders, setShowReaders] = useState(true);
  const [showBookstores, setShowBookstores] = useState(true);
  const [showLibraries, setShowLibraries] = useState(true);
  const [showCafes, setShowCafes] = useState(false);

  // Get user's location on mount
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!mapContainer.current) return;

    // Initialize map
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
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
      },
      center: [initialCenter.lng, initialCenter.lat],
      zoom: initialZoom,
    });

    // Add navigation controls
    map.current.addControl(new maplibregl.NavigationControl(), "top-right");

    // Handle map load
    map.current.on("load", () => {
      setIsLoading(false);
    });

    // Handle map movement
    map.current.on("moveend", () => {
      if (map.current) {
        const center = map.current.getCenter();
        fetchDataForLocation(center.lat, center.lng);
      }
    });

    // Try to get user's location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation({ lat: latitude, lng: longitude });
          map.current?.setCenter([longitude, latitude]);
          fetchDataForLocation(latitude, longitude);
        },
        () => {
          // Use default location if geolocation fails
          fetchDataForLocation(initialCenter.lat, initialCenter.lng);
        }
      );
    } else {
      fetchDataForLocation(initialCenter.lat, initialCenter.lng);
    }

    return () => {
      map.current?.remove();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch data for a location
  const fetchDataForLocation = async (lat: number, lng: number) => {
    const geohash = encodeGeohash(lat, lng, 4);

    // Build types filter
    const types: string[] = [];
    if (showBookstores) types.push("bookstore");
    if (showLibraries) types.push("library");
    if (showCafes) types.push("cafe");

    try {
      // Fetch readers and places in parallel
      const [readersRes, placesRes] = await Promise.all([
        showReaders
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

  // Update markers when data changes
  useEffect(() => {
    if (!map.current) return;

    // Clear existing markers
    markers.current.forEach((marker) => marker.remove());
    markers.current = [];

    // Add reader markers
    if (showReaders) {
      readers.forEach((reader) => {
        if (!reader.geohashPrefix) return;

        const { lat, lng } = decodeGeohash(reader.geohashPrefix);
        
        // Create custom marker element
        const el = document.createElement("div");
        el.className = "reader-marker";
        el.innerHTML = `
          <div class="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow-lg cursor-pointer hover:scale-110 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
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
      if (place.type === "bookstore" && !showBookstores) return;
      if (place.type === "library" && !showLibraries) return;
      if (place.type === "cafe" && !showCafes) return;

      // Create custom marker element
      const el = document.createElement("div");
      el.className = "place-marker";
      
      const bgColor = place.type === "bookstore" 
        ? "bg-amber-500" 
        : place.type === "library" 
          ? "bg-blue-500" 
          : "bg-orange-500";
      
      const icon = place.type === "bookstore"
        ? '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>'
        : place.type === "library"
          ? '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="3" x2="21" y1="9" y2="9"/><line x1="9" x2="9" y1="21" y2="9"/></svg>'
          : '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" x2="6" y1="2" y2="4"/><line x1="10" x2="10" y1="2" y2="4"/><line x1="14" x2="14" y1="2" y2="4"/></svg>';
      
      el.innerHTML = `
        <div class="w-7 h-7 rounded-full ${bgColor} flex items-center justify-center text-white shadow-lg cursor-pointer hover:scale-110 transition-transform">
          ${icon}
        </div>
      `;
      el.addEventListener("click", () => setSelectedItem(place));

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([place.lng, place.lat])
        .addTo(map.current!);
      markers.current.push(marker);
    });
  }, [readers, places, showReaders, showBookstores, showLibraries, showCafes]);

  // Center on user location
  const handleCenterOnUser = () => {
    if (userLocation && map.current) {
      map.current.flyTo({
        center: [userLocation.lng, userLocation.lat],
        zoom: 12,
      });
    }
  };

  return (
    <div className="relative w-full h-[600px] rounded-lg overflow-hidden border">
      {/* Map Container */}
      <div ref={mapContainer} className="w-full h-full" />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* Layer Controls */}
      <div className="absolute top-4 left-4 z-10">
        <Card className="shadow-lg">
          <CardContent className="p-3 space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Show on map
            </p>
            
            <div className="flex items-center gap-2">
              <Switch
                id="show-readers"
                checked={showReaders}
                onCheckedChange={setShowReaders}
              />
              <Label htmlFor="show-readers" className="flex items-center gap-1.5 text-sm">
                <Users className="h-4 w-4 text-primary" />
                Readers
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="show-bookstores"
                checked={showBookstores}
                onCheckedChange={setShowBookstores}
              />
              <Label htmlFor="show-bookstores" className="flex items-center gap-1.5 text-sm">
                <BookOpen className="h-4 w-4 text-amber-500" />
                Bookstores
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="show-libraries"
                checked={showLibraries}
                onCheckedChange={setShowLibraries}
              />
              <Label htmlFor="show-libraries" className="flex items-center gap-1.5 text-sm">
                <Building2 className="h-4 w-4 text-blue-500" />
                Libraries
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="show-cafes"
                checked={showCafes}
                onCheckedChange={setShowCafes}
              />
              <Label htmlFor="show-cafes" className="flex items-center gap-1.5 text-sm">
                <Coffee className="h-4 w-4 text-orange-500" />
                Cafes
              </Label>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Center on user button */}
      {userLocation && (
        <Button
          size="icon"
          variant="secondary"
          className="absolute bottom-4 right-4 z-10 shadow-lg"
          onClick={handleCenterOnUser}
          title="Center on my location"
        >
          <MapPin className="h-4 w-4" />
        </Button>
      )}

      {/* Selected Item Card */}
      {selectedItem && (
        <Card className="absolute bottom-4 left-4 z-10 w-72 shadow-lg">
          <CardContent className="p-4">
            <button
              onClick={() => setSelectedItem(null)}
              className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
            >
              ×
            </button>
            
            {"username" in selectedItem ? (
              // Reader card
              <div className="flex items-center gap-3">
                <Avatar>
                  {selectedItem.avatarUrl && (
                    <AvatarImage src={selectedItem.avatarUrl} />
                  )}
                  <AvatarFallback>
                    {(selectedItem.displayName || selectedItem.username || "?")[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">
                    {selectedItem.displayName || selectedItem.username}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selectedItem.locationLabel || "Reader"}
                  </p>
                  {selectedItem.username && (
                    <a
                      href={`/users/${selectedItem.username}`}
                      className="text-sm text-primary hover:underline"
                    >
                      View profile
                    </a>
                  )}
                </div>
              </div>
            ) : (
              // Place card
              <div>
                <div className="flex items-start gap-2 mb-2">
                  {selectedItem.type === "bookstore" && (
                    <BookOpen className="h-5 w-5 text-amber-500 mt-0.5" />
                  )}
                  {selectedItem.type === "library" && (
                    <Building2 className="h-5 w-5 text-blue-500 mt-0.5" />
                  )}
                  {selectedItem.type === "cafe" && (
                    <Coffee className="h-5 w-5 text-orange-500 mt-0.5" />
                  )}
                  <div>
                    <p className="font-medium">{selectedItem.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {selectedItem.type}
                    </p>
                  </div>
                </div>
                {selectedItem.address && (
                  <p className="text-sm text-muted-foreground mb-2">
                    {selectedItem.address}
                  </p>
                )}
                <div className="flex gap-2">
                  {selectedItem.website && (
                    <a
                      href={selectedItem.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline"
                    >
                      Website
                    </a>
                  )}
                  {selectedItem.lat && selectedItem.lng && (
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${selectedItem.lat},${selectedItem.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline"
                    >
                      Directions
                    </a>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

