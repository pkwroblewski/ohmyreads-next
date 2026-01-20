"use client";

import { cn } from "@/lib/utils";
import { Users, BookMarked, Landmark, Coffee, UtensilsCrossed } from "lucide-react";

interface LayerState {
  readers: boolean;
  bookstores: boolean;
  libraries: boolean;
  cafes: boolean;
  restaurants: boolean;
}

interface LayerCounts {
  readers?: number;
  bookstores?: number;
  libraries?: number;
  cafes?: number;
  restaurants?: number;
}

interface MapLayerControlsProps {
  layers: LayerState;
  onToggle: (layer: keyof LayerState) => void;
  counts?: LayerCounts;
  className?: string;
}

const layerConfig = [
  {
    key: "readers" as const,
    label: "Readers",
    shortLabel: "Ppl",
    icon: Users,
    activeColor: "text-emerald-600 dark:text-emerald-400",
    activeBg: "bg-emerald-500/20",
  },
  {
    key: "bookstores" as const,
    label: "Bookstores",
    shortLabel: "Books",
    icon: BookMarked,
    activeColor: "text-amber-600 dark:text-amber-400",
    activeBg: "bg-amber-500/20",
  },
  {
    key: "libraries" as const,
    label: "Libraries",
    shortLabel: "Libs",
    icon: Landmark,
    activeColor: "text-sky-600 dark:text-sky-400",
    activeBg: "bg-sky-500/20",
  },
  {
    key: "cafes" as const,
    label: "Cafes",
    shortLabel: "Cafe",
    icon: Coffee,
    activeColor: "text-orange-600 dark:text-orange-400",
    activeBg: "bg-orange-500/20",
  },
  {
    key: "restaurants" as const,
    label: "Restaurants",
    shortLabel: "Food",
    icon: UtensilsCrossed,
    activeColor: "text-pink-600 dark:text-pink-400",
    activeBg: "bg-pink-500/20",
  },
];

export function MapLayerControls({
  layers,
  onToggle,
  counts,
  className,
}: MapLayerControlsProps) {
  return (
    <div
      role="group"
      aria-label="Map layer visibility controls"
      className={cn(
        "inline-flex items-center gap-1.5 p-1.5 rounded-full",
        "bg-white/90 dark:bg-card/90 backdrop-blur-xl",
        "border border-border/50 shadow-lg",
        className
      )}
    >
      {layerConfig.map(({ key, label, shortLabel, icon: Icon, activeColor, activeBg }) => {
        const isActive = layers[key];
        const count = counts?.[key];
        const countText = count !== undefined && count > 0 ? `, ${count} nearby` : "";
        const stateText = isActive ? "visible" : "hidden";
        const ariaLabel = `${label} layer: ${stateText}${countText}. Click to ${isActive ? "hide" : "show"}`;

        return (
          <button
            key={key}
            onClick={() => onToggle(key)}
            aria-pressed={isActive}
            aria-label={ariaLabel}
            title={`${label}${countText} - ${isActive ? "Click to hide" : "Click to show"}`}
            className={cn(
              "inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-xs font-medium",
              "transition-all duration-200 whitespace-nowrap",
              "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-1",
              isActive
                ? cn(activeBg, activeColor)
                : "text-muted-foreground hover:bg-muted/50"
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="sm:hidden">{shortLabel}</span>
            <span className="hidden sm:inline">{label}</span>
            {count !== undefined && count > 0 && (
              <span className={cn(
                "text-[10px] tabular-nums",
                isActive ? "opacity-80" : "opacity-60"
              )} aria-hidden="true">
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
