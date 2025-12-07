import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    href: string;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-12",
        className
      )}
    >
      {/* Icon */}
      <div className="mb-4 p-4 rounded-full bg-muted">
        <Icon className="w-12 h-12 text-muted-foreground" />
      </div>

      {/* Title */}
      <h3 className="text-lg font-medium mb-2">{title}</h3>

      {/* Description */}
      <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">
        {description}
      </p>

      {/* Action Button */}
      {action && (
        <Link href={action.href}>
          <Button>{action.label}</Button>
        </Link>
      )}
    </div>
  );
}

