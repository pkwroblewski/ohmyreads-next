"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, BookOpen, Building2, Coffee, MapPin, Globe, Navigation, Users, MessageSquare, Camera } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { ReaderPin, PlacePin, MapItem } from "./reader-map-immersive";
import { PlaceReviewsList } from "./place-reviews-list";
import { PlacePhotosList } from "./place-photos-list";

interface MapDetailPanelProps {
  item: MapItem | null;
  onClose: () => void;
  currentUserId?: string;
}

function isReader(item: MapItem): item is ReaderPin {
  return "username" in item;
}

function isPlace(item: MapItem): item is PlacePin {
  return "type" in item && !("username" in item);
}

const placeIcons: Record<string, typeof BookOpen> = {
  bookstore: BookOpen,
  library: Building2,
  cafe: Coffee,
};

const placeColors: Record<string, string> = {
  bookstore: "text-amber-500",
  library: "text-blue-500",
  cafe: "text-orange-500",
};

export function MapDetailPanel({ item, onClose, currentUserId }: MapDetailPanelProps) {
  const [isVisible, setIsVisible] = useState(false);

  // Handle animation
  useEffect(() => {
    if (item) {
      // Small delay for enter animation
      requestAnimationFrame(() => setIsVisible(true));
    } else {
      setIsVisible(false);
    }
  }, [item]);

  if (!item) return null;

  return (
    <>
      {/* Backdrop for mobile */}
      <div
        className={cn(
          "fixed inset-0 bg-black/20 z-20 lg:hidden transition-opacity",
          isVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          "fixed z-30 bg-card border shadow-xl transition-transform duration-300 ease-out",
          // Mobile: bottom sheet
          "inset-x-0 bottom-0 rounded-t-2xl max-h-[60vh] lg:max-h-none",
          // Desktop: right sidebar
          "lg:inset-y-0 lg:right-0 lg:left-auto lg:w-96 lg:rounded-none lg:border-l lg:border-t-0 lg:border-b-0 lg:border-r-0",
          // Animation
          isVisible
            ? "translate-y-0 lg:translate-x-0"
            : "translate-y-full lg:translate-y-0 lg:translate-x-full"
        )}
      >
        {/* Drag handle - mobile only */}
        <div className="flex justify-center pt-3 pb-1 lg:hidden">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {isReader(item) ? (
              <>
                <Avatar className="h-12 w-12">
                  {item.avatarUrl && <AvatarImage src={item.avatarUrl} />}
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {(item.displayName || item.username || "?")[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <h3 className="font-semibold truncate">
                    {item.displayName || item.username}
                  </h3>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    Reader
                  </p>
                </div>
              </>
            ) : (
              <>
                {(() => {
                  const Icon = placeIcons[item.type] || MapPin;
                  const color = placeColors[item.type] || "text-muted-foreground";
                  return (
                    <div className={cn("p-3 rounded-xl bg-muted", color)}>
                      <Icon className="h-6 w-6" />
                    </div>
                  );
                })()}
                <div className="min-w-0">
                  <h3 className="font-semibold truncate">{item.name}</h3>
                  <p className="text-sm text-muted-foreground capitalize flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {item.type}
                    {item.source === "community" && (
                      <span className="ml-1 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                        Community
                      </span>
                    )}
                  </p>
                </div>
              </>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[40vh] lg:max-h-[calc(100vh-200px)]">
          {isReader(item) ? (
            <ReaderContent reader={item} />
          ) : (
            <PlaceContent place={item} currentUserId={currentUserId} />
          )}
        </div>
      </div>
    </>
  );
}

function ReaderContent({ reader }: { reader: ReaderPin }) {
  return (
    <div className="space-y-4">
      {reader.locationLabel && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4" />
          <span>{reader.locationLabel}</span>
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        This reader has opted in to share their approximate location to connect with fellow book lovers.
      </p>

      {reader.username && (
        <Link href={`/users/${reader.username}`}>
          <Button className="w-full">View Profile</Button>
        </Link>
      )}
    </div>
  );
}

function PlaceContent({ place, currentUserId }: { place: PlacePin; currentUserId?: string }) {
  // Only community places have real IDs for reviews
  const canShowReviews = place.source === "community" && !place.id.startsWith("osm-");

  return (
    <div className="space-y-4">
      {place.address && (
        <div className="flex items-start gap-2 text-sm">
          <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          <span>{place.address}</span>
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex gap-2">
        {place.website && (
          <a
            href={place.website}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "flex-1")}
          >
            <Globe className="h-4 w-4 mr-2" />
            Website
          </a>
        )}
        {place.lat && place.lng && (
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "flex-1")}
          >
            <Navigation className="h-4 w-4 mr-2" />
            Directions
          </a>
        )}
      </div>

      {/* Reviews Section - Only for community places */}
      {canShowReviews ? (
        <div className="pt-4 border-t">
          <Tabs defaultValue="reviews" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="reviews" className="flex-1">
                <MessageSquare className="h-4 w-4 mr-1.5" />
                Reviews
              </TabsTrigger>
              <TabsTrigger value="photos" className="flex-1">
                <Camera className="h-4 w-4 mr-1.5" />
                Photos
              </TabsTrigger>
            </TabsList>
            <TabsContent value="reviews" className="mt-4">
              <PlaceReviewsList placeId={place.id} currentUserId={currentUserId} />
            </TabsContent>
            <TabsContent value="photos" className="mt-4">
              <PlacePhotosList placeId={place.id} currentUserId={currentUserId} />
            </TabsContent>
          </Tabs>
        </div>
      ) : (
        <div className="pt-4 border-t">
          <p className="text-sm text-muted-foreground text-center">
            {place.source === "osm"
              ? "This is an OSM place. Submit it as a community place to enable reviews."
              : "Reviews coming soon"}
          </p>
        </div>
      )}
    </div>
  );
}
