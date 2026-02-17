"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Library,
  Search,
  Settings,
  LogOut,
  BookOpen,
  BarChart3,
  Upload,
  Target,
  Users,
  UserPlus,
  List,
  Globe,
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback, getInitials } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import type { Profile } from "@/types/database";

interface SidebarProps {
  user: SupabaseUser;
  profile: Profile | null;
}

interface NavSection {
  label: string;
  items: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[];
}

const navSections: NavSection[] = [
  {
    label: "Main",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/my-shelf", label: "Bookshelves", icon: Library },
      { href: "/books", label: "Browse", icon: Search },
    ],
  },
  {
    label: "Social",
    items: [
      { href: "/community", label: "Community", icon: Globe },
      { href: "/friends", label: "Friends", icon: UserPlus },
      { href: "/clubs", label: "Book Clubs", icon: Users },
    ],
  },
  {
    label: "Activity",
    items: [
      { href: "/challenges", label: "Challenges", icon: Target },
      { href: "/lists", label: "Lists", icon: List },
      { href: "/stats", label: "Reading Stats", icon: BarChart3 },
    ],
  },
  {
    label: "Utility",
    items: [
      { href: "/import", label: "Import", icon: Upload },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function Sidebar({ user, profile }: SidebarProps) {
  const pathname = usePathname();
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

  return (
    <div className="flex h-full flex-col bg-card border-r border-border">
      {/* Logo Section */}
      <div className="p-6">
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary text-primary-foreground shadow-sm transition-transform group-hover:scale-105">
            <BookOpen className="w-5 h-5" />
          </div>
          <span className="text-xl font-bold font-serif tracking-tight">
            OhMyReads
          </span>
        </Link>
      </div>

      {/* Navigation Section */}
      <nav className="flex-1 px-3 py-2 overflow-y-auto">
        {navSections.map((section, sectionIndex) => (
          <div key={section.label}>
            {sectionIndex > 0 && (
              <div className="my-2 mx-3 border-t border-border/50" />
            )}
            <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg",
                      "text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    <item.icon className="w-4.5 h-4.5 flex-shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User Section */}
      <div className="p-4 border-t border-border">
        {/* User Info */}
        <div className="flex items-center gap-3 mb-4">
          <Avatar size="sm">
            {avatarUrl ? (
              <AvatarImage src={avatarUrl} alt={displayName} />
            ) : (
              <AvatarFallback initials={getInitials(displayName)} />
            )}
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{displayName}</p>
            {email && (
              <p className="text-xs text-muted-foreground truncate">{email}</p>
            )}
          </div>
        </div>

        {/* Sign Out Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          className="w-full justify-start text-muted-foreground hover:text-destructive"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}
