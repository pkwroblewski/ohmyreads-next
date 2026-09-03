import type { Metadata } from "next";
import { createClient, getUser } from "@/lib/supabase/server";
import { MapPageClient } from "@/components/geo/map-page-client";
import type { UserPresenceData } from "@/components/geo/map-context-panel";

export const metadata: Metadata = {
  title: "Reader Map",
  description:
    "Discover readers and book-friendly places near you. Find bookstores, libraries, and cafes in your area.",
  openGraph: {
    title: "Reader Map",
    description: "Discover readers and book-friendly places near you.",
  },
};

export default async function ReaderMapPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await getUser();

  // Get user's display name and presence info
  let userName: string | undefined;
  let userPresence: UserPresenceData | null = null;

  if (user) {
    // Own row incl. presence columns, which are not directly selectable (065)
    const { data: profile } = await supabase.rpc("get_my_profile").maybeSingle();

    userName = profile?.display_name || profile?.username || undefined;

    // Check if presence is still valid (temporary or recommended check-ins)
    if (profile?.presence_type && (profile.presence_type === "temporary" || profile.presence_type === "recommended")) {
      const expiresAt = profile.presence_expires_at ? new Date(profile.presence_expires_at) : null;
      const isExpired = expiresAt && expiresAt < new Date();

      if (!isExpired) {
        userPresence = {
          type: profile.presence_type as "temporary" | "recommended",
          expiresAt: profile.presence_expires_at,
          note: profile.presence_note,
          locationLabel: profile.location_label,
        };
      }
    }
  }

  return (
    <MapPageClient
      currentUserId={user?.id}
      userName={userName}
      userPresence={userPresence}
    />
  );
}
