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
      .max(5, "Rating cannot exceed 5")
      .nullable()
      .optional(),
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
      const hasRating = data.rating != null;
      const hasText = totalLength >= 50;
      // Must have at least a rating OR 50+ chars of text (or both)
      // If text is present but < 50 chars, it's not enough on its own
      if (!hasRating && !hasText) return false;
      // If there's some text but not enough, only allow if there's also a rating
      if (totalLength > 0 && totalLength < 50 && !hasRating) return false;
      return true;
    },
    { message: "Add a star rating, or write at least 50 characters for a text-only review" }
  );

export const updateReviewSchema = z.object({
  reviewId: z.string().uuid("Invalid review ID"),
  rating: z.number().min(1).max(5).nullable().optional(),
  summary: z.string().max(2000).optional(),
  liked: z.string().max(1000).optional(),
  disliked: z.string().max(1000).optional(),
  takeaway: z.string().max(1000).optional(),
  vibeTags: z.array(vibeTagSchema).max(10).optional(),
  isSpoiler: z.boolean().optional(),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;

