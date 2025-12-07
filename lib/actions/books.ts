"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addToShelf(bookId: string, status: string) {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: "Not authenticated" };
    }

    // Validate status
    const validStatuses = ["want_to_read", "reading", "read"];
    if (!validStatuses.includes(status)) {
      return { error: "Invalid status" };
    }

    // Prepare data
    const now = new Date().toISOString();
    const data: Record<string, string> = {
      user_id: user.id,
      book_id: bookId,
      status,
      updated_at: now,
    };

    // Set timestamps based on status
    if (status === "reading") {
      data.started_at = now;
    } else if (status === "read") {
      data.finished_at = now;
    }

    // Upsert (insert or update on conflict)
    const { error } = await supabase.from("user_books").upsert(data, {
      onConflict: "user_id,book_id",
      ignoreDuplicates: false,
    });

    if (error) {
      console.error("Error adding to shelf:", error);
      return { error: error.message };
    }

    // Revalidate affected pages
    revalidatePath("/dashboard");
    revalidatePath("/my-shelf");

    return { success: true };
  } catch (error) {
    console.error("Error in addToShelf:", error);
    return { error: "An unexpected error occurred" };
  }
}

export async function removeFromShelf(bookId: string) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: "Not authenticated" };
    }

    const { error } = await supabase
      .from("user_books")
      .delete()
      .eq("user_id", user.id)
      .eq("book_id", bookId);

    if (error) {
      console.error("Error removing from shelf:", error);
      return { error: error.message };
    }

    revalidatePath("/dashboard");
    revalidatePath("/my-shelf");

    return { success: true };
  } catch (error) {
    console.error("Error in removeFromShelf:", error);
    return { error: "An unexpected error occurred" };
  }
}

