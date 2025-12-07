"use client";

import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ShareButtonProps {
  title: string;
  slug: string;
}

export function ShareButton({ title, slug }: ShareButtonProps) {
  const handleShare = async () => {
    const url = `${window.location.origin}/books/${slug}`;

    // Try Web Share API first (mobile/supported browsers)
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${title} - OhMyReads`,
          text: `Check out "${title}" on OhMyReads`,
          url,
        });
        return;
      } catch (error) {
        // User cancelled or share failed, fall through to clipboard
        if ((error as Error).name === "AbortError") {
          return; // User cancelled, no need for fallback
        }
      }
    }

    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard!");
    } catch (error) {
      console.error("Failed to copy:", error);
      toast.error("Failed to copy link");
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleShare}
      aria-label={`Share ${title}`}
      title="Share this book"
    >
      <Share2 className="h-4 w-4" />
    </Button>
  );
}

