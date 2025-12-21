"use client";

import Link from "next/link";
import { BookOpen, MessageSquare, Users } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback, getInitials } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import FollowButton from "@/components/social/follow-button";
import { CompatibilityBadge } from "./compatibility-badge";
import type { ReaderWithCompatibility } from "@/types/database";

interface ReaderCardProps {
  reader: ReaderWithCompatibility;
  showCompatibility?: boolean;
  compact?: boolean;
}

export function ReaderCard({
  reader,
  showCompatibility = true,
  compact = false,
}: ReaderCardProps) {
  const displayName = reader.display_name || reader.username || "Reader";

  if (compact) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
        <Link href={`/users/${reader.username}`}>
          <Avatar size="sm" className="hover:ring-2 hover:ring-primary/20 transition-all">
            {reader.avatar_url ? (
              <AvatarImage src={reader.avatar_url} alt={displayName} />
            ) : (
              <AvatarFallback initials={getInitials(displayName)} />
            )}
          </Avatar>
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Link
              href={`/users/${reader.username}`}
              className="font-medium text-sm truncate hover:text-primary transition-colors"
            >
              {displayName}
            </Link>
            {showCompatibility && reader.compatibility !== "unknown" && (
              <CompatibilityBadge level={reader.compatibility} size="sm" />
            )}
          </div>
          {reader.shared_books > 0 && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <BookOpen className="w-3 h-3" />
              {reader.shared_books} book{reader.shared_books !== 1 ? "s" : ""} in common
            </p>
          )}
        </div>

        <FollowButton
          targetUserId={reader.id}
          initialIsFollowing={false}
          size="sm"
        />
      </div>
    );
  }

  return (
    <Card className="overflow-hidden hover:border-primary/30 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Link href={`/users/${reader.username}`}>
            <Avatar size="lg" className="hover:ring-2 hover:ring-primary/20 transition-all">
              {reader.avatar_url ? (
                <AvatarImage src={reader.avatar_url} alt={displayName} />
              ) : (
                <AvatarFallback initials={getInitials(displayName)} />
              )}
            </Avatar>
          </Link>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={`/users/${reader.username}`}
                className="font-semibold hover:text-primary transition-colors"
              >
                {displayName}
              </Link>
              {showCompatibility && reader.compatibility !== "unknown" && (
                <CompatibilityBadge level={reader.compatibility} />
              )}
            </div>

            {reader.username && (
              <p className="text-sm text-muted-foreground">@{reader.username}</p>
            )}

            {reader.bio && (
              <p className="text-sm mt-2 line-clamp-2">{reader.bio}</p>
            )}

            <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <BookOpen className="w-4 h-4" />
                {reader.books_count} books
              </span>
              <span className="flex items-center gap-1">
                <MessageSquare className="w-4 h-4" />
                {reader.reviews_count} reviews
              </span>
              <span className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                {reader.followers_count} followers
              </span>
            </div>

            {(reader.shared_genres.length > 0 || reader.shared_vibes.length > 0) && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {reader.shared_genres.slice(0, 3).map((genre) => (
                  <span
                    key={genre}
                    className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary"
                  >
                    {genre}
                  </span>
                ))}
                {reader.shared_vibes.slice(0, 2).map((vibe) => (
                  <span
                    key={vibe}
                    className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground"
                  >
                    {vibe}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <FollowButton
            targetUserId={reader.id}
            initialIsFollowing={false}
          />
        </div>
      </CardContent>
    </Card>
  );
}
