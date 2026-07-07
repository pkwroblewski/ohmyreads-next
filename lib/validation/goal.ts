import { z } from "zod";

export const updateReadingGoalSchema = z
  .number()
  .int("Goal must be between 1 and 1000 books")
  .min(1, "Goal must be between 1 and 1000 books")
  .max(1000, "Goal must be between 1 and 1000 books");

export type UpdateReadingGoalInput = z.infer<typeof updateReadingGoalSchema>;
