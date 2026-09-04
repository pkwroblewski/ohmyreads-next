"use client";

import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatTriggerProps {
  unreadCount: number;
  onClick: () => void;
}

export function ChatTrigger({ unreadCount, onClick }: ChatTriggerProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        // Below lg the More sheet carries the Messages entry instead, so the
        // bubble no longer covers content above the bottom nav.
        "hidden lg:flex fixed bottom-6 right-6 z-30",
        "h-14 w-14 rounded-full",
        "bg-primary text-primary-foreground",
        "shadow-lg shadow-primary/25",
        "hover:bg-primary/90 hover:scale-105",
        "active:scale-95",
        "transition-all duration-200",
        "items-center justify-center"
      )}
      aria-label={`Messages${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
    >
      <MessageSquare className="h-6 w-6" aria-hidden="true" />
      {unreadCount > 0 && (
        <span
          className={cn(
            "absolute -top-1 -right-1",
            "min-w-[22px] h-[22px] px-1.5",
            "rounded-full bg-destructive text-destructive-foreground",
            "text-xs font-bold",
            "flex items-center justify-center",
            "animate-in zoom-in-50 duration-200"
          )}
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </button>
  );
}
