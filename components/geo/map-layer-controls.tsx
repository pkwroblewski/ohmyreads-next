"use client";

import { Users, BookOpen, Building2, Coffee, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface LayerState {
  readers: boolean;
  bookstores: boolean;
  libraries: boolean;
  cafes: boolean;
}

interface MapLayerControlsProps {
  layers: LayerState;
  onToggle: (layer: keyof LayerState) => void;
  className?: string;
}

const layerConfig = [
  {
    key: "readers" as const,
    label: "Readers",
    icon: Users,
    dotColor: "bg-primary",
  },
  {
    key: "bookstores" as const,
    label: "Bookstores",
    icon: BookOpen,
    dotColor: "bg-amber-500",
  },
  {
    key: "libraries" as const,
    label: "Libraries",
    icon: Building2,
    dotColor: "bg-blue-500",
  },
  {
    key: "cafes" as const,
    label: "Cafes",
    icon: Coffee,
    dotColor: "bg-orange-500",
  },
];

export function MapLayerControls({
  layers,
  onToggle,
  className,
}: MapLayerControlsProps) {
  return (
    <div
      className={cn(
        "bg-card/95 backdrop-blur-sm rounded-xl border shadow-warm p-1 min-w-[140px]",
        className
      )}
    >
      {layerConfig.map(({ key, label, icon: Icon, dotColor }) => {
        const isActive = layers[key];
        return (
          <button
            key={key}
            onClick={() => onToggle(key)}
            className={cn(
              "flex items-center gap-2.5 w-full px-3 py-2 rounded-lg transition-all duration-200",
              "hover:bg-muted/50",
              isActive && "bg-muted/30"
            )}
          >
            {/* Colored indicator dot */}
            <span
              className={cn(
                "w-2 h-2 rounded-full transition-opacity duration-200",
                dotColor,
                isActive ? "opacity-100" : "opacity-30"
              )}
            />

            {/* Icon */}
            <Icon
              className={cn(
                "h-4 w-4 transition-colors duration-200",
                isActive ? "text-foreground" : "text-muted-foreground"
              )}
            />

            {/* Label */}
            <span
              className={cn(
                "text-sm font-medium flex-1 text-left transition-colors duration-200",
                isActive ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {label}
            </span>

            {/* Check indicator */}
            <Check
              className={cn(
                "h-3.5 w-3.5 transition-all duration-200",
                isActive
                  ? "opacity-100 text-primary"
                  : "opacity-0"
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
