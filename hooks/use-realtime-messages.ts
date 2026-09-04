"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DirectMessage } from "@/types/database";
import type { RealtimePostgresInsertPayload } from "@supabase/supabase-js";

interface UseRealtimeMessagesOptions {
  userId: string | null;
  onNewMessage?: (message: DirectMessage) => void;
}

interface UseConversationMessagesOptions extends UseRealtimeMessagesOptions {
  friendId: string | null;
}

interface UseRealtimeMessagesReturn {
  isConnected: boolean;
  connectionError: string | null;
}

interface ChannelSpec {
  /** `null` when there is nothing to subscribe to yet (e.g. signed out). */
  name: string | null;
  /** Server-side row filter for the INSERT subscription, when one applies. */
  filter?: string;
  /** Client-side check that an inserted row belongs to this subscriber. */
  accept: (message: DirectMessage) => boolean;
  errorMessage: string;
}

/**
 * One subscription to `direct_messages` INSERTs. Both public hooks are thin
 * wrappers that only differ in channel name, row filter and acceptance test.
 */
function useDirectMessagesChannel(
  { name, filter, accept, errorMessage }: ChannelSpec,
  onNewMessage?: (message: DirectMessage) => void
): UseRealtimeMessagesReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const onNewMessageRef = useRef(onNewMessage);
  const acceptRef = useRef(accept);

  // Keep the latest callbacks without re-subscribing on every render.
  useEffect(() => {
    onNewMessageRef.current = onNewMessage;
    acceptRef.current = accept;
  }, [onNewMessage, accept]);

  useEffect(() => {
    if (!name) {
      queueMicrotask(() => setIsConnected(false));
      return;
    }

    const supabase = createClient();

    const channel = supabase
      .channel(name)
      .on<DirectMessage>(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
          ...(filter ? { filter } : {}),
        },
        (payload: RealtimePostgresInsertPayload<DirectMessage>) => {
          const msg = payload.new;
          if (msg && acceptRef.current(msg)) {
            onNewMessageRef.current?.(msg);
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setIsConnected(true);
          setConnectionError(null);
        } else if (status === "CHANNEL_ERROR") {
          setIsConnected(false);
          setConnectionError(errorMessage);
        } else if (status === "TIMED_OUT") {
          setIsConnected(false);
          setConnectionError("Connection timed out");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [name, filter, errorMessage]);

  return { isConnected, connectionError };
}

/**
 * Hook to subscribe to realtime direct messages for the current user
 */
export function useRealtimeMessages({
  userId,
  onNewMessage,
}: UseRealtimeMessagesOptions): UseRealtimeMessagesReturn {
  return useDirectMessagesChannel(
    {
      name: userId ? `direct_messages:${userId}` : null,
      filter: userId ? `receiver_id=eq.${userId}` : undefined,
      accept: (msg) => msg.receiver_id === userId,
      errorMessage: "Failed to connect to message updates",
    },
    onNewMessage
  );
}

/**
 * Hook to subscribe to messages in a specific conversation (both directions)
 */
export function useConversationMessages({
  userId,
  friendId,
  onNewMessage,
}: UseConversationMessagesOptions): UseRealtimeMessagesReturn {
  return useDirectMessagesChannel(
    {
      name: userId && friendId ? `conversation:${userId}:${friendId}` : null,
      accept: (msg) =>
        (msg.sender_id === userId && msg.receiver_id === friendId) ||
        (msg.sender_id === friendId && msg.receiver_id === userId),
      errorMessage: "Failed to connect to conversation updates",
    },
    onNewMessage
  );
}
