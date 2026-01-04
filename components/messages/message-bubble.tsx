"use client";

import { cn } from "@/lib/utils";
import { format, isToday, isYesterday } from "date-fns";

interface MessageBubbleProps {
  content: string;
  createdAt: string;
  isSent: boolean; // true if current user sent this message
  isRead?: boolean;
}

function formatMessageTime(date: string): string {
  const d = new Date(date);

  if (isToday(d)) {
    return format(d, "h:mm a");
  }

  if (isYesterday(d)) {
    return `Yesterday ${format(d, "h:mm a")}`;
  }

  return format(d, "MMM d, h:mm a");
}

export function MessageBubble({
  content,
  createdAt,
  isSent,
  isRead,
}: MessageBubbleProps) {
  return (
    <div
      className={cn(
        "flex",
        isSent ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-4 py-2",
          isSent
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-muted text-foreground rounded-bl-sm"
        )}
      >
        <p className="text-sm whitespace-pre-wrap break-words">{content}</p>
        <div
          className={cn(
            "flex items-center gap-1 mt-1",
            isSent ? "justify-end" : "justify-start"
          )}
        >
          <span
            className={cn(
              "text-[10px]",
              isSent ? "text-primary-foreground/70" : "text-muted-foreground"
            )}
          >
            {formatMessageTime(createdAt)}
          </span>
          {isSent && isRead && (
            <span className="text-[10px] text-primary-foreground/70">
              Read
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
