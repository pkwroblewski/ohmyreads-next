import { z } from "zod";

export const challengeIdSchema = z.string().uuid("Invalid challenge ID");

const challengeNameSchema = z
  .string()
  .trim()
  .min(1, "Challenge name is required")
  .max(100, "Challenge name must be less than 100 characters");

const challengeDateSchema = z
  .string()
  .max(30, "Invalid date")
  .refine((value) => !Number.isNaN(Date.parse(value)), "Invalid date");

export const createChallengeSchema = z.object({
  name: challengeNameSchema,
  description: z
    .string()
    .trim()
    .max(2000, "Description must be less than 2000 characters")
    .optional(),
  challenge_type: z.enum(["books_count", "pages_count", "genre_books"]),
  target_value: z
    .number()
    .int("Target must be between 1 and 10,000")
    .min(1, "Target must be between 1 and 10,000")
    .max(10000, "Target must be between 1 and 10,000"),
  genre: z.string().trim().max(100, "Invalid genre").optional(),
  start_date: challengeDateSchema,
  end_date: challengeDateSchema,
});

export const updateChallengeSchema = z.object({
  challengeId: challengeIdSchema,
  updates: z.object({
    name: challengeNameSchema.optional(),
    description: z
      .string()
      .trim()
      .max(2000, "Description must be less than 2000 characters")
      .nullable()
      .optional(),
    status: z.enum(["active", "completed", "failed", "abandoned"]).optional(),
  }),
});

export type CreateChallengeValidatedInput = z.infer<
  typeof createChallengeSchema
>;
export type UpdateChallengeValidatedInput = z.infer<
  typeof updateChallengeSchema
>;
