import { createClient } from "@/lib/supabase/server";
import { getFriendsActivity } from "@/lib/queries/follows";
import { FriendsActivity } from "./friends-activity";

/**
 * Server component that fetches and displays friends activity.
 * Wrapped in Suspense by parent for independent loading.
 */
export async function FriendsActivitySection() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  // Fetch friends activity
  const activities = await getFriendsActivity(user.id, 5);

  return <FriendsActivity activities={activities} />;
}
