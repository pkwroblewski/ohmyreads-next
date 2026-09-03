import { describe, it, expect } from "vitest";
import { parseBrowseParams } from "@/lib/validation/search";

const GENRES = ["Fiction", "Fantasy", "Literary Fiction"];

describe("parseBrowseParams", () => {
  it("defaults to the unfiltered popular view", () => {
    expect(parseBrowseParams({}, GENRES)).toEqual({ q: "", genre: null, sort: "popular" });
  });

  it("accepts a genre only when the page offers it", () => {
    expect(parseBrowseParams({ genre: "Literary Fiction" }, GENRES).genre).toBe(
      "Literary Fiction"
    );
    expect(parseBrowseParams({ genre: "Not A Genre" }, GENRES).genre).toBeNull();
    expect(parseBrowseParams({ genre: "fantasy" }, GENRES).genre).toBeNull();
  });

  it("accepts only known sort orders", () => {
    expect(parseBrowseParams({ sort: "title" }, GENRES).sort).toBe("title");
    expect(parseBrowseParams({ sort: "sideways" }, GENRES).sort).toBe("popular");
  });

  it("trims and caps the query", () => {
    expect(parseBrowseParams({ q: "  king " }, GENRES).q).toBe("king");
    expect(parseBrowseParams({ q: "x".repeat(300) }, GENRES).q).toHaveLength(200);
  });
});
