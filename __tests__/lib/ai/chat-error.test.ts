import { describe, it, expect } from "vitest";
import { chatErrorMessage } from "@/lib/ai/chat-error";

describe("chatErrorMessage", () => {
  it("maps the raw Forbidden body to readable copy", () => {
    expect(chatErrorMessage(new Error('{"error":"Forbidden"}'))).toBe(
      "The request was blocked. Please reload the page and try again."
    );
  });

  it("maps Unauthorized to a sign-in prompt", () => {
    expect(chatErrorMessage(new Error('{"error":"Unauthorized"}'))).toBe(
      "Please sign in to use the AI book finder."
    );
  });

  it("passes through a human-readable server message", () => {
    expect(
      chatErrorMessage(new Error('{"error":"Too many requests. Please wait a moment."}'))
    ).toBe("Too many requests. Please wait a moment.");
    expect(chatErrorMessage(new Error("Network error"))).toBe("Network error");
  });

  it("turns provider quota and overload errors into one calm sentence", () => {
    const expected = "The AI assistant is over its request limit right now. Please try again in a minute.";
    expect(
      chatErrorMessage(
        new Error(
          "You exceeded your current quota, please check your plan and billing details.\n* Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 5, model: gemini-3.6-flash\nPlease retry in 24.9s."
        )
      )
    ).toBe(expected);
    expect(
      chatErrorMessage(new Error("This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later."))
    ).toBe(expected);
  });

  it("falls back on empty, malformed or non-string bodies", () => {
    const fallback = "Something went wrong. Please try again.";
    expect(chatErrorMessage(null)).toBe(fallback);
    expect(chatErrorMessage(new Error(""))).toBe(fallback);
    expect(chatErrorMessage(new Error("{not json"))).toBe(fallback);
    expect(chatErrorMessage(new Error('{"error":{"code":1}}'))).toBe(fallback);
  });
});
