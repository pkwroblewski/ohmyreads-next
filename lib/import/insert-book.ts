import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { ActionResult } from "@/types/app";
import { reportError } from "@/lib/utils/log";

// PostgreSQL unique violation error code
const UNIQUE_VIOLATION = "23505";
const MAX_SLUG_RETRIES = 10;

// Generate a short random suffix using crypto
function generateRandomSuffix(): string {
  const bytes = crypto.randomBytes(4);
  return bytes.toString("hex").slice(0, 6);
}

/**
 * Book data for insertion. Everything the database generates or derives
 * (id, slug, timestamps, author_slug, fts) is excluded; the slug is passed
 * separately so collisions can be retried.
 */
export type BookInsertData = Omit<
  Database["public"]["Tables"]["books"]["Insert"],
  "id" | "slug" | "created_at" | "updated_at" | "author_slug" | "fts"
>;

/**
 * Insert a book with automatic slug collision handling.
 * Uses database unique constraint instead of check-then-insert to avoid race conditions.
 * On collision, retries with random suffix until success or max retries reached.
 *
 * Pass the service-role client: the books INSERT policy is admin-only, and the
 * caller is responsible for authenticating, rate-limiting and validating first.
 * Shared by the search-to-add action and the catalog import scripts.
 */
export async function insertBookWithUniqueSlug(
  supabase: SupabaseClient<Database>,
  bookData: BookInsertData,
  baseSlug: string
): Promise<ActionResult<{ id: string; slug: string }>> {
  let slug = baseSlug;
  let attempt = 0;

  while (attempt < MAX_SLUG_RETRIES) {
    const { data, error } = await supabase
      .from("books")
      .insert({ ...bookData, slug })
      .select("id, slug")
      .single();

    if (data) {
      // Success
      return { success: true, id: data.id, slug: data.slug };
    }

    if (error) {
      // Check if this is a unique constraint violation on slug
      if (error.code === UNIQUE_VIOLATION && error.message?.includes("slug")) {
        // Collision - retry with random suffix
        attempt++;
        slug = `${baseSlug}-${generateRandomSuffix()}`;
        continue;
      }

      // Different error - fail immediately
      return { success: false, error: reportError("Error inserting book", error) };
    }
  }

  // Exhausted retries - use timestamp as last resort
  const lastResortSlug = `${baseSlug}-${Date.now()}`;
  const { data, error } = await supabase
    .from("books")
    .insert({ ...bookData, slug: lastResortSlug })
    .select("id, slug")
    .single();

  if (data) {
    return { success: true, id: data.id, slug: data.slug };
  }

  return {
    success: false,
    error: error
      ? reportError("Error inserting book (last-resort slug)", error)
      : "Failed to create book after multiple attempts",
  };
}
