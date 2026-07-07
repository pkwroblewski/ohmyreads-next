"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import { updateReadingGoalSchema } from "@/lib/validation/goal";

export async function updateReadingGoal(targetBooks: number) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return { error: "Not authenticated" };
    }

    // Rate limit: 10 goal updates per minute per user
    const { allowed } = await checkRateLimit(`goal:${user.id}`, 10, 60000);
    if (!allowed) {
      return { error: "Too many requests. Please wait a moment." };
    }

    // Validate input with Zod
    const validationResult = updateReadingGoalSchema.safeParse(targetBooks);
    if (!validationResult.success) {
      return {
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
      console.error("Error updating reading goal:", error);
      return { error: error.message };
    }

    revalidatePath("/stats");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    console.error("Unexpected error in updateReadingGoal:", error);
    return { error: "An unexpected error occurred" };
  }
}

