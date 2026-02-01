import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getChallenges } from "@/lib/actions/challenges";
import { getPendingRequests } from "@/lib/queries/friends";
import ActiveChallengesWidget from "@/components/challenges/active-challenges-widget";
import { PlacesNearYou } from "@/components/dashboard/places-near-you";
import { FriendRequestsNotification } from "@/components/dashboard/friend-requests-notification";
import { DashboardStats } from "@/components/dashboard/dashboard-stats";
import { CurrentlyReading } from "@/components/dashboard/currently-reading";
import { FriendsActivitySection } from "@/components/dashboard/friends-activity-section";
import { RecommendationsSection } from "@/components/dashboard/recommendations-section";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import {
  DashboardStatsSkeleton,
  CurrentlyReadingSkeleton,
  FriendsActivitySkeleton,
  RecommendationsSkeleton,
  RecentActivitySkeleton,
} from "@/components/dashboard/skeletons";
import type { Profile } from "@/types/database";

export const metadata: Metadata = {
  title: "Dashboard",
};

// Format today's date nicely
function formatTodayDate(): string {
  return new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function DashboardPage() {
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null; // Layout handles redirect
  }

  // Fetch critical data that blocks initial render
  // (These are fast and needed for personalized header/quick actions)
  const [profileResult, challengesResult, pendingFriendRequests] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      getChallenges(),
      getPendingRequests(),
    ]);

  const profile = profileResult.data as Profile | null;
  const challenges = challengesResult.data || [];

  // Get display name
  const displayName =
    profile?.display_name ||
    profile?.username ||
    user.user_metadata?.full_name ||
    "Reader";

  return (
    <div className="max-w-6xl mx-auto">
      {/* ========================================
          Welcome Header
          ======================================== */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold font-serif mb-1">
          Welcome back, {displayName}
        </h1>
        <p className="text-muted-foreground">{formatTodayDate()}</p>
      </div>

      {/* ========================================
          Friend Requests Notification
          ======================================== */}
      {pendingFriendRequests.length > 0 && (
        <FriendRequestsNotification requests={pendingFriendRequests} />
      )}

      {/* ========================================
          Stats Grid - Independent Loading
          ======================================== */}
      <Suspense fallback={<DashboardStatsSkeleton />}>
        <DashboardStats />
      </Suspense>

      {/* ========================================
          Active Challenges Section
          ======================================== */}
      <ActiveChallengesWidget challenges={challenges} />

      {/* ========================================
          Currently Reading Section - Independent Loading
          ======================================== */}
      <Suspense fallback={<CurrentlyReadingSkeleton />}>
        <CurrentlyReading />
      </Suspense>

      {/* ========================================
          Places Near You Section
          (Client component with its own loading state)
          ======================================== */}
      <PlacesNearYou />

      {/* ========================================
          Friends Activity Section - Independent Loading
          ======================================== */}
      <Suspense fallback={<FriendsActivitySkeleton />}>
        <FriendsActivitySection />
      </Suspense>

      {/* ========================================
          Personalized Recommendations - Independent Loading
          ======================================== */}
      <Suspense fallback={<RecommendationsSkeleton />}>
        <RecommendationsSection />
      </Suspense>

      {/* ========================================
          Recent Activity Section - Independent Loading
          ======================================== */}
      <Suspense fallback={<RecentActivitySkeleton />}>
        <RecentActivity />
      </Suspense>

      {/* ========================================
          Quick Actions (for new users)
          This shows when there's no activity - keeping inline since
          it depends on the recent activity state which we'd need to
          track separately. Will be hidden once user has activity.
          ======================================== */}
      <Suspense fallback={null}>
        <QuickActionsForNewUsers />
      </Suspense>
    </div>
  );
}

/**
 * Server component for quick actions shown to new users
 */
async function QuickActionsForNewUsers() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // Check if user has stats or currently reading books
  const [statsResult, currentlyReadingResult] = await Promise.all([
    supabase
      .from("reading_stats")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("user_books")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "reading")
      .limit(1),
  ]);

  const hasStats = !!statsResult.data;
  const hasCurrentlyReading = (currentlyReadingResult.data || []).length > 0;

  // Only show for new users without activity
  if (hasStats || hasCurrentlyReading) {
    return null;
  }

  return (
    <section className="mb-8">
      <div
        className={cn(
          "p-6 rounded-xl text-center",
          "bg-gradient-to-br from-primary/10 via-accent/5 to-primary/5",
          "border border-primary/20"
        )}
      >
        <h3 className="text-lg font-semibold mb-2">
          Ready to start your reading journey?
        </h3>
        <p className="text-muted-foreground mb-4">
          Discover books, track your progress, and connect with other readers.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/books">
            <Button>
              Browse Books
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
          <Link href="/import">
            <Button variant="outline">
              <Upload className="w-4 h-4 mr-2" />
              Import from Goodreads
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
