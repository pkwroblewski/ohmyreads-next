"use client";

import { useState, useEffect } from "react";
import { CalendarDays, MapPin, Loader2, BookOpen, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { EventCardCompact, type BookEvent } from "./event-card-compact";

interface MapEventsPanelProps {
  geohash?: string;
  locationLabel?: string;
  onLocateEvent?: (lat: number, lng: number) => void;
  className?: string;
}

export function MapEventsPanel({
  geohash,
  locationLabel,
  onLocateEvent,
  className,
}: MapEventsPanelProps) {
  const [events, setEvents] = useState<BookEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEvents = async () => {
      if (!geohash) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const eventsRes = await fetch(`/api/geo/events?geohash=${geohash}&limit=20`);

        if (eventsRes.ok) {
          const eventsData = await eventsRes.json();
          setEvents(eventsData.events || []);
        }
      } catch (err) {
        console.error("Error fetching events:", err);
        setError("Failed to load events");
      }

      setIsLoading(false);
    };

    fetchEvents();
  }, [geohash]);

  // Limit to 5 events for the compact display
  const displayEvents = events.slice(0, 5);

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
      {/* Header */}
      <div className="p-5 border-b border-border/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center">
            <CalendarDays className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-lg">Events</h2>
            {locationLabel && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {locationLabel}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Events List - 5 Segmented Cards */}
      <div className="flex-1 p-4 space-y-3 overflow-y-auto">
        {isLoading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState error={error} />
        ) : displayEvents.length === 0 ? (
          <EmptyState />
        ) : (
          displayEvents.map((event, index) => (
            <EventCardCompact
              key={event.id}
              event={event}
              index={index}
              onLocate={onLocateEvent}
            />
          ))
        )}
      </div>

      {/* Footer - View All */}
      {events.length > 5 && (
        <div className="p-4 border-t border-border/30">
          <button className="w-full py-2.5 px-4 rounded-xl bg-muted/50 hover:bg-muted text-sm font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-2">
            <Sparkles className="h-4 w-4" />
            View all {events.length} events
          </button>
        </div>
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <Loader2 className="h-8 w-8 animate-spin mb-3 text-primary/50" />
      <span className="text-sm">Finding events nearby...</span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
        <BookOpen className="h-8 w-8 opacity-50" />
      </div>
      <p className="text-sm font-medium">No upcoming events</p>
      <p className="text-xs text-center mt-1 max-w-[200px]">
        Move the map to discover literary events in other areas
      </p>
    </div>
  );
}

function ErrorState({ error }: { error: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <p className="text-sm text-center">{error}</p>
      <button
        className="mt-3 text-sm text-primary hover:underline"
        onClick={() => window.location.reload()}
      >
        Try again
      </button>
    </div>
  );
}
