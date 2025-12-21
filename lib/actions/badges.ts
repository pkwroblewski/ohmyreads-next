"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkAndUnlockBadges } from "@/lib/queries/badges";
import { getBadgeById } from "@/lib/data/badges";

// Sync badges for the current user (check and unlock any new badges)
export async function syncUserBadges(): Promise<{
  newBadges: Array<{ id: string; name: string; icon: string }>;
  error: string | null;
}> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { newBadges: [], error: "Not authenticated" };
    }

    const newlyUnlocked = await checkAndUnlockBadges(user.id);

    // Get badge details for newly unlocked badges
    const newBadges = newlyUnlocked
      .map((id) => {
        const badge = getBadgeById(id);
        return badge
          ? { id: badge.id, name: badge.name, icon: badge.icon }
          : null;
      })
      .filter((b): b is { id: string; name: string; icon: string } => b !== null);

    if (newBadges.length > 0) {
      revalidatePath("/profile");
      revalidatePath("/stats");
    }

    return { newBadges, error: null };
  } catch (error) {
    console.error("Error syncing badges:", error);
    return { newBadges: [], error: "An unexpected error occurred" };
  }
}

// Remove a badge (if user wants to hide it)
export async function removeBadge(badgeId: string): Promise<{
  success: boolean;
  error: string | null;
}> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Not authenticated" };
    }

    const { error } = await supabase
      .from("user_badges")
      .delete()
      .eq("user_id", user.id)
      .eq("badge_id", badgeId);

    if (error) {
      console.error("Error removing badge:", error);
      return { success: false, error: error.message };
    }

    revalidatePath("/profile");

    return { success: true, error: null };
  } catch (error) {
    console.error("Error removing badge:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}
