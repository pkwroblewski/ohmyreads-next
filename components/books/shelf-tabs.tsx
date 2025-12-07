"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

interface ShelfTabsProps {
  activeStatus: string;
  counts: {
    all: number;
    reading: number;
    read: number;
    want_to_read: number;
  };
}

const tabs = [
  { key: "all", label: "All", href: "/my-shelf" },
  { key: "reading", label: "Reading", href: "/my-shelf?status=reading" },
  { key: "read", label: "Read", href: "/my-shelf?status=read" },
  { key: "want_to_read", label: "Want to Read", href: "/my-shelf?status=want_to_read" },
];

export function ShelfTabs({ activeStatus, counts }: ShelfTabsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {tabs.map((tab) => {
        const count = counts[tab.key as keyof typeof counts];
        const isActive = activeStatus === tab.key;

        return (
          <Link
            key={tab.key}
            href={tab.href}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap",
              isActive
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {tab.label}
            <span
              className={cn(
                "text-xs px-1.5 py-0.5 rounded-full",
                isActive
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-background text-muted-foreground"
              )}
            >
              {count}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

