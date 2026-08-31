"use client";

import { useState, useTransition } from "react";
import {
  Target,
  BookOpen,
  FileText,
  Sparkles,
  MoreVertical,
  Trash2,
  Flag,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { deleteChallenge, abandonChallenge } from "@/lib/actions/challenges";
import type { ChallengeWithProgress, ChallengeType } from "@/types/database";
import { cn } from "@/lib/utils";

interface ChallengeCardProps {
  challenge: ChallengeWithProgress;
}

const typeConfig: Record<
  ChallengeType,
  { icon: typeof Target; label: string; unit: string; color: string }
> = {
  books_count: {
    icon: BookOpen,
    label: "Books",
    unit: "books",
    color: "from-blue-500 to-indigo-500",
  },
  pages_count: {
    icon: FileText,
    label: "Pages",
    unit: "pages",
    color: "from-purple-500 to-pink-500",
  },
  genre_books: {
    icon: Sparkles,
    label: "Genre",
    unit: "books",
    color: "from-amber-500 to-orange-500",
  },
};

const statusConfig = {
  active: {
    icon: Target,
    label: "Active",
    variant: "default" as const,
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  completed: {
    icon: CheckCircle2,
    label: "Completed",
    variant: "default" as const,
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  failed: {
    icon: XCircle,
    label: "Failed",
    variant: "destructive" as const,
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
  abandoned: {
    icon: AlertCircle,
    label: "Abandoned",
    variant: "secondary" as const,
    className: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
  },
};

export default function ChallengeCard({ challenge }: ChallengeCardProps) {
  const [isPending, startTransition] = useTransition();
  const [showMenu, setShowMenu] = useState(false);

  const config = typeConfig[challenge.challenge_type];
  const status = statusConfig[challenge.status];
  const Icon = config.icon;
  const StatusIcon = status.icon;

  const handleDelete = () => {
    if (!confirm("Are you sure you want to delete this challenge?")) return;

    startTransition(async () => {
      const result = await deleteChallenge(challenge.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Challenge deleted");
      }
      setShowMenu(false);
    });
  };

  const handleAbandon = () => {
    if (!confirm("Are you sure you want to abandon this challenge?")) return;

    startTransition(async () => {
      const result = await abandonChallenge(challenge.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Challenge abandoned");
      }
      setShowMenu(false);
    });
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <Card className="overflow-hidden relative">
      {/* Progress bar at top */}
      <div className={cn("bg-gradient-to-r p-1", config.color)}>
        <div className="h-2 bg-white/30 rounded-full overflow-hidden">
          <div
            className="h-full bg-white rounded-full transition-all duration-500"
            style={{ width: `${challenge.progress_percentage}%` }}
          />
        </div>
      </div>

      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          {/* Left side - Icon and info */}
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div
              className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                "bg-gradient-to-br",
                config.color
              )}
            >
              <Icon className="h-5 w-5 text-white" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold truncate">{challenge.name}</h3>
                <Badge variant="outline" className={status.className}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {status.label}
                </Badge>
              </div>

              {challenge.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                  {challenge.description}
                </p>
              )}

              {/* Progress stats */}
              <div className="flex items-center gap-4 mt-2 text-sm">
                <span>
                  <span className="font-bold text-foreground">
                    {challenge.current_value}
                  </span>
                  <span className="text-muted-foreground">
                    {" "}
                    / {challenge.target_value} {config.unit}
                  </span>
                </span>

                <span className="text-muted-foreground">
                  {challenge.progress_percentage}%
                </span>

                {challenge.status === "active" && (
                  <span
                    className={cn(
                      "flex items-center gap-1",
                      challenge.is_on_track
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-amber-600 dark:text-amber-400"
                    )}
                  >
                    <Clock className="h-3 w-3" />
                    {challenge.days_remaining}d left
                  </span>
                )}
              </div>

              {/* Genre tag if applicable */}
              {challenge.challenge_type === "genre_books" && challenge.genre && (
                <Badge variant="secondary" className="mt-2">
                  {challenge.genre}
                </Badge>
              )}

              {/* Date range */}
              <p className="text-xs text-muted-foreground mt-2">
                {formatDate(challenge.start_date)} - {formatDate(challenge.end_date)}
              </p>
            </div>
          </div>

          {/* Right side - Menu */}
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowMenu(!showMenu)}
              disabled={isPending}
              aria-label="Challenge options"
              aria-expanded={showMenu}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1 bg-popover border rounded-lg shadow-lg py-1 z-20 min-w-[140px]">
                  {challenge.status === "active" && (
                    <button
                      onClick={handleAbandon}
                      className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2"
                      disabled={isPending}
                    >
                      <Flag className="h-4 w-4" />
                      Abandon
                    </button>
                  )}
                  <button
                    onClick={handleDelete}
                    className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2 text-destructive"
                    disabled={isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
