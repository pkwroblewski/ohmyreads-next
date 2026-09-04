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

  it("falls back on empty, malformed or non-string bodies", () => {
    const fallback = "Something went wrong. Please try again.";
    expect(chatErrorMessage(null)).toBe(fallback);
    expect(chatErrorMessage(new Error(""))).toBe(fallback);
    expect(chatErrorMessage(new Error("{not json"))).toBe(fallback);
    expect(chatErrorMessage(new Error('{"error":{"code":1}}'))).toBe(fallback);
  });
});
