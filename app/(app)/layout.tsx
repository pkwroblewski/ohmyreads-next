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
  let user;
  let profile: Profile;
  let conversations: Awaited<ReturnType<typeof getConversations>> = [];
  let unreadCount = 0;

  try {
    const supabase = await createClient();

    // Get current user
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError) {
      console.error("Auth error in layout:", authError.message);
      redirect("/login?error=auth_error");
    }

    user = authData.user;

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

    // If no profile exists, create one
    if (!profileData) {
      const { ensureUserProfile } = await import("@/lib/actions/user");
      const result = await ensureUserProfile();

      if (result.error || !result.profile) {
        console.error("Failed to ensure profile:", result.error);
        redirect("/login?error=profile_creation_failed");
      }

      profile = result.profile;
    } else {
      profile = profileData as Profile;
    }

    // Fetch chat data in parallel - wrap in try/catch to prevent layout crash
    try {
      [conversations, unreadCount] = await Promise.all([
        getConversations(),
        getUnreadCount(),
      ]);
    } catch (chatError) {
      console.error("Chat data fetch error:", chatError);
      // Continue with empty defaults
    }
  } catch (error) {
    console.error("Layout error:", error);
    redirect("/login?error=layout_error");
  }

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
