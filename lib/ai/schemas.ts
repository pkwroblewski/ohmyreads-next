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

/** Chat history longer than this is refused outright — no client sends it. */
const MAX_CHAT_MESSAGES = 100;
/** Only the most recent messages reach the model, so cost stays flat. */
export const CHAT_HISTORY_LIMIT = 20;
/** Readers type short questions; assistant replies are capped at ~800 tokens. */
const MAX_TEXT_CHARS = { user: 2_000, assistant: 8_000 } as const;

const chatPartSchema = z.looseObject({
  type: z.string(),
  text: z.string().optional(),
});

/** The text a message contributes to the prompt; tool parts are dropped. */
export function chatMessageText(message: {
  parts: z.infer<typeof chatPartSchema>[];
}): string {
  return message.parts
    .map((p) => (p.type === "text" ? (p.text ?? "") : ""))
    .join("");
}

const chatMessageSchema = z
  .looseObject({
    // Only the two chat roles: a client-sent `system` message would sit
    // beside our own system prompt with the same authority.
    role: z.enum(["user", "assistant"]),
    parts: z.array(chatPartSchema).max(100),
  })
  .refine((m) => chatMessageText(m).length <= MAX_TEXT_CHARS[m.role], {
    message: "Message is too long",
  });

/** Request body of the AI chat routes (useChat's extra fields pass through). */
export const chatRequestSchema = z.looseObject({
  messages: z.array(chatMessageSchema).min(1).max(MAX_CHAT_MESSAGES),
  // Interpolated into the place-search system prompt, so numbers only.
  location: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
    })
    .optional(),
});
