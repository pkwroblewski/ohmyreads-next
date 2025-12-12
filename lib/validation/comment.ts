import { z } from "zod";

export const createCommentSchema = z.object({
  reviewId: z.string().uuid("Invalid review ID"),
  content: z
    .string()
    .min(1, "Comment cannot be empty")
    .max(1000, "Comment must be less than 1000 characters")
    .trim(),
  parentId: z.string().uuid().optional().nullable(),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;

