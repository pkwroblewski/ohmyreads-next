"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Settings, Plus, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReaderMapLazy } from "./reader-map-lazy";
import { MapContextPanel, UserPresenceData } from "./map-context-panel";
import { MarkSpotModal, PlaceForMarkSpot } from "./mark-spot-modal";
import { clearPresence } from "@/lib/actions/location";
import { decodeGeohash } from "@/lib/utils/geohash";
import { toast } from "sonner";
import type { MapItem, ReaderPin, PlacePin } from "./reader-map-immersive";

interface MapPageClientProps {
  currentUserId?: string;
  userName?: string;
  userPresence?: UserPresenceData | null;
}

export function MapPageClient({ currentUserId, userName, userPresence }: MapPageClientProps) {
  // Shared state between map and context panel
  const [selectedItem, setSelectedItem] = useState<MapItem | null>(null);
  const [readers, setReaders] = useState<ReaderPin[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Mark spot modal state
  const [showMarkSpotModal, setShowMarkSpotModal] = useState(false);
  const [markSpotPlace, setMarkSpotPlace] = useState<PlaceForMarkSpot | undefined>();
  const [defaultPresenceType, setDefaultPresenceType] = useState<"temporary" | "recommended">("temporary");

  // Track presence state locally for optimistic updates
  const [localPresence, setLocalPresence] = useState<UserPresenceData | null | undefined>(userPresence);

  // Ref to store the flyToLocation callback from the map
  const flyToLocationRef = useRef<((lat: number, lng: number) => void) | null>(null);

  // Ref to store the refreshData callback from the map
  const refreshDataRef = useRef<(() => void) | null>(null);

  // Handle selection change from map
  const handleSelectionChange = useCallback((item: MapItem | null) => {
    setSelectedItem(item);
  }, []);

  // Handle readers change from map
  const handleReadersChange = useCallback((newReaders: ReaderPin[]) => {
    setReaders(newReaders);
  }, []);

  // Handle user location change from map
  const handleUserLocationChange = useCallback((location: { lat: number; lng: number } | null) => {
    setUserLocation(location);
  }, []);

  // Store the flyToLocation callback from the map
  const handleFlyToLocation = useCallback((callback: (lat: number, lng: number) => void) => {
    flyToLocationRef.current = callback;
  }, []);

  // Store the refreshData callback from the map
  const handleRefreshData = useCallback((callback: () => void) => {
    refreshDataRef.current = callback;
  }, []);

  // Fly to a reader's location
  const handleFlyToReader = useCallback((reader: ReaderPin) => {
    if (reader.geohashPrefix && flyToLocationRef.current) {
      const { lat, lng } = decodeGeohash(reader.geohashPrefix);
      flyToLocationRef.current(lat, lng);
      // Select the reader after flying to them
      setSelectedItem(reader);
    }
  }, []);

  // Open mark spot modal at a specific place
  const handleMarkSpotAtPlace = useCallback((place: PlacePin, presenceType: "temporary" | "recommended") => {
    if (!currentUserId) {
      window.location.href = "/login?redirect=/community/map";
      return;
    }
    setMarkSpotPlace({
      name: place.name,
      lat: place.lat,
      lng: place.lng,
      type: place.type,
    });
    setDefaultPresenceType(presenceType);
    setShowMarkSpotModal(true);
  }, [currentUserId]);

  // Clear user's presence
  const handleClearPresence = useCallback(async () => {
    const result = await clearPresence();
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setLocalPresence(null);
    toast.success("Status cleared");
  }, []);

  // Clear selection (called from context panel)
  const handleClearSelection = useCallback(() => {
    setSelectedItem(null);
  }, []);

  return (
    <div className="h-[calc(100vh-4rem)] bg-gradient-to-br from-background via-muted/30 to-background p-4 lg:p-6">
      <div className="flex h-full gap-4 lg:gap-6">
        {/* Map Container - Premium curved box */}
        <div className="relative flex-1 rounded-3xl overflow-hidden shadow-warm-lg dark:shadow-none border border-border/50 bg-card">
          {/* Subtle inner glow effect */}
          <div className="absolute inset-0 rounded-3xl ring-1 ring-inset ring-white/10 pointer-events-none z-10" />

          {/* Back Button - Top Left */}
          <div className="absolute top-4 left-4 z-30">
            <Link href="/community">
              <Button
                variant="secondary"
                size="icon"
                className="h-10 w-10 rounded-full shadow-lg bg-white/90 dark:bg-card/90 backdrop-blur-xl border border-white/50 dark:border-border/50"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
          </div>

          {/* Floating Action Buttons - Top Right */}
          <div className="absolute top-4 right-4 z-30 flex gap-2">
            {/* Settings - logged-in only, desktop only (mobile has floating button) */}
            {currentUserId && (
              <Link href="/settings" className="hidden lg:block">
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-10 w-10 rounded-full shadow-lg bg-white/90 dark:bg-card/90 backdrop-blur-xl border border-white/50 dark:border-border/50"
                  title="Location Settings"
                >
                  <Settings className="h-5 w-5" />
                </Button>
              </Link>
            )}
            {/* Add Place - visible to all, desktop only */}
            <Link href="/community/map/submit" className="hidden lg:block">
              <Button
                size="icon"
                className="h-10 w-10 rounded-full shadow-lg"
                title="Add Place"
              >
                <Plus className="h-5 w-5" />
              </Button>
            </Link>
          </div>

          {/* Privacy Info Button - Bottom Left */}
          <div className="absolute bottom-6 left-4 z-10">
            <Link href="/privacy">
              <Button
                variant="secondary"
                size="sm"
                className="rounded-full shadow-lg text-xs opacity-80 hover:opacity-100 bg-white/90 dark:bg-card/90 backdrop-blur-xl border border-white/50 dark:border-border/50"
              >
                <Info className="h-3 w-3 mr-1" />
                Privacy
              </Button>
            </Link>
          </div>

          {/* Map Component - Lazy loaded with callbacks */}
          <ReaderMapLazy
            currentUserId={currentUserId}
            onSelectionChange={handleSelectionChange}
            onReadersChange={handleReadersChange}
            onUserLocationChange={handleUserLocationChange}
            onFlyToLocation={handleFlyToLocation}
            onRefreshData={handleRefreshData}
            userPresence={localPresence}
            onClearPresence={handleClearPresence}
          />
        </div>

        {/* Context Panel - Desktop only */}
        <div className="hidden lg:flex">
          <MapContextPanel
            currentUserId={currentUserId}
            userName={userName}
            selectedItem={selectedItem}
            onClearSelection={handleClearSelection}
            nearbyReaders={readers}
            onMarkSpotAtPlace={handleMarkSpotAtPlace}
            onClearPresence={handleClearPresence}
            onFlyToReader={handleFlyToReader}
            userPresence={localPresence}
          />
        </div>
      </div>

      {/* Mark Spot Modal - Shared between map button (mobile) and panel (desktop) */}
      <MarkSpotModal
        open={showMarkSpotModal}
        onClose={() => setShowMarkSpotModal(false)}
        onSuccess={() => {
          // Update local presence state optimistically
          if (markSpotPlace) {
            setLocalPresence({
              type: defaultPresenceType,
              expiresAt: defaultPresenceType === "temporary"
                ? new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
                : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
              note: null,
              locationLabel: markSpotPlace.name,
            });
          }
          setShowMarkSpotModal(false);
          // Refresh map data to show the new reader marker
          refreshDataRef.current?.();
        }}
        locationLabel={markSpotPlace?.name || (userLocation ? "Near your current location" : undefined)}
        place={markSpotPlace}
        defaultPresenceType={defaultPresenceType}
      />
    </div>
  );
}
