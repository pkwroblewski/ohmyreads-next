/**
 * Env values pasted into Vercel carry a stray CR-LF; a trailing CR on
 * CRON_SECRET would 401 the cron forever and undici rejects it in a header.
 */

import { describe, it, expect } from "vitest";
import { cleanEnv } from "@/lib/utils/env";
import { safeCompare } from "@/lib/utils/secrets";

describe("cleanEnv", () => {
  it("strips a trailing CR-LF", () => {
    expect(cleanEnv("s3cret\r\n")).toBe("s3cret");
  });

  it("strips a line break in the middle of the value", () => {
    expect(cleanEnv("https://ingest.de.sentry\r\n.io")).toBe(
      "https://ingest.de.sentry.io"
    );
  });

  it("trims surrounding spaces", () => {
    expect(cleanEnv("  key  ")).toBe("key");
  });

  it("returns undefined for missing or blank values", () => {
    expect(cleanEnv(undefined)).toBeUndefined();
    expect(cleanEnv("")).toBeUndefined();
    expect(cleanEnv("\r\n")).toBeUndefined();
  });

  it("lets a pasted cron secret match its bearer header", () => {
    const secret = cleanEnv("abc123\r\n");
    expect(safeCompare("Bearer abc123", `Bearer ${secret}`)).toBe(true);
  });
});
