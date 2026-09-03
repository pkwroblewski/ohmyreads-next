import { AppTopBar } from "@/components/layout/app-top-bar";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { ChatWrapper } from "@/components/messages";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/types/database";
import type { getConversations } from "@/lib/queries/messages";

interface AppShellProps {
  user: User;
  profile: Profile;
  isAdmin: boolean;
  conversations: Awaited<ReturnType<typeof getConversations>>;
  unreadCount: number;
  children: React.ReactNode;
}

/**
 * The authenticated app chrome (top bar + sidebar + mobile nav + chat),
 * rendered by BOTH route-group layouts so logged-in users never lose the
 * shell when crossing into (public) routes. No data fetching here — each
 * layout supplies the props.
 */
export function AppShell({
  user,
  profile,
  isAdmin,
  conversations,
  unreadCount,
  children,
}: AppShellProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* App Top Bar - full width, fixed at top */}
      <AppTopBar user={user} profile={profile} isAdmin={isAdmin} />

      {/* Desktop Sidebar - hidden on mobile, starts below top bar */}
      <aside className="hidden lg:fixed lg:top-12 lg:left-0 lg:z-40 lg:flex lg:w-64 lg:flex-col lg:h-[calc(100vh-48px)]">
        <Sidebar user={user} profile={profile} />
      </aside>

      {/* Main Content Area - padded for sidebar on desktop, starts below top bar */}
      <div className="lg:pl-64 pt-12">
        <main id="main" tabIndex={-1} className="min-h-[calc(100vh-48px)] focus:outline-none">
          <div className="p-4 lg:p-8 pb-20 lg:pb-8">{children}</div>
        </main>
      </div>

      {/* Mobile Bottom Nav - hidden on desktop */}
      <MobileBottomNav />

      {/* Chat Panel and Trigger */}
      <ChatWrapper
        userId={user.id}
        initialConversations={conversations}
        initialUnreadCount={unreadCount}
      />
    </div>
  );
}
