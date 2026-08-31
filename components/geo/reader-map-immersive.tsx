"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useTheme } from "next-themes";
import { Loader2, Locate, Search, X, MapPin, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { encodeGeohash, decodeGeohash } from "@/lib/utils/geohash";
import { MapLayerControls } from "./map-layer-controls";
import { MapDetailPanel } from "./map-detail-panel";
import { IsochroneControls } from "./isochrone-controls";
import { AIPlaceSearch } from "./ai-place-search";
import { MarkSpotModal } from "./mark-spot-modal";
import type { UserPresenceData } from "./map-context-panel";

export type PresenceType = "temporary" | "recommended";

export interface CurrentlyReadingBook {
  id: string;
  title: string;
  author: string | null;
  coverUrl: string | null;
  slug: string | null;
}

export interface ReaderPin {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  locationLabel: string | null;
  geohashPrefix: string | null;
  presenceType: PresenceType;
  presenceNote: string | null;
  presenceExpiresAt: string | null;
  currentlyReading: CurrentlyReadingBook | null;
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
  // OSM extended fields
  phone: string | null;
  email: string | null;
  opening_hours: string | null;
  wheelchair: string | null;
  description: string | null;
  image: string | null;
}

export type MapItem = ReaderPin | PlacePin;

interface ReaderMapImmersiveProps {
  className?: string;
  currentUserId?: string;
  // Callback props for state sync with parent
  onSelectionChange?: (item: MapItem | null) => void;
  onReadersChange?: (readers: ReaderPin[]) => void;
  onUserLocationChange?: (location: { lat: number; lng: number } | null) => void;
  onFlyToLocation?: (callback: (lat: number, lng: number) => void) => void;
  // Callback to provide refresh function to parent
  onRefreshData?: (callback: () => void) => void;
  // User presence for check-out button
  userPresence?: UserPresenceData | null;
  onClearPresence?: () => void;
}

export function ReaderMapImmersive({
  className,
  currentUserId,
  onSelectionChange,
  onReadersChange,
  onUserLocationChange,
  onFlyToLocation,
  onRefreshData,
  userPresence,
  onClearPresence,
}: ReaderMapImmersiveProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();

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
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(-1); // Keyboard navigation index
  // Highlighted place from search (to show with distinctive marker)
  const [highlightedPlace, setHighlightedPlace] = useState<{ lat: number; lng: number; name: string } | null>(null);

  // Mark spot modal state
  const [showMarkSpotModal, setShowMarkSpotModal] = useState(false);
  const [markSpotPlace, setMarkSpotPlace] = useState<PlacePin | null>(null);
  const [markSpotDefaultType, setMarkSpotDefaultType] = useState<"temporary" | "recommended">("temporary");

  // Check-out confirmation dialog state (mobile)
  const [showCheckOutDialog, setShowCheckOutDialog] = useState(false);

  // Layer visibility state
  const [layers, setLayers] = useState({
    readers: true,
    bookstores: true,
    libraries: true,
    cafes: false,
    restaurants: false,
  });

  // Ref to always have latest layers for callbacks
  const layersRef = useRef(layers);
  useEffect(() => {
    layersRef.current = layers;
  }, [layers]);

  // Track previous layers to detect when a layer is turned ON
  const prevLayersRef = useRef(layers);

  // ARIA live region for reader count changes
  const prevReaderCountRef = useRef(readers.length);
  const [readerCountAnnouncement, setReaderCountAnnouncement] = useState("");
  useEffect(() => {
    // Check if any layer was turned ON (false -> true)
    const layerTurnedOn =
      (!prevLayersRef.current.bookstores && layers.bookstores) ||
      (!prevLayersRef.current.libraries && layers.libraries) ||
      (!prevLayersRef.current.cafes && layers.cafes) ||
      (!prevLayersRef.current.restaurants && layers.restaurants);

    // If a layer was turned on and map exists, refetch data
    if (layerTurnedOn && map.current) {
      const center = map.current.getCenter();
      const zoom = map.current.getZoom();
      // Update layersRef immediately before fetch
      layersRef.current = layers;
      fetchDataForLocation(center.lat, center.lng, zoom);
    }

    prevLayersRef.current = layers;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers]);

  // Update ARIA live region when reader count changes
  useEffect(() => {
    const currentCount = readers.length;
    const prevCount = prevReaderCountRef.current;

    // Only announce if count actually changed and we have data (avoid initial load)
    if (currentCount !== prevCount && prevCount !== 0) {
      const message =
        currentCount === 0
          ? "No readers in this area"
          : currentCount === 1
            ? "1 reader in this area"
            : `${currentCount} readers in this area`;
      setReaderCountAnnouncement(message);
    }

    prevReaderCountRef.current = currentCount;
  }, [readers.length]);

  // Isochrone state
  const [isochroneData, setIsochroneData] = useState<{
    geometry: GeoJSON.Polygon;
    center: [number, number];
    minutes: number;
    profile: "walking" | "cycling" | "driving";
  } | null>(null);

  // Callbacks for state sync with parent
  useEffect(() => {
    onSelectionChange?.(selectedItem);
  }, [selectedItem, onSelectionChange]);

  useEffect(() => {
    onReadersChange?.(readers);
  }, [readers, onReadersChange]);

  useEffect(() => {
    onUserLocationChange?.(userLocation);
  }, [userLocation, onUserLocationChange]);

  // Provide flyToLocation callback to parent
  useEffect(() => {
    if (onFlyToLocation) {
      onFlyToLocation((lat: number, lng: number) => {
        if (map.current) {
          map.current.flyTo({
            center: [lng, lat],
            zoom: 15,
            pitch: 50,
            bearing: 0,
            duration: 1500,
            essential: true,
          });
        }
      });
    }
  }, [onFlyToLocation]);

  // Provide refreshData callback to parent (for triggering refresh after marking a spot)
  useEffect(() => {
    if (onRefreshData) {
      onRefreshData(() => {
        if (map.current) {
          const center = map.current.getCenter();
          const zoom = map.current.getZoom();
          fetchDataForLocation(center.lat, center.lng, zoom, true);
        }
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRefreshData]);

  // Calculate geohash precision based on zoom level
  // Higher zoom = more precise geohash = smaller area
  const getGeohashPrecision = (zoom: number): number => {
    if (zoom >= 15) return 6;      // ~1.2km - neighborhood
    if (zoom >= 12) return 5;      // ~5km - city
    return 4;                       // ~20km - regional
  };

  // Fetch data for a location
  const fetchDataForLocation = async (lat: number, lng: number, zoom?: number, forceRefresh?: boolean) => {
    const precision = zoom ? getGeohashPrecision(zoom) : 4;
    const geohash = encodeGeohash(lat, lng, precision);

    // Use ref to get latest layer state (avoids stale closures)
    const currentLayers = layersRef.current;

    const types: string[] = [];
    if (currentLayers.bookstores) types.push("bookstore");
    if (currentLayers.libraries) types.push("library");
    if (currentLayers.cafes) types.push("cafe");
    if (currentLayers.restaurants) types.push("restaurant");

    // Add cache-busting parameter when force refresh is needed (e.g., after marking a spot)
    const cacheBuster = forceRefresh ? `&_t=${Date.now()}` : "";

    try {
      const [readersRes, placesRes] = await Promise.all([
        currentLayers.readers
          ? fetch(`/api/geo/readers?geohash=${geohash}${cacheBuster}`)
          : Promise.resolve(null),
        types.length > 0
          ? fetch(`/api/geo/places?geohash=${geohash}&types=${types.join(",")}${cacheBuster}`)
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

  // Initialize map with Mapbox GL v3
  useEffect(() => {
    if (!mapContainer.current) return;

    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

    if (!mapboxToken) {
      console.error("Mapbox token not found");
      setIsLoading(false);
      return;
    }

    // Set the access token
    mapboxgl.accessToken = mapboxToken;

    // Create map with Mapbox Standard style and 3D features
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/standard",
      center: [6.1319, 49.6116], // Luxembourg City default
      zoom: 11,
      pitch: 45, // 3D perspective
      bearing: -15, // Slight rotation for visual interest
      antialias: true,
    });

    // Add navigation controls
    map.current.addControl(
      new mapboxgl.NavigationControl({
        visualizePitch: true,
      }),
      "bottom-right"
    );

    // Add scale control
    map.current.addControl(
      new mapboxgl.ScaleControl({
        maxWidth: 100,
        unit: "metric",
      }),
      "bottom-left"
    );

    // Suppress Mapbox tile loading errors (403s, network errors, etc.)
    map.current.on("error", (e) => {
      // Silently ignore most map errors to prevent console spam
      const errorMsg = e.error?.message || "";
      if (errorMsg.includes("403") || errorMsg.includes("tile")) {
        return; // Token permission or tile loading issue - ignore silently
      }
      // Only log unexpected errors in development
      if (process.env.NODE_ENV === "development") {
        console.warn("Map error:", errorMsg || e);
      }
    });

    map.current.on("load", () => {
      setIsLoading(false);

      // Add fog for atmospheric depth
      map.current?.setFog({
        range: [0.5, 10],
        color: resolvedTheme === "dark" ? "#1a1a2e" : "#ffffff",
        "high-color": resolvedTheme === "dark" ? "#000022" : "#add8e6",
        "horizon-blend": 0.1,
        "star-intensity": resolvedTheme === "dark" ? 0.15 : 0,
        "space-color": resolvedTheme === "dark" ? "#000011" : "#d8f2ff",
      });

      // Set light preset based on theme
      try {
        map.current?.setConfigProperty("basemap", "lightPreset",
          resolvedTheme === "dark" ? "night" : "day"
        );
      } catch {
        // Standard style config might not be available in all versions
        console.log("Light preset configuration not available");
      }
    });

    map.current.on("moveend", () => {
      // Debounce: wait 300ms after map stops moving to fetch data
      if (moveEndTimeoutRef.current) {
        clearTimeout(moveEndTimeoutRef.current);
      }
      moveEndTimeoutRef.current = setTimeout(() => {
        if (map.current) {
          const center = map.current.getCenter();
          const zoom = map.current.getZoom();
          fetchDataForLocation(center.lat, center.lng, zoom);
        }
      }, 300);
    });

    // Get user's location from IP (server-side proxy to avoid CORS)
    const getIPLocation = async () => {
      try {
        const res = await fetch("/api/geo/ip-location");
        const data = await res.json();
        if (data.latitude && data.longitude) {
          map.current?.flyTo({
            center: [data.longitude, data.latitude],
            zoom: 12,
            pitch: 50,
            bearing: 0,
            duration: 2000,
            essential: true,
          });
          setUserLocation({ lat: data.latitude, lng: data.longitude });
          fetchDataForLocation(data.latitude, data.longitude, 12);
        } else {
          // Fallback to Luxembourg City
          map.current?.flyTo({
            center: [6.1319, 49.6116],
            zoom: 12,
            pitch: 50,
            bearing: 0,
            duration: 2000,
            essential: true,
          });
          fetchDataForLocation(49.6116, 6.1319, 12);
        }
      } catch {
        // Fallback to Luxembourg City
        map.current?.flyTo({
          center: [6.1319, 49.6116],
          zoom: 12,
          pitch: 50,
          bearing: 0,
          duration: 2000,
          essential: true,
        });
        fetchDataForLocation(49.6116, 6.1319, 12);
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation({ lat: latitude, lng: longitude });
          map.current?.flyTo({
            center: [longitude, latitude],
            zoom: 13,
            pitch: 50,
            bearing: 0,
            duration: 2000,
            essential: true,
          });
          fetchDataForLocation(latitude, longitude, 13);
        },
        () => {
          getIPLocation();
        }
      );
    } else {
      getIPLocation();
    }

    return () => {
      if (moveEndTimeoutRef.current) {
        clearTimeout(moveEndTimeoutRef.current);
      }
      map.current?.remove();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update fog and lighting when theme changes
  useEffect(() => {
    if (!map.current || isLoading) return;

    // Update fog colors for theme
    map.current.setFog({
      range: [0.5, 10],
      color: resolvedTheme === "dark" ? "#1a1a2e" : "#ffffff",
      "high-color": resolvedTheme === "dark" ? "#000022" : "#add8e6",
      "horizon-blend": 0.1,
      "star-intensity": resolvedTheme === "dark" ? 0.15 : 0,
      "space-color": resolvedTheme === "dark" ? "#000011" : "#d8f2ff",
    });

    // Update light preset
    try {
      map.current.setConfigProperty("basemap", "lightPreset",
        resolvedTheme === "dark" ? "night" : "day"
      );
    } catch {
      // Config might not be available
    }
  }, [resolvedTheme, isLoading]);

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

        // Determine marker style based on presence type
        const presenceType = reader.presenceType;

        // Build accessible label for the marker
        const readerName = reader.displayName || reader.username || "Reader";
        const locationDesc = reader.locationLabel || "this location";
        const presenceDesc = presenceType === "recommended"
          ? "recommended reading spot"
          : "reading here now";
        const readingDesc = reader.currentlyReading
          ? `, currently reading ${reader.currentlyReading.title}`
          : "";
        const ariaLabel = `${readerName}, ${presenceDesc} at ${locationDesc}${readingDesc}`;

        // Create marker button using DOM APIs to avoid XSS risk
        const btn = document.createElement("div");
        btn.setAttribute("role", "button");
        btn.setAttribute("tabindex", "0");
        btn.setAttribute("aria-label", ariaLabel);

        if (presenceType === "recommended") {
          // Gold star marker for recommended spots
          btn.className = "w-11 h-11 rounded-full bg-amber-400 flex items-center justify-center text-white shadow-lg cursor-pointer hover:scale-110 transition-transform border-2 border-yellow-200 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-offset-2";
          btn.style.boxShadow = "0 0 12px 4px rgba(251, 191, 36, 0.4)";
          // Static SVG icon (no user data)
          btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
        } else {
          // Pulsing green marker for "here now" (temporary presence)
          btn.className = "w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-lg cursor-pointer hover:scale-110 transition-transform border-2 border-white focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:ring-offset-2";
          btn.style.animation = "pulse 2s ease-in-out infinite";
          btn.style.boxShadow = "0 0 0 0 rgba(16, 185, 129, 0.7)";
          // Static SVG icon (no user data)
          btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
        }
        el.appendChild(btn);

        // Add click and keyboard handlers
        const handleSelect = () => setSelectedItem(reader);
        el.addEventListener("click", handleSelect);
        el.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleSelect();
          }
        });

        const marker = new mapboxgl.Marker({ element: el })
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
      if (place.type === "restaurant" && !layers.restaurants) return;

      // Check if this is the highlighted/searched place
      const isHighlighted = highlightedPlace &&
        Math.abs(place.lat - highlightedPlace.lat) < 0.0001 &&
        Math.abs(place.lng - highlightedPlace.lng) < 0.0001;

      const el = document.createElement("div");
      el.className = "place-marker";

      // Build accessible label for the place marker
      const placeTypeLabel = place.type.charAt(0).toUpperCase() + place.type.slice(1);
      const placeAriaLabel = `${place.name}, ${placeTypeLabel}${place.source === "community" ? ", community recommended" : ""}`;

      // Use glowing red for highlighted place, otherwise normal colors
      const bgColor = isHighlighted
        ? "bg-red-500"
        : place.type === "bookstore"
          ? "bg-amber-500"
          : place.type === "library"
            ? "bg-sky-500"
            : place.type === "restaurant"
              ? "bg-pink-500"
              : "bg-orange-400"; // cafe

      // Focus ring color matches background
      const focusRingColor = isHighlighted
        ? "focus:ring-red-300"
        : place.type === "bookstore"
          ? "focus:ring-amber-300"
          : place.type === "library"
            ? "focus:ring-sky-300"
            : place.type === "restaurant"
              ? "focus:ring-pink-300"
              : "focus:ring-orange-300";

      // Icons: Bookstore=book, Library=columns, Cafe=coffee, Restaurant=utensils
      const icon =
        place.type === "bookstore"
          ? '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>'
          : place.type === "library"
            ? '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 7 4 7"/></svg>'
            : place.type === "restaurant"
              ? '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>'
              : '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 8h1a4 4 0 1 1 0 8h-1"/><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" x2="6" y1="2" y2="4"/><line x1="10" x2="10" y1="2" y2="4"/><line x1="14" x2="14" y1="2" y2="4"/></svg>';

      // Highlighted marker has glow effect and is larger
      const markerSize = isHighlighted ? "w-12 h-12" : "w-9 h-9";
      const glowStyle = isHighlighted
        ? "box-shadow: 0 0 20px 8px rgba(239, 68, 68, 0.6), 0 0 40px 16px rgba(239, 68, 68, 0.3); animation: pulse 1.5s ease-in-out infinite;"
        : "";

      // Create marker button using DOM APIs to avoid XSS risk
      const placeBtn = document.createElement("div");
      placeBtn.className = `${markerSize} rounded-full ${bgColor} flex items-center justify-center text-white shadow-lg cursor-pointer hover:scale-110 transition-transform border-2 ${isHighlighted ? 'border-yellow-300' : 'border-white'} focus:outline-none focus:ring-2 ${focusRingColor} focus:ring-offset-2`;
      if (glowStyle) {
        placeBtn.style.cssText = glowStyle;
      }
      placeBtn.setAttribute("role", "button");
      placeBtn.setAttribute("tabindex", "0");
      placeBtn.setAttribute("aria-label", placeAriaLabel);
      // Static SVG icon (no user data)
      placeBtn.innerHTML = icon;
      el.appendChild(placeBtn);

      // Add click and keyboard handlers
      const handleSelect = () => {
        setSelectedItem(place);
        setHighlightedPlace(null); // Clear search highlight when place is selected
      };
      el.addEventListener("click", handleSelect);
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleSelect();
        }
      });

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([place.lng, place.lat])
        .addTo(map.current!);
      markers.current.push(marker);
    });

    // Add highlighted place marker even if no matching place found in data
    // (in case the searched place isn't in our OSM data yet)
    if (highlightedPlace) {
      const hasMatchingPlace = allPlaces.some(place =>
        place.lat && place.lng &&
        Math.abs(place.lat - highlightedPlace.lat) < 0.0001 &&
        Math.abs(place.lng - highlightedPlace.lng) < 0.0001
      );

      if (!hasMatchingPlace) {
        const el = document.createElement("div");
        el.className = "highlighted-marker";
        const highlightAriaLabel = `${highlightedPlace.name}, search result location. Click to check in here.`;

        // Create marker button using DOM APIs to avoid XSS risk
        const highlightBtn = document.createElement("div");
        highlightBtn.className = "w-12 h-12 rounded-full bg-red-500 flex items-center justify-center text-white shadow-lg cursor-pointer hover:scale-110 transition-transform border-2 border-yellow-300 focus:outline-none focus:ring-2 focus:ring-red-300 focus:ring-offset-2";
        highlightBtn.style.cssText = "box-shadow: 0 0 20px 8px rgba(239, 68, 68, 0.6), 0 0 40px 16px rgba(239, 68, 68, 0.3); animation: pulse 1.5s ease-in-out infinite;";
        highlightBtn.setAttribute("role", "button");
        highlightBtn.setAttribute("tabindex", "0");
        highlightBtn.setAttribute("aria-label", highlightAriaLabel);
        // Static SVG icon (no user data)
        highlightBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>';
        el.appendChild(highlightBtn);

        // Create synthetic place for the search result so user can check in
        const syntheticPlace: PlacePin = {
          id: `search-${highlightedPlace.lat}-${highlightedPlace.lng}`,
          name: highlightedPlace.name,
          type: "cafe", // Default type for searched locations
          source: "osm",
          address: null,
          lat: highlightedPlace.lat,
          lng: highlightedPlace.lng,
          website: null,
          phone: null,
          email: null,
          opening_hours: null,
          wheelchair: null,
          description: "Searched location",
          image: null,
        };

        // Add click handler to open detail panel for check-in
        const handleSearchResultClick = () => {
          setSelectedItem(syntheticPlace);
          setHighlightedPlace(null);
        };
        el.addEventListener("click", handleSearchResultClick);
        el.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleSearchResultClick();
          }
        });

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([highlightedPlace.lng, highlightedPlace.lat])
          .addTo(map.current!);
        markers.current.push(marker);
      }
    }
  }, [readers, places, layers, highlightedPlace]);

  // Center on user location with smooth 3D animation
  const handleCenterOnUser = () => {
    if (userLocation && map.current) {
      map.current.flyTo({
        center: [userLocation.lng, userLocation.lat],
        zoom: 14,
        pitch: 50,
        bearing: 0,
        duration: 2000,
        essential: true,
      });
    }
  };

  // Handle layer toggle
  const handleLayerToggle = (layer: keyof typeof layers) => {
    setLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  };

  // Debounce timer ref and search query tracking
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSearchQueryRef = useRef<string>("");
  // Debounce timer for moveend data fetch
  const moveEndTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Reset selectedSearchIndex when search results change
  useEffect(() => {
    setSelectedSearchIndex(-1);
  }, [searchResults]);

  // Close search dropdown on Escape key or click outside
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showSearch) {
        setShowSearch(false);
        setSelectedSearchIndex(-1);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (
        showSearch &&
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setShowSearch(false);
        setSelectedSearchIndex(-1);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showSearch]);

  // Search for places using our API (proxies Nominatim for better POI coverage)
  const handleSearch = useCallback((query: string) => {
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    const trimmedQuery = query.trim();
    lastSearchQueryRef.current = trimmedQuery;

    if (!trimmedQuery || trimmedQuery.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    // Don't clear results immediately - keep showing previous results while loading

    // Debounce: wait 250ms after user stops typing
    searchTimeoutRef.current = setTimeout(async () => {
      // Only update if this is still the current query (prevents race conditions)
      if (lastSearchQueryRef.current !== trimmedQuery) return;

      try {
        // Build URL with optional location bias from current map bounds
        let searchUrl = `/api/geo/search?q=${encodeURIComponent(trimmedQuery)}`;
        if (map.current) {
          const bounds = map.current.getBounds();
          if (bounds) {
            // viewbox format: west,north,east,south
            const viewbox = `${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()},${bounds.getSouth()}`;
            searchUrl += `&viewbox=${encodeURIComponent(viewbox)}`;
          }
        }
        const res = await fetch(searchUrl);
        const data = await res.json();

        // Double-check query hasn't changed while fetching
        if (lastSearchQueryRef.current !== trimmedQuery) return;

        setSearchResults(
          (data.results || []).map((item: { label: string; lng: number; lat: number }) => ({
            place_name: item.label,
            center: [item.lng, item.lat] as [number, number],
          }))
        );
      } catch (error) {
        console.error("Search error:", error);
        // Only clear on error if query hasn't changed
        if (lastSearchQueryRef.current === trimmedQuery) {
          setSearchResults([]);
        }
      }
      if (lastSearchQueryRef.current === trimmedQuery) {
        setIsSearching(false);
      }
    }, 250);
  }, []);

  // Handle search result selection with smooth 3D animation
  const handleSelectPlace = async (center: [number, number], placeName: string) => {
    // Set the highlighted place IMMEDIATELY for instant feedback
    setHighlightedPlace({
      lat: center[1],
      lng: center[0],
      name: placeName.split(",")[0],
    });

    if (map.current) {
      // Fast flyTo for instant response
      map.current.flyTo({
        center,
        zoom: 16, // Higher zoom to see the specific place clearly
        pitch: 50,
        bearing: -15,
        duration: 1200, // Faster animation
        essential: true,
      });

      // Note: highlightedPlace persists until user clears search (X button) or clicks a place
      // This allows users to interact with the search result marker

      // Enable all place layers so the searched result is visible
      setLayers(prev => ({
        ...prev,
        bookstores: true,
        libraries: true,
        cafes: true,
        restaurants: true,
      }));

      // Update the ref immediately for the fetch
      layersRef.current = {
        ...layersRef.current,
        bookstores: true,
        libraries: true,
        cafes: true,
        restaurants: true,
      };

      // Fetch all place types for the searched location
      const geohash = encodeGeohash(center[1], center[0], 6); // High precision
      try {
        const placesRes = await fetch(`/api/geo/places?geohash=${geohash}&types=bookstore,library,cafe,restaurant`);
        const placesData = await placesRes.json();
        setPlaces({
          community: placesData.community || [],
          osm: placesData.osm || [],
        });
      } catch (error) {
        console.error("Error fetching places:", error);
      }
    }
    setSearchQuery(placeName.split(",")[0]);
    setSearchResults([]);
    setShowSearch(false);
  };

  // Refetch when layers change
  useEffect(() => {
    if (map.current && !isLoading) {
      const center = map.current.getCenter();
      const zoom = map.current.getZoom();
      fetchDataForLocation(center.lat, center.lng, zoom);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers.readers, layers.bookstores, layers.libraries, layers.cafes, layers.restaurants]);

  // Handle mark spot at place
  const handleMarkSpotAtPlace = useCallback((place: PlacePin, presenceType: "temporary" | "recommended") => {
    if (!currentUserId) {
      alert("Please sign in to mark your reading spot");
      return;
    }
    setMarkSpotPlace(place);
    setMarkSpotDefaultType(presenceType);
    setShowMarkSpotModal(true);
  }, [currentUserId]);

  // Update isochrone layer when data changes
  useEffect(() => {
    if (!map.current || isLoading) return;

    const mapInstance = map.current;

    // Remove existing isochrone layer and source
    if (mapInstance.getLayer("isochrone-fill")) {
      mapInstance.removeLayer("isochrone-fill");
    }
    if (mapInstance.getLayer("isochrone-outline")) {
      mapInstance.removeLayer("isochrone-outline");
    }
    if (mapInstance.getSource("isochrone")) {
      mapInstance.removeSource("isochrone");
    }

    // Add new isochrone if data exists
    if (isochroneData) {
      mapInstance.addSource("isochrone", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: isochroneData.geometry,
        },
      });

      // Add fill layer
      mapInstance.addLayer({
        id: "isochrone-fill",
        type: "fill",
        source: "isochrone",
        paint: {
          "fill-color":
            isochroneData.profile === "walking"
              ? "#10b981"
              : isochroneData.profile === "cycling"
                ? "#0ea5e9"
                : "#f59e0b",
          "fill-opacity": 0.15,
        },
      });

      // Add outline layer
      mapInstance.addLayer({
        id: "isochrone-outline",
        type: "line",
        source: "isochrone",
        paint: {
          "line-color":
            isochroneData.profile === "walking"
              ? "#10b981"
              : isochroneData.profile === "cycling"
                ? "#0ea5e9"
                : "#f59e0b",
          "line-width": 2,
          "line-opacity": 0.8,
        },
      });
    }
  }, [isochroneData, isLoading]);

  return (
    <div className={cn("relative w-full", className)} style={{ height: "calc(100vh - 4rem)" }}>
      {/* Map Container */}
      <div ref={mapContainer} className="w-full h-full" />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading 3D map...</p>
          </div>
        </div>
      )}

      {/* Search Bar - Top Center */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 w-full max-w-md px-4">
        <div className="relative" ref={searchContainerRef}>
          <div className="flex items-center gap-2 bg-white/90 dark:bg-card/90 backdrop-blur-xl rounded-full shadow-lg border border-white/50 dark:border-border/50 px-4 py-2.5">
            {isSearching ? (
              <Loader2 className="h-4 w-4 text-primary shrink-0 animate-spin" aria-hidden="true" />
            ) : (
              <Search className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
            )}
            <Input
              type="text"
              placeholder="Search cafe, bookstore, or city..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSearch(true); // Keep dropdown visible while typing
                handleSearch(e.target.value);
              }}
              onFocus={() => setShowSearch(true)}
              onKeyDown={(e) => {
                if (!showSearch || searchResults.length === 0) return;

                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setSelectedSearchIndex((prev) =>
                    prev < searchResults.length - 1 ? prev + 1 : 0
                  );
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setSelectedSearchIndex((prev) =>
                    prev > 0 ? prev - 1 : searchResults.length - 1
                  );
                } else if (e.key === "Enter" && selectedSearchIndex >= 0) {
                  e.preventDefault();
                  const selected = searchResults[selectedSearchIndex];
                  handleSelectPlace(selected.center, selected.place_name);
                }
              }}
              className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 p-0 h-auto text-sm"
              role="combobox"
              aria-expanded={showSearch && searchResults.length > 0}
              aria-controls="search-results-listbox"
              aria-activedescendant={selectedSearchIndex >= 0 ? `search-result-${selectedSearchIndex}` : undefined}
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => {
                  setSearchQuery("");
                  setSearchResults([]);
                  setHighlightedPlace(null); // Clear highlighted marker
                }}
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 hover:bg-primary/10"
              onClick={handleCenterOnUser}
              title="Center on my location"
              disabled={!userLocation}
            >
              <Locate className={cn("h-4 w-4", userLocation ? "text-primary" : "text-muted-foreground")} />
            </Button>
          </div>

          {/* Search Results Dropdown */}
          {showSearch && searchResults.length > 0 && (
            <div
              id="search-results-listbox"
              role="listbox"
              aria-label="Search results"
              className="absolute top-full left-0 right-0 mt-2 bg-white/95 dark:bg-card/95 backdrop-blur-xl rounded-2xl shadow-lg border border-white/50 dark:border-border/50 overflow-hidden"
            >
              {searchResults.map((result, index) => (
                <button
                  key={index}
                  id={`search-result-${index}`}
                  role="option"
                  aria-selected={index === selectedSearchIndex}
                  className={cn(
                    "w-full px-4 py-3 text-left text-sm transition-colors border-b border-border/30 last:border-0",
                    index === selectedSearchIndex
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted/50"
                  )}
                  onClick={() => handleSelectPlace(result.center, result.place_name)}
                  onMouseEnter={() => setSelectedSearchIndex(index)}
                >
                  {result.place_name}
                </button>
              ))}
            </div>
          )}

          {/* Keep typing hint for short queries */}
          {showSearch && searchQuery.trim().length === 1 && !isSearching && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white/95 dark:bg-card/95 backdrop-blur-xl rounded-2xl shadow-lg border border-white/50 dark:border-border/50 p-4 text-center text-sm text-muted-foreground">
              Keep typing to search...
            </div>
          )}

          {/* Searching indicator */}
          {isSearching && searchResults.length === 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white/95 dark:bg-card/95 backdrop-blur-xl rounded-2xl shadow-lg border border-white/50 dark:border-border/50 p-4 text-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
              Searching...
            </div>
          )}
        </div>
      </div>

      {/* Layer Controls - Centered below search */}
      <MapLayerControls
        layers={layers}
        onToggle={handleLayerToggle}
        counts={{
          readers: readers.length,
          bookstores: [...places.community, ...places.osm].filter(p => p.type === "bookstore").length,
          libraries: [...places.community, ...places.osm].filter(p => p.type === "library").length,
          cafes: [...places.community, ...places.osm].filter(p => p.type === "cafe").length,
          restaurants: [...places.community, ...places.osm].filter(p => p.type === "restaurant").length,
        }}
        className="absolute top-[76px] left-1/2 -translate-x-1/2 z-10"
      />

      {/* ARIA Live Region for Reader Count - Visually hidden but announced by screen readers */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {readerCountAnnouncement}
      </div>

      {/* Isochrone Controls - Bottom Left */}
      <IsochroneControls
        onIsochroneChange={setIsochroneData}
        userLocation={userLocation}
        className="absolute bottom-24 left-4 z-10 lg:bottom-4"
      />

      {/* AI Place Search - Bottom Left (above isochrone on mobile) */}
      <AIPlaceSearch
        userLocation={userLocation}
        onPlaceSelect={(place) => {
          // Fly to the selected place
          if (map.current) {
            map.current.flyTo({
              center: [place.lng, place.lat],
              zoom: 15,
              pitch: 50,
              bearing: -15,
              duration: 2000,
              essential: true,
            });
          }
          // Find and select the place in our data if it exists
          const allPlaces = [...places.community, ...places.osm];
          const foundPlace = allPlaces.find(
            (p) =>
              p.id === place.id ||
              (p.lat === place.lat && p.lng === place.lng)
          );
          if (foundPlace) {
            setSelectedItem(foundPlace);
          }
        }}
        className="absolute bottom-36 left-4 z-10 lg:bottom-16"
      />

      {/* Detail Panel - Bottom (mobile) / Right (desktop) */}
      <MapDetailPanel
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        currentUserId={currentUserId}
        onMarkSpotAtPlace={handleMarkSpotAtPlace}
        onClearPresence={onClearPresence}
      />

      {/* Mark Spot Button - Mobile only (desktop uses context panel) */}
      {userLocation && (
        <Button
          onClick={() => {
            if (!currentUserId) {
              alert("Please sign in to mark your reading spot");
              return;
            }
            setShowMarkSpotModal(true);
          }}
          className="absolute top-4 right-4 z-20 h-12 gap-2 rounded-full shadow-lg bg-emerald-500 hover:bg-emerald-600 text-white px-4 lg:hidden"
          title="Mark this spot"
        >
          <MapPin className="w-5 h-5" />
          <span className="text-sm font-medium">I&apos;m Here</span>
        </Button>
      )}

      {/* Check Out Button - Mobile only, when user has active presence */}
      {userPresence && userPresence.type && onClearPresence && (
        <>
          <Button
            onClick={() => setShowCheckOutDialog(true)}
            variant="outline"
            className="absolute top-20 right-4 z-20 h-10 gap-2 rounded-full shadow-lg bg-white/90 dark:bg-card/90 backdrop-blur-xl border border-border/50 px-4 lg:hidden"
            title="Check out"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm font-medium">Check Out</span>
          </Button>

          {/* Check Out Confirmation Dialog - Mobile */}
          <AlertDialog open={showCheckOutDialog} onOpenChange={setShowCheckOutDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Check out from this spot?</AlertDialogTitle>
                <AlertDialogDescription>
                  You&apos;ll be removed from the map and other readers won&apos;t see you at{" "}
                  {userPresence.locationLabel ? `"${userPresence.locationLabel}"` : "this location"} anymore.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onClearPresence}>
                  Check Out
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}

      {/* Mark Spot Modal */}
      <MarkSpotModal
        open={showMarkSpotModal}
        onClose={() => {
          setShowMarkSpotModal(false);
          setMarkSpotPlace(null);
          setMarkSpotDefaultType("temporary");
        }}
        onSuccess={() => {
          // Refresh reader data after marking a spot (force refresh to bypass cache)
          if (map.current) {
            const center = map.current.getCenter();
            const zoom = map.current.getZoom();
            fetchDataForLocation(center.lat, center.lng, zoom, true);
          }
        }}
        locationLabel={markSpotPlace ? undefined : (userLocation ? `Near your current location` : undefined)}
        place={markSpotPlace ? {
          name: markSpotPlace.name,
          lat: markSpotPlace.lat,
          lng: markSpotPlace.lng,
          type: markSpotPlace.type,
        } : undefined}
        defaultPresenceType={markSpotDefaultType}
      />
    </div>
  );
}
