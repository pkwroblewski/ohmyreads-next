"use client";

import { useState, useEffect } from "react";
import { Sparkles, CalendarDays, MapPin, ChevronRight, Loader2, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { EventCard, type BookEvent } from "./event-card";
import { Button } from "@/components/ui/button";

interface EventsSummary {
  summary: string;
  event_count: number;
  generated_at: string;
}

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
  const [summary, setSummary] = useState<EventsSummary | null>(null);
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
        const [eventsRes, summaryRes] = await Promise.all([
          fetch(`/api/geo/events?geohash=${geohash}&limit=20`),
          fetch(`/api/geo/events/summary?geohash=${geohash}`),
        ]);

        if (eventsRes.ok) {
          const eventsData = await eventsRes.json();
          setEvents(eventsData.events || []);
        }

        if (summaryRes.ok) {
          const summaryData = await summaryRes.json();
          setSummary(summaryData.summary || null);
        }
      } catch (err) {
        console.error("Error fetching events:", err);
        setError("Failed to load events");
      }

      setIsLoading(false);
    };

    fetchEvents();
  }, [geohash]);

  return (
    <div className={cn("flex flex-col h-full bg-card", className)}>
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Literary Events</h2>
        </div>
        {locationLabel && (
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {locationLabel}
          </p>
        )}
      </div>

      {/* AI Summary Card */}
      {summary && (
        <div className="p-4 border-b border-border bg-gradient-to-br from-primary/5 via-accent/5 to-primary/5">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <span className="font-medium text-sm">This Week&apos;s Highlights</span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {summary.summary}
          </p>
          <p className="text-xs text-muted-foreground/70 mt-2">
            {summary.event_count} events nearby
          </p>
        </div>
      )}

      {/* Events List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mb-2" />
            <span className="text-sm">Loading events...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground p-4">
            <p className="text-sm text-center">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => window.location.reload()}
            >
              Try again
            </Button>
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground p-4">
            <BookOpen className="h-10 w-10 mb-3 opacity-50" />
            <p className="text-sm font-medium">No upcoming events</p>
            <p className="text-xs text-center mt-1">
              Move the map or search a new location to discover literary events
            </p>
          </div>
        ) : (
          <>
            {events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onLocate={onLocateEvent}
              />
            ))}
          </>
        )}
      </div>

      {/* Footer */}
      {events.length > 0 && (
        <div className="p-3 border-t border-border">
          <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground">
            <span>View all events</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
