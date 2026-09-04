import { z } from "zod";

const shelfNameSchema = z
  .string()
  .trim()
  .min(1, "Shelf name must be 1-100 characters")
  .max(100, "Shelf name must be 1-100 characters");

export const shelfIdSchema = z.string().uuid("Invalid shelf ID");
export const userBookIdSchema = z.string().uuid("Invalid book ID");

export const createShelfSchema = z.object({
  name: shelfNameSchema,
  description: z
    .string()
    .trim()
    .max(2000, "Description must be less than 2000 characters")
    .optional(),
  isPublic: z.boolean().optional(),
  color: z.string().max(50, "Invalid color").optional(),
  icon: z.string().max(50, "Invalid icon").optional(),
});

export const updateShelfSchema = z.object({
  shelfId: shelfIdSchema,
  name: shelfNameSchema.optional(),
  description: z
    .string()
    .trim()
    .max(2000, "Description must be less than 2000 characters")
    .optional(),
  isPublic: z.boolean().optional(),
  color: z.string().max(50, "Invalid color").optional(),
  icon: z.string().max(50, "Invalid icon").optional(),
});

export const updateBookShelvesSchema = z.object({
  userBookId: userBookIdSchema,
  shelfIds: z
    .array(shelfIdSchema)
    .max(50, "Maximum 50 shelves allowed"),
});

export const updateBookShelvesByBookIdSchema = z.object({
  bookId: z.string().uuid("Invalid book ID"),
  shelfIds: z
    .array(shelfIdSchema)
    .max(50, "Maximum 50 shelves allowed"),
});

export type CreateShelfInput = z.infer<typeof createShelfSchema>;
export type UpdateShelfInput = z.infer<typeof updateShelfSchema>;
export type UpdateBookShelvesInput = z.infer<typeof updateBookShelvesSchema>;
export type UpdateBookShelvesByBookIdInput = z.infer<
  typeof updateBookShelvesByBookIdSchema
>;
