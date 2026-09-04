import { getUser } from "@/lib/supabase/server";
import { getFriendsActivity } from "@/lib/queries/follows";
import { FriendsActivity } from "./friends-activity";
import type { DashboardSectionProps } from "./section-props";

/**
 * Server component that fetches and displays friends activity.
 * Wrapped in Suspense by parent for independent loading.
 */
/**
 * `hideEmpty` belongs to the first-run checklist: while that is on screen
 * it owns the calls to action, so this section says nothing rather than
 * adding another empty state with the same buttons.
 */

export async function FriendsActivitySection({
  hideEmpty = false,
}: DashboardSectionProps) {

  const {
    data: { user },
  } = await getUser();

  if (!user) {
    return null;
  }

  // Fetch friends activity
  const activities = await getFriendsActivity(user.id, 5);

  if (hideEmpty && activities.length === 0) {
    return null;
  }

  return <FriendsActivity activities={activities} />;
}
