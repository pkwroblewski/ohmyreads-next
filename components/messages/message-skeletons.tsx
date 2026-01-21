import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton for a single conversation list item
 */
export function ConversationItemSkeleton() {
  return (
    <div className="flex items-center gap-3 p-4 border-b border-border">
      {/* Avatar */}
      <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-12" />
        </div>
        <Skeleton className="h-3 w-3/4" />
      </div>
    </div>
  );
}

/**
 * Skeleton for the conversation list (multiple items)
 */
export function ConversationListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div>
      {Array.from({ length: count }).map((_, i) => (
        <ConversationItemSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Skeleton for a single message bubble
 */
function MessageBubbleSkeleton({ isOwn }: { isOwn: boolean }) {
  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[70%] space-y-1 ${isOwn ? "items-end" : "items-start"}`}
      >
        <Skeleton
          className={`h-10 rounded-2xl ${
            isOwn
              ? "w-32 rounded-br-sm bg-primary/20"
              : "w-40 rounded-bl-sm"
          }`}
        />
        <Skeleton className="h-2 w-12" />
      </div>
    </div>
  );
}

/**
 * Skeleton for the chat window when loading a conversation
 */
export function ChatLoadingSkeleton() {
  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-1">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 p-4 space-y-4 overflow-hidden">
        <MessageBubbleSkeleton isOwn={false} />
        <MessageBubbleSkeleton isOwn={true} />
        <MessageBubbleSkeleton isOwn={false} />
        <MessageBubbleSkeleton isOwn={true} />
        <MessageBubbleSkeleton isOwn={false} />
      </div>

      {/* Input area */}
      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          <Skeleton className="h-10 flex-1 rounded-md" />
          <Skeleton className="h-10 w-10 rounded-md" />
        </div>
      </div>
    </div>
  );
}
