import type { Metadata } from "next";
import { Suspense } from "react";
import { createClient, getUser } from "@/lib/supabase/server";
import { getChallenges } from "@/lib/queries/challenges";
import { getPendingRequests } from "@/lib/queries/friends";
import { getFirstRunChecklist } from "@/lib/queries/users";
import ActiveChallengesWidget from "@/components/challenges/active-challenges-widget";
import { PlacesNearYou } from "@/components/dashboard/places-near-you";
import { FriendRequestsNotification } from "@/components/dashboard/friend-requests-notification";
import { DashboardStats } from "@/components/dashboard/dashboard-stats";
import { FirstRunChecklist } from "@/components/dashboard/first-run-checklist";
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
  // Request-memoized — reuses the auth call from layout (no extra round-trip)
  const {
    data: { user },
  } = await getUser();

  if (!user) {
    return null; // Layout handles redirect
  }

  // Fetch critical data that blocks initial render
  // (These are fast and needed for personalized header/quick actions)
  const supabase = await createClient();
  const [profileResult, challengesResult, pendingFriendRequests, checklist] =
    await Promise.all([
      supabase.rpc("get_my_profile").maybeSingle(),
      getChallenges(),
      getPendingRequests(),
      getFirstRunChecklist(user.id),
    ]);

  // While anything on the checklist is outstanding it owns the calls to
  // action, and the sections below it stay quiet when they have nothing to
  // show. A reader who has finished it sees the dashboard exactly as before.
  const showChecklist = checklist.done < checklist.total;

  // Both of these read `user_books` and nothing else, so an empty shelf makes
  // them certainly empty. Skipping them outright spares a reader with nothing
  // on their shelf two skeletons that resolve to nothing.
  const showShelfSections = !checklist.hasNoBooks;

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
          First-run checklist (replaces the old trailing "quick actions"
          card, and the empty states it used to repeat)
          ======================================== */}
      {showChecklist && <FirstRunChecklist checklist={checklist} />}

      {/* ========================================
          Active Challenges Section
          ======================================== */}
      <ActiveChallengesWidget challenges={challenges} />

      {/* ========================================
          Currently Reading Section - Independent Loading
          ======================================== */}
      {showShelfSections && (
        <Suspense fallback={<CurrentlyReadingSkeleton />}>
          <CurrentlyReading hideEmpty={showChecklist} />
        </Suspense>
      )}

      {/* ========================================
          Places Near You Section
          (Client component with its own loading state)
          ======================================== */}
      <PlacesNearYou />

      {/* ========================================
          Friends Activity Section - Independent Loading
          ======================================== */}
      <Suspense fallback={<FriendsActivitySkeleton />}>
        <FriendsActivitySection hideEmpty={showChecklist} />
      </Suspense>

      {/* ========================================
          Personalized Recommendations - Independent Loading
          ======================================== */}
      <Suspense fallback={<RecommendationsSkeleton />}>
        <RecommendationsSection hideEmpty={showChecklist} />
      </Suspense>

      {/* ========================================
          Recent Activity Section - Independent Loading
          ======================================== */}
      {showShelfSections && (
        <Suspense fallback={<RecentActivitySkeleton />}>
          <RecentActivity hideEmpty={showChecklist} />
        </Suspense>
      )}
    </div>
  );
}
