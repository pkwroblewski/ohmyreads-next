import { describe, it, expect } from "vitest";
import { normalizeIsbn } from "@/lib/utils/isbn";

describe("normalizeIsbn", () => {
  it("keeps an ISBN-13 and strips hyphens and spaces", () => {
    expect(normalizeIsbn("978-0-441-01359-3")).toBe("9780441013593");
    expect(normalizeIsbn(" 978 0441013593 ")).toBe("9780441013593");
  });

  it("converts an ISBN-10 to ISBN-13", () => {
    expect(normalizeIsbn("0441013597")).toBe("9780441013593");
    expect(normalizeIsbn("0-8044-2957-x")).toBe("9780804429573");
  });

  it("returns null for blank or malformed input", () => {
    expect(normalizeIsbn(undefined)).toBeNull();
    expect(normalizeIsbn("")).toBeNull();
    expect(normalizeIsbn("12345")).toBeNull();
    expect(normalizeIsbn("97804410135X3")).toBeNull();
  });
});
