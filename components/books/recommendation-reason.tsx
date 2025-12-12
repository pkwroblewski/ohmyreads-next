"use client";

import { cn } from "@/lib/utils";
import { Sparkles, Heart, BookMarked, Star, TrendingUp } from "lucide-react";
import type { RecommendationReasonType } from "@/lib/queries/recommendations";

interface RecommendationReasonProps {
  type: RecommendationReasonType;
  label: string;
  className?: string;
  size?: "sm" | "md";
}

const REASON_ICONS: Record<RecommendationReasonType, typeof Sparkles> = {
  genre_match: Sparkles,
  vibe_match: Heart,
  similar_to_loved: BookMarked,
  popular_in_genre: TrendingUp,
  highly_rated: Star,
};

const REASON_COLORS: Record<RecommendationReasonType, string> = {
  genre_match: "text-primary",
  vibe_match: "text-pink-500",
  similar_to_loved: "text-amber-500",
  popular_in_genre: "text-blue-500",
  highly_rated: "text-yellow-500",
};

export function RecommendationReason({
  type,
  label,
  className,
  size = "sm",
}: RecommendationReasonProps) {
  const Icon = REASON_ICONS[type] || Sparkles;
  const colorClass = REASON_COLORS[type] || "text-primary";

  return (
    <div
      className={cn(
        "flex items-center gap-1.5",
        size === "sm" ? "text-xs" : "text-sm",
        "text-muted-foreground",
        className
      )}
    >
      <Icon className={cn("flex-shrink-0", colorClass, size === "sm" ? "h-3 w-3" : "h-4 w-4")} />
      <span className="truncate">{label}</span>
    </div>
  );
}

