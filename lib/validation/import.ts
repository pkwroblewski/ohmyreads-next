import { z } from "zod";

// Shape of rows produced by parseGoodreadsCSV — validated post-parse so
// malformed or oversized imports are rejected before any DB writes
const goodreadsRowSchema = z.object({
  bookId: z.string().max(50, "Invalid book ID in CSV"),
  title: z.string().max(500, "Title in CSV is too long"),
  author: z.string().max(200, "Author in CSV is too long"),
  isbn: z.string().max(32, "Invalid ISBN in CSV"),
  isbn13: z.string().max(32, "Invalid ISBN-13 in CSV"),
  myRating: z
    .number()
    .min(0, "Invalid rating in CSV")
    .max(5, "Invalid rating in CSV"),
  averageRating: z.number().min(0).max(5),
  numberOfPages: z.number().int().min(0).max(50000, "Invalid page count in CSV"),
  dateRead: z.string().max(30, "Invalid date in CSV").nullable(),
  dateAdded: z.string().max(30, "Invalid date in CSV"),
  bookshelves: z.array(z.string().max(100)).max(100),
  exclusiveShelf: z.string().max(50, "Invalid shelf in CSV"),
});

export const goodreadsRowsSchema = z
  .array(goodreadsRowSchema)
  .max(1000, "Import is limited to 1000 books at a time");

export type GoodreadsRowsInput = z.infer<typeof goodreadsRowsSchema>;
