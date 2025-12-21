"use client";

import { useState, useEffect } from "react";
import { MapPin, Loader2, User, BookOpen } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { getPlaceCheckins } from "@/lib/actions/checkins";
import Link from "next/link";

interface Checkin {
  id: string;
  place_id: string;
  user_id: string;
  book_id: string | null;
  note: string | null;
  created_at: string;
  user: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
  book?: {
    id: string;
    title: string;
    author: string;
    slug: string;
    cover_url: string | null;
  } | null;
}

interface PlaceCheckinsListProps {
  placeId: string;
  currentUserId?: string;
}

export function PlaceCheckinsList({ placeId, currentUserId }: PlaceCheckinsListProps) {
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCheckins = async () => {
    try {
      const result = await getPlaceCheckins(placeId, 20);
      setCheckins(result.checkins as Checkin[]);
    } catch (error) {
      console.error("Error fetching check-ins:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCheckins();
  }, [placeId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      {checkins.length > 0 && (
        <div className="flex items-center gap-2 pb-3 border-b">
          <MapPin className="h-5 w-5 text-primary" />
          <span className="text-muted-foreground">
            {checkins.length} recent check-in{checkins.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* Check-ins List */}
      {checkins.length === 0 ? (
        <p className="text-center text-muted-foreground py-6">
          No check-ins yet. Be the first to check in here!
        </p>
      ) : (
        <div className="space-y-4">
          {checkins.map((checkin) => (
            <CheckinCard
              key={checkin.id}
              checkin={checkin}
              isCurrentUser={checkin.user.id === currentUserId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CheckinCard({
  checkin,
  isCurrentUser,
}: {
  checkin: Checkin;
  isCurrentUser: boolean;
}) {
  const displayName = checkin.user.display_name || checkin.user.username || "Anonymous";

  // Format relative time
  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className={cn("space-y-2", isCurrentUser && "bg-muted/50 rounded-lg p-3 -mx-3")}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href={`/users/${checkin.user.username}`}>
          <Avatar className="h-9 w-9 cursor-pointer hover:opacity-80 transition-opacity">
            {checkin.user.avatar_url && (
              <AvatarImage src={checkin.user.avatar_url} alt={displayName} />
            )}
            <AvatarFallback>
              <User className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Link
              href={`/users/${checkin.user.username}`}
              className="font-medium text-sm truncate hover:underline"
            >
              {displayName}
              {isCurrentUser && (
                <span className="text-muted-foreground font-normal"> (You)</span>
              )}
            </Link>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span>checked in {getRelativeTime(checkin.created_at)}</span>
          </div>
        </div>
      </div>

      {/* Book being read */}
      {checkin.book && (
        <Link
          href={`/books/${checkin.book.slug}`}
          className="flex items-center gap-3 pl-12 group"
        >
          {checkin.book.cover_url ? (
            <img
              src={checkin.book.cover_url}
              alt={checkin.book.title}
              className="w-8 h-12 object-cover rounded shadow-sm"
            />
          ) : (
            <div className="w-8 h-12 rounded bg-muted flex items-center justify-center">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate group-hover:underline">
              {checkin.book.title}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {checkin.book.author}
            </p>
          </div>
        </Link>
      )}

      {/* Note */}
      {checkin.note && (
        <p className="text-sm text-muted-foreground pl-12">{checkin.note}</p>
      )}
    </div>
  );
}
