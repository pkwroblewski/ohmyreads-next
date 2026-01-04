"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { User, Library, Users, Settings, LogOut } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback, getInitials } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import type { User as SupabaseUser } from "@supabase/supabase-js";

interface NavbarUserMenuProps {
  user: SupabaseUser;
}

const menuItems = [
  { href: "/profile", label: "Profile", icon: User },
  { href: "/my-shelf", label: "My Shelf", icon: Library },
  { href: "/friends", label: "Friends", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function NavbarUserMenu({ user }: NavbarUserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { signOut } = useAuth();

  const displayName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    "User";
  const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture;
  const email = user.email;

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Close menu on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const handleSignOut = async () => {
    setIsOpen(false);
    await signOut();
  };

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 p-1 rounded-full",
          "transition-all duration-200",
          "hover:ring-2 hover:ring-primary/20",
          "focus:outline-none focus:ring-2 focus:ring-primary/50",
          isOpen && "ring-2 ring-primary/50"
        )}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Avatar size="sm">
          {avatarUrl ? (
            <AvatarImage src={avatarUrl} alt={displayName} />
          ) : (
            <AvatarFallback initials={getInitials(displayName)} />
          )}
        </Avatar>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={cn(
            "absolute right-0 mt-2 w-64 origin-top-right",
            "rounded-xl overflow-hidden",
            "bg-card border border-border",
            "shadow-lg shadow-black/10 dark:shadow-black/30",
            "animate-in fade-in-0 zoom-in-95 duration-200"
          )}
          role="menu"
          aria-orientation="vertical"
        >
          {/* User Info Header */}
          <div className="px-4 py-3 border-b border-border bg-muted/30">
            <p className="text-sm font-medium text-foreground truncate">
              {displayName}
            </p>
            {email && (
              <p className="text-xs text-muted-foreground truncate">{email}</p>
            )}
          </div>

          {/* Menu Items */}
          <div className="py-1">
            {menuItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5",
                  "text-sm text-foreground",
                  "hover:bg-accent/10 transition-colors"
                )}
                role="menuitem"
              >
                <item.icon className="w-4 h-4 text-muted-foreground" />
                {item.label}
              </Link>
            ))}
          </div>

          {/* Sign Out */}
          <div className="border-t border-border py-1">
            <button
              onClick={handleSignOut}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 w-full",
                "text-sm text-destructive",
                "hover:bg-destructive/10 transition-colors"
              )}
              role="menuitem"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

