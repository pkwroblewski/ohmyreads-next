"use client";

import { TIER_COLORS, type BadgeDefinition } from "@/lib/data/badges";
import { cn } from "@/lib/utils";

interface BadgeCardProps {
  badge: BadgeDefinition;
  unlocked: boolean;
  unlockedAt?: string | null;
  size?: "sm" | "md" | "lg";
  showDescription?: boolean;
}

export default function BadgeCard({
  badge,
  unlocked,
  unlockedAt,
  size = "md",
  showDescription = true,
}: BadgeCardProps) {
  const tierColors = TIER_COLORS[badge.tier];

  const sizeClasses = {
    sm: {
      container: "p-2",
      icon: "text-2xl",
      iconBox: "w-10 h-10",
      title: "text-xs",
      desc: "text-[10px]",
    },
    md: {
      container: "p-3",
      icon: "text-3xl",
      iconBox: "w-14 h-14",
      title: "text-sm",
      desc: "text-xs",
    },
    lg: {
      container: "p-4",
      icon: "text-4xl",
      iconBox: "w-16 h-16",
      title: "text-base",
      desc: "text-sm",
    },
  };

  const sizes = sizeClasses[size];

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div
      className={cn(
        "rounded-xl border transition-all",
        sizes.container,
        unlocked
          ? cn("bg-card hover:shadow-md", tierColors.border)
          : "bg-muted/50 opacity-60 grayscale"
      )}
    >
      <div className="flex items-center gap-3">
        {/* Badge Icon */}
        <div
          className={cn(
            "rounded-xl flex items-center justify-center shrink-0",
            sizes.iconBox,
            unlocked
              ? cn("bg-gradient-to-br", tierColors.bg)
              : "bg-muted"
          )}
        >
          <span className={sizes.icon}>{badge.icon}</span>
        </div>

        {/* Badge Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className={cn("font-semibold truncate", sizes.title)}>
              {badge.name}
            </h4>
            {unlocked && (
              <span
                className={cn(
                  "px-1.5 py-0.5 rounded text-[10px] font-medium uppercase",
                  "bg-gradient-to-r",
                  tierColors.bg,
                  tierColors.text
                )}
              >
                {badge.tier}
              </span>
            )}
          </div>

          {showDescription && (
            <p
              className={cn(
                "text-muted-foreground line-clamp-1 mt-0.5",
                sizes.desc
              )}
            >
              {badge.description}
            </p>
          )}

          {unlocked && unlockedAt && (
            <p className={cn("text-muted-foreground mt-1", sizes.desc)}>
              Earned {formatDate(unlockedAt)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
