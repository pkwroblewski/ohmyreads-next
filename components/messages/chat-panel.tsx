"use client";

import { useState, useEffect, useCallback } from "react";
import { X, MessageSquare } from "lucide-react";
import { ConversationList } from "./conversation-list";
import { ChatWindow } from "./chat-window";
import { ChatLoadingSkeleton } from "./message-skeletons";
import { cn } from "@/lib/utils";
import type { ConversationPreview, DirectMessage } from "@/types/database";

interface Friend {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  conversations: ConversationPreview[];
  initialFriendId?: string | null;
}

export function ChatPanel({
  isOpen,
  onClose,
  userId,
  conversations,
  initialFriendId,
}: ChatPanelProps) {
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(
    initialFriendId || null
  );
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [isLoadingChat, setIsLoadingChat] = useState(false);

  // Update selected friend when initialFriendId changes
  useEffect(() => {
    if (initialFriendId) {
      setSelectedFriendId(initialFriendId);
    }
  }, [initialFriendId]);

  // Load chat when friend is selected
  useEffect(() => {
    if (!selectedFriendId || !isOpen) {
      setSelectedFriend(null);
      setMessages([]);
      return;
    }

    async function loadChat() {
      setIsLoadingChat(true);
      try {
        const response = await fetch(`/api/messages/${selectedFriendId}`);
        if (response.ok) {
          const data = await response.json();
          setSelectedFriend(data.friend);
          setMessages(data.messages);
        }
      } catch (error) {
        console.error("Failed to load chat:", error);
      } finally {
        setIsLoadingChat(false);
      }
    }

    loadChat();
  }, [selectedFriendId, isOpen]);

  const handleBack = useCallback(() => {
    setSelectedFriendId(null);
    setSelectedFriend(null);
    setMessages([]);
  }, []);

  const handleSelectConversation = useCallback((friendId: string) => {
    setSelectedFriendId(friendId);
  }, []);

  // Close panel handler
  const handleClose = useCallback(() => {
    onClose();
    // Reset state after animation
    setTimeout(() => {
      setSelectedFriendId(null);
      setSelectedFriend(null);
      setMessages([]);
    }, 300);
  }, [onClose]);

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        handleClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleClose]);

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={handleClose}
        />
      )}

      {/* Panel */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full z-50",
          "w-full sm:w-96 max-w-full",
          "bg-card border-l border-border",
          "shadow-xl shadow-black/10 dark:shadow-black/30",
          // `visibility` transitions discretely at the end, so the slide-out
          // still plays; once closed the drawer is out of layout, the tab
          // order and the accessibility tree instead of sitting 384 px past
          // the right edge and widening the document.
          "transform transition-[transform,visibility] duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "translate-x-full invisible pointer-events-none"
        )}
      >
        {/* Panel Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Messages</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
            aria-label="Close messages"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Panel Content */}
        <div className="h-[calc(100%-64px)] overflow-hidden">
          {isLoadingChat ? (
            <ChatLoadingSkeleton />
          ) : selectedFriend ? (
            <ChatWindow
              userId={userId}
              friend={selectedFriend}
              initialMessages={messages}
              onBack={handleBack}
            />
          ) : (
            <ConversationList
              userId={userId}
              initialConversations={conversations}
              onSelectConversation={handleSelectConversation}
            />
          )}
        </div>
      </div>
    </>
  );
}
