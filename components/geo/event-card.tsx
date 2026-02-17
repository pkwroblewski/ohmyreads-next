"use client";

import { cn } from "@/lib/utils";
import { CalendarDays, MapPin, ExternalLink, Pen, BookOpen, Users, Sparkles, GraduationCap } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface BookEvent {
  id: string;
  title: string;
  description?: string;
  event_type: "signing" | "reading" | "festival" | "club" | "workshop" | "other";
  venue_name: string;
  venue_address?: string;
  city?: string;
  lat?: number;
  lng?: number;
  start_date: string;
  start_time?: string;
  end_date?: string;
  url?: string;
  image_url?: string;
  is_featured?: boolean;
}

interface EventCardProps {
  event: BookEvent;
  onLocate?: (lat: number, lng: number) => void;
  className?: string;
}

const eventTypeConfig = {
  signing: {
    label: "Book Signing",
    icon: Pen,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    badgeVariant: "secondary" as const,
  },
  reading: {
    label: "Reading",
    icon: BookOpen,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    badgeVariant: "secondary" as const,
  },
  festival: {
    label: "Festival",
    icon: Sparkles,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    badgeVariant: "secondary" as const,
  },
  club: {
    label: "Book Club",
    icon: Users,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    badgeVariant: "secondary" as const,
  },
  workshop: {
    label: "Workshop",
    icon: GraduationCap,
    color: "text-rose-500",
    bgColor: "bg-rose-500/10",
    badgeVariant: "secondary" as const,
  },
  other: {
    label: "Event",
    icon: CalendarDays,
    color: "text-slate-500",
    bgColor: "bg-slate-500/10",
    badgeVariant: "secondary" as const,
  },
};

function formatEventDate(startDate: string, startTime?: string): string {
  const start = new Date(startDate);
  const options: Intl.DateTimeFormatOptions = {
    weekday: "short",
    month: "short",
    day: "numeric"
  };

  let dateStr = start.toLocaleDateString("en-US", options);

  if (startTime) {
    // Parse time string (HH:MM:SS) and format
    const [hours, minutes] = startTime.split(":");
    const time = new Date();
    time.setHours(parseInt(hours), parseInt(minutes));
    dateStr += ` at ${time.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  }

  return dateStr;
}

export function EventCard({ event, onLocate, className }: EventCardProps) {
  const config = eventTypeConfig[event.event_type] || eventTypeConfig.other;
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "p-4 border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer group",
        className
      )}
    >
      <div className="flex gap-3">
        {/* Icon */}
        <div className={cn(
          "w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105",
          config.bgColor
        )}>
          <Icon className={cn("w-5 h-5", config.color)} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">
            {event.title}
          </h3>

          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{event.venue_name}</span>
          </p>

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge variant={config.badgeVariant} className="text-xs px-2 py-0">
              {config.label}
            </Badge>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              {formatEventDate(event.start_date, event.start_time)}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {event.lat && event.lng && onLocate && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onLocate(event.lat!, event.lng!);
              }}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              title="Show on map"
            >
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
          {event.url && (
            <a
              href={event.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              title="View details"
            >
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </a>
          )}
        </div>
      </div>

      {/* Description preview */}
      {event.description && (
        <p className="text-xs text-muted-foreground mt-2 line-clamp-2 pl-14">
          {event.description}
        </p>
      )}
    </div>
  );
}
