"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { UserShelf, UserShelfWithCount } from "@/types/database";

// ============================================
// SHELF MANAGEMENT
// ============================================

/**
 * Get all shelves for the current user
 */
export async function getUserShelves(): Promise<{
  shelves: UserShelfWithCount[];
  error?: string;
}> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { shelves: [], error: "Not authenticated" };
    }

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
      console.error("Error fetching shelves:", error);
      return { shelves: [], error: error.message };
    }

    // Transform to include book_count
    const shelvesWithCount: UserShelfWithCount[] = (shelves || []).map(
      (shelf) => ({
        ...shelf,
        book_count: shelf.shelf_books?.[0]?.count || 0,
      })
    );

    return { shelves: shelvesWithCount };
  } catch (error) {
    console.error("Error in getUserShelves:", error);
    return { shelves: [], error: "An unexpected error occurred" };
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
}): Promise<{ shelf?: UserShelf; error?: string }> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Not authenticated" };
    }

    // Validate name
    const name = input.name.trim();
    if (!name || name.length > 100) {
      return { error: "Shelf name must be 1-100 characters" };
    }

    // Check if shelf with this name already exists
    const { data: existing } = await supabase
      .from("user_shelves")
      .select("id")
      .eq("user_id", user.id)
      .eq("name", name)
      .single();

    if (existing) {
      return { error: "You already have a shelf with this name" };
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
        description: input.description?.trim() || null,
        is_public: input.isPublic ?? true,
        color: input.color || null,
        icon: input.icon || null,
        sort_order: sortOrder,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating shelf:", error);
      return { error: error.message };
    }

    revalidatePath("/my-shelf");

    return { shelf };
  } catch (error) {
    console.error("Error in createShelf:", error);
    return { error: "An unexpected error occurred" };
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
}): Promise<{ success?: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Not authenticated" };
    }

    // Verify ownership
    const { data: shelf } = await supabase
      .from("user_shelves")
      .select("user_id")
      .eq("id", input.shelfId)
      .single();

    if (!shelf || shelf.user_id !== user.id) {
      return { error: "Shelf not found or not authorized" };
    }

    // Build update object
    const updateData: Record<string, unknown> = {};

    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name || name.length > 100) {
        return { error: "Shelf name must be 1-100 characters" };
      }
      updateData.name = name;
    }

    if (input.description !== undefined) {
      updateData.description = input.description.trim() || null;
    }

    if (input.isPublic !== undefined) {
      updateData.is_public = input.isPublic;
    }

    if (input.color !== undefined) {
      updateData.color = input.color || null;
    }

    if (input.icon !== undefined) {
      updateData.icon = input.icon || null;
    }

    if (Object.keys(updateData).length === 0) {
      return { success: true }; // Nothing to update
    }

    const { error } = await supabase
      .from("user_shelves")
      .update(updateData)
      .eq("id", input.shelfId);

    if (error) {
      console.error("Error updating shelf:", error);
      return { error: error.message };
    }

    revalidatePath("/my-shelf");

    return { success: true };
  } catch (error) {
    console.error("Error in updateShelf:", error);
    return { error: "An unexpected error occurred" };
  }
}

/**
 * Delete a shelf
 */
export async function deleteShelf(
  shelfId: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Not authenticated" };
    }

    // Verify ownership
    const { data: shelf } = await supabase
      .from("user_shelves")
      .select("user_id")
      .eq("id", shelfId)
      .single();

    if (!shelf || shelf.user_id !== user.id) {
      return { error: "Shelf not found or not authorized" };
    }

    // Delete shelf (cascade will remove shelf_books entries)
    const { error } = await supabase
      .from("user_shelves")
      .delete()
      .eq("id", shelfId);

    if (error) {
      console.error("Error deleting shelf:", error);
      return { error: error.message };
    }

    revalidatePath("/my-shelf");

    return { success: true };
  } catch (error) {
    console.error("Error in deleteShelf:", error);
    return { error: "An unexpected error occurred" };
  }
}

// ============================================
// SHELF BOOK MANAGEMENT
// ============================================

/**
 * Add a book to a shelf
 */
