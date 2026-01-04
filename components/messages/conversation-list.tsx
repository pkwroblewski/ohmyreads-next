"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { MessageSquare, Users } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useRealtimeMessages } from "@/hooks/use-realtime-messages";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import type { ConversationPreview, DirectMessage } from "@/types/database";

interface ConversationListProps {
  userId: string;
  initialConversations: ConversationPreview[];
  onSelectConversation: (friendId: string) => void;
}

export function ConversationList({
  userId,
  initialConversations,
  onSelectConversation,
}: ConversationListProps) {
  const [conversations, setConversations] = useState<ConversationPreview[]>(initialConversations);

  // Handle new messages from realtime
  const handleNewMessage = useCallback((message: DirectMessage) => {
    setConversations((prev) => {
      const friendId = message.sender_id === userId ? message.receiver_id : message.sender_id;
      const existingIndex = prev.findIndex((c) => c.friend_id === friendId);

      if (existingIndex >= 0) {
        // Update existing conversation
        const updated = [...prev];
        const existing = updated[existingIndex];
        updated.splice(existingIndex, 1);

        const updatedConv: ConversationPreview = {
          ...existing,
          last_message: message.content,
          last_message_at: message.created_at,
          unread_count: message.receiver_id === userId
            ? existing.unread_count + 1
            : existing.unread_count,
        };

        // Move to top
        return [updatedConv, ...updated];
      }

      // New conversation - will be fetched on next load
      return prev;
    });
  }, [userId]);

  useRealtimeMessages({
    userId,
    onNewMessage: handleNewMessage,
  });

  // Update conversations when initialConversations change
  useEffect(() => {
    setConversations(initialConversations);
  }, [initialConversations]);

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="p-4 rounded-full bg-muted mb-4">
          <MessageSquare className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="font-medium mb-2">No messages yet</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Start a conversation with a friend!
        </p>
        <Link href="/friends">
          <Button variant="outline" size="sm">
            <Users className="h-4 w-4 mr-2" />
            View Friends
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {conversations.map((conversation) => {
        const displayName = conversation.friend_display_name || conversation.friend_username;
        const hasUnread = conversation.unread_count > 0;

        return (
          <button
            key={conversation.friend_id}
            onClick={() => onSelectConversation(conversation.friend_id)}
            className={cn(
              "flex items-center gap-3 w-full p-4 text-left",
              "hover:bg-muted/50 transition-colors",
              hasUnread && "bg-primary/5"
            )}
          >
            <div className="relative">
              <Avatar className="h-12 w-12">
                {conversation.friend_avatar_url && (
                  <AvatarImage
                    src={conversation.friend_avatar_url}
                    alt={displayName}
                  />
                )}
                <AvatarFallback>
                  {displayName[0]?.toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
              {hasUnread && (
                <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                  {conversation.unread_count > 9 ? "9+" : conversation.unread_count}
                </span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className={cn(
                  "font-medium truncate",
                  hasUnread && "font-semibold"
                )}>
                  {displayName}
                </p>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatDistanceToNow(new Date(conversation.last_message_at), {
                    addSuffix: false,
                  })}
                </span>
              </div>
              <p className={cn(
                "text-sm truncate",
                hasUnread ? "text-foreground font-medium" : "text-muted-foreground"
              )}>
                {conversation.last_message}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
