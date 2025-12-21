"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useTheme } from "next-themes";
import { Loader2, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

interface LocationMiniMapProps {
  lat: number;
  lng: number;
  precision?: number;
  className?: string;
}

/**
 * A small map preview showing the user's location pin.
 * Used in settings to visually confirm location selection.
 */
export function LocationMiniMap({
  lat,
  lng,
  precision = 5,
  className,
}: LocationMiniMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const { resolvedTheme } = useTheme();
  const [isLoading, setIsLoading] = useState(true);

  // Calculate radius based on precision (approximate area covered)
  const getRadius = (p: number) => {
    const radii: Record<number, number> = {
      4: 20000, // 20 km
      5: 2400,  // 2.4 km
      6: 1200,  // 1.2 km
      7: 150,   // 150 m
      8: 40,    // 40 m
    };
    return radii[p] || 2400;
  };

  useEffect(() => {
    if (!mapContainer.current) return;

    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    if (!mapboxToken) {
      setIsLoading(false);
      return;
    }

    mapboxgl.accessToken = mapboxToken;

    // Create map
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/standard",
      center: [lng, lat],
      zoom: precision >= 6 ? 14 : precision >= 5 ? 12 : 10,
      interactive: false, // Static map
      attributionControl: false,
    });

    map.current.on("load", () => {
      setIsLoading(false);

      // Set light preset based on theme
      try {
        map.current?.setConfigProperty("basemap", "lightPreset",
          resolvedTheme === "dark" ? "night" : "day"
        );
      } catch {
        // Config might not be available
      }

      // Add privacy radius circle
      const radius = getRadius(precision);
      map.current?.addSource("privacy-area", {
        type: "geojson",
        data: createCircleGeoJSON(lng, lat, radius),
      });

      map.current?.addLayer({
        id: "privacy-area-fill",
        type: "fill",
        source: "privacy-area",
        paint: {
          "fill-color": resolvedTheme === "dark" ? "#3b82f6" : "#2563eb",
          "fill-opacity": 0.15,
        },
      });

      map.current?.addLayer({
        id: "privacy-area-stroke",
        type: "line",
        source: "privacy-area",
        paint: {
          "line-color": resolvedTheme === "dark" ? "#3b82f6" : "#2563eb",
          "line-width": 2,
          "line-dasharray": [2, 2],
        },
      });
    });

    // Add marker
    const el = document.createElement("div");
    el.innerHTML = `
      <div class="flex flex-col items-center">
        <div class="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow-lg">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        </div>
        <div class="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-primary -mt-1"></div>
      </div>
    `;

    marker.current = new mapboxgl.Marker({ element: el })
      .setLngLat([lng, lat])
      .addTo(map.current);

    return () => {
      marker.current?.remove();
      map.current?.remove();
    };
  }, [lat, lng, precision, resolvedTheme]);

  // Update when position changes
  useEffect(() => {
    if (map.current && marker.current) {
      marker.current.setLngLat([lng, lat]);
      map.current.flyTo({
        center: [lng, lat],
        zoom: precision >= 6 ? 14 : precision >= 5 ? 12 : 10,
        duration: 500,
      });

      // Update privacy circle
      const source = map.current.getSource("privacy-area") as mapboxgl.GeoJSONSource;
      if (source) {
        source.setData(createCircleGeoJSON(lng, lat, getRadius(precision)));
      }
    }
  }, [lat, lng, precision]);

  return (
    <div className={cn("relative w-full h-48 rounded-xl overflow-hidden border", className)}>
      <div ref={mapContainer} className="w-full h-full" />

      {isLoading && (
        <div className="absolute inset-0 bg-muted flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Privacy indicator */}
      <div className="absolute bottom-2 left-2 bg-background/90 backdrop-blur-sm text-xs px-2 py-1 rounded-md border flex items-center gap-1">
        <MapPin className="h-3 w-3 text-primary" />
        <span>Approximate area</span>
      </div>
    </div>
  );
}

/**
 * Create a GeoJSON circle polygon
 */
function createCircleGeoJSON(lng: number, lat: number, radiusMeters: number) {
  const points = 64;
  const coords = [];

  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    const dx = radiusMeters * Math.cos(angle);
    const dy = radiusMeters * Math.sin(angle);

    // Convert meters to degrees (approximate)
    const dLng = dx / (111320 * Math.cos(lat * Math.PI / 180));
    const dLat = dy / 110540;

    coords.push([lng + dLng, lat + dLat]);
  }

  return {
    type: "Feature" as const,
    geometry: {
      type: "Polygon" as const,
      coordinates: [coords],
    },
    properties: {},
  };
}
