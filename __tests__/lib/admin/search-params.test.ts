/**
 * Tests for the admin list pages' URL filter helpers (Task 23).
 *
 * These decide the behaviour the task's first Verify item asks for — filters
 * reflected in the URL, shareable, back-button-friendly — so they are worth
 * pinning down directly rather than only through the pages that use them.
 */

import { describe, it, expect } from "vitest";
import {
  toAdminParams,
  buildAdminQuery,
  readPage,
  readEnum,
} from "@/lib/admin/search-params";

describe("toAdminParams", () => {
  it("flattens Next's string | string[] | undefined into a string map", () => {
    expect(
      toAdminParams({ search: "dune", genre: ["scifi", "epic"], page: "2" })
    ).toEqual({ search: "dune", genre: "scifi", page: "2" });
  });

  it("drops absent and empty values so they never reach a query", () => {
    expect(toAdminParams({ search: "", genre: undefined, page: "1" })).toEqual({
      page: "1",
    });
  });
});

describe("buildAdminQuery", () => {
  it("preserves the filters it is not changing", () => {
    const query = buildAdminQuery(
      { search: "dune", sortBy: "title" },
      { page: 3 }
    );
    expect(query).toContain("search=dune");
    expect(query).toContain("sortBy=title");
    expect(query).toContain("page=3");
  });

  it("returns a leading ? only when there is something to encode", () => {
    expect(buildAdminQuery({}, {})).toBe("");
    expect(buildAdminQuery({}, { page: 2 })).toBe("?page=2");
  });

  it("removes a key set back to its default rather than writing it", () => {
    // Selecting "All Users" should leave a clean URL, not ?isAdmin=all
    expect(buildAdminQuery({ isAdmin: "true" }, { isAdmin: undefined })).toBe("");
    expect(buildAdminQuery({ isAdmin: "true" }, { isAdmin: "" })).toBe("");
  });

  it("overwrites rather than appending a repeated key", () => {
    expect(buildAdminQuery({ page: "2" }, { page: 5 })).toBe("?page=5");
  });

  it("encodes values that would otherwise break the query string", () => {
    const query = buildAdminQuery({}, { search: "a&b=c d" });
    expect(query).not.toContain("a&b=c d");
    expect(new URLSearchParams(query.slice(1)).get("search")).toBe("a&b=c d");
  });
});

describe("readPage", () => {
  it("reads a valid page", () => {
    expect(readPage({ page: "4" })).toBe(4);
  });

  it("falls back when the param is absent, zero, negative or not a number", () => {
    expect(readPage({})).toBe(1);
    expect(readPage({ page: "0" })).toBe(1);
    expect(readPage({ page: "-3" })).toBe(1);
    expect(readPage({ page: "banana" })).toBe(1);
  });
});

describe("readEnum", () => {
  const SORTS = ["created_at", "title"] as const;

  it("accepts a known value", () => {
    expect(readEnum({ sortBy: "title" }, "sortBy", SORTS, "created_at")).toBe(
      "title"
    );
  });

  it("falls back on a hand-edited URL rather than passing it to a query", () => {
    expect(
      readEnum({ sortBy: "id; drop table" }, "sortBy", SORTS, "created_at")
    ).toBe("created_at");
    expect(readEnum({}, "sortBy", SORTS, "created_at")).toBe("created_at");
  });
});
