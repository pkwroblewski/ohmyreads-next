/**
 * Tests for the location server actions (Phase 2, Task 5).
 *
 * `setPresence` copies `placeGeohash` straight into `profiles.location_geohash`,
 * which the nearby-readers RPC then prefix-matches. `updateLocationFromGeohash`
 * already checks the geohash alphabet; this pins the same check on the presence
 * path, which previously only capped the length.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/utils/rate-limit", () => ({
  checkRateLimit: vi
    .fn()
    .mockResolvedValue({ allowed: true, remaining: 9, resetIn: 60000 }),
}));

vi.mock("@/lib/utils/log", () => ({
  logError: vi.fn(),
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

const update = vi.fn();
const updateEq = vi.fn().mockResolvedValue({ error: null });

function createMockSupabase(user: { id: string } | null) {
  update.mockReturnValue({ eq: updateEq });
  return {
    from: vi.fn(() => ({ update })),
    auth: {
      getUser: vi.fn().mockResolvedValue(
        user
          ? { data: { user }, error: null }
          : { data: { user: null }, error: { message: "Not authenticated" } }
      ),
    },
  };
}

let mockSupabase: ReturnType<typeof createMockSupabase>;

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
  getUser: () => mockSupabase.auth.getUser(),
}));

const { setPresence } = await import("@/lib/actions/location");

describe("setPresence", () => {
  const userId = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase({ id: userId });
  });

  it("rejects an unauthenticated user", async () => {
    mockSupabase = createMockSupabase(null);

    const result = await setPresence({ type: "recommended" });

    expect(result).toEqual({ error: "Not authenticated" });
    expect(update).not.toHaveBeenCalled();
  });

  it("refuses a placeGeohash outside the geohash alphabet", async () => {
    // Twelve chars passes the length cap; `a`, `i`, `l`, `o` and `%` are not
    // base-32 geohash characters and would never prefix-match a real cell.
    for (const bad of ["u4pruy%", "ailo", "abc def", "u4pruydqqvj'"]) {
      const result = await setPresence({
        type: "recommended",
        placeName: "Cafe",
        placeGeohash: bad,
      });

      expect(result, bad).toEqual({ error: "Invalid geohash" });
    }
    expect(update).not.toHaveBeenCalled();
  });

  it("writes a well-formed placeGeohash as the user's location", async () => {
    const result = await setPresence({
      type: "recommended",
      placeName: "Cafe",
      placeGeohash: "u4pruydq",
    });

    expect(result).toMatchObject({ success: true, placeName: "Cafe" });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        location_geohash: "u4pruydq",
        location_label: "Cafe",
        location_enabled: true,
        presence_type: "recommended",
      })
    );
    expect(updateEq).toHaveBeenCalledWith("id", userId);
  });

  it("does not touch the location when no place is given", async () => {
    await setPresence({ type: "temporary", durationHours: 2 });

    const payload = update.mock.calls[0][0];
    expect(payload).not.toHaveProperty("location_geohash");
    expect(payload.presence_type).toBe("temporary");
  });
});
