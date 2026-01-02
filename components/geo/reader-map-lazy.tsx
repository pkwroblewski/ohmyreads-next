"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

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
}

export function ReaderMapLazy({ currentUserId }: ReaderMapLazyProps) {
  return <ReaderMapImmersive currentUserId={currentUserId} />;
}
