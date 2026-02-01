"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Avatar, AvatarImage, AvatarFallback, getInitials } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";
import { User, Library, Users, Settings, LogOut, Shield } from "lucide-react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import type { Profile } from "@/types/database";

interface AppTopBarProps {
  user: SupabaseUser;
  profile: Profile | null;
  isAdmin?: boolean;
}

const navLinks = [
  { href: "/books", label: "Browse" },
  { href: "/community", label: "Community" },
  { href: "/community/map", label: "Map" },
  { href: "/about", label: "About" },
];

const dropdownMenuItems = [
  { href: "/profile", label: "Profile", icon: User },
  { href: "/my-shelf", label: "Bookshelves", icon: Library },
  { href: "/friends", label: "Friends", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppTopBar({ user, profile, isAdmin = false }: AppTopBarProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { signOut } = useAuth();

  const displayName =
    profile?.display_name ||
    profile?.username ||
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    "User";

  const avatarUrl =
    profile?.avatar_url ||
    user.user_metadata?.avatar_url ||
    user.user_metadata?.picture;

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
    <header className="fixed top-0 left-0 right-0 z-50 h-12 border-b border-border/50 bg-background/80 backdrop-blur-md">
      <div className="flex h-full items-center px-4">
        {/* Logo (left) */}
        <Link href="/dashboard" className="flex items-center gap-2 group">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary text-primary-foreground shadow-sm transition-transform group-hover:scale-105">
            <BookOpen className="w-4 h-4" />
          </div>
          <span className="text-lg font-bold font-serif tracking-tight hidden sm:inline">
            OhMyReads
          </span>
        </Link>

        {/* Center Navigation (Desktop only) */}
        <nav className="hidden md:flex items-center gap-1 mx-auto">
          {navLinks.map((link) => {
            const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                  isActive
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Right: Theme toggle + User avatar dropdown */}
        <div className="flex items-center gap-2 ml-auto">
          <ThemeToggle className="h-8 w-8" />

          {/* User Avatar Dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className={cn(
                "flex items-center gap-2 p-0.5 rounded-full",
                "transition-all duration-200",
                "hover:ring-2 hover:ring-primary/20",
                "focus:outline-none focus:ring-2 focus:ring-primary/50",
                isOpen && "ring-2 ring-primary/50"
              )}
              aria-expanded={isOpen}
              aria-haspopup="true"
              aria-label="User menu"
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
                  {dropdownMenuItems.map((item) => (
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
                  {/* Admin link - only visible to admins */}
                  {isAdmin && (
                    <Link
                      href="/admin"
                      onClick={() => setIsOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-4 py-2.5",
                        "text-sm text-foreground",
                        "hover:bg-accent/10 transition-colors",
                        "border-t border-border mt-1 pt-2"
                      )}
                      role="menuitem"
                    >
                      <Shield className="w-4 h-4 text-primary" />
                      <span className="font-medium">Admin</span>
                    </Link>
                  )}
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
        </div>
      </div>
    </header>
  );
}
