"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { ListVisibility } from "@/types/database";

interface CreateListInput {
  title: string;
  description?: string;
  visibility?: ListVisibility;
}

export async function createList(
  input: CreateListInput
): Promise<{ success: boolean; listId?: string; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Validate title
  if (!input.title || input.title.trim().length < 3) {
    return { success: false, error: "List title must be at least 3 characters" };
  }

  if (input.title.length > 100) {
    return { success: false, error: "List title must be less than 100 characters" };
  }

  // Generate slug
  const { data: slugData, error: slugError } = await supabase.rpc(
    "generate_list_slug",
    { list_title: input.title.trim(), owner_id: user.id }
  );

  if (slugError) {
    console.error("Error generating slug:", slugError);
    return { success: false, error: "Failed to create list" };
  }

  const slug = slugData as string;

  // Create list
  const { data: list, error: listError } = await supabase
    .from("reading_lists")
    .insert({
      user_id: user.id,
      title: input.title.trim(),
      slug,
      description: input.description?.trim() || null,
      visibility: input.visibility || "public",
    })
    .select("id")
    .single();

  if (listError) {
    console.error("Error creating list:", listError);
    return { success: false, error: "Failed to create list" };
  }

  revalidatePath("/lists");
  return { success: true, listId: list.id };
}

export async function updateList(
  listId: string,
  updates: { title?: string; description?: string; visibility?: ListVisibility }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Verify ownership
  const { data: list } = await supabase
    .from("reading_lists")
    .select("user_id")
    .eq("id", listId)
    .single();

  if (!list || list.user_id !== user.id) {
    return { success: false, error: "Not authorized" };
  }

  const updateData: Record<string, unknown> = {};
  if (updates.title) updateData.title = updates.title.trim();
  if (updates.description !== undefined) updateData.description = updates.description?.trim() || null;
  if (updates.visibility) updateData.visibility = updates.visibility;

  const { error } = await supabase
    .from("reading_lists")
    .update(updateData)
    .eq("id", listId);

  if (error) {
    console.error("Error updating list:", error);
    return { success: false, error: "Failed to update list" };
  }

  revalidatePath("/lists");
  return { success: true };
}

export async function deleteList(
  listId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("reading_lists")
    .delete()
    .eq("id", listId)
    .eq("user_id", user.id);

  if (error) {
    console.error("Error deleting list:", error);
    return { success: false, error: "Failed to delete list" };
  }

  revalidatePath("/lists");
  return { success: true };
}

export async function addBookToList(
  listId: string,
  bookId: string,
  note?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Verify ownership
  const { data: list } = await supabase
    .from("reading_lists")
    .select("user_id")
    .eq("id", listId)
    .single();

  if (!list || list.user_id !== user.id) {
    return { success: false, error: "Not authorized" };
  }

  // Get next position
  const { data: lastBook } = await supabase
    .from("reading_list_books")
    .select("position")
    .eq("list_id", listId)
    .order("position", { ascending: false })
    .limit(1)
    .single();

  const position = (lastBook?.position || 0) + 1;

  // Check if book already in list
  const { data: existing } = await supabase
    .from("reading_list_books")
    .select("list_id")
    .eq("list_id", listId)
    .eq("book_id", bookId)
    .single();

  if (existing) {
    return { success: false, error: "Book already in list" };
  }

  // Add book
  const { error } = await supabase.from("reading_list_books").insert({
    list_id: listId,
    book_id: bookId,
    position,
    note: note?.trim() || null,
  });

  if (error) {
    console.error("Error adding book to list:", error);
    return { success: false, error: "Failed to add book" };
  }

  revalidatePath("/lists");
  revalidatePath(`/lists/${listId}`);
  return { success: true };
}

export async function removeBookFromList(
  listId: string,
  bookId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Verify ownership
  const { data: list } = await supabase
    .from("reading_lists")
    .select("user_id")
    .eq("id", listId)
    .single();

  if (!list || list.user_id !== user.id) {
    return { success: false, error: "Not authorized" };
  }

  const { error } = await supabase
    .from("reading_list_books")
    .delete()
    .eq("list_id", listId)
    .eq("book_id", bookId);

  if (error) {
    console.error("Error removing book from list:", error);
    return { success: false, error: "Failed to remove book" };
  }

  revalidatePath("/lists");
  revalidatePath(`/lists/${listId}`);
  return { success: true };
}

export async function likeList(
  listId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  // Check if already liked
  const { data: existing } = await supabase
    .from("reading_list_likes")
    .select("list_id")
    .eq("list_id", listId)
    .eq("user_id", user.id)
    .single();

  if (existing) {
    // Unlike
    const { error } = await supabase
      .from("reading_list_likes")
      .delete()
      .eq("list_id", listId)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error unliking list:", error);
      return { success: false, error: "Failed to unlike list" };
    }
  } else {
    // Like
    const { error } = await supabase.from("reading_list_likes").insert({
      list_id: listId,
      user_id: user.id,
    });

    if (error) {
      console.error("Error liking list:", error);
      return { success: false, error: "Failed to like list" };
    }
  }

  revalidatePath("/lists");
  return { success: true };
}
