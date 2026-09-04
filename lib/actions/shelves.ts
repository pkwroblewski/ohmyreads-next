"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import {
  createShelfSchema,
  updateShelfSchema,
  updateBookShelvesSchema,
  updateBookShelvesByBookIdSchema,
  shelfIdSchema,
  userBookIdSchema,
} from "@/lib/validation/shelf";
import type { UserShelf, UserShelfWithCount } from "@/types/database";
import { logError, reportError } from "@/lib/utils/log";
import type { ActionResult } from "@/types/app";
import type { createClient } from "@/lib/supabase/server";
// The two authorization failures set_book_shelves raises deliberately. Anything
// else coming back from the RPC is an unexpected DB error and must not reach
// the client verbatim.
const SHELF_RPC_USER_ERRORS = new Set([
  "Book not found in your shelf",
  "One or more shelves not found",
]);

/**
 * Reconcile a book's shelf assignments in a single transaction via the
 * set_book_shelves RPC (migration 057). Returns a user-safe error string, or
 * null on success.
 */
async function setBookShelves(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userBookId: string,
  shelfIds: string[]
): Promise<string | null> {
  const { error } = await supabase.rpc("set_book_shelves", {
    p_user_book_id: userBookId,
    p_shelf_ids: shelfIds,
  });

  if (!error) return null;

  if (SHELF_RPC_USER_ERRORS.has(error.message)) {
    return error.message;
  }

  return reportError("Error updating book shelves", error, { userBookId });
}

// ============================================
// SHELF MANAGEMENT
// ============================================

/**
 * Get all shelves for the current user
 */
