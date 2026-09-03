"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Menu,
  X,
  BookOpen,
  Library,
  User,
  Users,
  Settings,
  LogOut,
  LayoutDashboard,
  Info,
  MapPin,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback, getInitials } from "@/components/ui/avatar";
import { useSignOut } from "@/hooks/use-sign-out";
import { cn } from "@/lib/utils";
import type { User as SupabaseUser } from "@supabase/supabase-js";

interface NavbarMobileMenuProps {
  user: SupabaseUser | null;
  isAdmin?: boolean;
}

const publicLinks = [
  { href: "/books", label: "Browse Books", icon: BookOpen },
  { href: "/community", label: "Community", icon: Users },
  { href: "/community/map", label: "Reader Map", icon: MapPin },
  { href: "/about", label: "About", icon: Info },
];

const authLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/my-shelf", label: "Bookshelves", icon: Library },
  { href: "/friends", label: "Friends", icon: Users },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function NavbarMobileMenu({ user, isAdmin = false }: NavbarMobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const signOut = useSignOut();

  const displayName = user
    ? user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split("@")[0] ||
      "User"
    : null;
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;

  const handleSignOut = async () => {
    setIsOpen(false);
    await signOut();
  };

  const closeMenu = () => setIsOpen(false);

  // Lock body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <>
      {/* Hamburger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "p-2 rounded-lg",
          "text-muted-foreground hover:text-foreground",
          "hover:bg-muted transition-colors"
        )}
        aria-label={isOpen ? "Close menu" : "Open menu"}
        aria-expanded={isOpen}
      >
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile Menu Overlay */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 top-16 bg-black/50 backdrop-blur-sm z-40"
            onClick={closeMenu}
            aria-hidden="true"
          />

          {/* Menu Panel */}
          <div
            className={cn(
              "fixed top-16 left-0 right-0 z-50",
              "bg-card border-b border-border",
              "shadow-lg shadow-black/10 dark:shadow-black/30",
              "animate-in slide-in-from-top-2 duration-200"
            )}
          >
            <div className="max-h-[calc(100vh-4rem)] overflow-y-auto">
              {/* User Section (if logged in) */}
              {user && (
                <div className="px-4 py-4 border-b border-border bg-muted/30">
                  <div className="flex items-center gap-3">
                    <Avatar size="md">
                      {avatarUrl ? (
                        <AvatarImage src={avatarUrl} alt={displayName || ""} />
                      ) : (
                        <AvatarFallback
                          initials={getInitials(displayName || "U")}
                        />
                      )}
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {displayName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {user.email}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation Links */}
              <div className="py-2">
                {publicLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={closeMenu}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3",
                      "text-sm font-medium text-foreground",
                      "hover:bg-accent/10 transition-colors"
                    )}
                  >
                    <link.icon className="w-5 h-5 text-muted-foreground" />
                    {link.label}
                  </Link>
                ))}

                {user && (
                  <>
                    <div className="my-2 border-t border-border" />
                    {authLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={closeMenu}
                        className={cn(
                          "flex items-center gap-3 px-4 py-3",
                          "text-sm font-medium text-foreground",
                          "hover:bg-accent/10 transition-colors"
                        )}
                      >
                        <link.icon className="w-5 h-5 text-muted-foreground" />
                        {link.label}
                      </Link>
                    ))}
                    {isAdmin && (
                      <>
                        <div className="my-2 border-t border-border" />
                        <Link
                          href="/admin"
                          onClick={closeMenu}
                          className={cn(
                            "flex items-center gap-3 px-4 py-3",
                            "text-sm font-medium text-primary",
                            "hover:bg-accent/10 transition-colors"
                          )}
                        >
                          <Shield className="w-5 h-5" />
                          Admin
                        </Link>
                      </>
                    )}
                  </>
                )}
              </div>

              {/* Auth Section */}
              <div className="p-4 border-t border-border">
                {user ? (
                  <button
                    onClick={handleSignOut}
                    className={cn(
                      "flex items-center justify-center gap-2 w-full",
                      "px-4 py-3 rounded-lg",
                      "text-sm font-medium text-destructive",
                      "bg-destructive/10 hover:bg-destructive/20",
                      "transition-colors"
                    )}
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                ) : (
                  <div className="flex flex-col gap-3">
                    <Link href="/signup" onClick={closeMenu}>
                      <Button className="w-full">Get Started</Button>
                    </Link>
                    <Link
                      href="/login"
                      onClick={closeMenu}
                      className="text-sm font-medium text-center text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Already have an account? Sign in
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