export async function addBookToShelf(input: {
  shelfId: string;
  userBookId: string;
  notes?: string;
}): Promise<{ success?: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Not authenticated" };
    }

    // Verify shelf ownership
    const { data: shelf } = await supabase
      .from("user_shelves")
      .select("user_id")
      .eq("id", input.shelfId)
      .single();

    if (!shelf || shelf.user_id !== user.id) {
      return { error: "Shelf not found or not authorized" };
    }

    // Verify user_book ownership
    const { data: userBook } = await supabase
      .from("user_books")
      .select("user_id")
      .eq("id", input.userBookId)
      .single();

    if (!userBook || userBook.user_id !== user.id) {
      return { error: "Book not found in your shelf" };
    }

    // Add to shelf
    const { error } = await supabase.from("shelf_books").insert({
      shelf_id: input.shelfId,
      user_book_id: input.userBookId,
      notes: input.notes?.trim() || null,
    });

    if (error) {
      if (error.code === "23505") {
        // Unique constraint violation
        return { error: "Book is already on this shelf" };
      }
      console.error("Error adding book to shelf:", error);
      return { error: error.message };
    }

    revalidatePath("/my-shelf");

    return { success: true };
  } catch (error) {
    console.error("Error in addBookToShelf:", error);
    return { error: "An unexpected error occurred" };
  }
}

/**
 * Remove a book from a shelf
 */
export async function removeBookFromShelf(input: {
  shelfId: string;
  userBookId: string;
}): Promise<{ success?: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Not authenticated" };
    }

    // Verify shelf ownership
    const { data: shelf } = await supabase
      .from("user_shelves")
      .select("user_id")
      .eq("id", input.shelfId)
      .single();

    if (!shelf || shelf.user_id !== user.id) {
      return { error: "Shelf not found or not authorized" };
    }

    // Remove from shelf
    const { error } = await supabase
      .from("shelf_books")
      .delete()
      .eq("shelf_id", input.shelfId)
      .eq("user_book_id", input.userBookId);

    if (error) {
      console.error("Error removing book from shelf:", error);
      return { error: error.message };
    }

    revalidatePath("/my-shelf");

    return { success: true };
  } catch (error) {
    console.error("Error in removeBookFromShelf:", error);
    return { error: "An unexpected error occurred" };
  }
}

/**
 * Get shelves a specific book is on
 */
export async function getBookShelves(
  userBookId: string
): Promise<{ shelfIds: string[]; error?: string }> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { shelfIds: [], error: "Not authenticated" };
    }

    const { data: shelfBooks, error } = await supabase
      .from("shelf_books")
      .select("shelf_id")
      .eq("user_book_id", userBookId);

    if (error) {
      console.error("Error fetching book shelves:", error);
      return { shelfIds: [], error: error.message };
    }

    return {
      shelfIds: (shelfBooks || []).map((sb) => sb.shelf_id),
    };
  } catch (error) {
    console.error("Error in getBookShelves:", error);
    return { shelfIds: [], error: "An unexpected error occurred" };
  }
}

/**
 * Update book's shelf assignments (batch operation)
 */
export async function updateBookShelves(input: {
  userBookId: string;
  shelfIds: string[];
}): Promise<{ success?: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Not authenticated" };
    }

    // Verify user_book ownership
    const { data: userBook } = await supabase
      .from("user_books")
      .select("user_id")
      .eq("id", input.userBookId)
      .single();

    if (!userBook || userBook.user_id !== user.id) {
      return { error: "Book not found in your shelf" };
    }

    // Get user's shelves to verify they own all the target shelves
    const { data: userShelves } = await supabase
      .from("user_shelves")
      .select("id")
      .eq("user_id", user.id);

    const userShelfIds = new Set((userShelves || []).map((s) => s.id));

    // Verify all target shelves belong to user
    for (const shelfId of input.shelfIds) {
      if (!userShelfIds.has(shelfId)) {
        return { error: "One or more shelves not found" };
      }
    }

    // Get current shelf assignments
    const { data: currentShelfBooks } = await supabase
      .from("shelf_books")
      .select("shelf_id")
      .eq("user_book_id", input.userBookId);

    const currentShelfIds = new Set(
      (currentShelfBooks || []).map((sb) => sb.shelf_id)
    );
    const targetShelfIds = new Set(input.shelfIds);

    // Determine adds and removes
    const toAdd = input.shelfIds.filter((id) => !currentShelfIds.has(id));
    const toRemove = Array.from(currentShelfIds).filter(
      (id) => !targetShelfIds.has(id)
    );

    // Remove from shelves
    if (toRemove.length > 0) {
      const { error: removeError } = await supabase
        .from("shelf_books")
        .delete()
        .eq("user_book_id", input.userBookId)
        .in("shelf_id", toRemove);

      if (removeError) {
        console.error("Error removing from shelves:", removeError);
        return { error: removeError.message };
      }
    }

    // Add to shelves
    if (toAdd.length > 0) {
      const { error: addError } = await supabase.from("shelf_books").insert(
        toAdd.map((shelfId) => ({
          shelf_id: shelfId,
          user_book_id: input.userBookId,
        }))
      );

      if (addError) {
        console.error("Error adding to shelves:", addError);
        return { error: addError.message };
      }
    }

    revalidatePath("/my-shelf");

    return { success: true };
  } catch (error) {
    console.error("Error in updateBookShelves:", error);
    return { error: "An unexpected error occurred" };
  }
}

