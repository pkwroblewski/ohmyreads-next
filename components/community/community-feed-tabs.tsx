"use client";

import { useState, useTransition } from "react";
import { Globe, Users, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActivityCard } from "./activity-card";
import { cn } from "@/lib/utils";
import type { CommunityFeedPage } from "@/lib/queries/community";

type FeedTab = "global" | "following";

interface CommunityFeedTabsProps {
  initialGlobalData: CommunityFeedPage;
  isLoggedIn: boolean;
  likedReviewIds?: string[];
  currentUserId?: string;
}

export function CommunityFeedTabs({
  initialGlobalData,
  isLoggedIn,
  likedReviewIds = [],
  currentUserId,
}: CommunityFeedTabsProps) {
  const [activeTab, setActiveTab] = useState<FeedTab>("global");

  // Global feed state
  const [globalItems, setGlobalItems] = useState(initialGlobalData.items);
  const [globalCursor, setGlobalCursor] = useState(initialGlobalData.nextCursor);
  const [globalHasMore, setGlobalHasMore] = useState(initialGlobalData.hasMore);

  // Following feed state
  const [followingItems, setFollowingItems] = useState<CommunityFeedPage["items"]>([]);
  const [followingCursor, setFollowingCursor] = useState<string | null>(null);
  const [followingHasMore, setFollowingHasMore] = useState(false);
  const [followingLoaded, setFollowingLoaded] = useState(false);

  const [isPending, startTransition] = useTransition();

  // Load following feed when tab is first selected
  const handleTabChange = (tab: FeedTab) => {
    setActiveTab(tab);

    if (tab === "following" && !followingLoaded && isLoggedIn) {
      loadFollowingFeed();
    }
  };

  const loadFollowingFeed = async (cursor?: string) => {
    startTransition(async () => {
      try {
        const url = cursor
          ? `/api/community/feed/following?cursor=${encodeURIComponent(cursor)}&limit=10`
          : "/api/community/feed/following?limit=10";

        const response = await fetch(url);
        if (!response.ok) throw new Error("Failed to load following feed");

        const data: CommunityFeedPage = await response.json();

        if (cursor) {
          setFollowingItems((prev) => [...prev, ...data.items]);
        } else {
          setFollowingItems(data.items);
          setFollowingLoaded(true);
        }
        setFollowingCursor(data.nextCursor);
        setFollowingHasMore(data.hasMore);
      } catch (error) {
        console.error("Error loading following feed:", error);
      }
    });
  };

  const loadMoreGlobal = async () => {
    if (!globalCursor || isPending) return;

    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/community/feed?cursor=${encodeURIComponent(globalCursor)}&limit=10`
        );
        if (!response.ok) throw new Error("Failed to load more");

        const data: CommunityFeedPage = await response.json();
        setGlobalItems((prev) => [...prev, ...data.items]);
        setGlobalCursor(data.nextCursor);
        setGlobalHasMore(data.hasMore);
      } catch (error) {
        console.error("Error loading more feed items:", error);
      }
    });
  };

  const loadMoreFollowing = () => {
    if (followingCursor) {
      loadFollowingFeed(followingCursor);
    }
  };

  const currentItems = activeTab === "global" ? globalItems : followingItems;
  const currentHasMore = activeTab === "global" ? globalHasMore : followingHasMore;
  const loadMore = activeTab === "global" ? loadMoreGlobal : loadMoreFollowing;

  return (
    <div className="space-y-4">
      {/* Tabs */}
      {isLoggedIn && (
        <div className="flex items-center gap-2 p-1 bg-muted rounded-lg w-fit">
          <button
            onClick={() => handleTabChange("global")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
              activeTab === "global"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Globe className="w-4 h-4" />
            Global
          </button>
          <button
            onClick={() => handleTabChange("following")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
              activeTab === "following"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Users className="w-4 h-4" />
            Following
          </button>
        </div>
      )}

      {/* Loading state for following tab first load */}
      {activeTab === "following" && !followingLoaded && isPending && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Feed content */}
      {(activeTab === "global" || followingLoaded || !isPending) && (
        <>
          {currentItems.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                {activeTab === "following"
                  ? "No activity from people you follow yet. Start following readers to see their activity here!"
                  : "No activity yet. Be the first to share a review!"}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {currentItems.map((item) => (
                <ActivityCard
                  key={item.id}
                  item={item}
                  isAuthenticated={isLoggedIn}
                  initialHasLiked={item.review?.id ? likedReviewIds.includes(item.review.id) : false}
                  currentUserId={currentUserId}
                />
              ))}
            </div>
          )}

          {currentHasMore && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={loadMore}
                disabled={isPending}
                className="min-w-[140px]"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  "Load More"
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
