"use client";

import { BookOpen, FileText, Star, TrendingUp } from "lucide-react";
import { ShareDropdown } from "@/components/ui/share-dropdown";
import type { ReadingStats } from "@/lib/queries/stats";

interface StatsHeroProps {
  stats: ReadingStats;
  userId: string;
}

export default function StatsHero({ stats, userId }: StatsHeroProps) {
  const currentYear = new Date().getFullYear();

  // Calculate goal percentage
  const goalPercentage =
    stats.yearlyGoal && stats.yearlyGoal > 0
      ? Math.min(100, Math.round((stats.yearlyProgress / stats.yearlyGoal) * 100))
      : null;

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-accent/5 to-background">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="container max-w-6xl relative py-12 md:py-16">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-bold font-serif mb-2">
            Your Reading Journey
          </h1>
          <p className="text-muted-foreground text-lg mb-4">
            {currentYear} so far — keep turning those pages!
          </p>
          <ShareDropdown
            url="/"
            title={`My ${currentYear} Reading Stats`}
            text={`I've read ${stats.booksThisYear} books and ${stats.pagesThisYear.toLocaleString()} pages in ${currentYear}! Track your reading on OhMyReads.`}
            variant="outline"
            size="sm"
          />
        </div>

        {/* Headline Metrics Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {/* Books Read This Year */}
          <MetricCard
            icon={BookOpen}
            label={`Books in ${currentYear}`}
            value={stats.booksThisYear}
            sublabel={
              stats.totalBooksRead > stats.booksThisYear
                ? `${stats.totalBooksRead} total all-time`
                : undefined
            }
            gradient="from-violet-500 to-purple-600"
          />

          {/* Pages Read This Year */}
          <MetricCard
            icon={FileText}
            label="Pages This Year"
            value={formatNumber(stats.pagesThisYear)}
            sublabel={
              stats.averagePagesPerDay > 0
                ? `~${stats.averagePagesPerDay} pages/day`
                : undefined
            }
            gradient="from-cyan-500 to-teal-600"
          />

          {/* Average Rating */}
          <MetricCard
            icon={Star}
            label="Your Avg Rating"
            value={stats.averageRating > 0 ? stats.averageRating.toFixed(1) : "—"}
            sublabel={
              stats.totalReviews > 0
                ? `from ${stats.totalReviews} review${stats.totalReviews !== 1 ? "s" : ""}`
                : "No reviews yet"
            }
            gradient="from-amber-500 to-orange-600"
          />

          {/* Goal Progress */}
          <MetricCard
            icon={TrendingUp}
            label="Goal Progress"
            value={
              goalPercentage !== null ? `${goalPercentage}%` : "No goal set"
            }
            sublabel={
              stats.yearlyGoal
                ? `${stats.yearlyProgress} of ${stats.yearlyGoal} books`
                : "Set a goal below"
            }
            gradient="from-pink-500 to-rose-600"
            isGoal
            goalPercentage={goalPercentage}
          />
        </div>

        {/* Monthly snapshot */}
        {stats.booksThisMonth > 0 && (
          <div className="mt-8 text-center">
            <p className="text-muted-foreground">
              This month you&apos;ve read{" "}
              <span className="font-semibold text-foreground">
                {stats.booksThisMonth} book{stats.booksThisMonth !== 1 ? "s" : ""}
              </span>
              {stats.averageDaysToFinish > 0 && (
                <>
                  {" "}— averaging{" "}
                  <span className="font-semibold text-foreground">
                    {stats.averageDaysToFinish} days
                  </span>{" "}
                  per book
                </>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  sublabel,
  gradient,
  isGoal,
  goalPercentage,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sublabel?: string;
  gradient: string;
  isGoal?: boolean;
  goalPercentage?: number | null;
}) {
  return (
    <div className="relative group">
      <div className="absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl blur-xl -z-10" />
      <div className="bg-card border border-border rounded-2xl p-5 md:p-6 h-full transition-shadow hover:shadow-lg">
        {/* Icon with gradient background */}
        <div
          className={`inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} mb-4`}
        >
          <Icon className="h-5 w-5 text-white" />
        </div>

        {/* Label */}
        <p className="text-sm text-muted-foreground mb-1">{label}</p>

        {/* Value */}
        <p className="text-2xl md:text-3xl font-bold tracking-tight">{value}</p>

        {/* Sublabel */}
        {sublabel && (
          <p className="text-xs text-muted-foreground mt-1">{sublabel}</p>
        )}

        {/* Goal progress bar */}
        {isGoal && goalPercentage !== null && (
          <div className="mt-3">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${gradient} transition-all duration-500 ease-out`}
                style={{ width: `${goalPercentage}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatNumber(num: number): string {
  if (num >= 10000) {
    return `${(num / 1000).toFixed(1)}k`;
  }
  return num.toLocaleString();
}

