"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { MapItem, ReaderPin } from "./reader-map-immersive";
import type { UserPresenceData } from "./map-context-panel";

// Lazy load the heavy Mapbox component (~350KB)
const ReaderMapImmersive = dynamic(
  () =>
    import("@/components/geo/reader-map-immersive").then(
      (m) => m.ReaderMapImmersive
    ),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
        <div className="text-center space-y-4">
          <Skeleton className="h-8 w-8 rounded-full mx-auto animate-pulse" />
          <p className="text-sm text-muted-foreground">Loading map...</p>
        </div>
      </div>
    ),
  }
);

interface ReaderMapLazyProps {
  currentUserId?: string;
  onSelectionChange?: (item: MapItem | null) => void;
  onReadersChange?: (readers: ReaderPin[]) => void;
  onUserLocationChange?: (location: { lat: number; lng: number } | null) => void;
  onFlyToLocation?: (callback: (lat: number, lng: number) => void) => void;
  onRefreshData?: (callback: () => void) => void;
  userPresence?: UserPresenceData | null;
  onClearPresence?: () => void;
}

export function ReaderMapLazy({
  currentUserId,
  onSelectionChange,
  onReadersChange,
  onUserLocationChange,
  onFlyToLocation,
  onRefreshData,
  userPresence,
  onClearPresence,
}: ReaderMapLazyProps) {
  return (
    <ReaderMapImmersive
      currentUserId={currentUserId}
      onSelectionChange={onSelectionChange}
      onReadersChange={onReadersChange}
      onUserLocationChange={onUserLocationChange}
      onFlyToLocation={onFlyToLocation}
      onRefreshData={onRefreshData}
      userPresence={userPresence}
      onClearPresence={onClearPresence}
    />
  );
}
