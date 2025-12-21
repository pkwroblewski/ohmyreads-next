"use client";

import Link from "next/link";
import { Award, ChevronRight } from "lucide-react";
import BadgeCard from "./badge-card";
import BadgeIcon from "./badge-icon";
import type { UserBadgeWithDefinition } from "@/lib/queries/badges";
import { cn } from "@/lib/utils";

interface BadgesSectionProps {
  badges: UserBadgeWithDefinition[];
  userId: string;
  isOwnProfile?: boolean;
  variant?: "compact" | "full";
  maxDisplay?: number;
}

export default function BadgesSection({
  badges,
  userId,
  isOwnProfile = false,
  variant = "compact",
  maxDisplay = 6,
}: BadgesSectionProps) {
  const unlockedBadges = badges.filter((b) => b.unlocked);
  const displayBadges = unlockedBadges.slice(0, maxDisplay);
  const remainingCount = unlockedBadges.length - maxDisplay;

  if (unlockedBadges.length === 0) {
    if (!isOwnProfile) return null;

    return (
      <div className="py-4">
        <div className="flex items-center gap-2 mb-3">
          <Award className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-muted-foreground">
            Achievements
          </h3>
        </div>
        <p className="text-sm text-muted-foreground">
          No badges unlocked yet. Keep reading to earn achievements!
        </p>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className="py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-medium">
              Achievements ({unlockedBadges.length})
            </h3>
          </div>
          {isOwnProfile && unlockedBadges.length > maxDisplay && (
            <Link
              href="/stats#achievements"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              View all
              <ChevronRight className="h-3 w-3" />
            </Link>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {displayBadges.map(({ badge }) => (
            <BadgeIcon key={badge.id} badge={badge} size="sm" />
          ))}
          {remainingCount > 0 && (
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
              +{remainingCount}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Full variant - shows cards
  return (
    <div className="py-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Award className="h-5 w-5 text-amber-500" />
          <h3 className="text-lg font-semibold">
            Achievements ({unlockedBadges.length})
          </h3>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {unlockedBadges.map(({ badge, unlockedAt }) => (
          <BadgeCard
            key={badge.id}
            badge={badge}
            unlocked={true}
            unlockedAt={unlockedAt}
            size="md"
          />
        ))}
      </div>
    </div>
  );
}
