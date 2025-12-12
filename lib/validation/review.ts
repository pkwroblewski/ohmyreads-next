import { z } from "zod";
import { ALL_VIBE_TAGS } from "@/types/database";

// Zod enum for vibe tags
const vibeTagSchema = z.enum(ALL_VIBE_TAGS as unknown as [string, ...string[]]);

export const createReviewSchema = z
  .object({
    bookId: z.string().uuid("Invalid book ID"),
    rating: z
      .number()
      .min(1, "Rating must be at least 1")
      .max(5, "Rating cannot exceed 5"),
    summary: z
      .string()
      .max(2000, "Summary must be less than 2000 characters")
      .optional(),
    liked: z
      .string()
      .max(1000, "Must be less than 1000 characters")
      .optional(),
    disliked: z
      .string()
      .max(1000, "Must be less than 1000 characters")
      .optional(),
    takeaway: z
      .string()
      .max(1000, "Must be less than 1000 characters")
      .optional(),
    vibeTags: z
      .array(vibeTagSchema)
      .max(10, "Maximum 10 vibe tags allowed")
      .default([]),
    isSpoiler: z.boolean().default(false),
  })
  .refine(
    (data) => {
      const totalLength =
        (data.summary?.length || 0) +
        (data.liked?.length || 0) +
        (data.disliked?.length || 0) +
        (data.takeaway?.length || 0);
      return totalLength >= 50;
    },
    { message: "Review must be at least 50 characters total across all fields" }
  );

export const updateReviewSchema = z.object({
  reviewId: z.string().uuid("Invalid review ID"),
  rating: z.number().min(1).max(5).optional(),
  summary: z.string().max(2000).optional(),
  liked: z.string().max(1000).optional(),
  disliked: z.string().max(1000).optional(),
  takeaway: z.string().max(1000).optional(),
  vibeTags: z.array(vibeTagSchema).max(10).optional(),
  isSpoiler: z.boolean().optional(),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;

