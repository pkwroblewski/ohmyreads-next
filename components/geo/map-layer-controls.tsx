"use client";

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
    activeColor: "bg-emerald-500",
    inactiveColor: "bg-emerald-500/30",
  },
  {
    key: "bookstores" as const,
    label: "Bookstores",
    activeColor: "bg-amber-500",
    inactiveColor: "bg-amber-500/30",
  },
  {
    key: "libraries" as const,
    label: "Libraries",
    activeColor: "bg-sky-500",
    inactiveColor: "bg-sky-500/30",
  },
  {
    key: "cafes" as const,
    label: "Cafes",
    activeColor: "bg-orange-400",
    inactiveColor: "bg-orange-400/30",
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
        "bg-white/80 dark:bg-card/80 backdrop-blur-md rounded-xl border border-white/50 dark:border-border shadow-lg",
        className
      )}
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-border/50">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Show on map
        </span>
      </div>

      {/* Filter options */}
      <div className="p-1.5">
        {layerConfig.map(({ key, label, activeColor, inactiveColor }) => {
          const isActive = layers[key];
          return (
            <button
              key={key}
              onClick={() => onToggle(key)}
              className={cn(
                "flex items-center gap-3 w-full px-2.5 py-2 rounded-lg transition-all duration-150",
                "hover:bg-black/5 dark:hover:bg-white/5",
                isActive && "bg-black/[0.03] dark:bg-white/[0.03]"
              )}
            >
              {/* Colored indicator dot */}
              <span
                className={cn(
                  "w-2.5 h-2.5 rounded-full transition-all duration-150 shrink-0",
                  isActive ? activeColor : inactiveColor
                )}
              />

              {/* Label */}
              <span
                className={cn(
                  "text-sm transition-colors duration-150 flex-1 text-left",
                  isActive
                    ? "text-foreground font-medium"
                    : "text-muted-foreground"
                )}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
