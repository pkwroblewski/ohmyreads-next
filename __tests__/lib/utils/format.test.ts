import { describe, it, expect } from "vitest";
import { truncateAtWord } from "@/lib/utils/format";

describe("truncateAtWord", () => {
  it("returns short text untouched apart from whitespace collapsing", () => {
    expect(truncateAtWord("A  short\n description")).toBe("A short description");
  });

  it("cuts at a word boundary and never exceeds the limit", () => {
    const text = "The quick brown fox jumps over the lazy dog and keeps running far away";
    const out = truncateAtWord(text, 30);
    expect(out).toBe("The quick brown fox jumps…");
    expect(out.length).toBeLessThanOrEqual(30);
  });

  it("drops trailing punctuation before the ellipsis", () => {
    expect(truncateAtWord("Tiny changes, remarkable results, every day.", 25)).toBe(
      "Tiny changes, remarkable…"
    );
  });

  it("falls back to a hard cut when there is no usable space", () => {
    const out = truncateAtWord("a".repeat(200), 20);
    expect(out).toBe(`${"a".repeat(19)}…`);
    expect(out.length).toBe(20);
  });

  it("defaults to the 160-character meta-description limit", () => {
    const out = truncateAtWord("word ".repeat(100));
    expect(out.length).toBeLessThanOrEqual(160);
    expect(out.endsWith("…")).toBe(true);
  });
});
