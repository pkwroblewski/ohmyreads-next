"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, BookMarked, Landmark, Coffee, MapPin, Globe, Navigation, Users, MessageSquare, Camera, Star, Clock, Loader2, ExternalLink, Phone, Share2, Mail, Accessibility, Check, MapPinned, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { ReaderPin, PlacePin, MapItem } from "./reader-map-immersive";
import { PlaceReviewsList } from "./place-reviews-list";
import { PlacePhotosList } from "./place-photos-list";
import { PlaceCheckinsList } from "./place-checkins-list";
import { CheckinButton } from "./checkin-button";
import { DirectionsDisplay } from "./directions-display";
import { isOpenNow, formatHoursForDisplay } from "@/lib/utils/opening-hours";
import { safeHref } from "@/lib/utils/sanitize";

interface MapDetailPanelProps {
  item: MapItem | null;
  onClose: () => void;
  currentUserId?: string;
  onMarkSpotAtPlace?: (place: PlacePin, presenceType: "temporary" | "recommended") => void;
  onClearPresence?: () => void;
}

function isReader(item: MapItem): item is ReaderPin {
  return "username" in item;
}

const placeConfig: Record<string, {
  icon: typeof BookMarked;
  color: string;
  bgColor: string;
  label: string;
  description: string;
}> = {
  bookstore: {
    icon: BookMarked,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-500/15",
    label: "Bookstore",
    description: "A place to browse and buy books. Perfect for discovering your next read.",
  },
  library: {
    icon: Landmark,
    color: "text-sky-600 dark:text-sky-400",
    bgColor: "bg-sky-500/15",
    label: "Library",
    description: "A public library with books to borrow. Often hosts reading events and book clubs.",
  },
  cafe: {
    icon: Coffee,
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-500/15",
    label: "Book Cafe",
    description: "A cozy cafe great for reading. Grab a coffee and enjoy your book.",
  },
};

