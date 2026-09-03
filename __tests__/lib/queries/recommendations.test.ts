import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `getPersonalizedRecommendations` used to run six reads in a row per view;
 * now the four about the reader go out together on the session client and
 * the 200-book pool with its vibe tags comes from one shared cache entry.
 */

type Call = { client: string; table: string; args: Record<string, unknown[]> };
const calls: Call[] = [];
const started: string[] = [];
let responses: Record<string, { data?: unknown; error?: unknown; count?: number | null }> = {};

function builder(client: string, table: string) {
  const call: Call = { client, table, args: {} };
  calls.push(call);
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "gte", "in", "not", "order", "limit", "single"]) {
    chain[m] = (...a: unknown[]) => {
      (call.args[m] ??= []).push(a);
      return chain;
    };
  }
  chain.then = (resolve: (v: unknown) => unknown) => {
    started.push(`${client}:${table}`);
    // Resolve on a later tick so a serial caller would leave a gap between starts.
    return new Promise((r) => setTimeout(r, 0)).then(() =>
      resolve(responses[`${client}:${table}`] ?? { data: null, error: null, count: null })
    );
  };
  return chain;
}

vi.mock("@/lib/supabase/server", () => ({
  createPublicClient: () => ({ from: (t: string) => builder("public", t) }),
  createClient: async () => ({ from: (t: string) => builder("session", t) }),
}));

const cacheEntries: { keys: string[]; options: { tags?: string[]; revalidate?: number } }[] = [];
vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...a: unknown[]) => unknown, keys: string[], options: Record<string, unknown>) => {
    cacheEntries.push({ keys, options });
    return fn;
  },
}));

vi.mock("@/lib/utils/log", () => ({ logError: vi.fn() }));

const { getPersonalizedRecommendations, getCuratedBooks } = await import("@/lib/queries/recommendations");

const entry = (key: string) => cacheEntries.find((e) => e.keys.includes(key));

describe("recommendation caches", () => {
  beforeEach(() => {
    calls.length = 0;
    started.length = 0;
    responses = {};
  });

  it("caches the candidate pool and the curated fallback under the tags that change them", () => {
    expect(entry("recommendation-candidate-pool")?.options).toEqual({
      revalidate: 1800,
      tags: ["books", "reviews"],
    });
    expect(entry("curated-fallback")?.options).toEqual({ revalidate: 600, tags: ["books"] });
  });

  it("starts the four reader reads and the pool together, and scores from the pool's vibe map", async () => {
    responses["session:user_taste_profiles"] = {
      data: { preferred_genres: ["Fantasy"], preferred_vibes: ["cozy"] },
    };
    responses["session:user_books"] = { data: [{ book_id: "owned" }] };
    responses["session:reviews"] = { data: [] };
    responses["public:books"] = {
      data: [
        { id: "owned", title: "Owned", genres: ["Fantasy"], average_rating: 4.5, ratings_count: 50 },
        { id: "b1", title: "Pick", genres: ["Fantasy"], average_rating: 4.2, ratings_count: 20 },
        { id: "b2", title: "Meh", genres: ["Finance"], average_rating: 3.1, ratings_count: 2 },
      ],
    };
    responses["public:reviews"] = { data: [{ book_id: "b1", vibe_tags: ["cozy", "cozy"] }] };

    const recs = await getPersonalizedRecommendations("u1", 10);

    // Every read was *started* before any resolved: no serial waterfall.
    const firstFive = started.slice(0, 5).sort();
    expect(firstFive).toEqual(
      ["public:books", "session:reviews", "session:user_books", "session:user_books", "session:user_taste_profiles"].sort()
    );
    expect(recs.map((r) => r.id)).toEqual(["b1"]); // owned book excluded, off-taste book scores 0
    expect(recs[0]?.score).toBe(30 + 25 + 10 + 5); // genre + vibe (from the pool map) + rating + popular
  });

  it("serves the anonymous curated list from the public client", async () => {
    responses["public:books"] = {
      data: [{ id: "b1", title: "A", genres: ["Fantasy"], average_rating: 4.4, ratings_count: 30 }],
    };

    const books = await getCuratedBooks(undefined, 4);

    expect(books.map((b) => b.id)).toEqual(["b1"]);
    expect(calls.every((c) => c.client === "public")).toBe(true);
  });
});
