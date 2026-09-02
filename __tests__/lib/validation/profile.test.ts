/**
 * Tests for the profile Zod schemas — specifically that every user-supplied
 * URL field rejects non-http(s) schemes. Zod 4's `.url()` alone accepts
 * `javascript:` / `data:` / `vbscript:`, which would then be rendered as a
 * raw `href` on the public profile.
 */

import { describe, it, expect } from "vitest";
import {
  updateProfileSchema,
  socialLinkSchema,
} from "@/lib/validation/profile";
import { submitPlaceSchema } from "@/lib/validation/place";
import { createBookSubmissionSchema } from "@/lib/validation/book-submission";
import { httpUrl } from "@/lib/validation/shared";

const DANGEROUS_URLS = [
  "javascript:alert(1)",
  "JavaScript:alert(1)",
  " javascript:alert(1)",
  "data:text/html,<script>alert(1)</script>",
  "vbscript:msgbox(1)",
  "ftp://example.com/file",
  "example.com",
  "//example.com",
];

describe("httpUrl", () => {
  it("accepts absolute http(s) URLs in any letter case", () => {
    expect(httpUrl().safeParse("https://example.com").success).toBe(true);
    expect(httpUrl().safeParse("http://example.com/path?q=1").success).toBe(true);
    expect(httpUrl().safeParse("HTTPS://example.com").success).toBe(true);
  });

  it.each(DANGEROUS_URLS)("rejects %j", (url) => {
    expect(httpUrl().safeParse(url).success).toBe(false);
  });

  it("caps the length at 2048 characters", () => {
    const long = `https://example.com/${"a".repeat(2048)}`;
    expect(httpUrl().safeParse(long).success).toBe(false);
  });

  it("uses the caller's message for the url check", () => {
    const result = httpUrl("Invalid website URL").safeParse("not a url");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Invalid website URL");
    }
  });
});

describe("updateProfileSchema", () => {
  it("accepts an https website and avatar", () => {
    const result = updateProfileSchema.safeParse({
      website: "https://example.com",
      avatarUrl: "https://cdn.example.com/a.png",
    });
    expect(result.success).toBe(true);
  });

  it("still allows an empty string to clear the fields", () => {
    const result = updateProfileSchema.safeParse({ website: "", avatarUrl: "" });
    expect(result.success).toBe(true);
  });

  it.each(DANGEROUS_URLS)("rejects website %j", (url) => {
    expect(updateProfileSchema.safeParse({ website: url }).success).toBe(false);
  });

  it.each(DANGEROUS_URLS)("rejects avatarUrl %j", (url) => {
    expect(updateProfileSchema.safeParse({ avatarUrl: url }).success).toBe(false);
  });
});

describe("socialLinkSchema", () => {
  const base = { platform: "twitter", displayOrder: 0 };

  it("accepts an https link", () => {
    expect(
      socialLinkSchema.safeParse({ ...base, url: "https://x.com/me" }).success
    ).toBe(true);
  });

  it.each(DANGEROUS_URLS)("rejects url %j", (url) => {
    expect(socialLinkSchema.safeParse({ ...base, url }).success).toBe(false);
  });
});

describe("submitPlaceSchema website", () => {
  const base = { name: "Corner Books", placeType: "bookstore" as const };

  it("accepts https, empty, or omitted", () => {
    expect(submitPlaceSchema.safeParse({ ...base, website: "https://corner.example" }).success).toBe(true);
    expect(submitPlaceSchema.safeParse({ ...base, website: "" }).success).toBe(true);
    expect(submitPlaceSchema.safeParse(base).success).toBe(true);
  });

  it.each(DANGEROUS_URLS)("rejects %j", (url) => {
    expect(submitPlaceSchema.safeParse({ ...base, website: url }).success).toBe(false);
  });
});

describe("createBookSubmissionSchema coverUrl", () => {
  const base = { title: "A Book", author: "Someone" };

  it("accepts https or empty", () => {
    expect(createBookSubmissionSchema.safeParse({ ...base, coverUrl: "https://covers.example/1.jpg" }).success).toBe(true);
    expect(createBookSubmissionSchema.safeParse({ ...base, coverUrl: "" }).success).toBe(true);
  });

  it.each(DANGEROUS_URLS)("rejects %j", (url) => {
    expect(createBookSubmissionSchema.safeParse({ ...base, coverUrl: url }).success).toBe(false);
  });
});
