"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { UserPlus, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { acceptFriendRequest, rejectFriendRequest } from "@/lib/actions/friends";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { FriendRequestWithSender } from "@/types/database";

interface FriendRequestsNotificationProps {
  requests: FriendRequestWithSender[];
}

export function FriendRequestsNotification({
  requests: initialRequests,
}: FriendRequestsNotificationProps) {
  const [requests, setRequests] = useState(initialRequests);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const handleAccept = (requestId: string) => {
    setPendingId(requestId);
    startTransition(async () => {
      const result = await acceptFriendRequest(requestId);
      setPendingId(null);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      setRequests((prev) => prev.filter((r) => r.id !== requestId));
      toast.success("Friend request accepted!");
    });
  };

  const handleReject = (requestId: string) => {
    setPendingId(requestId);
    startTransition(async () => {
      const result = await rejectFriendRequest(requestId);
      setPendingId(null);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      setRequests((prev) => prev.filter((r) => r.id !== requestId));
      toast.success("Friend request declined");
    });
  };

  if (requests.length === 0) {
    return null;
  }

  // Show only first 3 requests inline, link to full page for more
  const displayRequests = requests.slice(0, 3);
  const remainingCount = requests.length - 3;

  return (
    <div
      className={cn(
        "mb-6 p-4 rounded-xl",
        "bg-gradient-to-r from-primary/10 via-accent/5 to-primary/5",
        "border border-primary/20"
      )}
    >
      <div className="flex items-center gap-2 mb-3">
        <UserPlus className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">
          Friend Request{requests.length !== 1 ? "s" : ""}
        </h3>
        <span className="text-xs px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
          {requests.length}
        </span>
      </div>

      <div className="space-y-2">
        {displayRequests.map((request) => {
          const isPending = pendingId === request.id;
          return (
            <div
              key={request.id}
              className="flex items-center justify-between p-2 rounded-lg bg-background/50"
            >
              <div className="flex items-center gap-2">
                <Link href={`/users/${request.sender.username}`}>
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={request.sender.avatar_url || undefined} />
                    <AvatarFallback className="text-xs">
                      {(request.sender.display_name || request.sender.username || "?")[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </Link>
                <Link
                  href={`/users/${request.sender.username}`}
                  className="font-medium text-sm hover:text-primary transition-colors"
                >
                  {request.sender.display_name || request.sender.username}
                </Link>
              </div>

              <div className="flex gap-1">
                <Button
                  onClick={() => handleAccept(request.id)}
                  disabled={isPending}
                  size="sm"
                  className="h-7 px-2"
                >
                  {isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Check className="h-3 w-3" />
                  )}
                </Button>
                <Button
                  onClick={() => handleReject(request.id)}
                  disabled={isPending}
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {remainingCount > 0 && (
        <Link
          href="/friends?tab=requests"
          className="block text-center text-sm text-primary hover:underline mt-3"
        >
          View {remainingCount} more request{remainingCount !== 1 ? "s" : ""}
        </Link>
      )}
    </div>
  );
}
