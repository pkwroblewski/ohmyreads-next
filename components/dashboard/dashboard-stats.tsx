import { BookOpen, FileText, MessageSquare, Flame } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/ui/stat-card";
import type { ReadingStats } from "@/types/database";

/**
 * Server component that fetches and displays dashboard stats.
 * Wrapped in Suspense by parent for independent loading.
 */
export async function DashboardStats() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // Fetch reading stats
  let { data: stats } = await supabase
    .from("reading_stats")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  // Initialize reading stats if they don't exist. The counters themselves are
  // trigger-owned (migrations 057/064), so only the row is created here.
  if (!stats) {
    await supabase
      .from("reading_stats")
      .upsert({ user_id: user.id }, { onConflict: "user_id", ignoreDuplicates: true });
    const { data: newStats } = await supabase
      .from("reading_stats")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    stats = newStats;
  }

  const typedStats = stats as ReadingStats | null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <StatCard
        title="Books Read"
        value={typedStats?.books_read || 0}
        icon={BookOpen}
      />
      <StatCard
        title="Pages Read"
        value={typedStats?.pages_read?.toLocaleString() || 0}
        icon={FileText}
      />
      <StatCard
        title="Reviews Written"
        value={typedStats?.reviews_count || 0}
        icon={MessageSquare}
      />
      <StatCard
        title="Day Streak"
        value={typedStats?.current_streak || 0}
        icon={Flame}
        subtitle={
          typedStats?.current_streak && typedStats.current_streak > 0
            ? "🔥 Keep it going!"
            : undefined
        }
        trend={
          typedStats?.current_streak && typedStats.current_streak > 0
            ? "up"
            : "neutral"
        }
      />
    </div>
  );
}
