"use client";

import Link from "next/link";
import { BookOpen, UserPlus } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback, getInitials } from "@/components/ui/avatar";
import { CompatibilityBadge } from "@/components/discover/compatibility-badge";
import FollowButton from "./follow-button";
import type { SuggestedFollow } from "@/lib/queries/follows";

interface SuggestedFollowsProps {
  suggestions: SuggestedFollow[];
}

export function SuggestedFollows({
  suggestions,
}: SuggestedFollowsProps) {
  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className="bg-card border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <UserPlus className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">Readers You Might Like</h3>
      </div>

      <div className="space-y-3">
        {suggestions.map((user) => {
          const displayName = user.display_name || user.username || "Reader";

          return (
            <div
              key={user.id}
              className="flex items-center gap-3"
            >
              <Link href={`/users/${user.username}`}>
                <Avatar size="sm" className="hover:ring-2 hover:ring-primary/20 transition-all">
                  {user.avatar_url ? (
                    <AvatarImage src={user.avatar_url} alt={displayName} />
                  ) : (
                    <AvatarFallback initials={getInitials(displayName)} />
                  )}
                </Avatar>
              </Link>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <Link
                    href={`/users/${user.username}`}
                    className="font-medium text-sm truncate hover:text-primary transition-colors"
                  >
                    {displayName}
                  </Link>
                  {user.compatibility && (
                    <CompatibilityBadge level={user.compatibility} size="sm" />
                  )}
                </div>
                {user.shared_books > 0 && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <BookOpen className="w-3 h-3" />
                    {user.shared_books} book{user.shared_books !== 1 ? "s" : ""} in common
                  </p>
                )}
              </div>

              <FollowButton
                targetUserId={user.id}
                initialIsFollowing={false}
                size="sm"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
