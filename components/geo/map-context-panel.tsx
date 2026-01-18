"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  MapPin,
  Star,
  Users,
  Clock,
  BookMarked,
  Landmark,
  Coffee,
  UtensilsCrossed,
  Navigation,
  Globe,
  Share2,
  Check,
  ExternalLink,
  LogIn,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { ReaderPin, PlacePin, MapItem } from "./reader-map-immersive";

export interface UserPresenceData {
  type: "static" | "temporary" | "recommended";
  expiresAt: string | null;
  note: string | null;
  locationLabel: string | null;
}

interface MapContextPanelProps {
  currentUserId?: string;
  userName?: string;
  selectedItem: MapItem | null;
  onClearSelection: () => void;
  nearbyReaders: ReaderPin[];
  onMarkSpot: () => void;
  onMarkSpotAtPlace: (place: PlacePin, presenceType: "temporary" | "recommended") => void;
  onClearPresence: () => void;
  onFlyToReader: (reader: ReaderPin) => void;
  userPresence?: UserPresenceData | null;
  className?: string;
}

function isReader(item: MapItem): item is ReaderPin {
  return "username" in item;
}

function isPlace(item: MapItem): item is PlacePin {
  return "type" in item && !("username" in item);
}

const placeConfig: Record<string, {
  icon: typeof BookMarked;
  color: string;
  bgColor: string;
  label: string;
}> = {
  bookstore: {
    icon: BookMarked,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-500/15",
    label: "Bookstore",
  },
  library: {
    icon: Landmark,
    color: "text-sky-600 dark:text-sky-400",
    bgColor: "bg-sky-500/15",
    label: "Library",
  },
  cafe: {
    icon: Coffee,
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-500/15",
    label: "Cafe",
  },
  restaurant: {
    icon: UtensilsCrossed,
    color: "text-pink-600 dark:text-pink-400",
    bgColor: "bg-pink-500/15",
    label: "Restaurant",
  },
};

export function MapContextPanel({
  currentUserId,
  userName,
  selectedItem,
  onClearSelection,
  nearbyReaders,
  onMarkSpot,
  onMarkSpotAtPlace,
  onClearPresence,
  onFlyToReader,
  userPresence,
  className,
}: MapContextPanelProps) {
  // Determine view state
  const viewState = selectedItem
    ? isReader(selectedItem)
      ? "reader"
      : "place"
    : "default";

  return (
    <div
      className={cn(
        "w-80 xl:w-96 flex flex-col h-full",
        "bg-white/95 dark:bg-card/95 backdrop-blur-xl",
        "rounded-3xl border border-border/50",
        "shadow-warm-lg dark:shadow-none",
        "overflow-hidden",
        className
      )}
    >
      {viewState === "default" && (
        <DefaultView
          currentUserId={currentUserId}
          userName={userName}
          nearbyReaders={nearbyReaders}
          onMarkSpot={onMarkSpot}
          onFlyToReader={onFlyToReader}
          userPresence={userPresence}
          onClearPresence={onClearPresence}
        />
      )}
      {viewState === "reader" && selectedItem && isReader(selectedItem) && (
        <ReaderView
          reader={selectedItem}
          onBack={onClearSelection}
        />
      )}
      {viewState === "place" && selectedItem && isPlace(selectedItem) && (
        <PlaceView
          place={selectedItem}
          onBack={onClearSelection}
          currentUserId={currentUserId}
          onMarkSpotAtPlace={onMarkSpotAtPlace}
        />
      )}
    </div>
  );
}

