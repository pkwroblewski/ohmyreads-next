"use client";

import { createContext, useContext } from "react";

export interface ChatPanelContextValue {
  /** Open the messages panel, optionally straight into one conversation. */
  openChat: (friendId?: string) => void;
  /** Unread direct messages across all conversations. */
  unreadCount: number;
}

const noop = () => {};

/**
 * Provided by `ChatWrapper` so navigation surfaces (sidebar, mobile More
 * sheet) can open the messages panel and show the unread badge without
 * reaching for `window.openChat`. Outside a provider (anonymous pages,
 * tests) it degrades to a no-op with no badge.
 */
export const ChatPanelContext = createContext<ChatPanelContextValue>({
  openChat: noop,
  unreadCount: 0,
});

export function useChatPanel(): ChatPanelContextValue {
  return useContext(ChatPanelContext);
}
