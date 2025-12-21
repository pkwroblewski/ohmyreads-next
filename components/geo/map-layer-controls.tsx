"use client";

import { Users, BookOpen, Building2, Coffee } from "lucide-react";
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
    activeColor: "bg-primary text-primary-foreground",
    inactiveColor: "bg-card text-muted-foreground hover:bg-muted",
  },
  {
    key: "bookstores" as const,
    label: "Bookstores",
    icon: BookOpen,
    activeColor: "bg-amber-500 text-white",
    inactiveColor: "bg-card text-muted-foreground hover:bg-muted",
  },
  {
    key: "libraries" as const,
    label: "Libraries",
    icon: Building2,
    activeColor: "bg-blue-500 text-white",
    inactiveColor: "bg-card text-muted-foreground hover:bg-muted",
  },
  {
    key: "cafes" as const,
    label: "Cafes",
    icon: Coffee,
    activeColor: "bg-orange-500 text-white",
    inactiveColor: "bg-card text-muted-foreground hover:bg-muted",
  },
];

export function MapLayerControls({
  layers,
  onToggle,
  className,
}: MapLayerControlsProps) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {layerConfig.map(({ key, label, icon: Icon, activeColor, inactiveColor }) => (
        <button
          key={key}
          onClick={() => onToggle(key)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all shadow-md",
            layers[key] ? activeColor : inactiveColor
          )}
        >
          <Icon className="h-4 w-4" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}
