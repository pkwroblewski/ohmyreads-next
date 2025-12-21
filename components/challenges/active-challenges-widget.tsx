"use client";

import Link from "next/link";
import { Target, ArrowRight, BookOpen, FileText, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { ChallengeWithProgress, ChallengeType } from "@/types/database";
import { cn } from "@/lib/utils";

interface ActiveChallengesWidgetProps {
  challenges: ChallengeWithProgress[];
}

const typeConfig: Record<ChallengeType, { icon: typeof Target; color: string }> = {
  books_count: { icon: BookOpen, color: "from-blue-500 to-indigo-500" },
  pages_count: { icon: FileText, color: "from-purple-500 to-pink-500" },
  genre_books: { icon: Sparkles, color: "from-amber-500 to-orange-500" },
};

export default function ActiveChallengesWidget({
  challenges,
}: ActiveChallengesWidgetProps) {
  // Only show active challenges, max 3
  const activeChallenges = challenges
    .filter((c) => c.status === "active")
    .slice(0, 3);

  if (activeChallenges.length === 0) {
    return null;
  }

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold font-serif flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          Active Challenges
        </h2>
        <Link href="/challenges">
          <Button variant="ghost" size="sm">
            View all
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {activeChallenges.map((challenge) => {
          const config = typeConfig[challenge.challenge_type];
          const Icon = config.icon;

          return (
            <Link key={challenge.id} href="/challenges">
              <Card className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
                {/* Mini progress bar */}
                <div className={cn("h-1 bg-gradient-to-r", config.color)}>
                  <div
                    className="h-full bg-white/50"
                    style={{ width: `${100 - challenge.progress_percentage}%`, marginLeft: "auto" }}
                  />
                </div>

                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                        "bg-gradient-to-br",
                        config.color
                      )}
                    >
                      <Icon className="h-4 w-4 text-white" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {challenge.name}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>
                          {challenge.current_value}/{challenge.target_value}
                        </span>
                        <span>•</span>
                        <span
                          className={cn(
                            challenge.is_on_track
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-amber-600 dark:text-amber-400"
                          )}
                        >
                          {challenge.days_remaining}d left
                        </span>
                      </div>
                    </div>

                    <span className="text-sm font-semibold text-primary">
                      {challenge.progress_percentage}%
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
