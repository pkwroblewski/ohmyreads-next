import { z } from "zod";

/**
 * Result schemas for the LLM-backed homepage endpoints.
 *
 * These replace a `text.match(/\{[\s\S]*\}/)` + `JSON.parse` pair in each
 * route. That older path had no notion of a valid shape: when the model
 * answered with prose instead of JSON it fell through to
 * `responseText.slice(0, 80)` and rendered the model's chatter to the reader as
 * if it were a recommendation. Passing these to `generateObject` makes a
 * malformed answer throw `NoObjectGeneratedError`, which the routes catch and
 * answer with a written fallback instead.
 *
 * They live here rather than in the route files because a Next route module is
 * only meant to export its handlers — and because these are worth testing
 * directly.
 */

/** One curated pick blurb, shown under a book on the homepage grid. */
export const curatedPickSchema = z.object({
  reason: z
    .string()
    .min(1)
    .max(200)
    .describe("10-20 words on why this reader might love this book"),
  matchType: z.enum(["mood", "theme", "author", "genre", "vibe"]),
});

export type CuratedPickResult = z.infer<typeof curatedPickSchema>;

/** One trending insight, shown beside a book in the trending list. */
export const trendingInsightSchema = z.object({
  insight: z
    .string()
    .min(1)
    .max(240)
    .describe("15-25 words on why this book is resonating right now"),
  keywords: z.array(z.string().min(1).max(40)).min(1).max(3),
});

export type TrendingInsightResult = z.infer<typeof trendingInsightSchema>;
