"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { acceptFriendRequest, rejectFriendRequest, cancelFriendRequest } from "@/lib/actions/friends";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import type { FriendRequestWithSender, FriendRequestWithReceiver } from "@/types/database";

interface PendingRequestsListProps {
  requests: FriendRequestWithSender[];
}

export function PendingRequestsList({ requests: initialRequests }: PendingRequestsListProps) {
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
    return (
      <div className="text-center py-8 text-muted-foreground">
        No pending friend requests
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {requests.map((request) => {
        const isPending = pendingId === request.id;
        return (
          <div
            key={request.id}
            className="flex items-center justify-between p-4 rounded-lg border bg-card"
          >
            <div className="flex items-center gap-3">
              <Link href={`/users/${request.sender.username}`}>
                <Avatar className="h-10 w-10">
                  <AvatarImage src={request.sender.avatar_url || undefined} />
                  <AvatarFallback>
                    {(request.sender.display_name || request.sender.username || "?")[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Link>
              <div>
                <Link
                  href={`/users/${request.sender.username}`}
                  className="font-medium hover:text-primary transition-colors"
                >
                  {request.sender.display_name || request.sender.username}
                </Link>
                <p className="text-sm text-muted-foreground">
                  @{request.sender.username} · {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => handleAccept(request.id)}
                disabled={isPending}
                size="sm"
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Accept
                  </>
                )}
              </Button>
              <Button
                onClick={() => handleReject(request.id)}
                disabled={isPending}
                variant="outline"
                size="sm"
                className="border-foreground/20 hover:border-foreground/30"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface SentRequestsListProps {
  requests: FriendRequestWithReceiver[];
}

export function SentRequestsList({ requests: initialRequests }: SentRequestsListProps) {
  const [requests, setRequests] = useState(initialRequests);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const handleCancel = (requestId: string) => {
    setPendingId(requestId);
    startTransition(async () => {
      const result = await cancelFriendRequest(requestId);
      setPendingId(null);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      setRequests((prev) => prev.filter((r) => r.id !== requestId));
      toast.success("Friend request cancelled");
    });
  };

  if (requests.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No pending sent requests
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {requests.map((request) => {
        const isPending = pendingId === request.id;
        return (
          <div
            key={request.id}
            className="flex items-center justify-between p-4 rounded-lg border bg-card"
          >
            <div className="flex items-center gap-3">
              <Link href={`/users/${request.receiver.username}`}>
                <Avatar className="h-10 w-10">
                  <AvatarImage src={request.receiver.avatar_url || undefined} />
                  <AvatarFallback>
                    {(request.receiver.display_name || request.receiver.username || "?")[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Link>
              <div>
                <Link
                  href={`/users/${request.receiver.username}`}
                  className="font-medium hover:text-primary transition-colors"
                >
                  {request.receiver.display_name || request.receiver.username}
                </Link>
                <p className="text-sm text-muted-foreground">
                  @{request.receiver.username} · Sent {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>

            <Button
              onClick={() => handleCancel(request.id)}
              disabled={isPending}
              variant="outline"
              size="sm"
              className="border-foreground/20 hover:border-foreground/30"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </>
              )}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
