import type { Metadata } from "next";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getInitialCommunityFeed, getCommunitySidebar, getUserLikedReviewIds } from "@/lib/queries/community";
import { getHomeReadingActivity } from "@/lib/queries/home";
import { getSuggestedFollows, getFollowingIds } from "@/lib/queries/follows";
import { CommunityFeedTabs } from "@/components/community/community-feed-tabs";
import { CommunityMobileTabs } from "@/components/community/community-mobile-tabs";
import { MyShelfPanel } from "@/components/community/my-shelf-panel";
import { CommunitySidebar } from "@/components/community/community-sidebar";
import { SuggestedFollows } from "@/components/social/suggested-follows";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Community",
  description:
    "See what readers are reading and reviewing. Join the OhMyReads community.",
  openGraph: {
    title: "Community",
    description:
      "See what readers are reading and reviewing. Join the OhMyReads community.",
    type: "website",
  },
};

export default async function CommunityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch user profile if logged in
  let userProfile = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .eq("id", user.id)
      .single();
    userProfile = profile;
  }

  // Fetch all data in parallel
  const [initialFeed, sidebarData, activity, suggestions, followingIds, likedReviewIds] = await Promise.all([
    getInitialCommunityFeed(),
    getCommunitySidebar(),
    user ? getHomeReadingActivity(user.id) : Promise.resolve(null),
    user ? getSuggestedFollows(user.id, 5) : Promise.resolve([]),
    user ? getFollowingIds(user.id) : Promise.resolve([]),
    user ? getUserLikedReviewIds(user.id) : Promise.resolve([]),
  ]);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-border bg-card/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold font-serif">
                Community Feed
              </h1>
              <p className="text-muted-foreground mt-1">
                See what readers are discovering and sharing
              </p>
            </div>
            <Link href="/community/map">
              <Button variant="outline" className="gap-2">
                <MapPin className="w-4 h-4" />
                Reader Map
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        {/* Desktop: three-column grid (unchanged) */}
        <div className="hidden lg:grid lg:grid-cols-[280px_1fr_280px] gap-6">
          {/* Left Sidebar - My Shelf */}
          <aside>
            <div className="sticky top-20">
              <MyShelfPanel activity={activity} user={userProfile} />
            </div>
          </aside>

          {/* Center - Activity Feed */}
          <main>
            <CommunityFeedTabs
              initialGlobalData={initialFeed}
              isLoggedIn={!!user}
              likedReviewIds={likedReviewIds}
            />
          </main>

          {/* Right Sidebar - Community */}
          <aside>
            <div className="sticky top-20 space-y-4">
              {user && suggestions.length > 0 && (
                <SuggestedFollows suggestions={suggestions} followingIds={followingIds} />
              )}
              <CommunitySidebar data={sidebarData} />
            </div>
          </aside>
        </div>

        {/* Mobile: tabbed panels instead of stacking below the feed */}
        <div className="lg:hidden">
          <CommunityMobileTabs
            feed={
              <CommunityFeedTabs
                initialGlobalData={initialFeed}
                isLoggedIn={!!user}
                likedReviewIds={likedReviewIds}
              />
            }
            myShelf={<MyShelfPanel activity={activity} user={userProfile} />}
            discover={
              <>
                {user && suggestions.length > 0 && (
                  <SuggestedFollows
                    suggestions={suggestions}
                    followingIds={followingIds}
                  />
                )}
                <CommunitySidebar data={sidebarData} />
              </>
            }
          />
        </div>
      </div>
    </div>
  );
}

