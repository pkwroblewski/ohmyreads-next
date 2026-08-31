/**
 * Tests for production log shape (Task 24).
 *
 * Task 24 replaced 300+ `console.error("Msg:", err)` calls across `lib/` and
 * `app/` with `logError`. The point of that migration is what these assert:
 * in production the output is a single structured JSON line a log aggregator
 * can search, and Postgres internals are scrubbed out of it rather than
 * printed raw into the log stream.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { logError, logger, reportError, GENERIC_ERROR_MESSAGE } from "@/lib/utils/log";

/** Capture whatever the logger writes, and return it parsed. */
function captureProd(fn: () => void): Record<string, unknown> {
  vi.stubEnv("NODE_ENV", "production");
  const spy = vi.spyOn(console, "log").mockImplementation(() => {});
  try {
    fn();
    expect(spy).toHaveBeenCalledTimes(1);
    return JSON.parse(spy.mock.calls[0][0] as string);
  } finally {
    spy.mockRestore();
  }
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("production log output", () => {
  it("emits one parseable JSON line with level, message and timestamp", () => {
    const entry = captureProd(() =>
      logError("Error in getUserShelves", new Error("boom"))
    );

    expect(entry.level).toBe("error");
    expect(entry.message).toBe("Error in getUserShelves");
    expect(typeof entry.timestamp).toBe("string");
    expect(Number.isNaN(Date.parse(entry.timestamp as string))).toBe(false);
  });

  it("merges caller context alongside the extracted error fields", () => {
    const entry = captureProd(() =>
      logError("Failed to send welcome email", new Error("nope"), {
        userId: "abc-123",
      })
    );

    const context = entry.context as Record<string, unknown>;
    expect(context.userId).toBe("abc-123");
    expect(context.errorName).toBe("Error");
    expect(context.errorMessage).toBe("nope");
  });

  it("omits stack traces in production", () => {
    const entry = captureProd(() => logError("Boom", new Error("with stack")));
    const context = entry.context as Record<string, unknown>;
    expect(context.errorStack).toBeUndefined();
  });

  describe("Supabase errors are scrubbed, not printed raw", () => {
    // A PostgREST error object: a plain object, not an Error instance.
    const pgError = {
      code: "23505",
      message:
        'duplicate key value violates unique constraint "books_isbn_key" SELECT * FROM /var/app/secret.ts',
      details: "Key (isbn)=(123) already exists.",
      hint: "internal hint",
    };

    it("keeps the error code, which is the searchable part", () => {
      const entry = captureProd(() => logError("Insert failed", pgError));
      expect((entry.context as Record<string, unknown>).errorCode).toBe("23505");
    });

    it("masks SQL keywords and file paths out of the message", () => {
      const entry = captureProd(() => logError("Insert failed", pgError));
      const message = (entry.context as Record<string, unknown>)
        .errorMessage as string;

      expect(message).not.toContain("SELECT");
      expect(message).not.toContain("/var/app/secret.ts");
      expect(message).toContain("[sql]");
      expect(message).toContain("[path]");
    });

    it("withholds details and hint outside development", () => {
      const entry = captureProd(() => logError("Insert failed", pgError));
      const context = entry.context as Record<string, unknown>;
      expect(context.errorDetails).toBeUndefined();
      expect(context.errorHint).toBeUndefined();
    });
  });

  it("drops debug output in production unless DEBUG_LOGS is set", () => {
    vi.stubEnv("NODE_ENV", "production");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      logger.debug("Non-critical error in getTasteProfile", { errorCode: "PGRST116" });
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});

describe("reportError", () => {
  it("logs the same structured entry and returns the client-safe copy", () => {
    let returned = "";
    const entry = captureProd(() => {
      returned = reportError("Error creating shelf", {
        code: "42501",
        message: 'permission denied for table "shelves"',
      });
    });

    expect(returned).toBe(GENERIC_ERROR_MESSAGE);
    expect(entry.level).toBe("error");
    expect((entry.context as Record<string, unknown>).errorCode).toBe("42501");
    // The raw Postgres text must not be what the caller hands back.
    expect(returned).not.toContain("permission denied");
  });
});
