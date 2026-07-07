"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { createAuditLog } from "@/lib/utils/audit-log";
import { parseBookCSV, type ParsedBookRow } from "@/lib/utils/book-csv-parser";
import { generateSlug } from "@/lib/utils/slug";
import { checkRateLimit } from "@/lib/utils/rate-limit";
import { importBookRowsSchema } from "@/lib/validation/admin";

// Check if current user is admin
async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    throw new Error("Not authorized");
  }

  return { supabase, user };
}

// Parse CSV and return preview
export async function parseCSVForPreview(csvContent: string) {
  try {
    await requireAdmin();
    const result = parseBookCSV(csvContent);
    return result;
  } catch (error) {
    console.error("Error parsing CSV:", error);
    return {
      success: false,
      rows: [],
      totalRows: 0,
      validRows: 0,
      errorRows: 0,
      errors: ["Failed to parse CSV"],
    };
  }
}

// Import result for each row
export interface ImportRowResult {
  rowNumber: number;
  title: string;
  success: boolean;
  bookId?: string;
  error?: string;
  skipped?: boolean;
  skipReason?: string;
}

export interface ImportResult {
  success: boolean;
  totalRows: number;
  imported: number;
  skipped: number;
  failed: number;
  results: ImportRowResult[];
}

// Import books from parsed CSV rows
export async function importBooksFromCSV(rows: ParsedBookRow[]): Promise<ImportResult> {
  try {
    const { supabase, user } = await requireAdmin();

    // Rate limit: 30 admin mutations per minute per admin
    const { allowed } = await checkRateLimit(`admin:${user.id}`, 30, 60000);
    if (!allowed) {
      return {
        success: false,
        totalRows: rows.length,
        imported: 0,
        skipped: 0,
        failed: rows.length,
        results: [
          {
            rowNumber: 0,
            title: "",
            success: false,
            error: "Too many requests. Please wait a moment.",
          },
        ],
      };
    }

    // Validate input with Zod (row cap + per-row field bounds)
    const validationResult = importBookRowsSchema.safeParse(rows);
    if (!validationResult.success) {
      return {
        success: false,
        totalRows: rows.length,
        imported: 0,
        skipped: 0,
        failed: rows.length,
        results: [
          {
            rowNumber: 0,
            title: "",
            success: false,
            error:
              validationResult.error.issues[0]?.message || "Invalid input",
          },
        ],
      };
    }

    const results: ImportRowResult[] = [];
    let imported = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of rows) {
      // Skip rows with errors
      if (row.errors.length > 0) {
        results.push({
          rowNumber: row.rowNumber,
          title: row.title || "Unknown",
          success: false,
          error: row.errors.join("; "),
        });
        failed++;
        continue;
      }

      // Check for duplicate by ISBN or title+author
      let existingBook = null;

      if (row.isbn) {
        const { data } = await supabase
          .from("books")
          .select("id, title")
          .eq("isbn", row.isbn)
          .single();
        existingBook = data;
      }

      if (!existingBook && row.isbn13) {
        const { data } = await supabase
          .from("books")
          .select("id, title")
          .eq("isbn13", row.isbn13)
          .single();
        existingBook = data;
      }

      if (!existingBook) {
        // Check by title and author (fuzzy)
        const { data } = await supabase
          .from("books")
          .select("id, title")
          .ilike("title", row.title)
          .ilike("author", row.author)
          .single();
        existingBook = data;
      }

      if (existingBook) {
        results.push({
          rowNumber: row.rowNumber,
          title: row.title,
          success: true,
          skipped: true,
          skipReason: `Duplicate: matches existing book "${existingBook.title}"`,
          bookId: existingBook.id,
        });
        skipped++;
        continue;
      }

      // Generate unique slug
      const baseSlug = generateSlug(row.title);
      let slug = baseSlug;
      let counter = 1;

      while (true) {
        const { data: existing } = await supabase
          .from("books")
          .select("id")
          .eq("slug", slug)
          .single();

        if (!existing) break;
        slug = `${baseSlug}-${counter}`;
        counter++;
      }

      // Insert book
      const { data: newBook, error: insertError } = await supabase
        .from("books")
        .insert({
          title: row.title,
          author: row.author,
          slug,
          description: row.description || null,
          isbn: row.isbn || null,
          isbn13: row.isbn13 || null,
          cover_url: row.cover_url || null,
          page_count: row.page_count || null,
          published_date: row.published_date || null,
          genres: row.genres,
        })
        .select()
        .single();

      if (insertError) {
        results.push({
          rowNumber: row.rowNumber,
          title: row.title,
          success: false,
          error: insertError.message,
        });
        failed++;
      } else {
        results.push({
          rowNumber: row.rowNumber,
          title: row.title,
          success: true,
          bookId: newBook.id,
        });
        imported++;
      }
    }

    // Audit log
    await createAuditLog({
      action: "admin.import.books",
      targetType: "book",
      userId: user.id,
      metadata: {
        totalRows: rows.length,
        imported,
        skipped,
        failed,
      },
    });

    revalidatePath("/admin/books");
    revalidatePath("/books");

    return {
      success: true,
      totalRows: rows.length,
      imported,
      skipped,
      failed,
      results,
    };
  } catch (error) {
    console.error("Error importing books:", error);
    return {
      success: false,
      totalRows: rows.length,
      imported: 0,
      skipped: 0,
      failed: rows.length,
      results: [],
    };
  }
}
