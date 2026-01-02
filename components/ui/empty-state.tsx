import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateAction {
  label: string;
  href: string;
  icon?: LucideIcon;
  variant?: "default" | "outline" | "secondary";
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
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

      {/* Action Buttons */}
      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row gap-3">
          {action && (
            <Link href={action.href}>
              <Button variant={action.variant || "default"}>
                {action.icon && <action.icon className="w-4 h-4 mr-2" />}
                {action.label}
              </Button>
            </Link>
          )}
          {secondaryAction && (
            <Link href={secondaryAction.href}>
              <Button variant={secondaryAction.variant || "outline"}>
                {secondaryAction.icon && <secondaryAction.icon className="w-4 h-4 mr-2" />}
                {secondaryAction.label}
              </Button>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

