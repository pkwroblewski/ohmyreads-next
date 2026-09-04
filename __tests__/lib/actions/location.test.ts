/**
 * Location server actions (Phase 2, Task 5 and Task 21, T8).
 *
 * `setPresence` copies `placeGeohash` straight into `profiles.location_geohash`,
 * which the nearby-readers RPC then prefix-matches, so the geohash alphabet is
 * checked on that path too. `updateLocation` clamps the precision to 4–8 cells
 * and stores exactly what the shared encoder produces for those inputs.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase, type MockSupabase } from "../../helpers/mock-supabase";
import { encodeGeohash } from "@/lib/utils/geohash";

const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));

vi.mock("@/lib/utils/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 9, resetIn: 60000 }),
}));

vi.mock("@/lib/utils/log", () => ({
  logError: vi.fn(),
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

let mock: MockSupabase;

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mock)),
  getUser: () => mock.auth.getUser(),
}));

const { setPresence, updateLocation } = await import("@/lib/actions/location");

const userId = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

beforeEach(() => {
  vi.clearAllMocks();
  mock = createMockSupabase({ id: userId });
});

describe("setPresence", () => {
  it("rejects an unauthenticated user", async () => {
    mock = createMockSupabase(null);

    const result = await setPresence({ type: "recommended" });

    expect(result).toEqual({ success: false, error: "Not authenticated" });
    expect(mock.update).not.toHaveBeenCalled();
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

      expect(result, bad).toEqual({ success: false, error: "Invalid geohash" });
    }
    expect(mock.update).not.toHaveBeenCalled();
  });

  it("writes a well-formed placeGeohash as the user's location", async () => {
    const result = await setPresence({
      type: "recommended",
      placeName: "Cafe",
      placeGeohash: "u4pruydq",
    });

    expect(result).toMatchObject({ success: true, placeName: "Cafe" });
    expect(mock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        location_geohash: "u4pruydq",
        location_label: "Cafe",
        location_enabled: true,
        presence_type: "recommended",
      })
    );
    expect(mock.eq).toHaveBeenCalledWith("id", userId);
    expect(revalidatePath).toHaveBeenCalledWith("/settings");
    expect(revalidatePath).toHaveBeenCalledWith("/profile");
    expect(revalidatePath).toHaveBeenCalledWith("/community/map");
  });

  it("does not touch the location when no place is given", async () => {
    await setPresence({ type: "temporary", durationHours: 2 });

    const payload = mock.update.mock.calls[0][0];
    expect(payload).not.toHaveProperty("location_geohash");
    expect(payload.presence_type).toBe("temporary");
  });
});

describe("updateLocation", () => {
  const input = { lat: 52.2297, lng: 21.0122, label: "Warsaw" };

  it("rejects an unauthenticated user and out-of-range coordinates", async () => {
    mock = createMockSupabase(null);
    expect(await updateLocation(input)).toEqual({ success: false, error: "Not authenticated" });

    mock = createMockSupabase({ id: userId });
    expect((await updateLocation({ ...input, lat: 91 })).error).toBeTruthy();
    expect((await updateLocation({ ...input, lng: -181 })).error).toBeTruthy();
    expect(mock.update).not.toHaveBeenCalled();
  });

  it("stores the encoder's geohash at the default precision of 6", async () => {
    const result = await updateLocation(input);

    const expected = encodeGeohash(input.lat, input.lng, 6);
    expect(expected).toHaveLength(6);
    expect(result).toEqual({ success: true, geohash: expected, label: "Warsaw" });
    expect(mock.from).toHaveBeenCalledWith("profiles");
    expect(mock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        location_enabled: true,
        location_geohash: expected,
        location_label: "Warsaw",
        location_precision: 6,
        location_updated_at: expect.any(String),
      })
    );
    expect(mock.eq).toHaveBeenCalledWith("id", userId);
    expect(revalidatePath).toHaveBeenCalledWith("/settings");
    expect(revalidatePath).toHaveBeenCalledWith("/profile");
  });

  it("clamps the precision to 4–8 and the stored hash length follows it", async () => {
    for (const [asked, stored] of [
      [1, 4],
      [4, 4],
      [7, 7],
      [8, 8],
      [12, 8],
    ] as const) {
      mock = createMockSupabase({ id: userId });
      const result = await updateLocation({ ...input, precision: asked });
      expect(result, `precision ${asked}`).toMatchObject({ geohash: encodeGeohash(input.lat, input.lng, stored) });
      expect(mock.update.mock.calls[0][0], `precision ${asked}`).toMatchObject({
        location_precision: stored,
        location_geohash: expect.stringMatching(new RegExp(`^[0-9b-hjkmnp-z]{${stored}}$`)),
      });
    }
  });

  it("cuts the label at 200 characters", async () => {
    await updateLocation({ ...input, label: "x".repeat(200) });
    expect(mock.update.mock.calls[0][0].location_label).toHaveLength(200);
    expect((await updateLocation({ ...input, label: "x".repeat(201) })).error).toBeTruthy();
  });
});
