import { z } from "zod";
import {
  GOOGLE_BOOKS_ID_PATTERN,
  OPEN_LIBRARY_WORK_ID_PATTERN,
} from "@/lib/utils/external-book-search";

const shelfStatusSchema = z.enum(["want_to_read", "reading", "read"]);

export const bookIdSchema = z.string().uuid("Invalid book ID");

export const addToShelfSchema = z.object({
  bookId: z.string().uuid("Invalid book ID"),
  status: shelfStatusSchema,
});

/**
 * Progress arrives as a page number or as a percentage — an audiobook or an
 * e-reader gives a reader no page to type. At least one of the two must be
 * present; `percent` wins when both are, and the action derives the other
 * side whenever a total page count is known.
 */
export const updateReadingProgressSchema = z
  .object({
    bookId: z.string().uuid("Invalid book"),
    currentPage: z
      .number()
      .int("Invalid page number")
      .min(0, "Invalid page number")
      .max(50000, "Invalid page number")
      .optional(),
    totalPages: z
      .number()
      .int("Invalid total pages")
      .positive("Invalid total pages")
      .max(50000, "Invalid total pages")
      .optional(),
    percent: z
      .number()
      .int("Invalid percentage")
      .min(0, "Invalid percentage")
      .max(100, "Invalid percentage")
      .optional(),
  })
  .refine((value) => value.currentPage !== undefined || value.percent !== undefined, {
    message: "Enter a page number or a percentage",
  });

/**
 * Adding a search result to the catalog takes only its external id: the
 * action re-fetches the record from Google Books / Open Library, so no
 * client-supplied title, cover or description ever reaches the public catalog.
 */
export const importAndAddToShelfSchema = z.object({
  externalBook: z
    .object({
      googleBooksId: z
        .string()
        .regex(GOOGLE_BOOKS_ID_PATTERN, "Invalid Google Books ID")
        .nullish(),
      openLibraryId: z
        .string()
        .regex(OPEN_LIBRARY_WORK_ID_PATTERN, "Invalid Open Library ID")
        .nullish(),
    })
    .refine((book) => book.googleBooksId || book.openLibraryId, {
      message: "This book can't be added from search",
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