export function MapDetailPanel({ item, onClose, currentUserId, onMarkSpotAtPlace, onClearPresence }: MapDetailPanelProps) {
  const [isVisible, setIsVisible] = useState(false);

  // Handle animation
  useEffect(() => {
    if (item) {
      // Small delay for enter animation
      requestAnimationFrame(() => setIsVisible(true));
    } else {
      queueMicrotask(() => setIsVisible(false));
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
          "fixed z-30 bg-white/95 dark:bg-card/95 backdrop-blur-xl border border-border/50 shadow-2xl transition-transform duration-300 ease-out",
          // Mobile: bottom sheet
          "inset-x-0 bottom-0 rounded-t-3xl max-h-[70vh]",
          // Desktop: floating card on the right
          "lg:top-24 lg:bottom-auto lg:right-4 lg:left-auto lg:w-80 lg:max-h-[calc(100vh-7rem)] lg:rounded-2xl lg:border",
          // Animation
          isVisible
            ? "translate-y-0 lg:translate-x-0"
            : "translate-y-full lg:translate-y-0 lg:translate-x-full"
        )}
      >
        {/* Drag handle - mobile only */}
        <div className="flex justify-center pt-2 pb-1 lg:hidden">
          <div className="w-8 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header - Compact with close button */}
        <div className="flex items-start gap-2 p-3 lg:p-3">
          {isReader(item) ? (
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <Avatar className="h-10 w-10 border-2 border-background shadow-sm">
                {item.avatarUrl && <AvatarImage src={item.avatarUrl} />}
                <AvatarFallback className="bg-emerald-500 text-white text-sm">
                  {(item.displayName || item.username || "?")[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold truncate text-sm">
                  {item.displayName || item.username}
                </h2>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Users className="h-3 w-3 text-emerald-500" />
                  <span>Reader</span>
                  {item.locationLabel && (
                    <>
                      <span>·</span>
                      <span className="truncate">{item.locationLabel}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 min-w-0">
              {(() => {
                const config = placeConfig[item.type] || {
                  icon: MapPin,
                  color: "text-muted-foreground",
                  bgColor: "bg-muted",
                  label: item.type,
                  description: "A literary place in your area.",
                };
                const Icon = config.icon;

                return (
                  <>
                    {/* Type badge row */}
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium",
                        config.bgColor, config.color
                      )}>
                        <Icon className="h-3 w-3" />
                        {config.label}
                      </span>
                      {item.source === "community" && (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary">
                          Community
                        </span>
                      )}
                    </div>

                    {/* Name */}
                    <h2 className="font-semibold leading-snug pr-6 text-sm">
                      {item.name}
                    </h2>

                    {/* Address */}
                    {item.address && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-start gap-1">
                        <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                        <span className="line-clamp-1">{item.address}</span>
                      </p>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 -mt-0.5 -mr-1"
            onClick={onClose}
            aria-label="Close place details"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="px-3 pb-3 overflow-y-auto max-h-[50vh] lg:max-h-[calc(100vh-12rem)]">
          {isReader(item) ? (
            <ReaderContent reader={item} currentUserId={currentUserId} onClearPresence={onClearPresence} />
          ) : (
            <PlaceContent place={item} currentUserId={currentUserId} onMarkSpotAtPlace={onMarkSpotAtPlace} />
          )}
        </div>
      </div>
    </>
  );
}

function ReaderContent({ reader, currentUserId, onClearPresence }: {
  reader: ReaderPin;
  currentUserId?: string;
  onClearPresence?: () => void;
}) {
  // Check if this is the current user's marker
  const isOwnMarker = currentUserId && reader.id === currentUserId;

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
  const presenceType = reader.presenceType;

  // If no presence type, user is not checked in (shouldn't happen due to API filtering)
  if (!presenceType) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Presence badge */}
      <div className="flex items-center gap-2">
        <span className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
          presenceType === "temporary"
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
            : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
        )}>
          {presenceType === "temporary" ? (
            <>
              <Clock className="h-3 w-3" />
              Here now
            </>
          ) : (
            <>
              <Star className="h-3 w-3" />
              Recommended spot
            </>
          )}
        </span>
        {timeRemaining && (
          <span className="text-xs text-muted-foreground">{timeRemaining}</span>
        )}
      </div>

      {/* Location label - show prominently for check-ins */}
      {reader.locationLabel && (
        <p className="text-sm text-muted-foreground">
          {presenceType === "temporary" ? "Currently reading at " : "Recommends "}
          <span className="font-medium text-foreground">{reader.locationLabel}</span>
        </p>
      )}

      {/* Currently reading book */}
      {reader.currentlyReading && (
        <Link
          href={reader.currentlyReading.slug ? `/books/${reader.currentlyReading.slug}` : "#"}
          className="block p-3 rounded-lg bg-primary/5 hover:bg-primary/10 border border-primary/10 transition-colors group"
        >
          <div className="flex items-center gap-1.5 text-xs text-primary font-medium mb-2">
            <BookOpen className="h-3.5 w-3.5" />
            <span>Currently Reading</span>
          </div>
          <div className="flex items-center gap-3">
            {reader.currentlyReading.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- URL host is not guaranteed to be in ALLOWED_IMAGE_HOSTS
              <img
                src={reader.currentlyReading.coverUrl}
                alt={reader.currentlyReading.title}
                className="w-10 h-14 object-cover rounded shadow-sm"
              />
            ) : (
              <div className="w-10 h-14 rounded bg-muted flex items-center justify-center">
                <BookMarked className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                {reader.currentlyReading.title}
              </p>
              {reader.currentlyReading.author && (
                <p className="text-xs text-muted-foreground truncate">
                  by {reader.currentlyReading.author}
                </p>
              )}
            </div>
          </div>
        </Link>
      )}

      {/* Presence note */}
      {reader.presenceNote && (
        <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
          <p className="text-sm italic text-foreground/80">&quot;{reader.presenceNote}&quot;</p>
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        {isOwnMarker
          ? presenceType === "temporary"
            ? "You're currently checked in here."
            : "You recommend this spot for reading."
          : presenceType === "temporary"
            ? "This reader is currently here and reading."
            : "This reader recommends this spot for reading."}
      </p>

      {/* Check Out button for own marker */}
      {isOwnMarker && onClearPresence && (
        <Button
          variant="outline"
          className="w-full"
          onClick={onClearPresence}
        >
          Check Out
        </Button>
      )}

      {reader.username && !isOwnMarker && (
        <Link href={`/users/${reader.username}`}>
          <Button className="w-full">View Profile</Button>
        </Link>
      )}
    </div>
  );
}

interface PlaceEnrichment {
  found: boolean;
  rating?: number;
  reviewCount?: number;
  photoUrl?: string;
  hours?: string[];
  website?: string;
  googleMapsUrl?: string;
}

function PlaceContent({ place, currentUserId, onMarkSpotAtPlace }: {
  place: PlacePin;
  currentUserId?: string;
  onMarkSpotAtPlace?: (place: PlacePin, presenceType: "temporary" | "recommended") => void;
}) {
  const [enrichment, setEnrichment] = useState<PlaceEnrichment | null>(null);
  const [isEnriching, setIsEnriching] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showAllHours, setShowAllHours] = useState(false);
  const [showDirections, setShowDirections] = useState(false);

  // Only community places have real IDs for reviews
  const canShowReviews = place.source === "community" && !place.id.startsWith("osm-");
  const isOsmPlace = place.source === "osm";

  // Parse OSM opening hours
  const openStatus = isOpenNow(place.opening_hours);
  const formattedHours = formatHoursForDisplay(place.opening_hours);

  // Get place config for description
  const config = placeConfig[place.type] || {
    icon: MapPin,
    color: "text-muted-foreground",
    bgColor: "bg-muted",
    label: place.type,
    description: "A literary place in your area.",
  };

  // Fetch enrichment data for OSM places
  useEffect(() => {
    if (isOsmPlace && place.lat && place.lng) {
      queueMicrotask(() => setIsEnriching(true));
      fetch(
        `/api/geo/places/enrich?name=${encodeURIComponent(place.name)}&lat=${place.lat}&lng=${place.lng}&osm_id=${place.id}`
      )
        .then((res) => res.json())
        .then((data) => setEnrichment(data.found ? data : null))
        .catch(() => setEnrichment(null))
        .finally(() => setIsEnriching(false));
    }
  }, [place, isOsmPlace]);

  // Use OSM data first, fallback to enrichment
  const websiteUrl = safeHref(place.website || enrichment?.website);
  const phoneNumber = place.phone;
  const emailAddress = place.email;
  const googleMapsUrl = enrichment?.googleMapsUrl || (place.lat && place.lng ? `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}` : null);
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

  // Get photo URL (OSM image or Google Places)
  const photoUrl = place.image || enrichment?.photoUrl;

  // Check if we have any details to show
  const hasDetails = openStatus || formattedHours || enrichment?.hours || phoneNumber || emailAddress || websiteUrl || place.wheelchair;

  return (
    <div className="space-y-3">
      {/* Quick Action Buttons - Compact row */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setShowDirections(!showDirections)}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium transition-colors",
            showDirections
              ? "bg-primary text-primary-foreground"
              : "bg-primary/10 hover:bg-primary/20 text-primary"
          )}
        >
          <Navigation className="h-3.5 w-3.5" />
          <span>Directions</span>
        </button>

        {websiteUrl ? (
          <a
            href={websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg bg-muted/60 hover:bg-muted text-xs font-medium transition-colors"
          >
            <Globe className="h-3.5 w-3.5" />
            <span>Website</span>
          </a>
        ) : (
          <div className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg bg-muted/30 text-xs font-medium text-muted-foreground/50">
            <Globe className="h-3.5 w-3.5" />
            <span>Website</span>
          </div>
        )}

        <button
          onClick={handleShare}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg bg-muted/60 hover:bg-muted text-xs font-medium transition-colors"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-green-500" />
              <span className="text-green-600">Copied</span>
            </>
          ) : (
            <>
              <Share2 className="h-3.5 w-3.5" />
              <span>Share</span>
            </>
          )}
        </button>
      </div>

      {/* Mark Presence Buttons */}
      {currentUserId && onMarkSpotAtPlace && (
        <div className="flex gap-2">
          <Button
            onClick={() => onMarkSpotAtPlace(place, "temporary")}
            size="sm"
            className="flex-1 bg-emerald-500 hover:bg-emerald-600"
          >
            <MapPinned className="h-4 w-4 mr-1.5" />
            I&apos;m Here
          </Button>
          <Button
            onClick={() => onMarkSpotAtPlace(place, "recommended")}
            size="sm"
            variant="outline"
            className="flex-1"
          >
            <Star className="h-4 w-4 mr-1.5" />
            Recommend
          </Button>
        </div>
      )}

      {/* Directions Panel */}
      {showDirections && place.lat && place.lng && (
        <DirectionsDisplay
          destination={{
            lat: place.lat,
            lng: place.lng,
            name: place.name,
          }}
        />
      )}

      {/* Photo section - smaller */}
      {photoUrl && (
        <div className="relative rounded-lg overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element -- URL host is not guaranteed to be in ALLOWED_IMAGE_HOSTS */}
          <img
            src={photoUrl}
            alt={place.name}
            className="w-full h-28 object-cover"
          />
        </div>
      )}

      {/* Loading indicator */}
      {isEnriching && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Loading details...</span>
        </div>
      )}

      {/* About + Rating - compact */}
      <div className="p-2.5 rounded-lg bg-muted/30">
        <p className="text-xs text-muted-foreground leading-relaxed">
          {place.description || config.description}
        </p>
        {enrichment?.rating && (
          <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-border/50">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            <span className="text-xs font-medium">{enrichment.rating.toFixed(1)}</span>
            {enrichment.reviewCount && (
              <span className="text-xs text-muted-foreground">
                ({enrichment.reviewCount.toLocaleString()} reviews)
              </span>
            )}
          </div>
        )}
      </div>

      {/* Details section - compact */}
      {hasDetails && (
        <div className="space-y-2">
          {/* Open/Closed Status */}
          {openStatus && (
            <div className="flex items-center gap-2">
              <span className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium",
                openStatus.isOpen
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
              )}>
                <span className={cn("w-1 h-1 rounded-full", openStatus.isOpen ? "bg-green-500" : "bg-red-500")} />
                {openStatus.isOpen ? "Open" : "Closed"}
              </span>
              {openStatus.nextChange && (
                <span className="text-[10px] text-muted-foreground">{openStatus.nextChange}</span>
              )}
            </div>
          )}

          {/* Opening Hours - collapsible */}
          {(formattedHours || enrichment?.hours) && (
            <button
              onClick={() => setShowAllHours(!showAllHours)}
              className="flex items-center gap-1.5 text-xs text-left hover:text-primary transition-colors w-full"
            >
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="flex-1">Hours</span>
              <span className="text-[10px] text-primary">{showAllHours ? "Hide" : "Show"}</span>
            </button>
          )}
          {showAllHours && (formattedHours || enrichment?.hours) && (
            <div className="ml-5 space-y-0.5 p-2 rounded bg-muted/40">
              {(formattedHours || enrichment?.hours || []).map((h, i) => (
                <p key={i} className="text-[10px] text-muted-foreground">{h}</p>
              ))}
            </div>
          )}

          {/* Phone */}
          {phoneNumber && (
            <a href={`tel:${phoneNumber.replace(/\s/g, "")}`} className="flex items-center gap-1.5 text-xs hover:text-primary">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{phoneNumber}</span>
            </a>
          )}

          {/* Website link */}
          {websiteUrl && (
            <a href={websiteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs hover:text-primary">
              <Globe className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="truncate flex-1">{websiteUrl.replace(/^https?:\/\//, "").split("/")[0]}</span>
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
            </a>
          )}

          {/* Email */}
          {emailAddress && (
            <a href={`mailto:${emailAddress}`} className="flex items-center gap-1.5 text-xs hover:text-primary">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="truncate">{emailAddress}</span>
            </a>
          )}

          {/* Wheelchair */}
          {place.wheelchair && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Accessibility className="h-3.5 w-3.5" />
              <span>{place.wheelchair === "yes" ? "Accessible" : place.wheelchair === "limited" ? "Limited access" : "Not accessible"}</span>
            </div>
          )}
        </div>
      )}

      {/* Check-in button - only for community places */}
      {canShowReviews && (
        <div className="pt-2">
          <CheckinButton
            placeId={place.id}
            placeName={place.name}
            currentUserId={currentUserId}
          />
        </div>
      )}

      {/* Reviews Section - Only for community places */}
      {canShowReviews ? (
        <div className="pt-4 border-t">
          <Tabs defaultValue="checkins" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="checkins" className="flex-1">
                <MapPin className="h-4 w-4 mr-1.5" />
                Check-ins
              </TabsTrigger>
              <TabsTrigger value="reviews" className="flex-1">
                <MessageSquare className="h-4 w-4 mr-1.5" />
                Reviews
              </TabsTrigger>
              <TabsTrigger value="photos" className="flex-1">
                <Camera className="h-4 w-4 mr-1.5" />
                Photos
              </TabsTrigger>
            </TabsList>
            <TabsContent value="checkins" className="mt-4">
              <PlaceCheckinsList placeId={place.id} currentUserId={currentUserId} />
            </TabsContent>
            <TabsContent value="reviews" className="mt-4">
              <PlaceReviewsList placeId={place.id} currentUserId={currentUserId} />
            </TabsContent>
            <TabsContent value="photos" className="mt-4">
              <PlacePhotosList placeId={place.id} currentUserId={currentUserId} />
            </TabsContent>
          </Tabs>
        </div>
      ) : (
        <div className="pt-3 border-t text-center">
          <p className="text-xs text-muted-foreground">
            Data from OpenStreetMap{enrichment ? " & Google" : ""}
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
      )}
    </div>
  );
}
