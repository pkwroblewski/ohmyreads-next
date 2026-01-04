"use client";

import Link from "next/link";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import type { FriendProfile } from "@/lib/queries/friends";

interface FriendsListProps {
  friends: FriendProfile[];
}

export function FriendsList({ friends }: FriendsListProps) {
  if (friends.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No friends yet</p>
        <p className="text-sm mt-1">Discover readers and send friend requests!</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {friends.map((friend) => (
        <Link
          key={friend.id}
          href={`/users/${friend.username}`}
          className="flex items-center gap-3 p-4 rounded-lg border bg-card hover:border-primary/30 transition-colors"
        >
          <Avatar className="h-12 w-12">
            <AvatarImage src={friend.avatar_url || undefined} />
            <AvatarFallback>
              {(friend.display_name || friend.username || "?")[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="font-medium truncate">
              {friend.display_name || friend.username}
            </p>
            <p className="text-sm text-muted-foreground truncate">
              @{friend.username}
            </p>
            {friend.bio && (
              <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                {friend.bio}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Friends since {formatDistanceToNow(new Date(friend.friends_since), { addSuffix: true })}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
