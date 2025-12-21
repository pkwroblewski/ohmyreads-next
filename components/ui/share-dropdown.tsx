"use client";

import { useState } from "react";
import { Share2, Twitter, Linkedin, Link2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ShareDropdownProps {
  url: string;
  title: string;
  text?: string;
  className?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "icon";
}

export function ShareDropdown({
  url,
  title,
  text,
  className,
  variant = "outline",
  size = "default",
}: ShareDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const fullUrl = url.startsWith("http") ? url : `${typeof window !== "undefined" ? window.location.origin : ""}${url}`;
  const shareText = text || `Check out "${title}" on OhMyReads`;

  const handleShare = async () => {
    // Try Web Share API first (mobile/supported browsers)
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${title} - OhMyReads`,
          text: shareText,
          url: fullUrl,
        });
        return;
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return;
        }
      }
    }
    // Otherwise show dropdown
    setIsOpen(!isOpen);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      toast.success("Link copied!");
      setTimeout(() => {
        setCopied(false);
        setIsOpen(false);
      }, 1500);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleTwitter = () => {
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(fullUrl)}`;
    window.open(twitterUrl, "_blank", "width=550,height=420");
    setIsOpen(false);
  };

  const handleLinkedIn = () => {
    const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(fullUrl)}`;
    window.open(linkedInUrl, "_blank", "width=550,height=420");
    setIsOpen(false);
  };

  return (
    <div className={cn("relative", className)}>
      <Button
        variant={variant}
        size={size}
        onClick={handleShare}
        aria-label="Share"
        title="Share"
      >
        <Share2 className="h-4 w-4" />
        {size !== "icon" && <span className="ml-2">Share</span>}
      </Button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 mt-2 w-48 rounded-lg border bg-card shadow-lg z-50 py-1">
            <button
              onClick={handleTwitter}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-muted transition-colors"
            >
              <Twitter className="h-4 w-4" />
              Share on X
            </button>
            <button
              onClick={handleLinkedIn}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-muted transition-colors"
            >
              <Linkedin className="h-4 w-4" />
              Share on LinkedIn
            </button>
            <div className="h-px bg-border my-1" />
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-muted transition-colors"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="text-green-500">Copied!</span>
                </>
              ) : (
                <>
                  <Link2 className="h-4 w-4" />
                  Copy link
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
