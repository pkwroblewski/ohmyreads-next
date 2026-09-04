/**
 * One place for the model ids the app calls, so a provider retiring a model
 * is a one-line change. Google retired gemini-2.0-flash on 2026-09-04 with a
 * 404 pointing at gemini-3.6-flash.
 */
export const GEMINI_MODEL = "gemini-3.6-flash";

/**
 * Gemini 3.x thinks before answering, and its thinking tokens count against
 * `maxOutputTokens`. With the small budgets these calls use (120-800 tokens)
 * the model spent the whole budget reasoning: `generateObject` returned no
 * JSON and the chat stalled past the 30 s function limit. Minimal thinking
 * is right for short blurbs and tool-driven search anyway.
 */
export const GEMINI_PROVIDER_OPTIONS = {
  google: { thinkingConfig: { thinkingLevel: "minimal" as const } },
};
