/**
 * Tests for the single image-host allow-list (Phase 2, Task 5).
 *
 * The OG routes render `<img src>` through `@vercel/og`, which fetches the URL
 * from our own infrastructure. `cover_url` and `avatar_url` are user- or
 * import-controlled, so an unchecked value is a server-side request to any
 * address the attacker names. The gate must refuse everything that is not an
 * https URL on a host `next/image` already trusts.
 */

import { describe, it, expect } from "vitest";
import {
  ALLOWED_IMAGE_HOSTS,
  isAllowedImageHost,
} from "@/lib/config/image-hosts";

describe("isAllowedImageHost", () => {
  it("accepts every host that is live in the catalog today", () => {
    // These three hosts account for every cover_url / avatar_url row in
    // production as of 2026-09-02.
    expect(
      isAllowedImageHost("https://covers.openlibrary.org/b/id/12345-L.jpg")
    ).toBe(true);
    expect(
      isAllowedImageHost(
        "https://books.google.com/books/content?id=abc&printsec=frontcover&img=1"
      )
    ).toBe(true);
    expect(
      isAllowedImageHost("https://lh3.googleusercontent.com/a/ACg8ocK=s96-c")
    ).toBe(true);
  });

  it("accepts the archive.org CDN hosts that Open Library redirects to", () => {
    expect(isAllowedImageHost("https://archive.org/download/x/y.jpg")).toBe(
      true
    );
    expect(
      isAllowedImageHost("https://ia800204.us.archive.org/1/items/x/y.jpg")
    ).toBe(true);
  });

  it("refuses internal and metadata addresses", () => {
    expect(isAllowedImageHost("http://169.254.169.254/latest/meta-data/")).toBe(
      false
    );
    expect(isAllowedImageHost("https://169.254.169.254/")).toBe(false);
    expect(isAllowedImageHost("http://localhost:3000/api/admin")).toBe(false);
    expect(isAllowedImageHost("https://10.0.0.5/")).toBe(false);
  });

  it("refuses http even on an allowed host", () => {
    expect(
      isAllowedImageHost("http://covers.openlibrary.org/b/id/1-L.jpg")
    ).toBe(false);
  });

  it("refuses look-alike hosts", () => {
    expect(
      isAllowedImageHost("https://covers.openlibrary.org.evil.example/x.jpg")
    ).toBe(false);
    expect(
      isAllowedImageHost("https://evil.example/covers.openlibrary.org/x.jpg")
    ).toBe(false);
    expect(
      isAllowedImageHost("https://evil.example@covers.openlibrary.org/x.jpg")
    ).toBe(true); // userinfo does not change the host — still openlibrary
    expect(
      isAllowedImageHost("https://covers.openlibrary.org@evil.example/x.jpg")
    ).toBe(false);
  });

  it("matches a single-label wildcard only one label deep", () => {
    // `*.googleusercontent.com` — one label, like next/image
    expect(isAllowedImageHost("https://lh3.googleusercontent.com/x")).toBe(
      true
    );
    expect(isAllowedImageHost("https://a.b.googleusercontent.com/x")).toBe(
      false
    );
    expect(isAllowedImageHost("https://googleusercontent.com/x")).toBe(false);
  });

  it("refuses empty, relative and malformed values", () => {
    expect(isAllowedImageHost(null)).toBe(false);
    expect(isAllowedImageHost(undefined)).toBe(false);
    expect(isAllowedImageHost("")).toBe(false);
    expect(isAllowedImageHost("/images/placeholder.png")).toBe(false);
    expect(isAllowedImageHost("not a url")).toBe(false);
    expect(isAllowedImageHost("javascript:alert(1)")).toBe(false);
    expect(isAllowedImageHost("data:image/png;base64,AAAA")).toBe(false);
  });

  it("only lists https patterns, so next/image and the OG gate agree", () => {
    for (const host of ALLOWED_IMAGE_HOSTS) {
      expect(host.protocol).toBe("https");
    }
  });
});
