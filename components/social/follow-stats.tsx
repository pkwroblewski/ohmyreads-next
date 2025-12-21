"use client";

import Link from "next/link";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface FollowStatsProps {
  username: string;
  followersCount: number;
  followingCount: number;
  className?: string;
}

export default function FollowStats({
  username,
  followersCount,
  followingCount,
  className,
}: FollowStatsProps) {
  return (
    <div className={cn("flex items-center gap-4 text-sm", className)}>
      <Link
        href={`/users/${username}/followers`}
        className="hover:text-primary transition-colors"
      >
        <span className="font-semibold">{followersCount}</span>{" "}
        <span className="text-muted-foreground">
          {followersCount === 1 ? "Follower" : "Followers"}
        </span>
      </Link>
      <Link
        href={`/users/${username}/following`}
        className="hover:text-primary transition-colors"
      >
        <span className="font-semibold">{followingCount}</span>{" "}
        <span className="text-muted-foreground">Following</span>
      </Link>
    </div>
  );
}
