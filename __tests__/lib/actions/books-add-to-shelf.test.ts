/**
 * addToShelf() — the most-called mutation in the app (Phase 2, Task 21, T1).
 *
 * The guards run in order (auth, rate limit, schema), the upsert carries the
 * right timestamp for the status and the (user_id, book_id) conflict target,
 * badges sync only when a book becomes read and a failed sync never turns a
 * successful shelf write into an error, and the caches that the write makes
 * stale are invalidated.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase, type MockSupabase } from "../../helpers/mock-supabase";

const { revalidatePath, invalidateTags, syncUserBadges, syncChallengeProgress, checkRateLimit } =
  vi.hoisted(() => ({
    revalidatePath: vi.fn(),
    invalidateTags: vi.fn(),
    syncUserBadges: vi.fn(),
    syncChallengeProgress: vi.fn(),
    checkRateLimit: vi.fn(),
  }));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/cache/tags", () => ({
  invalidateTags,
  CACHE_TAGS: { activity: "activity-feed", trending: "trending", books: "books" },
  BOOK_CATALOG_TAGS: ["books", "genres", "authors"],
}));
vi.mock("@/lib/actions/badges", () => ({ syncUserBadges }));
vi.mock("@/lib/actions/challenges", () => ({ syncChallengeProgress }));
vi.mock("@/lib/utils/rate-limit", () => ({ checkRateLimit }));
vi.mock("@/lib/utils/log", () => ({
  logError: vi.fn(),
  reportError: (msg: string) => msg,
}));

let mock: MockSupabase;
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => mock,
  getUser: () => mock.auth.getUser(),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => mock }));

import { addToShelf } from "@/lib/actions/books";

const USER = { id: "550e8400-e29b-41d4-a716-446655440000" };
const BOOK = "550e8400-e29b-41d4-a716-446655440001";

beforeEach(() => {
  vi.clearAllMocks();
  mock = createMockSupabase(USER);
  // `await supabase.from("user_books").upsert(...)` — resolve the upsert itself
  mock.upsert.mockResolvedValue({ error: null });
  checkRateLimit.mockResolvedValue({ allowed: true });
  syncChallengeProgress.mockResolvedValue({});
  syncUserBadges.mockResolvedValue({ newBadges: [{ name: "First Read", icon: "📖" }] });
});

describe("addToShelf guards", () => {
  it("refuses an anonymous caller before the rate limiter or the database", async () => {
    mock = createMockSupabase(null);

    expect(await addToShelf(BOOK, "read")).toEqual({ error: "Not authenticated" });
    expect(checkRateLimit).not.toHaveBeenCalled();
    expect(mock.upsert).not.toHaveBeenCalled();
  });

  it("stops at 20 shelf writes per minute per user", async () => {
    checkRateLimit.mockResolvedValue({ allowed: false });

    const result = await addToShelf(BOOK, "read");

    expect(result.error).toMatch(/too many/i);
    expect(checkRateLimit).toHaveBeenCalledWith(`book:${USER.id}`, 20, 60000);
    expect(mock.upsert).not.toHaveBeenCalled();
  });

  it("rejects an unknown status and a malformed book id before writing", async () => {
    expect((await addToShelf(BOOK, "abandoned")).error).toBeTruthy();
    expect((await addToShelf("not-a-uuid", "read")).error).toBeTruthy();
    expect(mock.upsert).not.toHaveBeenCalled();
    expect(invalidateTags).not.toHaveBeenCalled();
  });
});

describe("addToShelf write", () => {
  it("upserts on (user_id, book_id) with started_at for reading", async () => {
    const result = await addToShelf(BOOK, "reading");

    expect(result).toEqual({ success: true, newBadges: [] });
    expect(mock.from).toHaveBeenCalledWith("user_books");
    const [row, options] = mock.upsert.mock.calls[0];
    expect(row).toMatchObject({ user_id: USER.id, book_id: BOOK, status: "reading" });
    expect(row.started_at).toEqual(expect.any(String));
    expect(row).not.toHaveProperty("finished_at");
    expect(options).toEqual({ onConflict: "user_id,book_id", ignoreDuplicates: false });
  });

  it("sets finished_at for read and neither timestamp for want_to_read", async () => {
    await addToShelf(BOOK, "read");
    const read = mock.upsert.mock.calls[0][0];
    expect(read.finished_at).toEqual(expect.any(String));
    expect(read).not.toHaveProperty("started_at");

    await addToShelf(BOOK, "want_to_read");
    const want = mock.upsert.mock.calls[1][0];
    expect(want).not.toHaveProperty("started_at");
    expect(want).not.toHaveProperty("finished_at");
  });

  it("syncs badges only when a book becomes read, and returns the new ones", async () => {
    const result = await addToShelf(BOOK, "read");
    expect(result).toEqual({ success: true, newBadges: [{ name: "First Read", icon: "📖" }] });
    expect(syncUserBadges).toHaveBeenCalledTimes(1);
    expect(syncChallengeProgress).toHaveBeenCalledTimes(1);

    await addToShelf(BOOK, "reading");
    expect(syncUserBadges).toHaveBeenCalledTimes(1); // unchanged
    expect(syncChallengeProgress).toHaveBeenCalledTimes(2); // every status change
  });

  it("still reports success when the badge sync rejects", async () => {
    syncUserBadges.mockRejectedValue(new Error("badge service down"));

    const result = await addToShelf(BOOK, "read");

    expect(result).toEqual({ success: true, newBadges: [] });
    expect(invalidateTags).toHaveBeenCalled();
  });

  it("invalidates the activity and trending caches and the two pages", async () => {
    await addToShelf(BOOK, "reading");

    expect(invalidateTags).toHaveBeenCalledWith("activity-feed", "trending");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(revalidatePath).toHaveBeenCalledWith("/my-shelf");
  });

  it("surfaces a database error and invalidates nothing", async () => {
    mock.upsert.mockResolvedValue({ error: { message: "boom" } });

    const result = await addToShelf(BOOK, "read");

    expect(result).toEqual({ error: "Error adding to shelf" });
    expect(invalidateTags).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(syncUserBadges).not.toHaveBeenCalled();
  });
});
