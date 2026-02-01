"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { MessageBubble } from "./message-bubble";
import { useConversationMessages } from "@/hooks/use-realtime-messages";
import { sendMessage, markMessagesAsRead } from "@/lib/actions/messages";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { DirectMessage } from "@/types/database";

interface ChatWindowProps {
  userId: string;
  friend: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  initialMessages: DirectMessage[];
  onBack: () => void;
}

export function ChatWindow({
  userId,
  friend,
  initialMessages,
  onBack,
}: ChatWindowProps) {
  const [messages, setMessages] = useState<DirectMessage[]>(initialMessages);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const displayName = friend.display_name || friend.username;

  // Mark messages as read when viewing conversation
  useEffect(() => {
    markMessagesAsRead(friend.id);
  }, [friend.id]);

  // Subscribe to realtime messages
  const handleNewMessage = useCallback((message: DirectMessage) => {
    // Skip messages we sent - they're already added optimistically
    // This prevents duplication since optimistic messages have temp IDs
    // while realtime messages have real UUIDs
    if (message.sender_id === userId) return;

    setMessages((prev) => {
      // Check for duplicate (safety check)
      if (prev.some((m) => m.id === message.id)) return prev;
      return [...prev, message];
    });

    // Mark as read since we're the receiver
    markMessagesAsRead(friend.id);
  }, [userId, friend.id]);

  useConversationMessages({
    userId,
    friendId: friend.id,
    onNewMessage: handleNewMessage,
  });

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const content = inputValue.trim();
    if (!content || isSending) return;

    setIsSending(true);
    setInputValue("");

    // Optimistically add message
    const optimisticMessage: DirectMessage = {
      id: `temp-${Date.now()}`,
      sender_id: userId,
      receiver_id: friend.id,
      content,
      read_at: null,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMessage]);

    try {
      const result = await sendMessage(friend.id, content);

      if (result.error) {
        // Remove optimistic message on error
        setMessages((prev) => prev.filter((m) => m.id !== optimisticMessage.id));
        toast.error(result.error);
        setInputValue(content); // Restore input
      } else if (result.messageId) {
        // Update optimistic message with real ID from server
        setMessages((prev) =>
          prev.map((m) =>
            m.id === optimisticMessage.id ? { ...m, id: result.messageId! } : m
          )
        );
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMessage.id));
      toast.error("Failed to send message");
      setInputValue(content);
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <button
          onClick={onBack}
          className="p-1 hover:bg-muted rounded-lg transition-colors"
          aria-label="Back to conversations"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <Link
          href={`/users/${friend.username}`}
          className="flex items-center gap-3 flex-1 hover:opacity-80 transition-opacity"
        >
          <Avatar className="h-10 w-10">
            {friend.avatar_url && (
              <AvatarImage src={friend.avatar_url} alt={displayName} />
            )}
            <AvatarFallback>
              {displayName[0]?.toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-medium truncate">{displayName}</p>
            <p className="text-xs text-muted-foreground">@{friend.username}</p>
          </div>
        </Link>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground text-sm text-center">
              No messages yet.
              <br />
              Say hi to {displayName}!
            </p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                content={message.content}
                createdAt={message.created_at}
                isSent={message.sender_id === userId}
                isRead={!!message.read_at}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-border">
        <div className="flex items-center gap-2">
          <label htmlFor="message-input" className="sr-only">
            Message to {displayName}
          </label>
          <input
            id="message-input"
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type a message..."
            className={cn(
              "flex-1 px-4 py-2 rounded-full",
              "bg-muted border border-border",
              "focus:outline-none focus:ring-2 focus:ring-primary/50",
              "text-sm placeholder:text-muted-foreground"
            )}
            maxLength={2000}
            disabled={isSending}
          />
          <Button
            type="submit"
            size="icon"
            className="rounded-full h-10 w-10"
            disabled={!inputValue.trim() || isSending}
            aria-label={isSending ? "Sending message" : "Send message"}
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="h-4 w-4" aria-hidden="true" />
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
