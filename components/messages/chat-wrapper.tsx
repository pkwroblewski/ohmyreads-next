"use client";

import { useState, useEffect, useCallback } from "react";
import { ChatPanel } from "./chat-panel";
import { ChatTrigger } from "./chat-trigger";
import { useRealtimeMessages } from "@/hooks/use-realtime-messages";
import type { ConversationPreview, DirectMessage } from "@/types/database";

interface ChatWrapperProps {
  userId: string;
  initialConversations: ConversationPreview[];
  initialUnreadCount: number;
}

export function ChatWrapper({
  userId,
  initialConversations,
  initialUnreadCount,
}: ChatWrapperProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [conversations, setConversations] = useState<ConversationPreview[]>(initialConversations);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [openWithFriendId, setOpenWithFriendId] = useState<string | null>(null);

  // Handle new messages for badge update
  const handleNewMessage = useCallback((message: DirectMessage) => {
    // Only increment if we're the receiver and panel is closed
    if (message.receiver_id === userId && !isOpen) {
      setUnreadCount((prev) => prev + 1);
    }

    // Update conversations list
    setConversations((prev) => {
      const friendId = message.sender_id === userId ? message.receiver_id : message.sender_id;
      const existingIndex = prev.findIndex((c) => c.friend_id === friendId);

      if (existingIndex >= 0) {
        const updated = [...prev];
        const existing = updated[existingIndex];
        updated.splice(existingIndex, 1);

        return [{
          ...existing,
          last_message: message.content,
          last_message_at: message.created_at,
          unread_count: message.receiver_id === userId && !isOpen
            ? existing.unread_count + 1
            : existing.unread_count,
        }, ...updated];
      }

      return prev;
    });
  }, [userId, isOpen]);

  useRealtimeMessages({
    userId,
    onNewMessage: handleNewMessage,
  });

  // Refresh conversations when panel opens
  useEffect(() => {
    if (isOpen) {
      fetch("/api/messages/conversations")
        .then((res) => res.json())
        .then((data) => {
          if (data.conversations) {
            setConversations(data.conversations);
          }
          if (typeof data.unreadCount === "number") {
            setUnreadCount(data.unreadCount);
          }
        })
        .catch(console.error);
    }
  }, [isOpen]);

  const handleOpenChat = useCallback((friendId?: string) => {
    setOpenWithFriendId(friendId || null);
    setIsOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setOpenWithFriendId(null);
  }, []);

  // Expose openChat function globally for other components
  useEffect(() => {
    (window as unknown as { openChat?: (friendId?: string) => void }).openChat = handleOpenChat;
    return () => {
      delete (window as unknown as { openChat?: (friendId?: string) => void }).openChat;
    };
  }, [handleOpenChat]);

  return (
    <>
      <ChatTrigger
        unreadCount={unreadCount}
        onClick={() => handleOpenChat()}
      />
      <ChatPanel
        isOpen={isOpen}
        onClose={handleClose}
        userId={userId}
        conversations={conversations}
        initialFriendId={openWithFriendId}
      />
    </>
  );
}