/**
 * Add a book to a shelf by book ID (auto-creates user_books entry if needed)
 * This allows adding books to custom shelves directly from the book page
 */
export async function addBookToShelfByBookId(input: {
  shelfId: string;
  bookId: string;
}): Promise<{ success?: boolean; userBookId?: string; error?: string }> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Not authenticated" };
    }

    // Verify shelf ownership
    const { data: shelf } = await supabase
      .from("user_shelves")
      .select("user_id")
      .eq("id", input.shelfId)
      .single();

    if (!shelf || shelf.user_id !== user.id) {
      return { error: "Shelf not found or not authorized" };
    }

    // Check if user already has this book in user_books
    let userBookId: string;
    const { data: existingUserBook } = await supabase
      .from("user_books")
      .select("id")
      .eq("user_id", user.id)
      .eq("book_id", input.bookId)
      .single();

    if (existingUserBook) {
      userBookId = existingUserBook.id;
    } else {
      // Create user_books entry with "want_to_read" status
      const { data: newUserBook, error: createError } = await supabase
        .from("user_books")
        .insert({
          user_id: user.id,
          book_id: input.bookId,
          status: "want_to_read",
        })
        .select("id")
        .single();

      if (createError) {
        console.error("Error creating user_book:", createError);
        return { error: "Failed to add book to your library" };
      }

      userBookId = newUserBook.id;
    }

    // Add to shelf (handle duplicate gracefully)
    const { error: shelfError } = await supabase.from("shelf_books").insert({
      shelf_id: input.shelfId,
      user_book_id: userBookId,
    });

    if (shelfError) {
      if (shelfError.code === "23505") {
        // Unique constraint - already on shelf
        return { error: "Book is already on this shelf" };
      }
      console.error("Error adding book to shelf:", shelfError);
      return { error: shelfError.message };
    }

    revalidatePath("/my-shelf");

    return { success: true, userBookId };
  } catch (error) {
    console.error("Error in addBookToShelfByBookId:", error);
    return { error: "An unexpected error occurred" };
  }
}

/**
 * Get shelves a book is on by book ID (not user_book_id)
 */
export async function getBookShelvesByBookId(
  bookId: string
): Promise<{ shelfIds: string[]; userBookId?: string; error?: string }> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { shelfIds: [], error: "Not authenticated" };
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
      return { shelfIds: [] };
    }

    // Get shelf assignments
    const { data: shelfBooks, error } = await supabase
      .from("shelf_books")
      .select("shelf_id")
      .eq("user_book_id", userBook.id);

    if (error) {
      console.error("Error fetching book shelves:", error);
      return { shelfIds: [], userBookId: userBook.id, error: error.message };
    }

    return {
      shelfIds: (shelfBooks || []).map((sb) => sb.shelf_id),
      userBookId: userBook.id,
    };
  } catch (error) {
    console.error("Error in getBookShelvesByBookId:", error);
    return { shelfIds: [], error: "An unexpected error occurred" };
  }
}

/**
 * Update book's shelf assignments by book ID (batch operation)
 * Auto-creates user_books entry if needed
 */
