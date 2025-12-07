import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: "up" | "down" | "neutral";
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend = "neutral",
}: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            {/* Value */}
            <p className="text-3xl font-bold tracking-tight">{value}</p>
            
            {/* Title */}
            <p className="text-sm text-muted-foreground">{title}</p>
          </div>
          
          {/* Icon */}
          <div className="p-2 rounded-lg bg-muted">
            <Icon className="w-5 h-5 text-muted-foreground" />
          </div>
        </div>

        {/* Subtitle with trend */}
        {subtitle && (
          <div
            className={cn(
              "flex items-center gap-1 mt-4 text-sm",
              trend === "up" && "text-green-600 dark:text-green-400",
              trend === "down" && "text-red-600 dark:text-red-400",
              trend === "neutral" && "text-muted-foreground"
            )}
          >
            {trend === "up" && <TrendingUp className="w-4 h-4" />}
            {trend === "down" && <TrendingDown className="w-4 h-4" />}
            <span>{subtitle}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

