"use client";

import {
  Twitter,
  Instagram,
  Github,
  Linkedin,
  Globe,
  BookOpen,
  Link as LinkIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { safeHref } from "@/lib/utils/sanitize";
import type { SocialLink } from "@/types/database";

interface SocialLinksDisplayProps {
  links: SocialLink[];
  size?: "sm" | "md";
}

function getPlatformInfo(url: string): {
  icon: typeof Twitter;
  name: string;
  color: string;
} {
  const lowercaseUrl = url.toLowerCase();

  if (lowercaseUrl.includes("twitter.com") || lowercaseUrl.includes("x.com")) {
    return { icon: Twitter, name: "Twitter / X", color: "hover:text-[#1DA1F2]" };
  }
  if (lowercaseUrl.includes("instagram.com")) {
    return { icon: Instagram, name: "Instagram", color: "hover:text-[#E4405F]" };
  }
  if (lowercaseUrl.includes("github.com")) {
    return { icon: Github, name: "GitHub", color: "hover:text-foreground" };
  }
  if (lowercaseUrl.includes("linkedin.com")) {
    return { icon: Linkedin, name: "LinkedIn", color: "hover:text-[#0A66C2]" };
  }
  if (lowercaseUrl.includes("goodreads.com")) {
    return { icon: BookOpen, name: "Goodreads", color: "hover:text-[#553B08]" };
  }

  // Check if it's a website (has common TLD)
  const websitePattern = /\.(com|org|net|io|co|me|dev)($|\/)/;
  if (websitePattern.test(lowercaseUrl)) {
    return { icon: Globe, name: "Website", color: "hover:text-primary" };
  }

  return { icon: LinkIcon, name: "Link", color: "hover:text-primary" };
}

export function SocialLinksDisplay({
  links,
  size = "md",
}: SocialLinksDisplayProps) {
  if (links.length === 0) return null;

  const iconSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const buttonSize = size === "sm" ? "h-8 w-8" : "h-10 w-10";

  return (
    <div className="flex items-center gap-2">
      {links.map((link) => {
        const { icon: Icon, name, color } = getPlatformInfo(link.url);
        const href = safeHref(link.url);
        if (!href) return null;

        return (
          <a
            key={link.id}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            title={link.platform || name}
            className={cn(
              "inline-flex items-center justify-center rounded-lg",
              "text-muted-foreground transition-colors",
              "hover:bg-muted",
              color,
              buttonSize
            )}
          >
            <Icon className={iconSize} />
            <span className="sr-only">{link.platform || name}</span>
          </a>
        );
      })}
    </div>
  );
}

