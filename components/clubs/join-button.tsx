"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, UserMinus, Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { joinClub, leaveClub } from "@/lib/actions/clubs";
import { cn } from "@/lib/utils";

interface JoinButtonProps {
  clubId: string;
  isMember: boolean;
  userRole?: "admin" | "member" | null;
  isAuthenticated: boolean;
  size?: "sm" | "default" | "lg";
  className?: string;
}

export function JoinButton({
  clubId,
  isMember,
  userRole,
  isAuthenticated,
  size = "default",
  className,
}: JoinButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isHovering, setIsHovering] = useState(false);

  const handleJoin = () => {
    if (!isAuthenticated) {
      router.push(`/login?redirect=/clubs`);
      return;
    }

    startTransition(async () => {
      const result = await joinClub(clubId);
      if (result.success) {
        toast.success("Joined club!");
      } else {
        toast.error(result.error || "Failed to join club");
      }
    });
  };

  const handleLeave = () => {
    startTransition(async () => {
      const result = await leaveClub(clubId);
      if (result.success) {
        toast.success("Left club");
      } else {
        toast.error(result.error || "Failed to leave club");
      }
    });
  };

  if (!isAuthenticated) {
    return (
      <Button onClick={handleJoin} size={size} className={className}>
        <LogIn className="h-4 w-4 mr-2" />
        Sign in to join
      </Button>
    );
  }

  if (isMember) {
    // Admins can't leave via this button (need to transfer or delete)
    if (userRole === "admin") {
      return null;
    }

    return (
      <Button
        onClick={handleLeave}
        disabled={isPending}
        variant="outline"
        size={size}
        className={cn(
          "transition-all",
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
            Leave
          </>
        ) : (
          <>
            <UserPlus className="h-4 w-4 mr-2" />
            Member
          </>
        )}
      </Button>
    );
  }

  return (
    <Button
      onClick={handleJoin}
      disabled={isPending}
      size={size}
      className={className}
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <>
          <UserPlus className="h-4 w-4 mr-2" />
          Join Club
        </>
      )}
    </Button>
  );
}
