import { z } from "zod";
import { httpUrl } from "./shared";

// ---- Shared ----
export const adminBookIdSchema = z.string().uuid("Invalid book ID");
export const adminUserIdSchema = z.string().uuid("Invalid user ID");
export const adminReviewIdSchema = z.string().uuid("Invalid review ID");

const adminReasonSchema = z
  .string()
  .max(1000, "Reason must be less than 1000 characters")
  .optional();

const bookUrlSchema = httpUrl("Invalid cover URL").or(z.literal(""));

// ---- Book edits ----
const adminBookFieldsSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title and author are required")
    .max(500, "Title must be less than 500 characters"),
  author: z
    .string()
    .trim()
    .min(1, "Title and author are required")
    .max(200, "Author must be less than 200 characters"),
  description: z
    .string()
    .max(5000, "Description must be less than 5000 characters")
    .optional(),
  isbn: z.string().max(32, "Invalid ISBN").optional(),
  isbn13: z.string().max(32, "Invalid ISBN-13").optional(),
  cover_url: bookUrlSchema.optional(),
  page_count: z
    .number()
    .int("Invalid page count")
    .positive("Invalid page count")
    .max(50000, "Invalid page count")
    .optional(),
  published_date: z.string().max(30, "Invalid published date").optional(),
  genres: z
    .array(z.string().max(100, "Invalid genre"))
    .max(50, "Maximum 50 genres allowed")
    .optional(),
  google_books_id: z.string().max(100, "Invalid Google Books ID").optional(),
  open_library_id: z.string().max(100, "Invalid Open Library ID").optional(),
});

export const adminCreateBookSchema = adminBookFieldsSchema;

export const adminUpdateBookSchema = z.object({
  bookId: adminBookIdSchema,
  input: adminBookFieldsSchema.partial(),
});

// ---- User role changes / moderation ----
export const adminUserActionSchema = z.object({
  userId: adminUserIdSchema,
  reason: adminReasonSchema,
});

// ---- Review moderation ----
export const adminDeleteReviewSchema = z.object({
  reviewId: adminReviewIdSchema,
  reason: adminReasonSchema,
});

// ---- Enrichment ----
export const enrichmentLimitSchema = z
  .number()
  .int("Invalid limit")
  .min(1, "Invalid limit")
  .max(200, "Invalid limit");

export const bookToEnrichSchema = z.object({
  id: adminBookIdSchema,
  title: z.string().max(500, "Title too long"),
  author: z.string().max(200, "Author too long"),
  isbn: z.string().max(32, "Invalid ISBN").nullable(),
  genres: z.array(z.string().max(100)).max(50, "Maximum 50 genres allowed"),
  description: z.string().max(10000, "Description too long").nullable(),
  cover_url: z.string().max(2000, "Invalid cover URL").nullable(),
  page_count: z.number().int("Invalid page count").nullable(),
  google_books_id: z.string().max(100).nullable(),
  open_library_id: z.string().max(100).nullable(),
  created_at: z.string().max(40, "Invalid date"),
});

export const enrichBookIdsSchema = z
  .array(adminBookIdSchema)
  .max(50, "Maximum 50 books per batch");

// ---- CSV import ----
const parsedBookRowSchema = z.object({
  title: z.string().max(500, "Title in CSV is too long"),
  author: z.string().max(200, "Author in CSV is too long"),
  isbn: z.string().max(32, "Invalid ISBN in CSV").optional(),
  isbn13: z.string().max(32, "Invalid ISBN-13 in CSV").optional(),
  description: z
    .string()
    .max(5000, "Description in CSV is too long")
    .optional(),
  genres: z.array(z.string().max(100)).max(50),
  page_count: z.number().int().min(0).max(50000).optional(),
  published_date: z.string().max(30).optional(),
  cover_url: bookUrlSchema.optional(),
  rowNumber: z.number().int(),
  errors: z.array(z.string().max(500)).max(50),
});

export const importBookRowsSchema = z
  .array(parsedBookRowSchema)
  .max(1000, "Import is limited to 1000 books at a time");

export type AdminCreateBookInput = z.infer<typeof adminCreateBookSchema>;
export type AdminUpdateBookInput = z.infer<typeof adminUpdateBookSchema>;
export type AdminUserActionInput = z.infer<typeof adminUserActionSchema>;
export type BookToEnrichInput = z.infer<typeof bookToEnrichSchema>;