export async function updateBookShelvesByBookId(input: {
  bookId: string;
  shelfIds: string[];
}): Promise<{ success?: boolean; userBookId?: string; error?: string }> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Not authenticated" };
    }

    // Get or create user_book entry
    let userBookId: string;
    const { data: existingUserBook } = await supabase
      .from("user_books")
      .select("id")
      .eq("user_id", user.id)
      .eq("book_id", input.bookId)
      .single();

    if (existingUserBook) {
      userBookId = existingUserBook.id;
    } else if (input.shelfIds.length > 0) {
      // Only create if we're adding to at least one shelf
      const { data: newUserBook, error: createError } = await supabase
        .from("user_books")
        .insert({
          user_id: user.id,
          book_id: input.bookId,
          status: "want_to_read",
        })
        .select("id")
        .single();

      if (createError) {
        console.error("Error creating user_book:", createError);
        return { error: "Failed to add book to your library" };
      }

      userBookId = newUserBook.id;
    } else {
      // No shelves to add and no existing user_book - nothing to do
      return { success: true };
    }

    // Get user's shelves to verify ownership
    const { data: userShelves } = await supabase
      .from("user_shelves")
      .select("id")
      .eq("user_id", user.id);

    const userShelfIds = new Set((userShelves || []).map((s) => s.id));

    // Verify all target shelves belong to user
    for (const shelfId of input.shelfIds) {
      if (!userShelfIds.has(shelfId)) {
        return { error: "One or more shelves not found" };
      }
    }

    // Get current shelf assignments
    const { data: currentShelfBooks } = await supabase
      .from("shelf_books")
      .select("shelf_id")
      .eq("user_book_id", userBookId);

    const currentShelfIds = new Set(
      (currentShelfBooks || []).map((sb) => sb.shelf_id)
    );
    const targetShelfIds = new Set(input.shelfIds);

    // Determine adds and removes
    const toAdd = input.shelfIds.filter((id) => !currentShelfIds.has(id));
    const toRemove = Array.from(currentShelfIds).filter(
      (id) => !targetShelfIds.has(id)
    );

    // Remove from shelves
    if (toRemove.length > 0) {
      const { error: removeError } = await supabase
        .from("shelf_books")
        .delete()
        .eq("user_book_id", userBookId)
        .in("shelf_id", toRemove);

      if (removeError) {
        console.error("Error removing from shelves:", removeError);
        return { error: removeError.message };
      }
    }

    // Add to shelves
    if (toAdd.length > 0) {
      const { error: addError } = await supabase.from("shelf_books").insert(
        toAdd.map((shelfId) => ({
          shelf_id: shelfId,
          user_book_id: userBookId,
        }))
      );

      if (addError) {
        console.error("Error adding to shelves:", addError);
        return { error: addError.message };
      }
    }

    revalidatePath("/my-shelf");

    return { success: true, userBookId };
  } catch (error) {
    console.error("Error in updateBookShelvesByBookId:", error);
    return { error: "An unexpected error occurred" };
  }
}

/**
 * Get books in a specific shelf
 */
export async function getShelfBooks(shelfId: string): Promise<{
  books: Array<{
    id: string;
    user_book_id: string;
    book_id: string;
    title: string;
    author: string;
    slug: string;
    cover_url: string | null;
    status: string;
    added_at: string;
  }>;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    // First get shelf_books
    const { data: shelfBooks, error } = await supabase
      .from("shelf_books")
      .select("id, added_at, user_book_id")
      .eq("shelf_id", shelfId)
      .order("added_at", { ascending: false });

    if (error) {
      console.error("Error fetching shelf books:", error);
      return { books: [], error: error.message };
    }

    if (!shelfBooks || shelfBooks.length === 0) {
      return { books: [] };
    }

    // Get user_books with book details
    const userBookIds = shelfBooks.map((sb) => sb.user_book_id);
    const { data: userBooks } = await supabase
      .from("user_books")
      .select("id, status, book:books(id, title, author, slug, cover_url)")
      .in("id", userBookIds);

    // Create a map for quick lookup
    const userBookMap = new Map(
      (userBooks || []).map((ub) => [ub.id, ub])
    );

    // Combine the data
    const books = shelfBooks
      .map((sb) => {
        const ub = userBookMap.get(sb.user_book_id);
        if (!ub || !ub.book) return null;
        // book comes as an array from Supabase, take first element
        const book = Array.isArray(ub.book) ? ub.book[0] : ub.book;
        if (!book) return null;
        return {
          id: sb.id,
          user_book_id: sb.user_book_id,
          book_id: book.id,
          title: book.title,
          author: book.author,
          slug: book.slug,
          cover_url: book.cover_url,
          status: ub.status,
          added_at: sb.added_at,
        };
      })
      .filter((b): b is NonNullable<typeof b> => b !== null);

    return { books };
  } catch (error) {
    console.error("Error in getShelfBooks:", error);
    return { books: [], error: "An unexpected error occurred" };
  }
}
