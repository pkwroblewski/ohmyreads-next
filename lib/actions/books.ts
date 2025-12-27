"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Types for external book data
export interface ExternalBookData {
  title: string;
  author: string;
  description?: string;
  coverUrl?: string | null;
  isbn?: string;
  googleBooksId?: string;
  openLibraryId?: string;
  genres?: string[];
  pageCount?: number;
  publishedDate?: string;
}

type ShelfStatus = "want_to_read" | "reading" | "read";

// Helper function to generate slug from title
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 100);
}

// Helper function to ensure unique slug
async function ensureUniqueSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  baseSlug: string
): Promise<string> {
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const { data: existing } = await supabase
      .from("books")
      .select("id")
      .eq("slug", slug)
      .limit(1);

    if (!existing || existing.length === 0) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;

    if (counter > 100) {
      // Safety valve
      return `${baseSlug}-${Date.now()}`;
    }
  }
}

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

/**
 * Import an external book to catalog and add to user's shelf
 * Used when user wants to add a book from Google Books/Open Library that's not in catalog
 */
export async function importAndAddToShelf(
  externalBook: ExternalBookData,
  status: ShelfStatus
): Promise<{ success: boolean; bookId?: string; slug?: string; error?: string }> {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Not authenticated" };
    }

    // Check if book already exists by ISBN, Google Books ID, or Open Library ID
    let existingBook = null;

    if (externalBook.isbn) {
      const { data } = await supabase
        .from("books")
        .select("id, slug")
        .eq("isbn", externalBook.isbn)
        .limit(1)
        .single();
      existingBook = data;
    }

    if (!existingBook && externalBook.googleBooksId) {
      const { data } = await supabase
        .from("books")
        .select("id, slug")
        .eq("google_books_id", externalBook.googleBooksId)
        .limit(1)
        .single();
      existingBook = data;
    }

    if (!existingBook && externalBook.openLibraryId) {
      const { data } = await supabase
        .from("books")
        .select("id, slug")
        .eq("open_library_id", externalBook.openLibraryId)
        .limit(1)
        .single();
      existingBook = data;
    }

    let bookId: string;
    let bookSlug: string;

    if (existingBook) {
      // Book already exists, use it
      bookId = existingBook.id;
      bookSlug = existingBook.slug;
    } else {
      // Create new book in catalog
      const baseSlug = generateSlug(externalBook.title);
      bookSlug = await ensureUniqueSlug(supabase, baseSlug);

      const { data: newBook, error: insertError } = await supabase
        .from("books")
        .insert({
          title: externalBook.title,
          author: externalBook.author,
          slug: bookSlug,
          description: externalBook.description || null,
          cover_url: externalBook.coverUrl || null,
          isbn: externalBook.isbn || null,
          google_books_id: externalBook.googleBooksId || null,
          open_library_id: externalBook.openLibraryId || null,
          genres: externalBook.genres || [],
          page_count: externalBook.pageCount || null,
          published_date: externalBook.publishedDate || null,
          // User-submitted books start with no ratings
          average_rating: null,
          ratings_count: 0,
        })
        .select("id")
        .single();

      if (insertError || !newBook) {
        console.error("Error creating book:", insertError);
        return { success: false, error: "Failed to add book to catalog" };
      }

      bookId = newBook.id;
    }

    // Now add to user's shelf
    const now = new Date().toISOString();
    const shelfData: Record<string, string> = {
      user_id: user.id,
      book_id: bookId,
      status,
      updated_at: now,
    };

    if (status === "reading") {
      shelfData.started_at = now;
    } else if (status === "read") {
      shelfData.finished_at = now;
    }

    const { error: shelfError } = await supabase.from("user_books").upsert(shelfData, {
      onConflict: "user_id,book_id",
      ignoreDuplicates: false,
    });

    if (shelfError) {
      console.error("Error adding to shelf:", shelfError);
      return { success: false, error: "Book added to catalog but failed to add to shelf" };
    }

    // Revalidate pages
    revalidatePath("/dashboard");
    revalidatePath("/my-shelf");
    revalidatePath("/books");
    revalidatePath(`/books/${bookSlug}`);

    return { success: true, bookId, slug: bookSlug };
  } catch (error) {
    console.error("Error in importAndAddToShelf:", error);
    return { success: false, error: "An unexpected error occurred" };
  }
}