// Default view - shows when nothing is selected
function DefaultView({
  currentUserId,
  userName,
  nearbyReaders,
  onMarkSpot,
  onFlyToReader,
  userPresence,
  onClearPresence,
}: {
  currentUserId?: string;
  userName?: string;
  nearbyReaders: ReaderPin[];
  onMarkSpot: () => void;
  onFlyToReader: (reader: ReaderPin) => void;
  userPresence?: UserPresenceData | null;
  onClearPresence: () => void;
}) {
  // Check if user has active (non-static) presence
  const hasActivePresence = userPresence && userPresence.type !== "static";

  // Calculate time remaining for temporary presence
  const getTimeRemaining = () => {
    if (!userPresence?.expiresAt) return null;
    const expiresAt = new Date(userPresence.expiresAt);
    const now = new Date();
    const diff = expiresAt.getTime() - now.getTime();
    if (diff <= 0) return "Expired";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${minutes}m remaining`;
    return `${minutes}m remaining`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-5 border-b border-border/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-primary/10 flex items-center justify-center">
            <Users className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h2 className="font-semibold text-lg">
              {currentUserId ? `Welcome${userName ? `, ${userName}` : ""}` : "Reader Hub"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {currentUserId ? "Your reading community" : "Discover readers nearby"}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* YOUR STATUS - Show if user has active presence */}
        {currentUserId && hasActivePresence && (
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Your Status
            </h3>
            <div className={cn(
              "p-4 rounded-xl border",
              userPresence.type === "temporary"
                ? "bg-emerald-500/10 border-emerald-500/20"
                : "bg-amber-500/10 border-amber-500/20"
            )}>
              <div className="flex items-start gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0",
                  userPresence.type === "temporary" ? "bg-emerald-500" : "bg-amber-500"
                )}>
                  {userPresence.type === "temporary" ? (
                    <Clock className="h-5 w-5" />
                  ) : (
                    <Star className="h-5 w-5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">
                    {userPresence.type === "temporary" ? "You're at" : "You recommend"}
                  </p>
                  <p className="text-sm truncate">
                    {userPresence.locationLabel || "A reading spot"}
                  </p>
                  {userPresence.expiresAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {getTimeRemaining()}
                    </p>
                  )}
                </div>
              </div>
              {userPresence.note && (
                <p className="text-sm text-muted-foreground mt-3 italic">
                  &quot;{userPresence.note}&quot;
                </p>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearPresence}
                className="w-full mt-3 text-muted-foreground hover:text-foreground"
              >
                Check Out
              </Button>
            </div>
          </div>
        )}

        {/* Mark Your Spot Section */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Mark Your Spot
          </h3>
          {currentUserId ? (
            <p className="text-sm text-muted-foreground">
              Search for a place or click on a marker to mark where you&apos;re reading
            </p>
          ) : (
            <div className="p-4 rounded-xl bg-muted/50 border border-border/50 text-center">
              <LogIn className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground mb-3">
                Sign in to share your reading spots
              </p>
              <Link href="/login?redirect=/community/map">
                <Button size="sm" className="w-full">
                  Sign In
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Nearby Readers Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Nearby Readers
            </h3>
            <span className="text-xs text-muted-foreground">
              {nearbyReaders.length} {nearbyReaders.length === 1 ? "reader" : "readers"}
            </span>
          </div>

          {nearbyReaders.length > 0 ? (
            <div className="space-y-2">
              {nearbyReaders.slice(0, 5).map((reader) => (
                <ReaderCard
                  key={reader.id}
                  reader={reader}
                  onClick={() => onFlyToReader(reader)}
                />
              ))}
              {nearbyReaders.length > 5 && (
                <p className="text-xs text-center text-muted-foreground pt-2">
                  +{nearbyReaders.length - 5} more on map
                </p>
              )}
            </div>
          ) : (
            <div className="p-6 rounded-xl bg-muted/30 text-center">
              <Users className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">
                No readers in this area yet
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Move the map to explore other areas
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Compact reader card for the list
function ReaderCard({
  reader,
  onClick,
}: {
  reader: ReaderPin;
  onClick: () => void;
}) {
  const presenceType = reader.presenceType || "static";

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors text-left"
    >
      <Avatar className="h-10 w-10 border-2 border-background shadow-sm">
        {reader.avatarUrl && <AvatarImage src={reader.avatarUrl} />}
        <AvatarFallback className={cn(
          "text-white text-sm",
          presenceType === "recommended" ? "bg-amber-500" : "bg-emerald-500"
        )}>
          {(reader.displayName || reader.username || "?")[0].toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">
          {reader.displayName || reader.username}
        </p>
        <div className="flex items-center gap-1.5">
          {presenceType === "temporary" && (
            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
              <Clock className="h-3 w-3" />
              Here now
            </span>
          )}
          {presenceType === "recommended" && (
            <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
              <Star className="h-3 w-3" />
              Recommends this spot
            </span>
          )}
          {presenceType === "static" && reader.locationLabel && (
            <span className="text-[10px] text-muted-foreground truncate">
              {reader.locationLabel}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// Reader detail view
function ReaderView({
  reader,
  onBack,
}: {
  reader: ReaderPin;
  onBack: () => void;
}) {
  const presenceType = reader.presenceType || "static";

  // Calculate time remaining for temporary presence
  const getTimeRemaining = () => {
    if (!reader.presenceExpiresAt) return null;
    const expiresAt = new Date(reader.presenceExpiresAt);
    const now = new Date();
    const diff = expiresAt.getTime() - now.getTime();
    if (diff <= 0) return "Expired";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${minutes}m left`;
    return `${minutes}m left`;
  };

  const timeRemaining = getTimeRemaining();

  return (
    <div className="flex flex-col h-full">
      {/* Header with back button */}
      <div className="p-4 border-b border-border/30">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Reader Profile Header */}
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 border-2 border-background shadow-lg">
            {reader.avatarUrl && <AvatarImage src={reader.avatarUrl} />}
            <AvatarFallback className={cn(
              "text-white text-xl",
              presenceType === "recommended" ? "bg-amber-500" : "bg-emerald-500"
            )}>
              {(reader.displayName || reader.username || "?")[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-lg truncate">
              {reader.displayName || reader.username}
            </h2>
            {reader.locationLabel && (
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                {reader.locationLabel}
              </p>
            )}
          </div>
        </div>

        {/* Presence badge */}
        {presenceType !== "static" && (
          <div className="flex items-center gap-2">
            <span className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium",
              presenceType === "temporary"
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
            )}>
              {presenceType === "temporary" ? (
                <>
                  <Clock className="h-3.5 w-3.5" />
                  Here now
                </>
              ) : (
                <>
                  <Star className="h-3.5 w-3.5" />
                  Recommended spot
                </>
              )}
            </span>
            {timeRemaining && (
              <span className="text-xs text-muted-foreground">{timeRemaining}</span>
            )}
          </div>
        )}

        {/* Location label - show prominently for check-ins */}
        {reader.locationLabel && presenceType !== "static" && (
          <p className="text-sm text-muted-foreground">
            {presenceType === "temporary" ? "Currently reading at " : "Recommends "}
            <span className="font-medium text-foreground">{reader.locationLabel}</span>
          </p>
        )}

        {/* Presence note */}
        {reader.presenceNote && (
          <div className="p-4 rounded-xl bg-muted/50 border border-border/50">
            <p className="text-sm italic text-foreground/80">"{reader.presenceNote}"</p>
          </div>
        )}

        {/* Description */}
        <p className="text-sm text-muted-foreground">
          {presenceType === "temporary"
            ? "This reader is currently here and reading."
            : presenceType === "recommended"
              ? "This reader recommends this spot for reading."
              : "This reader has opted in to share their approximate location to connect with fellow book lovers."}
        </p>

        {/* View Profile Button */}
        {reader.username && (
          <Link href={`/users/${reader.username}`} className="block">
            <Button className="w-full">View Profile</Button>
          </Link>
        )}
      </div>
    </div>
  );
}

