"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Search, User, Settings, LogOut, Shield } from "lucide-react";
import { GlobalSearchModal } from "@/components/search/global-search-modal";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Avatar, AvatarImage, AvatarFallback, getInitials } from "@/components/ui/avatar";
import { useSignOut } from "@/hooks/use-sign-out";
import { cn } from "@/lib/utils";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
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

export function AppTopBar({ user, profile, isAdmin = false }: AppTopBarProps) {
  const pathname = usePathname();
  const signOut = useSignOut();
  const [searchOpen, setSearchOpen] = useState(false);

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

        {/* Global Search trigger (Desktop pill) */}
        <button
          onClick={() => setSearchOpen(true)}
          className={cn(
            "hidden md:flex items-center gap-2 ml-6 h-8 w-56 px-3 rounded-md",
            "border bg-muted/50 text-sm text-muted-foreground",
            "hover:bg-muted transition-colors"
          )}
          aria-label="Search books and authors"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1 text-left">Search...</span>
          <kbd className="pointer-events-none rounded border bg-background px-1.5 text-[10px] font-medium">
            ⌘K
          </kbd>
        </button>

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
          {/* Global Search trigger (Mobile icon) */}
          <button
            onClick={() => setSearchOpen(true)}
            className="md:hidden flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Search books and authors"
          >
            <Search className="h-4 w-4" />
          </button>

          <ThemeToggle className="h-8 w-8" />

          {/* User Avatar Dropdown (Radix) */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                className={cn(
                  "flex items-center gap-2 p-0.5 rounded-full",
                  "transition-all duration-200",
                  "hover:ring-2 hover:ring-primary/20",
                  "focus:outline-none focus:ring-2 focus:ring-primary/50",
                  "data-[state=open]:ring-2 data-[state=open]:ring-primary/50"
                )}
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
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={8}
                className={cn(
                  "w-64 rounded-xl overflow-hidden",
                  "bg-card border border-border",
                  "shadow-lg shadow-black/10 dark:shadow-black/30",
                  "animate-in fade-in-0 zoom-in-95 duration-200",
                  "z-[60]"
                )}
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
                <DropdownMenu.Group className="py-1">
                  <DropdownMenu.Item asChild>
                    <Link
                      href="/profile"
                      className={cn(
                        "flex items-center gap-3 px-4 py-2.5",
                        "text-sm text-foreground",
                        "hover:bg-accent/10 transition-colors outline-none",
                        "data-[highlighted]:bg-accent/10"
                      )}
                    >
                      <User className="w-4 h-4 text-muted-foreground" />
                      Profile
                    </Link>
                  </DropdownMenu.Item>
                  <DropdownMenu.Item asChild>
                    <Link
                      href="/settings"
                      className={cn(
                        "flex items-center gap-3 px-4 py-2.5",
                        "text-sm text-foreground",
                        "hover:bg-accent/10 transition-colors outline-none",
                        "data-[highlighted]:bg-accent/10"
                      )}
                    >
                      <Settings className="w-4 h-4 text-muted-foreground" />
                      Settings
                    </Link>
                  </DropdownMenu.Item>
                </DropdownMenu.Group>

                {/* Admin link - only visible to admins */}
                {isAdmin && (
                  <>
                    <DropdownMenu.Separator className="h-px bg-border my-1" />
                    <DropdownMenu.Group className="py-1">
                      <DropdownMenu.Item asChild>
                        <Link
                          href="/admin"
                          className={cn(
                            "flex items-center gap-3 px-4 py-2.5",
                            "text-sm text-foreground",
                            "hover:bg-accent/10 transition-colors outline-none",
                            "data-[highlighted]:bg-accent/10"
                          )}
                        >
                          <Shield className="w-4 h-4 text-primary" />
                          <span className="font-medium">Admin</span>
                        </Link>
                      </DropdownMenu.Item>
                    </DropdownMenu.Group>
                  </>
                )}

                {/* Sign Out */}
                <DropdownMenu.Separator className="h-px bg-border" />
                <DropdownMenu.Group className="py-1">
                  <DropdownMenu.Item
                    onSelect={signOut}
                    className={cn(
                      "flex items-center gap-3 px-4 py-2.5 w-full",
                      "text-sm text-destructive cursor-pointer",
                      "hover:bg-destructive/10 transition-colors outline-none",
                      "data-[highlighted]:bg-destructive/10"
                    )}
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </DropdownMenu.Item>
                </DropdownMenu.Group>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>

      {/* Global Search Modal (Ctrl/Cmd+K) */}
      <GlobalSearchModal open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  );
}
