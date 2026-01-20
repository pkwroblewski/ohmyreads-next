import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { ChatWrapper } from "@/components/messages";
import { createClient } from "@/lib/supabase/server";
import { getConversations, getUnreadCount } from "@/lib/queries/messages";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch chat data if logged in
  let conversations: Awaited<ReturnType<typeof getConversations>> = [];
  let unreadCount = 0;

  if (user) {
    [conversations, unreadCount] = await Promise.all([
      getConversations(),
      getUnreadCount(),
    ]);
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
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
