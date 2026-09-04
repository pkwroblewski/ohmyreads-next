import { z } from "zod";

const listTitleSchema = z
  .string()
  .trim()
  .min(3, "List title must be at least 3 characters")
  .max(100, "List title must be less than 100 characters");

const visibilitySchema = z.enum(["public", "private"]);

export const listIdSchema = z.string().uuid("Invalid list ID");

export const createListSchema = z.object({
  title: listTitleSchema,
  description: z
    .string()
    .trim()
    .max(2000, "Description must be less than 2000 characters")
    .optional(),
  visibility: visibilitySchema.optional(),
});

export const addBookToListSchema = z.object({
  listId: listIdSchema,
  bookId: z.string().uuid("Invalid book ID"),
  note: z
    .string()
    .trim()
    .max(2000, "Note must be less than 2000 characters")
    .optional(),
});

export const removeBookFromListSchema = z.object({
  listId: listIdSchema,
  bookId: z.string().uuid("Invalid book ID"),
});

export type CreateListInput = z.infer<typeof createListSchema>;
export type AddBookToListInput = z.infer<typeof addBookToListSchema>;
export type RemoveBookFromListInput = z.infer<typeof removeBookFromListSchema>;
