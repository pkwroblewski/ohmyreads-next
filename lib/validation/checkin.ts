import { z } from "zod";

export const placeIdSchema = z.string().uuid("Invalid place ID");
export const createCheckinSchema = z.object({
  placeId: placeIdSchema,
  bookId: z.string().uuid("Invalid book ID").nullable().optional(),
  note: z
    .string()
    .trim()
    .max(500, "Note must be 500 characters or less")
    .nullable()
    .optional(),
});

export type CreateCheckinValidatedInput = z.infer<typeof createCheckinSchema>;
