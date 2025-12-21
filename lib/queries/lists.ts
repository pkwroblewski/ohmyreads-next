import { createPublicClient } from "@/lib/supabase/server";
import { getCuratedList, type CuratedList } from "@/lib/data/curated-lists";
import type { Book } from "@/types/database";

export interface CuratedListWithBooks extends CuratedList {
  books: Book[];
}

/**
 * Get a curated list with its books
 */
export async function getCuratedListWithBooks(
  slug: string
): Promise<CuratedListWithBooks | null> {
  const list = getCuratedList(slug);

  if (!list) {
    return null;
  }

  const supabase = createPublicClient();

  let books: Book[] = [];

  // If explicit book slugs are provided, fetch those
  if (list.bookSlugs && list.bookSlugs.length > 0) {
    const { data, error } = await supabase
      .from("books")
      .select("*")
      .in("slug", list.bookSlugs)
      .order("ratings_count", { ascending: false });

    if (error) {
      console.error("Error fetching books by slugs:", error);
    } else {
      books = (data || []) as Book[];
    }
  }
  // Otherwise, fetch by genres
  else if (list.genres && list.genres.length > 0) {
    const { data, error } = await supabase
      .from("books")
      .select("*")
      .overlaps("genres", list.genres)
      .order("ratings_count", { ascending: false })
      .limit(24);

    if (error) {
      console.error("Error fetching books by genres:", error);
    } else {
      books = (data || []) as Book[];
    }
  }

  return {
    ...list,
    books,
  };
}
