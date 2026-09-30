/**
 * addStarterPicks() — the books a visitor picked on the homepage before
 * signing up (shelf design plan, Task 9). The ids come from the browser's
 * localStorage, so anything that is not a list of up to three real catalogue
 * ids is refused, and books already on the reader's shelf are never touched.
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

import { addStarterPicks } from "@/lib/actions/books";

const USER = { id: "550e8400-e29b-41d4-a716-446655440000" };
const A = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const B = "9b2f8c1e-3d4a-4f5b-8c6d-7e8f9a0b1c2d";

/** Books lookup (`.select().in()`) answers `found`; the upsert returns `inserted`. */
function script(found: string[], inserted: string[]) {
  mock.in.mockResolvedValueOnce({ data: found.map((id) => ({ id })), error: null });
  mock.select
    .mockReturnValueOnce(mock)
    .mockResolvedValueOnce({ data: inserted.map((id) => ({ id })), error: null });
}

beforeEach(() => {
  vi.clearAllMocks();
  mock = createMockSupabase(USER);
  checkRateLimit.mockResolvedValue({ allowed: true });
  syncChallengeProgress.mockResolvedValue({});
  syncUserBadges.mockResolvedValue({ success: true, newBadges: [] });
});

describe("addStarterPicks guards", () => {
  it("refuses an anonymous caller", async () => {
    mock = createMockSupabase(null);
    expect(await addStarterPicks([A])).toEqual({ success: false, error: "Not authenticated" });
    expect(mock.upsert).not.toHaveBeenCalled();
  });

  it.each([
    ["not an array", A],
    ["an empty list", []],
    ["more than three", [A, B, A, B]],
    ["a malformed id", ["not-a-uuid"]],
    ["the nil UUID", ["00000000-0000-0000-0000-000000000000"]],
    ["an object", [{ id: A }]],
  ])("rejects %s before touching the database", async (_, input) => {
    expect(await addStarterPicks(input)).toEqual({ success: false, error: "Invalid book IDs" });
    expect(mock.from).not.toHaveBeenCalled();
  });

  it("rejects ids that are not in the catalogue", async () => {
    mock.in.mockResolvedValueOnce({ data: [], error: null });
    expect(await addStarterPicks([A])).toEqual({ success: false, error: "Invalid book IDs" });
    expect(mock.upsert).not.toHaveBeenCalled();
  });
});

describe("addStarterPicks writes", () => {
  it("adds only catalogue books, as read with no invented date, without overwriting", async () => {
    script([A], [A]);

    expect(await addStarterPicks([A, B, A])).toEqual({ success: true, added: 1 });

    expect(mock.in).toHaveBeenCalledWith("id", [A, B]);
    const [rows, options] = mock.upsert.mock.calls[0];
    expect(rows).toEqual([
      expect.objectContaining({ user_id: USER.id, book_id: A, status: "read" }),
    ]);
    expect(rows[0]).not.toHaveProperty("finished_at");
    expect(options).toEqual({ onConflict: "user_id,book_id", ignoreDuplicates: true });
    expect(syncUserBadges).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/profile");
  });

  it("reports zero added when every pick was already on the shelf", async () => {
    script([A, B], []);
    expect(await addStarterPicks([A, B])).toEqual({ success: true, added: 0 });
  });
});
