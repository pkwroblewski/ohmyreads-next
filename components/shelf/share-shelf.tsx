"use client";

import { Download, Link2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ShareShelfProps {
  username: string;
  year: number;
}

/** The public URL of one year's shelf; it unfurls as that year's shelf image. */
export function shelfShareUrl(username: string, year: number): string {
  return `/users/${encodeURIComponent(username)}?year=${year}#shelf-${year}`;
}

function imageUrl(username: string, year: number, format: "square" | "story"): string {
  return `/api/og/shelf?user=${encodeURIComponent(username)}&year=${year}&format=${format}`;
}

/** Share one year's shelf: copy its link, or download it as an image to post. */
export function ShareShelf({ username, year }: ShareShelfProps) {
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${shelfShareUrl(username, year)}`);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy the link");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={`Share your ${year} shelf`}>
          <Share2 className="h-4 w-4 mr-1.5" aria-hidden="true" />
          Share
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={copyLink}>
          <Link2 className="h-4 w-4 mr-2" aria-hidden="true" />
          Copy link
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={imageUrl(username, year, "square")} download={`${username}-${year}-shelf.png`}>
            <Download className="h-4 w-4 mr-2" aria-hidden="true" />
            Square image
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={imageUrl(username, year, "story")} download={`${username}-${year}-shelf-story.png`}>
            <Download className="h-4 w-4 mr-2" aria-hidden="true" />
            Story image (9:16)
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
