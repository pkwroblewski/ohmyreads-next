"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Library,
  Search,
  Users,
  MoreHorizontal,
  UserPlus,
  Target,
  List,
  BarChart3,
  Upload,
  Settings,
  User,
  Globe,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef, useMemo } from "react";

const primaryItems = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/my-shelf", label: "Shelf", icon: Library },
  { href: "/books", label: "Browse", icon: Search },
  { href: "/community", label: "Social", icon: Users },
];

const overflowItems = [
  { href: "/friends", label: "Friends", icon: UserPlus },
  { href: "/clubs", label: "Book Clubs", icon: Globe },
  { href: "/challenges", label: "Challenges", icon: Target },
  { href: "/lists", label: "Lists", icon: List },
  { href: "/stats", label: "Reading Stats", icon: BarChart3 },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/import", label: "Import", icon: Upload },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  // Track which pathname the menu was opened on — auto-closes on navigation
  const [openOnPath, setOpenOnPath] = useState<string | null>(null);
  const showMore = openOnPath !== null && openOnPath === pathname;
  const menuRef = useRef<HTMLDivElement>(null);

  const toggleMore = () => setOpenOnPath(showMore ? null : pathname);
  const closeMore = () => setOpenOnPath(null);

  // Check if current path matches any overflow item
  const isOverflowActive = useMemo(
    () =>
      overflowItems.some(
        (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
      ),
    [pathname]
  );

  // Close on outside click
  useEffect(() => {
    if (!showMore) return;

    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMore();
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showMore]);

  return (
    <>
      {/* Backdrop */}
      {showMore && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          aria-hidden="true"
        />
      )}

      <div ref={menuRef} className="lg:hidden">
        {/* Overflow Menu */}
        {showMore && (
          <div
            className={cn(
              "fixed bottom-16 inset-x-0 z-50",
              "pb-[env(safe-area-inset-bottom)]",
              "animate-in slide-in-from-bottom-4 fade-in-0 duration-200"
            )}
          >
            <div className="mx-3 mb-2 rounded-2xl bg-card border border-border shadow-xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
                <span className="text-sm font-semibold text-foreground">More</span>
                <button
                  onClick={closeMore}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  aria-label="Close menu"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Menu Grid */}
              <div className="grid grid-cols-4 gap-1 p-3">
                {overflowItems.map((item) => {
                  const isActive =
                    pathname === item.href || pathname.startsWith(`${item.href}/`);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl",
                        "text-center transition-colors",
                        isActive
                          ? "text-primary bg-primary/10"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      )}
                    >
                      <item.icon className={cn("w-5 h-5", isActive && "stroke-[2.5px]")} />
                      <span className="text-[10px] font-medium leading-tight">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Bottom Nav Bar */}
        <nav
          className={cn(
            "fixed bottom-0 inset-x-0 z-50",
            "bg-background/80 backdrop-blur-lg",
            "border-t border-border",
            "pb-[env(safe-area-inset-bottom)]"
          )}
        >
          <div className="flex items-center justify-around h-16">
            {primaryItems.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center justify-center",
                    "w-full h-full",
                    "transition-colors",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  aria-label={item.label}
                >
                  <item.icon
                    className={cn("w-5 h-5", isActive && "stroke-[2.5px]")}
                  />
                  <span className="text-[10px] mt-1 font-medium">{item.label}</span>
                </Link>
              );
            })}

            {/* More Button */}
            <button
              onClick={toggleMore}
              className={cn(
                "flex flex-col items-center justify-center",
                "w-full h-full",
                "transition-colors",
                showMore || isOverflowActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-label="More options"
              aria-expanded={showMore}
            >
              <MoreHorizontal
                className={cn("w-5 h-5", (showMore || isOverflowActive) && "stroke-[2.5px]")}
              />
              <span className="text-[10px] mt-1 font-medium">More</span>
            </button>
          </div>
        </nav>
      </div>
    </>
  );
}
