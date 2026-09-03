import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * /my-shelf and the public profile count shelves in SQL rather than by
 * loading every row: three HEAD counts (one per status, whose sum is `all`)
 * and, for a custom shelf, one inner-joined page instead of a four-query
 * waterfall. These tests pin the request shapes the page relies on.
 */

type Call = { table: string; args: Record<string, unknown[]> };
const calls: Call[] = [];
let respond: (call: Call) => { data?: unknown; error?: unknown; count?: number | null } = () => ({
  data: null,
  error: null,
  count: null,
});

function builder(table: string) {
  const call: Call = { table, args: {} };
  calls.push(call);
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order", "range", "limit", "single", "maybeSingle", "is"]) {
    chain[m] = (...a: unknown[]) => {
      (call.args[m] ??= []).push(a);
      return chain;
    };
  }
  chain.then = (resolve: (v: unknown) => unknown) => resolve(respond(call));
  return chain;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: (t: string) => builder(t) }),
  createPublicClient: () => ({ from: (t: string) => builder(t) }),
}));

vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...a: unknown[]) => unknown) => fn,
}));

const logError = vi.fn();
vi.mock("@/lib/utils/log", () => ({ logError: (...a: unknown[]) => logError(...a) }));

const { getShelfCounts, getUserBooks, getUserStats, SHELF_PAGE_SIZE } = await import("@/lib/queries/users");

const statusOf = (call: Call) =>
  (call.args.eq?.find((a) => (a as unknown[])[0] === "status") as unknown[] | undefined)?.[1];

describe("shelf counts", () => {
  beforeEach(() => {
    calls.length = 0;
    logError.mockClear();
  });

  it("issues one HEAD count per status and sums them for `all`", async () => {
    respond = (call) => ({ count: { reading: 3, read: 1200, want_to_read: 7 }[statusOf(call) as string] ?? null });

    const counts = await getShelfCounts("u1");

    expect(counts).toEqual({ all: 1210, reading: 3, read: 1200, want_to_read: 7 });
    expect(calls).toHaveLength(3);
    for (const call of calls) {
      expect(call.table).toBe("user_books");
      expect((call.args.select?.[0] as unknown[])[1]).toEqual({ count: "exact", head: true });
      expect(call.args.eq).toContainEqual(["user_id", "u1"]);
    }
  });

  it("treats a failed count as zero and logs it, rather than throwing the page", async () => {
    respond = (call) => (statusOf(call) === "read" ? { error: { message: "boom" }, count: null } : { count: 2 });

    expect(await getShelfCounts("u1")).toEqual({ all: 4, reading: 2, read: 0, want_to_read: 2 });
    expect(logError).toHaveBeenCalledTimes(1);
  });

  it("feeds the profile stats from the same counts plus one review count", async () => {
    respond = (call) => (call.table === "reviews" ? { count: 9 } : { count: 4 });

    expect(await getUserStats("u1")).toEqual({
      booksRead: 4,
      booksReading: 4,
      booksWantToRead: 4,
      totalBooks: 12,
      reviewsCount: 9,
    });
    expect(calls.map((c) => c.table).sort()).toEqual(["reviews", "user_books", "user_books", "user_books"]);
  });
});

describe("shelf pages", () => {
  beforeEach(() => {
    calls.length = 0;
    respond = () => ({ data: [{ id: "ub1" }], count: 130 });
  });

  it("pages a status shelf with an exact count and no shelf join", async () => {
    const page = await getUserBooks("u1", { status: "read", limit: SHELF_PAGE_SIZE, offset: 96 });

    expect(page.total).toBe(130);
    expect(page.userBooks).toHaveLength(1);
    const call = calls[0]!;
    expect(String((call.args.select?.[0] as unknown[])[0])).not.toContain("shelf_books");
    expect(call.args.eq).toEqual([
      ["user_id", "u1"],
      ["status", "read"],
    ]);
    expect(call.args.range).toEqual([[96, 96 + SHELF_PAGE_SIZE - 1]]);
  });

  it("filters a custom shelf through an inner join on shelf_books in the same query", async () => {
    await getUserBooks("u1", { shelfId: "shelf-9", limit: 48 });

    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(String((call.args.select?.[0] as unknown[])[0])).toContain("shelf_books!inner(shelf_id)");
    expect(call.args.eq).toEqual([
      ["user_id", "u1"],
      ["shelf_books.shelf_id", "shelf-9"],
    ]);
    expect(call.args.range).toEqual([[0, 47]]);
  });
});
