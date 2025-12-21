"use client";

import { cn } from "@/lib/utils";
import { Users, BookOpen, Building2, Coffee, SlidersHorizontal } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface LayerState {
  readers: boolean;
  bookstores: boolean;
  libraries: boolean;
  cafes: boolean;
}

interface LayerCounts {
  readers?: number;
  bookstores?: number;
  libraries?: number;
  cafes?: number;
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
    icon: Users,
    activeColor: "text-emerald-500",
    activeBg: "bg-emerald-500/10",
  },
  {
    key: "bookstores" as const,
    label: "Bookstores",
    icon: BookOpen,
    activeColor: "text-amber-500",
    activeBg: "bg-amber-500/10",
  },
  {
    key: "libraries" as const,
    label: "Libraries",
    icon: Building2,
    activeColor: "text-sky-500",
    activeBg: "bg-sky-500/10",
  },
  {
    key: "cafes" as const,
    label: "Cafes",
    icon: Coffee,
    activeColor: "text-orange-400",
    activeBg: "bg-orange-400/10",
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
      className={cn(
        "bg-card/95 backdrop-blur-xl rounded-2xl border border-border/50 shadow-lg overflow-hidden",
        "min-w-[200px]",
        className
      )}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/50 flex items-center gap-2">
        <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Filters</span>
      </div>

      {/* Filter options */}
      <div className="p-2">
        {layerConfig.map(({ key, label, icon: Icon, activeColor, activeBg }) => {
          const isActive = layers[key];
          const count = counts?.[key];

          return (
            <div
              key={key}
              className={cn(
                "flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all duration-200 cursor-pointer",
                "hover:bg-muted/50",
                isActive && activeBg
              )}
              onClick={() => onToggle(key)}
            >
              {/* Icon */}
              <Icon className={cn(
                "h-4 w-4 shrink-0 transition-colors duration-200",
                isActive ? activeColor : "text-muted-foreground"
              )} />

              {/* Label */}
              <span
                className={cn(
                  "text-sm transition-colors duration-200 flex-1",
                  isActive ? "text-foreground font-medium" : "text-muted-foreground"
                )}
              >
                {label}
              </span>

              {/* Count badge */}
              {count !== undefined && count > 0 && (
                <span className={cn(
                  "text-xs px-1.5 py-0.5 rounded-full transition-all duration-200",
                  isActive
                    ? "bg-foreground/10 text-foreground"
                    : "bg-muted text-muted-foreground"
                )}>
                  {count}
                </span>
              )}

              {/* Switch */}
              <Switch
                checked={isActive}
                onCheckedChange={() => onToggle(key)}
                className="scale-75"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
