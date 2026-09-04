"use server";

import { requireUser } from "@/lib/auth/require-user";
import { revalidatePath } from "next/cache";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import {
  createListSchema,
  addBookToListSchema,
  removeBookFromListSchema,
  listIdSchema,
} from "@/lib/validation/list";
import type { ListVisibility } from "@/types/database";
import { logError } from "@/lib/utils/log";
import type { ActionResult } from "@/types/app";

interface CreateListInput {
  title: string;
  description?: string;
  visibility?: ListVisibility;
}

export async function createList(
  input: CreateListInput
): Promise<ActionResult<{ listId: string }>> {
  const auth = await requireUser();
  if (!auth.ok) {
    return { success: false, error: auth.error };
  }
  const { supabase, user } = auth;

  // Rate limit: 10 list creations per minute per user
  const { allowed } = await checkRateLimit(`list:create:${user.id}`, 10, 60000);
  if (!allowed) {
    return { success: false, error: "Too many requests. Please wait a moment." };
  }

  // Validate input with Zod
  const validationResult = createListSchema.safeParse(input);
  if (!validationResult.success) {
    return {
      success: false,
      error: validationResult.error.issues[0]?.message || "Invalid input",
    };
  }

  const data = validationResult.data;

  // Generate slug
  const { data: slugData, error: slugError } = await supabase.rpc(
    "generate_list_slug",
    { list_title: data.title, owner_id: user.id }
  );

  if (slugError) {
    logError("Error generating slug", slugError);
    return { success: false, error: "Failed to create list" };
  }

  const slug = slugData as string;

  // Create list
  const { data: list, error: listError } = await supabase
    .from("reading_lists")
    .insert({
      user_id: user.id,
      title: data.title,
      slug,
      description: data.description || null,
      visibility: data.visibility || "public",
    })
    .select("id")
    .single();

  if (listError) {
    logError("Error creating list", listError);
    return { success: false, error: "Failed to create list" };
  }

  revalidatePath("/lists");
  return { success: true, listId: list.id };
}

export async function addBookToList(
  listId: string,
  bookId: string,
  note?: string
): Promise<ActionResult> {
  const auth = await requireUser();
  if (!auth.ok) {
    return { success: false, error: auth.error };
  }
  const { supabase, user } = auth;

  // Rate limit: 30 list-book toggles per minute per user
  const { allowed } = await checkRateLimit(`list:book:${user.id}`, 30, 60000);
  if (!allowed) {
    return { success: false, error: "Too many requests. Please wait a moment." };
  }

  // Validate input with Zod
  const validationResult = addBookToListSchema.safeParse({ listId, bookId, note });
  if (!validationResult.success) {
    return {
      success: false,
      error: validationResult.error.issues[0]?.message || "Invalid input",
    };
  }

  const data = validationResult.data;

  // Verify ownership
  const { data: list } = await supabase
    .from("reading_lists")
    .select("user_id")
    .eq("id", data.listId)
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
    list_id: data.listId,
    book_id: data.bookId,
    position,
    note: data.note || null,
  });

  if (error) {
    logError("Error adding book to list", error);
    return { success: false, error: "Failed to add book" };
  }

  revalidatePath("/lists");
  revalidatePath(`/lists/${listId}`);
  return { success: true };
}

export async function removeBookFromList(
  listId: string,
  bookId: string
): Promise<ActionResult> {
  const auth = await requireUser();
  if (!auth.ok) {
    return { success: false, error: auth.error };
  }
  const { supabase, user } = auth;

  // Rate limit: 30 list-book toggles per minute per user
  const { allowed } = await checkRateLimit(`list:book:${user.id}`, 30, 60000);
  if (!allowed) {
    return { success: false, error: "Too many requests. Please wait a moment." };
  }

  // Validate input with Zod
  const validationResult = removeBookFromListSchema.safeParse({ listId, bookId });
  if (!validationResult.success) {
    return {
      success: false,
      error: validationResult.error.issues[0]?.message || "Invalid input",
    };
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
    logError("Error removing book from list", error);
    return { success: false, error: "Failed to remove book" };
  }

  revalidatePath("/lists");
  revalidatePath(`/lists/${listId}`);
  return { success: true };
}

export async function likeList(
  listId: string
): Promise<ActionResult> {
  const auth = await requireUser();
  if (!auth.ok) {
    return { success: false, error: auth.error };
  }
  const { supabase, user } = auth;

  // Rate limit: 30 like toggles per minute per user
  const { allowed } = await checkRateLimit(`list:like:${user.id}`, 30, 60000);
  if (!allowed) {
    return { success: false, error: "Too many requests. Please wait a moment." };
  }

  // Validate input with Zod
  const validationResult = listIdSchema.safeParse(listId);
  if (!validationResult.success) {
    return {
      success: false,
      error: validationResult.error.issues[0]?.message || "Invalid input",
    };
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
      logError("Error unliking list", error);
      return { success: false, error: "Failed to unlike list" };
    }
  } else {
    // Like
    const { error } = await supabase.from("reading_list_likes").insert({
      list_id: listId,
      user_id: user.id,
    });

    if (error) {
      logError("Error liking list", error);
      return { success: false, error: "Failed to like list" };
    }
  }

  revalidatePath("/lists");
  return { success: true };
}
