"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ExternalLink, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getAffiliateLinks } from "@/lib/utils/affiliate-links";

interface BuyLinksProps {
  book: {
    isbn?: string | null;
    title: string;
    author: string;
  };
  size?: "sm" | "default";
  variant?: "outline" | "ghost";
  className?: string;
}

const retailers = [
  { key: "amazon" as const, label: "Amazon", icon: "🛒" },
  { key: "bolcom" as const, label: "Bol.com", icon: "📦" },
];

export function BuyLinks({
  book,
  size = "sm",
  variant = "outline",
  className,
}: BuyLinksProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const links = getAffiliateLinks(book);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const handleLinkClick = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
    setIsOpen(false);
  };

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      <Button
        variant={variant}
        size={size}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "gap-1.5",
          size === "sm" && "text-xs h-8 px-2.5"
        )}
      >
        <ShoppingCart className={cn("w-3.5 h-3.5", size === "default" && "w-4 h-4")} />
        Buy
        <ChevronDown
          className={cn(
            "w-3 h-3 transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </Button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className={cn(
            "absolute top-full right-0 mt-1 z-50",
            "bg-background border border-border rounded-lg shadow-lg",
            "py-1 min-w-[140px]"
          )}
        >
          {retailers.map((retailer) => (
            <button
              key={retailer.key}
              onClick={() => handleLinkClick(links[retailer.key])}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 text-sm text-left",
                "hover:bg-muted transition-colors"
              )}
            >
              <span className="text-base">{retailer.icon}</span>
              <span className="flex-1">{retailer.label}</span>
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Simple inline buy link (single retailer)
 */
export function BuyLink({
  book,
  retailer = "amazon",
  className,
}: {
  book: { isbn?: string | null; title: string; author: string };
  retailer?: "amazon" | "bolcom";
  className?: string;
}) {
  const links = getAffiliateLinks(book);
  const label = retailer === "amazon" ? "Amazon" : "Bol.com";

  return (
    <a
      href={links[retailer]}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors",
        className
      )}
    >
      <ShoppingCart className="w-3.5 h-3.5" />
      {label}
      <ExternalLink className="w-3 h-3" />
    </a>
  );
}
