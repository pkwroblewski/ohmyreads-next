import { createClient, getUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getConversations, getUnreadCount } from "@/lib/queries/messages";
import type { Profile } from "@/types/database";
import { logError } from "@/lib/utils/log";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user;
  let profile: Profile;
  let isAdmin = false;
  let conversations: Awaited<ReturnType<typeof getConversations>> = [];
  let unreadCount = 0;

  try {
    // Request-memoized — deduped across layout + page + nested components
    const { data: authData, error: authError } = await getUser();

    if (authError) {
      logError("Auth error in layout", authError.message);
      redirect("/login?error=auth_error");
    }

    user = authData.user;

    // Fallback only — proxy.ts handles redirect-preserving auth for all (app) routes
    if (!user) {
      redirect("/login");
    }

    // Get user profile - use maybeSingle() to avoid error when no row exists
    const supabase = await createClient();
    const { data: profileData, error: profileError } = await supabase
      .rpc("get_my_profile")
      .maybeSingle();

    if (profileError) {
      logError("Profile fetch error", profileError);
    }

    // If no profile exists, create one
    if (!profileData) {
      const { ensureUserProfile } = await import("@/lib/actions/user");
      const result = await ensureUserProfile();

      if (result.error || !result.profile) {
        logError("Failed to ensure profile", result.error);
        redirect("/login?error=profile_creation_failed");
      }

      profile = result.profile;
    } else {
      profile = profileData as Profile;
    }

    // Check if user is admin
    isAdmin = profile?.is_admin || false;

    // Fetch chat data in parallel - wrap in try/catch to prevent layout crash
    try {
      [conversations, unreadCount] = await Promise.all([
        getConversations(),
        getUnreadCount(),
      ]);
    } catch (chatError) {
      logError("Chat data fetch error", chatError);
      // Continue with empty defaults
    }
  } catch (error) {
    logError("Layout error", error);
    redirect("/login?error=layout_error");
  }

  return (
    <AppShell
      user={user}
      profile={profile}
      isAdmin={isAdmin}
      conversations={conversations}
      unreadCount={unreadCount}
    >
      {children}
    </AppShell>
  );
}
