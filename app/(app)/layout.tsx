import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { ChatWrapper } from "@/components/messages";
import { getConversations, getUnreadCount } from "@/lib/queries/messages";
import type { Profile } from "@/types/database";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Redirect to login if not authenticated
  if (!user) {
    redirect("/login");
  }

  // Get user profile - use maybeSingle() to avoid error when no row exists
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Profile fetch error:", profileError);
  }

  // If no profile exists, redirect to callback to create one
  if (!profileData) {
    redirect("/callback?redirect=/dashboard");
  }

  const profile = profileData as Profile;

  // Fetch chat data in parallel
  const [conversations, unreadCount] = await Promise.all([
    getConversations(),
    getUnreadCount(),
  ]);

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar - hidden on mobile */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:w-64 lg:flex-col">
        <Sidebar user={user} profile={profile} />
      </aside>

      {/* Main Content Area */}
      <div className="lg:pl-64">
        <main className="min-h-screen">
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
