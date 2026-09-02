/**
 * Tests for CSV cell escaping in the data export (Phase 2, Task 5).
 *
 * Book titles and review text are user-controlled and end up in a file the
 * user opens in a spreadsheet. A cell beginning with `=` is a formula there.
 */

import { describe, it, expect } from "vitest";
import { escapeCsv } from "@/lib/utils/csv-escape";

describe("escapeCsv", () => {
  it("neutralises a formula in a book title", () => {
    const out = escapeCsv('=HYPERLINK("https://evil.example","Click me")');

    expect(out.startsWith("\"'=")).toBe(true);
    expect(out).toBe('"\'=HYPERLINK(""https://evil.example"",""Click me"")"');
  });

  it("prefixes every formula trigger character", () => {
    for (const first of ["=", "+", "-", "@", "\t", "\r"]) {
      expect(escapeCsv(`${first}cmd`), JSON.stringify(first)).toBe(
        `'${first}cmd`
      );
    }
  });

  it("leaves ordinary text alone", () => {
    expect(escapeCsv("Dune")).toBe("Dune");
    expect(escapeCsv("A 2-hour read")).toBe("A 2-hour read");
    expect(escapeCsv("user@example")).toBe("user@example");
  });

  it("still quotes commas, quotes and newlines", () => {
    expect(escapeCsv("Hello, World")).toBe('"Hello, World"');
    expect(escapeCsv('Say "hi"')).toBe('"Say ""hi"""');
    expect(escapeCsv("line1\nline2")).toBe('"line1\nline2"');
  });

  it("returns an empty cell for nothing", () => {
    expect(escapeCsv(null)).toBe("");
    expect(escapeCsv(undefined)).toBe("");
    expect(escapeCsv("")).toBe("");
  });
});
