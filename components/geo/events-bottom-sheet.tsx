"use client";

import { useState } from "react";
import { CalendarDays, X, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MapEventsPanel } from "./map-events-panel";

interface EventsBottomSheetProps {
  geohash?: string;
  locationLabel?: string;
  onLocateEvent?: (lat: number, lng: number) => void;
}

export function EventsBottomSheet({
  geohash,
  locationLabel,
  onLocateEvent,
}: EventsBottomSheetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <>
      {/* Toggle Button - Only visible on mobile/tablet */}
      <Button
        variant="secondary"
        size="sm"
        className={cn(
          "fixed bottom-6 left-1/2 -translate-x-1/2 z-20 shadow-lg rounded-full px-4 lg:hidden",
          "flex items-center gap-2",
          isOpen && "hidden"
        )}
        onClick={() => setIsOpen(true)}
      >
        <CalendarDays className="h-4 w-4" />
        <span>Events</span>
        <ChevronUp className="h-4 w-4" />
      </Button>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Bottom Sheet */}
      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 z-40 lg:hidden",
          "bg-card rounded-t-3xl shadow-2xl",
          "transform transition-transform duration-300 ease-out",
          isOpen ? "translate-y-0" : "translate-y-full",
          isExpanded ? "h-[85vh]" : "h-[50vh]"
        )}
      >
        {/* Handle */}
        <div
          className="flex justify-center py-3 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Close Button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2"
          onClick={() => {
            setIsOpen(false);
            setIsExpanded(false);
          }}
        >
          <X className="h-5 w-5" />
        </Button>

        {/* Content */}
        <div className="h-[calc(100%-2rem)] overflow-hidden">
          <MapEventsPanel
            geohash={geohash}
            locationLabel={locationLabel}
            onLocateEvent={(lat, lng) => {
              onLocateEvent?.(lat, lng);
              setIsOpen(false);
            }}
          />
        </div>
      </div>
    </>
  );
}
