import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getInitialCommunityFeed, getCommunitySidebar } from "@/lib/queries/community";
import { getHomeReadingActivity } from "@/lib/queries/home";
import { GlobalActivityFeed } from "@/components/community/global-activity-feed";
import { MyShelfPanel } from "@/components/community/my-shelf-panel";
import { CommunitySidebar } from "@/components/community/community-sidebar";

export const metadata: Metadata = {
  title: "Community | OhMyReads",
  description:
    "See what readers are reading and reviewing. Join the OhMyReads community.",
  openGraph: {
    title: "Community | OhMyReads",
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
  const [initialFeed, sidebarData, activity] = await Promise.all([
    getInitialCommunityFeed(),
    getCommunitySidebar(),
    user ? getHomeReadingActivity(user.id) : Promise.resolve(null),
  ]);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-border bg-card/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-2xl sm:text-3xl font-bold font-serif">
            Community Feed
          </h1>
          <p className="text-muted-foreground mt-1">
            See what readers are discovering and sharing
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid lg:grid-cols-[280px_1fr_280px] gap-6">
          {/* Left Sidebar - My Shelf */}
          <aside className="hidden lg:block">
            <div className="sticky top-20">
              <MyShelfPanel activity={activity} user={userProfile} />
            </div>
          </aside>

          {/* Center - Activity Feed */}
          <main>
            <GlobalActivityFeed initialData={initialFeed} />
          </main>

          {/* Right Sidebar - Community */}
          <aside className="hidden lg:block">
            <div className="sticky top-20">
              <CommunitySidebar data={sidebarData} />
            </div>
          </aside>
        </div>

        {/* Mobile: Show sidebars below feed */}
        <div className="lg:hidden mt-8 space-y-6">
          <MyShelfPanel activity={activity} user={userProfile} />
          <CommunitySidebar data={sidebarData} />
        </div>
      </div>
    </div>
  );
}

