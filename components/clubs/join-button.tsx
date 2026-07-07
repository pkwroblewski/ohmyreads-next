"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, UserMinus, Loader2, LogIn, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { joinClub, leaveClub } from "@/lib/actions/clubs";
import { cn } from "@/lib/utils";

interface JoinButtonProps {
  clubId: string;
  clubSlug: string;
  isMember: boolean;
  userRole?: "admin" | "member" | null;
  isAuthenticated: boolean;
  size?: "sm" | "default" | "lg";
  className?: string;
}

export function JoinButton({
  clubId,
  clubSlug,
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
      router.push(`/login?redirect=/clubs/${clubSlug}`);
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
    // Admins see a badge instead of leave button
    if (userRole === "admin") {
      return (
        <Badge variant="secondary" className={cn("gap-1.5", className)}>
          <Shield className="h-3 w-3" />
          Admin
        </Badge>
      );
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
