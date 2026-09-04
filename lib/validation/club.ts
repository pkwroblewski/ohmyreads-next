import { z } from "zod";

const clubNameSchema = z
  .string()
  .trim()
  .min(3, "Club name must be at least 3 characters")
  .max(100, "Club name must be less than 100 characters");

const clubDescriptionSchema = z
  .string()
  .trim()
  .max(2000, "Description must be less than 2000 characters");

export const clubIdSchema = z.string().uuid("Invalid club ID");

export const createClubSchema = z.object({
  name: clubNameSchema,
  description: clubDescriptionSchema.optional(),
  visibility: z.enum(["public", "private"]).optional(),
});

export const setCurrentBookSchema = z.object({
  clubId: clubIdSchema,
  bookId: z.string().uuid("Invalid book ID"),
  clubSlug: z.string().trim().max(100, "Invalid club slug").optional(),
});

export type CreateClubInput = z.infer<typeof createClubSchema>;
export type SetCurrentBookInput = z.infer<typeof setCurrentBookSchema>;
