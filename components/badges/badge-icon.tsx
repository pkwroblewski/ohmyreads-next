"use client";

import { TIER_COLORS, type BadgeDefinition } from "@/lib/data/badges";
import { cn } from "@/lib/utils";

interface BadgeIconProps {
  badge: BadgeDefinition;
  size?: "xs" | "sm" | "md";
  showTooltip?: boolean;
}

export default function BadgeIcon({
  badge,
  size = "sm",
  showTooltip = true,
}: BadgeIconProps) {
  const tierColors = TIER_COLORS[badge.tier];

  const sizeClasses = {
    xs: "w-6 h-6 text-sm",
    sm: "w-8 h-8 text-lg",
    md: "w-10 h-10 text-xl",
  };

  return (
    <div className="relative group">
      <div
        className={cn(
          "rounded-lg flex items-center justify-center",
          "bg-gradient-to-br",
          tierColors.bg,
          sizeClasses[size]
        )}
      >
        <span>{badge.icon}</span>
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div
          className={cn(
            "absolute bottom-full left-1/2 -translate-x-1/2 mb-2",
            "opacity-0 group-hover:opacity-100 transition-opacity",
            "pointer-events-none z-10"
          )}
        >
          <div className="bg-popover border rounded-lg shadow-lg px-3 py-2 text-center whitespace-nowrap">
            <p className="text-sm font-medium">{badge.name}</p>
            <p className="text-xs text-muted-foreground">{badge.description}</p>
          </div>
        </div>
      )}
    </div>
  );
}
