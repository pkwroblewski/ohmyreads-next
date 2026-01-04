"use client";

import { useState, useTransition } from "react";
import { UserPlus, UserMinus, UserCheck, Clock, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  sendFriendRequest,
  cancelFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend,
} from "@/lib/actions/friends";
import { cn } from "@/lib/utils";
import type { FriendshipStatus } from "@/types/database";

interface FriendButtonProps {
  targetUserId: string;
  initialStatus: FriendshipStatus;
  requestId?: string | null;
  size?: "sm" | "default";
  className?: string;
  onStatusChange?: (status: FriendshipStatus) => void;
}

export default function FriendButton({
  targetUserId,
  initialStatus,
  requestId: initialRequestId,
  size = "default",
  className,
  onStatusChange,
}: FriendButtonProps) {
  const [status, setStatus] = useState<FriendshipStatus>(initialStatus);
  const [requestId, setRequestId] = useState<string | null>(initialRequestId || null);
  const [isPending, startTransition] = useTransition();
  const [isHovering, setIsHovering] = useState(false);

  const handleSendRequest = () => {
    startTransition(async () => {
      const result = await sendFriendRequest(targetUserId);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      setStatus("pending_sent");
      onStatusChange?.("pending_sent");
      toast.success("Friend request sent!");
    });
  };

  const handleCancelRequest = () => {
    if (!requestId) return;

    startTransition(async () => {
      const result = await cancelFriendRequest(requestId);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      setStatus("none");
      setRequestId(null);
      onStatusChange?.("none");
      toast.success("Friend request cancelled");
    });
  };

  const handleAcceptRequest = () => {
    if (!requestId) return;

    startTransition(async () => {
      const result = await acceptFriendRequest(requestId);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      setStatus("friends");
      onStatusChange?.("friends");
      toast.success("Friend request accepted!");
    });
  };

  const handleRejectRequest = () => {
    if (!requestId) return;

    startTransition(async () => {
      const result = await rejectFriendRequest(requestId);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      setStatus("none");
      setRequestId(null);
      onStatusChange?.("none");
      toast.success("Friend request declined");
    });
  };

  const handleRemoveFriend = () => {
    startTransition(async () => {
      const result = await removeFriend(targetUserId);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      setStatus("none");
      setRequestId(null);
      onStatusChange?.("none");
      toast.success("Friend removed");
    });
  };

  // Render based on status
  if (status === "none") {
    return (
      <Button
        onClick={handleSendRequest}
        disabled={isPending}
        size={size}
        className={cn("min-w-[120px]", className)}
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <UserPlus className="h-4 w-4 mr-2" />
            Add Friend
          </>
        )}
      </Button>
    );
  }

  if (status === "pending_sent") {
    return (
      <Button
        onClick={handleCancelRequest}
        disabled={isPending}
        variant="outline"
        size={size}
        className={cn(
          "min-w-[120px] transition-all",
          isHovering && "border-destructive text-destructive hover:bg-destructive/10",
          className
        )}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isHovering ? (
          <>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </>
        ) : (
          <>
            <Clock className="h-4 w-4 mr-2" />
            Pending
          </>
        )}
      </Button>
    );
  }

  if (status === "pending_received") {
    return (
      <div className={cn("flex gap-2", className)}>
        <Button
          onClick={handleAcceptRequest}
          disabled={isPending}
          size={size}
          className="min-w-[90px]"
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
          onClick={handleRejectRequest}
          disabled={isPending}
          variant="outline"
          size={size}
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <X className="h-4 w-4" />
          )}
        </Button>
      </div>
    );
  }

  // status === "friends"
  return (
    <Button
      onClick={handleRemoveFriend}
      disabled={isPending}
      variant="outline"
      size={size}
      className={cn(
        "min-w-[120px] transition-all",
        isHovering && "border-destructive text-destructive hover:bg-destructive/10",
        className
      )}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isHovering ? (
        <>
          <UserMinus className="h-4 w-4 mr-2" />
          Unfriend
        </>
      ) : (
        <>
          <UserCheck className="h-4 w-4 mr-2" />
          Friends
        </>
      )}
    </Button>
  );
}
