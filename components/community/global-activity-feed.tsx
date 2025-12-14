"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActivityCard } from "./activity-card";
import type { CommunityFeedPage } from "@/lib/queries/community";

interface GlobalActivityFeedProps {
  initialData: CommunityFeedPage;
}

export function GlobalActivityFeed({ initialData }: GlobalActivityFeedProps) {
  const [items, setItems] = useState(initialData.items);
  const [cursor, setCursor] = useState(initialData.nextCursor);
  const [hasMore, setHasMore] = useState(initialData.hasMore);
  const [isPending, startTransition] = useTransition();

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

