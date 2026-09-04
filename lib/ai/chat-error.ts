/**
 * Turn the error `useChat` surfaces into something a person can read.
 *
 * The AI SDK transport uses the raw response body as `error.message`, so a
 * rejected request shows up as `{"error":"Forbidden"}` in the chat bubble.
 */

const FALLBACK = "Something went wrong. Please try again.";

const KNOWN: Record<string, string> = {
  Forbidden: "The request was blocked. Please reload the page and try again.",
  Unauthorized: "Please sign in to use the AI book finder.",
};

export function chatErrorMessage(error: { message?: string } | null | undefined): string {
  const raw = error?.message?.trim();
  if (!raw) return FALLBACK;

  let text = raw;
  if (raw.startsWith("{")) {
    try {
      const parsed = JSON.parse(raw) as { error?: unknown };
      if (typeof parsed.error === "string" && parsed.error) {
        text = parsed.error;
      } else {
        return FALLBACK;
      }
    } catch {
      return FALLBACK;
    }
  }

  if (/quota|rate.?limit|resource_exhausted|high demand|try again later/i.test(text)) {
    return "The AI assistant is over its request limit right now. Please try again in a minute.";
  }

  return KNOWN[text] ?? text;
}
