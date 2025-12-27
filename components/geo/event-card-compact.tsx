"use client";

import { cn } from "@/lib/utils";
import {
  CalendarDays,
  MapPin,
  ExternalLink,
  Pen,
  BookOpen,
  Users,
  Sparkles,
  GraduationCap,
  Clock,
  Star,
  Flame,
  Navigation,
} from "lucide-react";

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

interface EventCardCompactProps {
  event: BookEvent;
  index: number;
  onLocate?: (lat: number, lng: number) => void;
}

const eventTypeConfig = {
  signing: {
    label: "Signing",
    icon: Pen,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
  reading: {
    label: "Reading",
    icon: BookOpen,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  festival: {
    label: "Festival",
    icon: Sparkles,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
  },
  club: {
    label: "Book Club",
    icon: Users,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
  },
  workshop: {
    label: "Workshop",
    icon: GraduationCap,
    color: "text-rose-500",
    bgColor: "bg-rose-500/10",
  },
  other: {
    label: "Event",
    icon: CalendarDays,
    color: "text-slate-500",
    bgColor: "bg-slate-500/10",
  },
};

function getRecommendationReason(
  event: BookEvent,
  index: number
): { text: string; icon: typeof Star } {
  const today = new Date();
  const eventDate = new Date(event.start_date);
  const diffDays = Math.ceil(
    (eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (event.is_featured) {
    return { text: "Featured", icon: Star };
  }

  if (diffDays >= 0 && diffDays <= 3) {
    return { text: "This weekend", icon: Clock };
  }

  if (diffDays > 3 && diffDays <= 7) {
    return { text: "Coming soon", icon: Flame };
  }

  if (index < 2) {
    return { text: "Near you", icon: Navigation };
  }

  if (event.event_type === "festival") {
    return { text: "Popular", icon: Flame };
  }

  return { text: "Recommended", icon: Star };
}

function formatDateCompact(startDate: string): string {
  const date = new Date(startDate);
  const today = new Date();
  const diffDays = Math.ceil(
    (date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays <= 7) {
    return date.toLocaleDateString("en-US", { weekday: "short" });
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function EventCardCompact({
  event,
  index,
  onLocate,
}: EventCardCompactProps) {
  const config = eventTypeConfig[event.event_type] || eventTypeConfig.other;
  const Icon = config.icon;
  const recommendation = getRecommendationReason(event, index);
  const RecommendIcon = recommendation.icon;

  return (
    <div
      className={cn(
        "group relative p-4 rounded-2xl",
        "bg-card border border-border/50",
        "hover:shadow-warm hover:border-primary/20",
        "transition-all duration-300 ease-out",
        "cursor-pointer"
      )}
      onClick={() => {
        if (event.lat && event.lng && onLocate) {
          onLocate(event.lat, event.lng);
        } else if (event.url) {
          window.open(event.url, "_blank");
        }
      }}
    >
      <div className="flex gap-3">
        {/* Event Type Icon */}
        <div
          className={cn(
            "w-11 h-11 rounded-xl flex items-center justify-center shrink-0",
            "transition-transform duration-300 group-hover:scale-105",
            config.bgColor
          )}
        >
          <Icon className={cn("w-5 h-5", config.color)} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Event Name */}
          <h4 className="font-medium text-sm leading-tight line-clamp-1 group-hover:text-primary transition-colors">
            {event.title}
          </h4>

          {/* Location */}
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{event.venue_name}</span>
          </p>

          {/* Why Recommended + Date */}
          <div className="flex items-center gap-2 mt-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full",
                "bg-primary/10 text-primary"
              )}
            >
              <RecommendIcon className="h-3 w-3" />
              {recommendation.text}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {formatDateCompact(event.start_date)}
            </span>
          </div>
        </div>

        {/* External Link indicator */}
        {event.url && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 self-center">
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
}
