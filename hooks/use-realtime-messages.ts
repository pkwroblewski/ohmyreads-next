"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DirectMessage } from "@/types/database";
import type { RealtimeChannel, RealtimePostgresInsertPayload } from "@supabase/supabase-js";

interface UseRealtimeMessagesOptions {
  userId: string | null;
  onNewMessage?: (message: DirectMessage) => void;
}

interface UseRealtimeMessagesReturn {
  isConnected: boolean;
  connectionError: string | null;
}

/**
 * Hook to subscribe to realtime direct messages for the current user
 */
export function useRealtimeMessages({
  userId,
  onNewMessage,
}: UseRealtimeMessagesOptions): UseRealtimeMessagesReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onNewMessageRef = useRef(onNewMessage);

  // Keep callback ref updated
  useEffect(() => {
    onNewMessageRef.current = onNewMessage;
  }, [onNewMessage]);

  useEffect(() => {
    if (!userId) {
      queueMicrotask(() => setIsConnected(false));
      return;
    }

    const supabase = createClient();

    // Subscribe to new messages where current user is receiver
    const channel = supabase
      .channel(`direct_messages:${userId}`)
      .on<DirectMessage>(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
          filter: `receiver_id=eq.${userId}`,
        },
        (payload: RealtimePostgresInsertPayload<DirectMessage>) => {
          if (payload.new && onNewMessageRef.current) {
            onNewMessageRef.current(payload.new);
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setIsConnected(true);
          setConnectionError(null);
        } else if (status === "CHANNEL_ERROR") {
          setIsConnected(false);
          setConnectionError("Failed to connect to message updates");
        } else if (status === "TIMED_OUT") {
          setIsConnected(false);
          setConnectionError("Connection timed out");
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId]);

  return { isConnected, connectionError };
}

interface UseConversationMessagesOptions {
  userId: string | null;
  friendId: string | null;
  onNewMessage?: (message: DirectMessage) => void;
}

/**
 * Hook to subscribe to messages in a specific conversation
 */
export function useConversationMessages({
  userId,
  friendId,
  onNewMessage,
}: UseConversationMessagesOptions): UseRealtimeMessagesReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onNewMessageRef = useRef(onNewMessage);

  useEffect(() => {
    onNewMessageRef.current = onNewMessage;
  }, [onNewMessage]);

  useEffect(() => {
    if (!userId || !friendId) {
      queueMicrotask(() => setIsConnected(false));
      return;
    }

    const supabase = createClient();

    // Subscribe to messages in this conversation (both directions)
    const channel = supabase
      .channel(`conversation:${userId}:${friendId}`)
      .on<DirectMessage>(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
        },
        (payload: RealtimePostgresInsertPayload<DirectMessage>) => {
          const msg = payload.new;
          if (!msg) return;

          // Check if message is in this conversation
          const isInConversation =
            (msg.sender_id === userId && msg.receiver_id === friendId) ||
            (msg.sender_id === friendId && msg.receiver_id === userId);

          if (isInConversation && onNewMessageRef.current) {
            onNewMessageRef.current(msg);
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setIsConnected(true);
          setConnectionError(null);
        } else if (status === "CHANNEL_ERROR") {
          setIsConnected(false);
          setConnectionError("Failed to connect to conversation updates");
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId, friendId]);

  return { isConnected, connectionError };
}
