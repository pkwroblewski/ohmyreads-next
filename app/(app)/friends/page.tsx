import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Users, UserPlus, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getFriends, getPendingRequests, getSentRequests } from "@/lib/queries/friends";
import { FriendsList } from "@/components/social/friends-list";
import { PendingRequestsList, SentRequestsList } from "@/components/social/friend-requests-list";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Friends",
};

interface FriendsPageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function FriendsPage({ searchParams }: FriendsPageProps) {
  const { tab = "friends" } = await searchParams;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch data based on active tab
  const [friends, pendingRequests, sentRequests] = await Promise.all([
    getFriends(user.id),
    getPendingRequests(),
    getSentRequests(),
  ]);

  const tabs = [
    {
      id: "friends",
      label: "Friends",
      icon: Users,
      count: friends.length,
    },
    {
      id: "requests",
      label: "Requests",
      icon: UserPlus,
      count: pendingRequests.length,
      highlight: pendingRequests.length > 0,
    },
    {
      id: "sent",
      label: "Sent",
      icon: Clock,
      count: sentRequests.length,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold font-serif">Friends</h1>
        <p className="text-muted-foreground">
          Manage your friends and friend requests
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = tab === t.id;

          return (
            <a
              key={t.id}
              href={`/friends?tab=${t.id}`}
              className={cn(
                "flex items-center gap-2 px-4 py-2 -mb-px border-b-2 transition-colors",
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{t.label}</span>
              {t.count > 0 && (
                <span
                  className={cn(
                    "text-xs px-1.5 py-0.5 rounded-full",
                    t.highlight
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {t.count}
                </span>
              )}
            </a>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="min-h-[200px]">
        {tab === "friends" && <FriendsList friends={friends} />}
        {tab === "requests" && <PendingRequestsList requests={pendingRequests} />}
        {tab === "sent" && <SentRequestsList requests={sentRequests} />}
      </div>
    </div>
  );
}