export async function getUserShelves(): Promise<ActionResult<{ shelves: UserShelfWithCount[] }>> {
  try {
    const auth = await requireUser();
    if (!auth.ok) {
      return { success: false, error: auth.error };
    }
    const { supabase, user } = auth;

    // Get shelves with book counts
    const { data: shelves, error } = await supabase
      .from("user_shelves")
      .select(`
        *,
        shelf_books(count)
      `)
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true });

    if (error) {
      return { success: false, error: reportError("Error fetching shelves", error) };
    }

    // Transform to include book_count
    const shelvesWithCount: UserShelfWithCount[] = (shelves || []).map(
      (shelf) => ({
        ...shelf,
        book_count: shelf.shelf_books?.[0]?.count || 0,
      })
    );

    return { success: true, shelves: shelvesWithCount };
  } catch (error) {
    logError("Error in getUserShelves", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Create a new shelf
 */
export async function createShelf(input: {
  name: string;
  description?: string;
  isPublic?: boolean;
  color?: string;
  icon?: string;
}): Promise<ActionResult<{ shelf: UserShelf }>> {
  try {
    const auth = await requireUser();
    if (!auth.ok) {
      return { success: false, error: auth.error };
    }
    const { supabase, user } = auth;

    // Rate limit: 10 shelf creations per minute per user
    const { allowed } = await checkRateLimit(`shelf:create:${user.id}`, 10, 60000);
    if (!allowed) {
      return { success: false, error: "Too many requests. Please wait a moment." };
    }

    // Validate input with Zod
    const validationResult = createShelfSchema.safeParse(input);
    if (!validationResult.success) {
      return {
        success: false,
        error: validationResult.error.issues[0]?.message || "Invalid input",
      };
    }

    const { name, ...data } = validationResult.data;

    // Check if shelf with this name already exists
    const { data: existing } = await supabase
      .from("user_shelves")
      .select("id")
      .eq("user_id", user.id)
      .eq("name", name)
      .single();

    if (existing) {
      return { success: false, error: "You already have a shelf with this name" };
    }

    // Get next sort order
    const { data: lastShelf } = await supabase
      .from("user_shelves")
      .select("sort_order")
      .eq("user_id", user.id)
      .order("sort_order", { ascending: false })
      .limit(1)
      .single();

    const sortOrder = (lastShelf?.sort_order || 0) + 1;

    // Create shelf
    const { data: shelf, error } = await supabase
      .from("user_shelves")
      .insert({
        user_id: user.id,
        name,
        description: data.description || null,
        is_public: data.isPublic ?? true,
        color: data.color || null,
        icon: data.icon || null,
        sort_order: sortOrder,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: reportError("Error creating shelf", error) };
    }

    revalidatePath("/my-shelf");

    return { success: true, shelf };
  } catch (error) {
    logError("Error in createShelf", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Update a shelf
 */
export async function updateShelf(input: {
  shelfId: string;
  name?: string;
  description?: string;
  isPublic?: boolean;
  color?: string;
  icon?: string;
}): Promise<ActionResult> {
  try {
    const auth = await requireUser();
    if (!auth.ok) {
      return { success: false, error: auth.error };
    }
    const { supabase, user } = auth;

    // Rate limit: 20 shelf updates per minute per user
    const { allowed } = await checkRateLimit(`shelf:update:${user.id}`, 20, 60000);
    if (!allowed) {
      return { success: false, error: "Too many requests. Please wait a moment." };
    }

    // Validate input with Zod
    const validationResult = updateShelfSchema.safeParse(input);
    if (!validationResult.success) {
      return {
        success: false,
        error: validationResult.error.issues[0]?.message || "Invalid input",
      };
    }

    const data = validationResult.data;

    // Verify ownership
    const { data: shelf } = await supabase
      .from("user_shelves")
      .select("user_id")
      .eq("id", data.shelfId)
      .single();

    if (!shelf || shelf.user_id !== user.id) {
      return { success: false, error: "Shelf not found or not authorized" };
    }

    // Build update object
    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) {
      updateData.name = data.name;
    }

    if (data.description !== undefined) {
      updateData.description = data.description || null;
    }

    if (data.isPublic !== undefined) {
      updateData.is_public = data.isPublic;
    }

    if (data.color !== undefined) {
      updateData.color = data.color || null;
    }

    if (data.icon !== undefined) {
      updateData.icon = data.icon || null;
    }

    if (Object.keys(updateData).length === 0) {
      return { success: true }; // Nothing to update
    }

    const { error } = await supabase
      .from("user_shelves")
      .update(updateData)
      .eq("id", data.shelfId);

    if (error) {
      return { success: false, error: reportError("Error updating shelf", error) };
    }

    revalidatePath("/my-shelf");

    return { success: true };
  } catch (error) {
    logError("Error in updateShelf", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Delete a shelf
 */
export async function deleteShelf(
  shelfId: string
): Promise<ActionResult> {
  try {
    const auth = await requireUser();
    if (!auth.ok) {
      return { success: false, error: auth.error };
    }
    const { supabase, user } = auth;

    // Rate limit: 20 shelf deletes per minute per user
    const { allowed } = await checkRateLimit(`shelf:delete:${user.id}`, 20, 60000);
    if (!allowed) {
      return { success: false, error: "Too many requests. Please wait a moment." };
    }

    // Validate input with Zod
    const validationResult = shelfIdSchema.safeParse(shelfId);
    if (!validationResult.success) {
      return {
        success: false,
        error: validationResult.error.issues[0]?.message || "Invalid input",
      };
    }

    // Verify ownership
    const { data: shelf } = await supabase
      .from("user_shelves")
      .select("user_id")
      .eq("id", shelfId)
      .single();

    if (!shelf || shelf.user_id !== user.id) {
      return { success: false, error: "Shelf not found or not authorized" };
    }

    // Delete shelf (cascade will remove shelf_books entries)
    const { error } = await supabase
      .from("user_shelves")
      .delete()
      .eq("id", shelfId);

    if (error) {
      return { success: false, error: reportError("Error deleting shelf", error) };
    }

    revalidatePath("/my-shelf");

    return { success: true };
  } catch (error) {
    logError("Error in deleteShelf", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

// ============================================
// SHELF BOOK MANAGEMENT
// ============================================

/**
 * Get shelves a specific book is on
 */
export async function getBookShelves(
  userBookId: string
): Promise<ActionResult<{ shelfIds: string[] }>> {
  try {
    const auth = await requireUser();
    if (!auth.ok) {
      return { success: false, error: auth.error };
    }
    const { supabase } = auth;

    // Validate id param
    if (!userBookIdSchema.safeParse(userBookId).success) {
      return { success: false, error: "Invalid book ID" };
    }

    const { data: shelfBooks, error } = await supabase
      .from("shelf_books")
      .select("shelf_id")
      .eq("user_book_id", userBookId);

    if (error) {
      return { success: false, error: reportError("Error fetching book shelves", error) };
    }

    return {
      success: true,
      shelfIds: (shelfBooks || []).map((sb) => sb.shelf_id),
    };
  } catch (error) {
    logError("Error in getBookShelves", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Update book's shelf assignments (batch operation)
 */
export async function updateBookShelves(input: {
  userBookId: string;
  shelfIds: string[];
}): Promise<ActionResult> {
  try {
    const auth = await requireUser();
    if (!auth.ok) {
      return { success: false, error: auth.error };
    }
    const { supabase, user } = auth;

    // Rate limit: 30 shelf-book toggles per minute per user
    const { allowed } = await checkRateLimit(`shelf:book:${user.id}`, 30, 60000);
    if (!allowed) {
      return { success: false, error: "Too many requests. Please wait a moment." };
    }

    // Validate input with Zod
    const validationResult = updateBookShelvesSchema.safeParse(input);
    if (!validationResult.success) {
      return {
        success: false,
        error: validationResult.error.issues[0]?.message || "Invalid input",
      };
    }

    const data = validationResult.data;

    // Ownership checks, removes and adds all happen inside set_book_shelves
    // (migration 057). Doing this as two statements meant a failed insert left
    // the book stripped from shelves the remove had already committed.
    const rpcError = await setBookShelves(supabase, data.userBookId, data.shelfIds);
    if (rpcError) {
      return { success: false, error: rpcError };
    }

    revalidatePath("/my-shelf");

    return { success: true };
  } catch (error) {
    logError("Error in updateBookShelves", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Get shelves a book is on by book ID (not user_book_id)
 */
export async function getBookShelvesByBookId(
  bookId: string
): Promise<ActionResult<{ shelfIds: string[]; userBookId?: string }>> {
  try {
    const auth = await requireUser();
    if (!auth.ok) {
      return { success: false, error: auth.error };
    }
    const { supabase, user } = auth;

    // Validate id param
    if (!userBookIdSchema.safeParse(bookId).success) {
      return { success: false, error: "Invalid book ID" };
    }

    // Get user_book for this book
    const { data: userBook } = await supabase
      .from("user_books")
      .select("id")
      .eq("user_id", user.id)
      .eq("book_id", bookId)
      .single();

    if (!userBook) {
      // Book not in user's library yet
      return { success: true, shelfIds: [] };
    }

    // Get shelf assignments
    const { data: shelfBooks, error } = await supabase
      .from("shelf_books")
      .select("shelf_id")
      .eq("user_book_id", userBook.id);

    if (error) {
      return { success: false, error: reportError("Error fetching book shelves", error) };
    }

    return {
      success: true,
      shelfIds: (shelfBooks || []).map((sb) => sb.shelf_id),
      userBookId: userBook.id,
    };
  } catch (error) {
    logError("Error in getBookShelvesByBookId", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

/**
 * Update book's shelf assignments by book ID (batch operation)
 * Auto-creates user_books entry if needed
 */
export async function updateBookShelvesByBookId(input: {
  bookId: string;
  shelfIds: string[];
}): Promise<ActionResult<{ userBookId?: string }>> {
  try {
    const auth = await requireUser();
    if (!auth.ok) {
      return { success: false, error: auth.error };
    }
    const { supabase, user } = auth;

    // Rate limit: 30 shelf-book toggles per minute per user
    const { allowed } = await checkRateLimit(`shelf:book:${user.id}`, 30, 60000);
    if (!allowed) {
      return { success: false, error: "Too many requests. Please wait a moment." };
    }

    // Validate input with Zod
    const validationResult = updateBookShelvesByBookIdSchema.safeParse(input);
    if (!validationResult.success) {
      return {
        success: false,
        error: validationResult.error.issues[0]?.message || "Invalid input",
      };
    }

    const data = validationResult.data;

    // Get or create user_book entry
    let userBookId: string;
    const { data: existingUserBook } = await supabase
      .from("user_books")
      .select("id")
      .eq("user_id", user.id)
      .eq("book_id", data.bookId)
      .single();

    if (existingUserBook) {
      userBookId = existingUserBook.id;
    } else if (data.shelfIds.length > 0) {
      // Only create if we're adding to at least one shelf
      const { data: newUserBook, error: createError } = await supabase
        .from("user_books")
        .insert({
          user_id: user.id,
          book_id: data.bookId,
          status: "want_to_read",
        })
        .select("id")
        .single();

      if (createError) {
        logError("Error creating user_book", createError);
        return { success: false, error: "Failed to add book to your library" };
      }

      userBookId = newUserBook.id;
    } else {
      // No shelves to add and no existing user_book - nothing to do
      return { success: true };
    }

    // Same atomic reconciliation as updateBookShelves (migration 057)
    const rpcError = await setBookShelves(supabase, userBookId, data.shelfIds);
    if (rpcError) {
      return { success: false, error: rpcError };
    }

    revalidatePath("/my-shelf");

    return { success: true, userBookId };
  } catch (error) {
    logError("Error in updateBookShelvesByBookId", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}
