import { cn } from "@/lib/utils";
import type { CompatibilityLevel } from "@/types/database";

interface CompatibilityBadgeProps {
  level: CompatibilityLevel;
  score?: number;
  showScore?: boolean;
  size?: "sm" | "default";
  className?: string;
}

const levelConfig: Record<
  CompatibilityLevel,
  { label: string; color: string; bgColor: string }
> = {
  high: {
    label: "High Match",
    color: "text-green-700 dark:text-green-400",
    bgColor: "bg-green-100 dark:bg-green-900/30",
  },
  medium: {
    label: "Medium Match",
    color: "text-amber-700 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
  },
  low: {
    label: "Low Match",
    color: "text-gray-600 dark:text-gray-400",
    bgColor: "bg-gray-100 dark:bg-gray-800",
  },
  unknown: {
    label: "",
    color: "",
    bgColor: "",
  },
};

export function CompatibilityBadge({
  level,
  score,
  showScore = false,
  size = "default",
  className,
}: CompatibilityBadgeProps) {
  if (level === "unknown") {
    return null;
  }

  const config = levelConfig[level];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium",
        config.bgColor,
        config.color,
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs",
        className
      )}
    >
      <span className="relative flex h-2 w-2">
        <span
          className={cn(
            "absolute inline-flex h-full w-full rounded-full opacity-75",
            level === "high" && "animate-ping bg-green-500",
            level === "medium" && "bg-amber-500",
            level === "low" && "bg-gray-400"
          )}
        />
        <span
          className={cn(
            "relative inline-flex h-2 w-2 rounded-full",
            level === "high" && "bg-green-500",
            level === "medium" && "bg-amber-500",
            level === "low" && "bg-gray-400"
          )}
        />
      </span>
      {config.label}
      {showScore && score !== undefined && (
        <span className="opacity-70">({score}%)</span>
      )}
    </span>
  );
}
