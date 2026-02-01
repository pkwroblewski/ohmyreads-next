/**
 * Tests for search parameter validation (Task 9)
 * Validates that the Zod schema correctly validates/rejects search parameters
 */

import { describe, it, expect } from "vitest";
import {
  searchParamsSchema,
  parseSearchParams,
  SORT_OPTIONS,
  GENRE_OPTIONS,
} from "@/lib/validation/search";

describe("searchParamsSchema", () => {
  describe("query parameter (q)", () => {
    it("should accept valid search query", () => {
      const result = searchParamsSchema.safeParse({ q: "fantasy books" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.q).toBe("fantasy books");
      }
    });

    it("should trim whitespace from query", () => {
      const result = searchParamsSchema.safeParse({ q: "  fantasy books  " });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.q).toBe("fantasy books");
      }
    });

    it("should strip special PostgREST characters", () => {
      const result = searchParamsSchema.safeParse({
        q: "fantasy% OR books_test()",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.q).toBe("fantasy OR bookstest");
      }
    });

    it("should reject query longer than 200 characters", () => {
      const longQuery = "a".repeat(201);
      const result = searchParamsSchema.safeParse({ q: longQuery });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("too long");
      }
    });

    it("should default to empty string when not provided", () => {
      const result = searchParamsSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.q).toBe("");
      }
    });
  });

  describe("sort parameter", () => {
    it("should accept all valid sort options", () => {
      for (const sort of SORT_OPTIONS) {
        const result = searchParamsSchema.safeParse({ sort });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.sort).toBe(sort);
        }
      }
    });

    it("should reject invalid sort option", () => {
      const result = searchParamsSchema.safeParse({ sort: "invalid" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("Invalid sort option");
      }
    });

    it("should default to 'popular' when not provided", () => {
      const result = searchParamsSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sort).toBe("popular");
      }
    });
  });

  describe("genre parameter", () => {
    it("should accept all valid genre options", () => {
      for (const genre of GENRE_OPTIONS) {
        const result = searchParamsSchema.safeParse({ genre });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.genre).toBe(genre);
        }
      }
    });

    it("should reject invalid genre", () => {
      const result = searchParamsSchema.safeParse({ genre: "InvalidGenre" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("Invalid genre");
      }
    });

    it("should accept null genre", () => {
      const result = searchParamsSchema.safeParse({ genre: null });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.genre).toBeNull();
      }
    });

    it("should accept undefined genre", () => {
      const result = searchParamsSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.genre).toBeUndefined();
      }
    });
  });

  describe("page parameter", () => {
    it("should accept valid page number", () => {
      const result = searchParamsSchema.safeParse({ page: "5" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(5);
      }
    });

    it("should coerce string to number", () => {
      const result = searchParamsSchema.safeParse({ page: "10" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(10);
      }
    });

    it("should reject page less than 1", () => {
      const result = searchParamsSchema.safeParse({ page: "0" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("at least 1");
      }
    });

    it("should reject negative page", () => {
      const result = searchParamsSchema.safeParse({ page: "-1" });
      expect(result.success).toBe(false);
    });

    it("should default to 1 when not provided", () => {
      const result = searchParamsSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
      }
    });
  });

  describe("limit parameter", () => {
    it("should accept valid limit", () => {
      const result = searchParamsSchema.safeParse({ limit: "25" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(25);
      }
    });

    it("should reject limit less than 1", () => {
      const result = searchParamsSchema.safeParse({ limit: "0" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("at least 1");
      }
    });

    it("should reject limit greater than 50", () => {
      const result = searchParamsSchema.safeParse({ limit: "100" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("cannot exceed 50");
      }
    });

    it("should default to 20 when not provided", () => {
      const result = searchParamsSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(20);
      }
    });
  });
});

describe("parseSearchParams", () => {
  it("should parse valid URLSearchParams", () => {
    const params = new URLSearchParams();
    params.set("q", "fantasy");
    params.set("sort", "rating");
    params.set("genre", "Fiction");
    params.set("page", "2");
    params.set("limit", "30");

    const result = parseSearchParams(params);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.q).toBe("fantasy");
      expect(result.data.sort).toBe("rating");
      expect(result.data.genre).toBe("Fiction");
      expect(result.data.page).toBe(2);
      expect(result.data.limit).toBe(30);
    }
  });

  it("should return error for invalid sort", () => {
    const params = new URLSearchParams();
    params.set("sort", "invalid");

    const result = parseSearchParams(params);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("sort");
      expect(result.error).toContain("Invalid sort option");
    }
  });

  it("should return error for invalid genre", () => {
    const params = new URLSearchParams();
    params.set("genre", "NotAGenre");

    const result = parseSearchParams(params);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("genre");
      expect(result.error).toContain("Invalid genre");
    }
  });

  it("should handle empty URLSearchParams with defaults", () => {
    const params = new URLSearchParams();

    const result = parseSearchParams(params);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.q).toBe("");
      expect(result.data.sort).toBe("popular");
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
    }
  });
});

describe("constants", () => {
  it("SORT_OPTIONS should have expected values", () => {
    expect(SORT_OPTIONS).toContain("popular");
    expect(SORT_OPTIONS).toContain("newest");
    expect(SORT_OPTIONS).toContain("rating");
    expect(SORT_OPTIONS).toContain("title");
    expect(SORT_OPTIONS.length).toBe(4);
  });

  it("GENRE_OPTIONS should have expected genres", () => {
    expect(GENRE_OPTIONS).toContain("Fiction");
    expect(GENRE_OPTIONS).toContain("Non-Fiction");
    expect(GENRE_OPTIONS).toContain("Science Fiction");
    expect(GENRE_OPTIONS).toContain("Fantasy");
    expect(GENRE_OPTIONS.length).toBe(20);
  });
});
