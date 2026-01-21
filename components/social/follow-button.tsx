"use client";

import { useState, useTransition } from "react";
import { UserPlus, UserMinus, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toggleFollow } from "@/lib/actions/follows";
import { cn } from "@/lib/utils";

interface FollowButtonProps {
  targetUserId: string;
  initialIsFollowing: boolean;
  size?: "sm" | "default";
  className?: string;
  onFollowChange?: (isFollowing: boolean) => void;
}

export default function FollowButton({
  targetUserId,
  initialIsFollowing,
  size = "default",
  className,
  onFollowChange,
}: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [isPending, startTransition] = useTransition();
  const [isHovering, setIsHovering] = useState(false);
  const [showUnfollowDialog, setShowUnfollowDialog] = useState(false);

  const handleFollow = () => {
    startTransition(async () => {
      const result = await toggleFollow(targetUserId);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      setIsFollowing(result.isFollowing);
      onFollowChange?.(result.isFollowing);
      toast.success("Following!");
    });
  };

  const handleUnfollow = () => {
    startTransition(async () => {
      const result = await toggleFollow(targetUserId);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      setIsFollowing(result.isFollowing);
      onFollowChange?.(result.isFollowing);
      toast.success("Unfollowed");
      setShowUnfollowDialog(false);
    });
  };

  const handleClick = () => {
    if (isFollowing) {
      setShowUnfollowDialog(true);
    } else {
      handleFollow();
    }
  };

  // Show "Unfollow" on hover when already following
  const showUnfollow = isFollowing && isHovering;

  return (
    <>
      <Button
        onClick={handleClick}
        disabled={isPending}
        variant={isFollowing ? "outline" : "default"}
        size={size}
        className={cn(
          "min-w-[100px] transition-all",
          isFollowing && isHovering && "border-destructive text-destructive hover:bg-destructive/10",
          className
        )}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : showUnfollow ? (
          <>
            <UserMinus className="h-4 w-4 mr-2" />
            Unfollow
          </>
        ) : isFollowing ? (
          <>
            <Check className="h-4 w-4 mr-2" />
            Following
          </>
        ) : (
          <>
            <UserPlus className="h-4 w-4 mr-2" />
            Follow
          </>
        )}
      </Button>

      <AlertDialog open={showUnfollowDialog} onOpenChange={setShowUnfollowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unfollow this user?</AlertDialogTitle>
            <AlertDialogDescription>
              You will no longer see their updates in your feed. You can follow them again at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnfollow}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Unfollow
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
