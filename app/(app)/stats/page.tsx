import { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserReadingStats } from "@/lib/queries/stats";
import StatsHero from "@/components/stats/stats-hero";
import StatsCharts from "@/components/stats/stats-charts";
import StatsHighlights from "@/components/stats/stats-highlights";
import StatsGoal from "@/components/stats/stats-goal";
import EmptyStats from "@/components/stats/empty-stats";

export const metadata: Metadata = {
  title: "Reading Stats | OhMyReads",
  description: "Your personal reading statistics and insights",
  robots: { index: false, follow: false },
};

export default async function StatsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/stats");
  }

  const stats = await getUserReadingStats(user.id);

  // Show empty state if no books read
  if (stats.totalBooksRead === 0) {
    return <EmptyStats />;
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section with Key Stats */}
      <StatsHero stats={stats} userId={user.id} />

      {/* Reading Goal Progress */}
      <div className="container max-w-6xl py-8">
        <StatsGoal goal={stats.yearlyGoal} progress={stats.yearlyProgress} />
      </div>

      {/* Charts Section */}
      <div className="container max-w-6xl pb-8">
        <StatsCharts stats={stats} />
      </div>

      {/* Highlights & Fun Facts */}
      <div className="container max-w-6xl pb-12">
        <StatsHighlights stats={stats} />
      </div>
    </div>
  );
}

