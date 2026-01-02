"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActivityCard } from "./activity-card";
import { createClient } from "@/lib/supabase/client";
import type { CommunityFeedPage } from "@/lib/queries/community";

interface GlobalActivityFeedProps {
  initialData: CommunityFeedPage;
}

export function GlobalActivityFeed({ initialData }: GlobalActivityFeedProps) {
  const [items, setItems] = useState(initialData.items);
  const [cursor, setCursor] = useState(initialData.nextCursor);
  const [hasMore, setHasMore] = useState(initialData.hasMore);
  const [isPending, startTransition] = useTransition();
  const [newItemsCount, setNewItemsCount] = useState(0);

  // Handle loading new items after realtime notification
  const loadNewItems = useCallback(async () => {
    try {
      const response = await fetch("/api/community/feed?limit=10");
      if (!response.ok) throw new Error("Failed to fetch");
      const data: CommunityFeedPage = await response.json();
      setItems(data.items);
      setCursor(data.nextCursor);
      setHasMore(data.hasMore);
      setNewItemsCount(0);
    } catch (error) {
      console.error("Error loading new items:", error);
    }
  }, []);

  // Subscribe to real-time activity feed updates
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("activity-feed-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activity_feed",
        },
        (payload) => {
          // Only notify if it's a new item (not from current user loading more)
          if (payload.new && payload.new.id) {
            const isNewItem = !items.some((item) => item.id === payload.new.id);
            if (isNewItem) {
              setNewItemsCount((prev) => prev + 1);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [items]);

  const loadMore = async () => {
    if (!cursor || isPending) return;

    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/community/feed?cursor=${encodeURIComponent(cursor)}&limit=10`
        );
        if (!response.ok) throw new Error("Failed to load more");

        const data: CommunityFeedPage = await response.json();
        setItems((prev) => [...prev, ...data.items]);
        setCursor(data.nextCursor);
        setHasMore(data.hasMore);
      } catch (error) {
        console.error("Error loading more feed items:", error);
      }
    });
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          No activity yet. Be the first to share a review!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* New items notification */}
      {newItemsCount > 0 && (
        <Button
          variant="outline"
          size="sm"
          onClick={loadNewItems}
          className="w-full bg-primary/5 hover:bg-primary/10 border-primary/20 text-primary"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          {newItemsCount} new {newItemsCount === 1 ? "update" : "updates"} - Click to refresh
        </Button>
      )}

      {items.map((item) => (
        <ActivityCard key={item.id} item={item} />
      ))}

      {hasMore && (
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
    </div>
  );
}

