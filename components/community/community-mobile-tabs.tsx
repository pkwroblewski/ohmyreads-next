"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type TabKey = "feed" | "shelf" | "discover";

const TABS: { key: TabKey; label: string }[] = [
  { key: "feed", label: "Feed" },
  { key: "shelf", label: "My Shelf" },
  { key: "discover", label: "Discover" },
];

interface CommunityMobileTabsProps {
  feed: React.ReactNode;
  myShelf: React.ReactNode;
  discover: React.ReactNode;
}

/**
 * Mobile-only tab bar for the community page — replaces the old pattern of
 * stacking the side panels below the entire feed. Panels come in as
 * ReactNode props so the page stays a server component.
 */
export function CommunityMobileTabs({
  feed,
  myShelf,
  discover,
}: CommunityMobileTabsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("feed");

  return (
    <div>
      <div
        role="tablist"
        aria-label="Community sections"
        className="flex border-b border-border mb-4"
      >
        {TABS.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex-1 px-3 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
              activeTab === tab.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={cn(activeTab !== "feed" && "hidden")}>{feed}</div>
      <div className={cn("space-y-6", activeTab !== "shelf" && "hidden")}>
        {myShelf}
      </div>
      <div className={cn("space-y-6", activeTab !== "discover" && "hidden")}>
        {discover}
      </div>
    </div>
  );
}
