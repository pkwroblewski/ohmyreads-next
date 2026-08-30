/**
 * Tests for reportError — the boundary that stops raw Postgres/PostgREST text
 * from reaching the browser.
 *
 * Server actions used to `return { error: error.message }`, which handed the
 * client constraint, column and policy names. reportError must return a fixed
 * generic string and keep the real detail server-side only.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { GENERIC_ERROR_MESSAGE, reportError } from "@/lib/utils/log";

/** A realistic Supabase error: plain object, not an Error instance. */
const pgError = {
  code: "23505",
  message:
    'duplicate key value violates unique constraint "shelf_books_shelf_id_user_book_id_key"',
  details: "Key (shelf_id, user_book_id)=(abc, def) already exists.",
  hint: "Check the shelf_books table",
};

/** Captures whatever the logger writes, whichever branch it takes. */
function captureLogs() {
  const written: string[] = [];
  const record = (...args: unknown[]) => {
    written.push(args.map((a) => JSON.stringify(a)).join(" "));
  };
  vi.spyOn(console, "log").mockImplementation(record);
  vi.spyOn(console, "error").mockImplementation(record);
  return written;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("reportError", () => {
  it("returns the generic message for a Supabase error", () => {
    captureLogs();
    expect(reportError("Error creating shelf", pgError)).toBe(
      GENERIC_ERROR_MESSAGE
    );
  });

  it("never returns the constraint name to the caller", () => {
    captureLogs();
    const returned = reportError("Error creating shelf", pgError);

    expect(returned).not.toContain("shelf_books");
    expect(returned).not.toContain("duplicate key");
    expect(returned).not.toContain("23505");
  });

  it("still logs the real detail server-side", () => {
    const written = captureLogs();
    reportError("Error creating shelf", pgError);

    const output = written.join("\n");
    expect(output).toContain("Error creating shelf");
    expect(output).toContain("23505");
  });

  it("merges call-site context into the log", () => {
    const written = captureLogs();
    reportError("Error creating comment", pgError, { userId: "user-123" });

    expect(written.join("\n")).toContain("user-123");
  });

  it("handles Error instances", () => {
    captureLogs();
    const thrown = new Error(
      "No AI API key configured. Please set GOOGLE_GENERATIVE_AI_API_KEY."
    );

    const returned = reportError("AI book search error", thrown);

    expect(returned).toBe(GENERIC_ERROR_MESSAGE);
    expect(returned).not.toContain("GOOGLE_GENERATIVE_AI_API_KEY");
  });

  it("handles non-Error throwables without crashing", () => {
    captureLogs();

    expect(reportError("scope", "a bare string")).toBe(GENERIC_ERROR_MESSAGE);
    expect(reportError("scope", null)).toBe(GENERIC_ERROR_MESSAGE);
    expect(reportError("scope", undefined)).toBe(GENERIC_ERROR_MESSAGE);
    expect(reportError("scope", { unexpected: "shape" })).toBe(
      GENERIC_ERROR_MESSAGE
    );
  });
});
