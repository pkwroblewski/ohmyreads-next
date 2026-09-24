import { describe, it, expect } from "vitest";
import { UncachedResult, serveUncachedResult } from "@/lib/cache/uncached-result";

describe("serveUncachedResult", () => {
  it("returns a cached value as it is", async () => {
    const get = serveUncachedResult(async (n: number) => n * 2);
    await expect(get(2)).resolves.toBe(4);
  });

  it("turns a thrown UncachedResult into the return value", async () => {
    const get = serveUncachedResult(async () => {
      throw new UncachedResult(["fallback"]);
    });
    await expect(get()).resolves.toEqual(["fallback"]);
  });

  it("rethrows any other error", async () => {
    const get = serveUncachedResult(async () => {
      throw new Error("db down");
    });
    await expect(get()).rejects.toThrow("db down");
  });
});
