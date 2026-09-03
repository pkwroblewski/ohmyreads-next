import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { ChatWrapper } from "@/components/messages";
import { AppShell } from "@/components/layout/app-shell";
import { createClient, getUser } from "@/lib/supabase/server";
import { getConversations, getUnreadCount } from "@/lib/queries/messages";
import type { Profile } from "@/types/database";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await getUser();

  // Fetch chat data if logged in
  let conversations: Awaited<ReturnType<typeof getConversations>> = [];
  let unreadCount = 0;
  let profile: Profile | null = null;

  if (user) {
    const [chatData, profileResult] = await Promise.all([
      Promise.all([getConversations(), getUnreadCount()]),
      // No ensureUserProfile here — a public page must not hard-fail on
      // profile creation; the rare profile-less user gets the Navbar branch
      supabase.rpc("get_my_profile").maybeSingle(),
    ]);
    [conversations, unreadCount] = chatData;
    profile = (profileResult.data as Profile | null) ?? null;
  }

  // Logged-in users keep the app chrome on public routes (no shell-swap)
  if (user && profile) {
    return (
      <AppShell
        user={user}
        profile={profile}
        isAdmin={profile.is_admin || false}
        conversations={conversations}
        unreadCount={unreadCount}
      >
        {children}
      </AppShell>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
      </main>
      <Footer />

      {/* Chat Panel - only show when logged in */}
      {user && (
        <ChatWrapper
          userId={user.id}
          initialConversations={conversations}
          initialUnreadCount={unreadCount}
        />
      )}
    </div>
  );
}
