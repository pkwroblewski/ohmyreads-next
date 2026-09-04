"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import { updateReadingGoalSchema } from "@/lib/validation/goal";
import { logError, reportError } from "@/lib/utils/log";
import type { ActionResult } from "@/types/app";
export async function updateReadingGoal(targetBooks: number): Promise<ActionResult> {
  try {
    const auth = await requireUser();
    if (!auth.ok) {
      return { success: false, error: auth.error };
    }
    const { supabase, user } = auth;

    // Rate limit: 10 goal updates per minute per user
    const { allowed } = await checkRateLimit(`goal:${user.id}`, 10, 60000);
    if (!allowed) {
      return { success: false, error: "Too many requests. Please wait a moment." };
    }

    // Validate input with Zod
    const validationResult = updateReadingGoalSchema.safeParse(targetBooks);
    if (!validationResult.success) {
      return {
        success: false,
        error: validationResult.error.issues[0]?.message || "Invalid input",
      };
    }

    const currentYear = new Date().getFullYear();

    // Upsert the goal
    const { error } = await supabase.from("reading_goals").upsert(
      {
        user_id: user.id,
        year: currentYear,
        target_books: targetBooks,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,year",
      }
    );

    if (error) {
      return { success: false, error: reportError("Error updating reading goal", error) };
    }

    revalidatePath("/stats");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    logError("Unexpected error in updateReadingGoal", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

