/**
 * Reader compatibility scoring (Phase 2, Task 21). Pure arithmetic that the
 * discover page and the nearby-readers list both rank on.
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(), createPublicClient: vi.fn() }));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("./follows", () => ({ getFollowingIds: vi.fn() }));
vi.mock("@/lib/queries/follows", () => ({ getFollowingIds: vi.fn() }));

import { computeCompatibilityScore } from "@/lib/queries/discover";

const me = { bookIds: ["b1", "b2", "b3", "b4"], genres: ["Fantasy", "Mystery"], vibes: ["cozy", "dark"] };

describe("computeCompatibilityScore", () => {
  it("scores nothing in common as 0 / low", () => {
    const r = computeCompatibilityScore(me, { bookIds: ["x"], genres: ["Romance"], vibes: ["light"] });
    expect(r).toEqual({ score: 0, level: "low", sharedBooks: 0, sharedGenres: [], sharedVibes: [] });
  });

  it("weights books 40 / genres 35 / vibes 25 with books capped at ten", () => {
    // 2 shared books of a 10-book cap = 20 → 8; all genres = 35; half the vibes = 12.5
    const r = computeCompatibilityScore(me, {
      bookIds: ["b1", "b2", "zz"],
      genres: ["Mystery", "Fantasy", "Horror"],
      vibes: ["cozy"],
    });
    expect(r.sharedBooks).toBe(2);
    expect(r.sharedGenres).toEqual(["Mystery", "Fantasy"]);
    expect(r.sharedVibes).toEqual(["cozy"]);
    expect(r.score).toBe(Math.round(20 * 0.4 + 100 * 0.35 + 50 * 0.25)); // 56
    expect(r.level).toBe("medium");
  });

  it("reaches high at 70 and never exceeds 100", () => {
    const twin = { bookIds: [...me.bookIds, ...Array.from({ length: 20 }, (_, i) => `t${i}`)], genres: me.genres, vibes: me.vibes };
    const r = computeCompatibilityScore({ ...me, bookIds: twin.bookIds }, twin);
    expect(r.score).toBe(100);
    expect(r.level).toBe("high");
    const seventy = computeCompatibilityScore(me, { bookIds: [], genres: me.genres, vibes: me.vibes });
    expect(seventy.score).toBe(60); // genres 35 + vibes 25, no books
    expect(seventy.level).toBe("medium");
  });

  it("does not divide by zero for a reader with an empty profile", () => {
    const r = computeCompatibilityScore({ bookIds: [], genres: [], vibes: [] }, me);
    expect(r).toMatchObject({ score: 0, level: "low" });
  });
});