// Place detail view
function PlaceView({
  place,
  onBack,
  currentUserId,
  onMarkSpotAtPlace,
}: {
  place: PlacePin;
  onBack: () => void;
  currentUserId?: string;
  onMarkSpotAtPlace: (place: PlacePin, presenceType: "temporary" | "recommended") => void;
}) {
  const [copied, setCopied] = useState(false);

  const config = placeConfig[place.type] || {
    icon: MapPin,
    color: "text-muted-foreground",
    bgColor: "bg-muted",
    label: place.type,
  };
  const Icon = config.icon;

  // URLs
  const googleMapsUrl = place.lat && place.lng
    ? `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`
    : null;
  const directionsUrl = place.lat && place.lng
    ? `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`
    : null;

  // Share functionality
  const handleShare = async () => {
    const shareUrl = googleMapsUrl || window.location.href;
    const shareData = {
      title: place.name,
      text: `Check out ${place.name}${place.address ? ` at ${place.address}` : ""}`,
      url: shareUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // User cancelled or share failed
      }
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with back button */}
      <div className="p-4 border-b border-border/30">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Place Header */}
        <div>
          {/* Type badge */}
          <div className="flex items-center gap-1.5 mb-2">
            <span className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
              config.bgColor, config.color
            )}>
              <Icon className="h-3.5 w-3.5" />
              {config.label}
            </span>
            {place.source === "community" && (
              <span className="px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                Community
              </span>
            )}
          </div>

          {/* Name */}
          <h2 className="font-semibold text-lg leading-snug">
            {place.name}
          </h2>

          {/* Address */}
          {place.address && (
            <p className="text-sm text-muted-foreground mt-1 flex items-start gap-1.5">
              <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{place.address}</span>
            </p>
          )}
        </div>

        {/* Quick Action Buttons */}
        <div className="grid grid-cols-3 gap-2">
          {directionsUrl ? (
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
            >
              <Navigation className="h-5 w-5" />
              <span className="text-xs font-medium">Directions</span>
            </a>
          ) : (
            <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-muted/30 text-muted-foreground/50">
              <Navigation className="h-5 w-5" />
              <span className="text-xs font-medium">Directions</span>
            </div>
          )}

          {place.website ? (
            <a
              href={place.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-muted/60 hover:bg-muted text-foreground transition-colors"
            >
              <Globe className="h-5 w-5" />
              <span className="text-xs font-medium">Website</span>
            </a>
          ) : (
            <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-muted/30 text-muted-foreground/50">
              <Globe className="h-5 w-5" />
              <span className="text-xs font-medium">Website</span>
            </div>
          )}

          <button
            onClick={handleShare}
            className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-muted/60 hover:bg-muted text-foreground transition-colors"
          >
            {copied ? (
              <>
                <Check className="h-5 w-5 text-green-500" />
                <span className="text-xs font-medium text-green-600">Copied!</span>
              </>
            ) : (
              <>
                <Share2 className="h-5 w-5" />
                <span className="text-xs font-medium">Share</span>
              </>
            )}
          </button>
        </div>

        {/* Description */}
        {place.description && (
          <div className="p-4 rounded-xl bg-muted/30">
            <p className="text-sm text-muted-foreground">{place.description}</p>
          </div>
        )}

        {/* Primary Actions */}
        {currentUserId ? (
          <div className="space-y-2">
            <Button
              onClick={() => onMarkSpotAtPlace(place, "temporary")}
              className="w-full bg-emerald-500 hover:bg-emerald-600"
            >
              <MapPin className="h-4 w-4 mr-2" />
              I&apos;m Here Now
            </Button>
            <Button
              onClick={() => onMarkSpotAtPlace(place, "recommended")}
              variant="outline"
              className="w-full border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
            >
              <Star className="h-4 w-4 mr-2" />
              Recommend This Spot
            </Button>
          </div>
        ) : (
          <Link href="/login?redirect=/community/map" className="block">
            <Button variant="outline" className="w-full">
              Sign in to mark your spot
            </Button>
          </Link>
        )}

        {/* Data source */}
        <div className="pt-2 border-t text-center">
          <p className="text-xs text-muted-foreground">
            Data from {place.source === "community" ? "OhMyReads Community" : "OpenStreetMap"}
          </p>
          {googleMapsUrl && (
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
            >
              View on Google Maps
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
