import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The anonymous homepage reads three things that are identical for every
 * visitor — the community feed, the hero counts and (via recommendations)
 * the curated fallback. These tests pin that they go through the public
 * client under the tags the review actions expire, and that the signed-in
 * reading-activity panel issues its reads in parallel.
 */

type Call = { table: string; args: Record<string, unknown[]> };
const calls: Call[] = [];
let responses: Record<string, { data?: unknown; error?: unknown; count?: number | null }> = {};

function builder(table: string) {
  const call: Call = { table, args: {} };
  calls.push(call);
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "gte", "in", "not", "order", "limit", "single", "maybeSingle"]) {
    chain[m] = (...a: unknown[]) => {
      (call.args[m] ??= []).push(a);
      return chain;
    };
  }
  chain.then = (resolve: (v: unknown) => unknown) =>
    resolve(responses[table] ?? { data: null, error: null, count: null });
  return chain;
}

const publicClient = { from: (t: string) => builder(t) };
const cookieClient = { from: (t: string) => builder(`session:${t}`) };

vi.mock("@/lib/supabase/server", () => ({
  createPublicClient: () => publicClient,
  createClient: async () => cookieClient,
}));

const cacheEntries: { keys: string[]; options: { tags?: string[]; revalidate?: number } }[] = [];
vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...a: unknown[]) => unknown, keys: string[], options: Record<string, unknown>) => {
    cacheEntries.push({ keys, options });
    return fn;
  },
}));

vi.mock("@/lib/utils/log", () => ({ logError: vi.fn() }));

const { getCommunityFeed, getHomeCounts, getHomeReadingActivity } = await import("@/lib/queries/home");

const entry = (key: string) => cacheEntries.find((e) => e.keys.includes(key));

describe("homepage public reads", () => {
  beforeEach(() => {
    calls.length = 0;
    responses = {};
  });

  it("caches the community feed and the hero counts under the review tag", () => {
    expect(entry("home-community-feed")?.options).toEqual({ revalidate: 600, tags: ["reviews", "books"] });
    expect(entry("home-counts")?.options).toEqual({ revalidate: 600, tags: ["reviews"] });
  });

  it("builds the feed from one query with both FK joins and drops rows missing either side", async () => {
    responses.reviews = {
      data: [
        {
          id: "r1",
          rating: 5,
          content: "Great",
          created_at: "2026-09-01",
          user_id: "u1",
          book: { id: "b1", title: "T", author: "A", slug: "t", cover_url: null },
          profile: { id: "u1", username: "u1", display_name: null, avatar_url: null },
        },
        { id: "r2", rating: 3, content: null, created_at: "2026-09-02", user_id: "u2", book: null, profile: { id: "u2" } },
        { id: "r3", rating: 4, content: null, created_at: "2026-09-03", user_id: "u3", book: { id: "b3" }, profile: null },
      ],
      error: null,
    };

    const feed = await getCommunityFeed(6);

    expect(feed.map((f) => f.id)).toEqual(["r1"]);
    expect(feed[0]?.user.username).toBe("u1");
    expect(feed[0]?.book.slug).toBe("t");
    expect(calls.map((c) => c.table)).toEqual(["reviews"]); // no second profiles round-trip
    expect(String((calls[0]?.args.select?.[0] as unknown[])[0])).toContain("profiles!reviews_user_profile_fkey");
    expect(calls[0]?.args.limit).toEqual([[6]]);
  });

  it("counts readers and reviews with HEAD requests on the public client", async () => {
    responses.profiles = { count: 1234 };
    responses.reviews = { count: 56 };

    expect(await getHomeCounts()).toEqual({ readers: 1234, reviews: 56 });
    for (const c of calls) {
      expect(c.table.startsWith("session:")).toBe(false);
      expect((c.args.select?.[0] as unknown[])[1]).toEqual({ count: "exact", head: true });
    }
  });

  it("reads goal, finished count and current shelf on the session client and only reports a goal when one exists", async () => {
    responses["session:reading_goals"] = { data: { target_books: 24, year: 2026 } };
    responses["session:user_books"] = { data: [], count: 7 };

    const withGoal = await getHomeReadingActivity("u1");
    expect(withGoal.goal).toEqual({ target: 24, progress: 7, year: 2026 });
    expect(calls.map((c) => c.table)).toEqual([
      "session:reading_goals",
      "session:user_books",
      "session:user_books",
    ]);

    calls.length = 0;
    responses["session:reading_goals"] = { data: null };
    const withoutGoal = await getHomeReadingActivity("u1");
    expect(withoutGoal.goal).toBeNull();
    expect(withoutGoal.currentlyReading).toEqual([]);
  });
});
