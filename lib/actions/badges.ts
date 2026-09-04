"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { checkAndUnlockBadges } from "@/lib/queries/badges";
import { getBadgeById } from "@/lib/data/badges";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import { logError } from "@/lib/utils/log";
import type { ActionResult } from "@/types/app";
// Sync badges for the current user (check and unlock any new badges)
export async function syncUserBadges(): Promise<
  ActionResult<{ newBadges: Array<{ id: string; name: string; icon: string }> }>
> {
  try {

    const auth = await requireUser();
    if (!auth.ok) {
      return { success: false, error: auth.error };
    }
    const { user } = auth;

    // Rate limit: 20 badge mutations per minute per user
    const { allowed } = await checkRateLimit(`badge:${user.id}`, 20, 60000);
    if (!allowed) {
      return { success: false, error: "Too many requests. Please wait a moment." };
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

    return { success: true, newBadges };
  } catch (error) {
    logError("Error syncing badges", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}
