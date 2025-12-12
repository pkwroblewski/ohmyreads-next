"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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

    if (targetBooks < 1 || targetBooks > 1000) {
      return { error: "Goal must be between 1 and 1000 books" };
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

