"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import {
  LayoutDashboard,
  Library,
  Search,
  Users,
  MoreHorizontal,
  UserPlus,
  UserSearch,
  Target,
  List,
  BarChart3,
  Upload,
  Settings,
  User,
  Globe,
  TrendingUp,
  Sparkles,
  MapPin,
  Info,
  MessageSquare,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useChatPanel } from "@/components/messages/chat-context";
import { useState, useMemo } from "react";

const primaryItems = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/my-shelf", label: "Shelf", icon: Library },
  { href: "/books", label: "Browse", icon: Search },
  { href: "/community", label: "Social", icon: Users },
];

const overflowItems = [
  { href: "/trending", label: "Trending", icon: TrendingUp },
  { href: "/recommendations", label: "For You", icon: Sparkles },
  { href: "/discover", label: "Find Readers", icon: UserSearch },
  { href: "/friends", label: "Friends", icon: UserPlus },
  { href: "/clubs", label: "Book Clubs", icon: Globe },
  { href: "/community/map", label: "Map", icon: MapPin },
  { href: "/challenges", label: "Challenges", icon: Target },
  { href: "/lists", label: "Lists", icon: List },
  { href: "/stats", label: "Reading Stats", icon: BarChart3 },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/import", label: "Import", icon: Upload },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/about", label: "About", icon: Info },
];

const sheetItemClasses = cn(
  "flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl",
  "text-center transition-colors"
);

export function MobileBottomNav() {
  const pathname = usePathname();
  const { openChat, unreadCount } = useChatPanel();
  // Track which pathname the menu was opened on — auto-closes on navigation
  const [openOnPath, setOpenOnPath] = useState<string | null>(null);
  const showMore = openOnPath !== null && openOnPath === pathname;

  const setMoreOpen = (open: boolean) => setOpenOnPath(open ? pathname : null);

  // Check if current path matches any overflow item
  const isOverflowActive = useMemo(
    () =>
      overflowItems.some(
        (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
      ),
    [pathname]
  );

  return (
    <div className="lg:hidden">
      {/* Overflow sheet. A Radix Dialog so that Escape closes it, focus moves
          into it and back to the More button afterwards, and the page behind
          it is hidden from assistive tech while it is open. */}
      <Dialog.Root open={showMore} onOpenChange={setMoreOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden" />
          <Dialog.Content
            aria-describedby={undefined}
            className={cn(
              // Sits on the 4rem nav bar, which itself sits on the safe area
              "fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] inset-x-0 z-50 lg:hidden focus:outline-none",
              "motion-safe:animate-[slide-up_200ms_ease-out]"
            )}
          >
            <div className="mx-3 mb-2 rounded-2xl bg-card border border-border shadow-xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
                <Dialog.Title className="text-sm font-semibold text-foreground">
                  More
                </Dialog.Title>
                <Dialog.Close
                  className="p-2 -m-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  aria-label="Close menu"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </Dialog.Close>
              </div>

              {/* Menu Grid */}
              <nav aria-label="More pages" className="grid grid-cols-4 gap-1 p-3">
                {overflowItems.map((item) => {
                  const isActive =
                    pathname === item.href || pathname.startsWith(`${item.href}/`);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        sheetItemClasses,
                        isActive
                          ? "text-primary bg-primary/10"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      )}
                    >
                      <item.icon
                        className={cn("w-5 h-5", isActive && "stroke-[2.5px]")}
                        aria-hidden="true"
                      />
                      <span className="text-[10px] font-medium leading-tight">{item.label}</span>
                    </Link>
                  );
                })}

                {/* Messages opens the chat panel rather than navigating */}
                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    openChat();
                  }}
                  className={cn(
                    sheetItemClasses,
                    "relative text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <MessageSquare className="w-5 h-5" aria-hidden="true" />
                  <span className="text-[10px] font-medium leading-tight">Messages</span>
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                      {unreadCount > 99 ? "99+" : unreadCount}
                      <span className="sr-only"> unread</span>
                    </span>
                  )}
                </button>
              </nav>
            </div>
          </Dialog.Content>
        </Dialog.Portal>

        {/* Bottom Nav Bar */}
        <nav
          aria-label="Primary"
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
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex flex-col items-center justify-center",
                    "w-full h-full",
                    "transition-colors",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <item.icon
                    className={cn("w-5 h-5", isActive && "stroke-[2.5px]")}
                    aria-hidden="true"
                  />
                  <span className="text-[10px] mt-1 font-medium">{item.label}</span>
                </Link>
              );
            })}

            {/* More Button — the Dialog trigger, so focus returns here on close */}
            <Dialog.Trigger
              className={cn(
                "flex flex-col items-center justify-center",
                "w-full h-full",
                "transition-colors",
                showMore || isOverflowActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-label="More pages"
            >
              <MoreHorizontal
                className={cn("w-5 h-5", (showMore || isOverflowActive) && "stroke-[2.5px]")}
                aria-hidden="true"
              />
              <span className="text-[10px] mt-1 font-medium">More</span>
            </Dialog.Trigger>
          </div>
        </nav>
      </Dialog.Root>
    </div>
  );
}
