import { z } from "zod";
import { httpUrl } from "./shared";

const shelfStatusSchema = z.enum(["want_to_read", "reading", "read"]);

export const bookIdSchema = z.string().uuid("Invalid book ID");

export const addToShelfSchema = z.object({
  bookId: z.string().uuid("Invalid book ID"),
  status: shelfStatusSchema,
});

export const updateReadingProgressSchema = z.object({
  bookId: z.string().uuid("Invalid book"),
  currentPage: z
    .number()
    .int("Invalid page number")
    .min(0, "Invalid page number")
    .max(50000, "Invalid page number"),
  totalPages: z
    .number()
    .int("Invalid total pages")
    .positive("Invalid total pages")
    .max(50000, "Invalid total pages")
    .optional(),
});

export const importAndAddToShelfSchema = z.object({
  externalBook: z.object({
    title: z
      .string()
      .trim()
      .min(1, "Title is required")
      .max(500, "Title must be less than 500 characters"),
    author: z
      .string()
      .trim()
      .min(1, "Author is required")
      .max(200, "Author must be less than 200 characters"),
    description: z
      .string()
      .max(5000, "Description must be less than 5000 characters")
      .optional(),
    coverUrl: httpUrl("Invalid cover URL")
      .or(z.literal(""))
      .nullable()
      .optional(),
    isbn: z.string().max(32, "Invalid ISBN").optional(),
    googleBooksId: z.string().max(100, "Invalid Google Books ID").optional(),
    openLibraryId: z.string().max(100, "Invalid Open Library ID").optional(),
    genres: z
      .array(z.string().max(100, "Invalid genre"))
      .max(50, "Maximum 50 genres allowed")
      .optional(),
    pageCount: z
      .number()
      .int("Invalid page count")
      .positive("Invalid page count")
      .max(50000, "Invalid page count")
      .optional(),
    publishedDate: z.string().max(50, "Invalid published date").optional(),
  }),
  status: shelfStatusSchema,
});

export type AddToShelfInput = z.infer<typeof addToShelfSchema>;
export type UpdateReadingProgressInput = z.infer<
  typeof updateReadingProgressSchema
>;
export type ImportAndAddToShelfInput = z.infer<
  typeof importAndAddToShelfSchema
>;
