// @vitest-environment node
/**
 * getNearbyReaders() after migration 065.
 *
 * The location / presence columns on `profiles` are no longer selectable by
 * the anon or authenticated roles; the only read path is the
 * `get_nearby_readers()` RPC, which applies the visibility rules in SQL.
 * These tests pin the contract: the query calls the RPC with the searched
 * cell plus its neighbours, never touches `profiles` directly, and trusts
 * the RPC's rows instead of re-filtering them.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const rpc = vi.fn();
const from = vi.fn();
const logError = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createPublicClient: () => ({ rpc, from }),
  createClient: async () => ({ rpc, from }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc, from }),
}));

vi.mock("@/lib/utils/log", () => ({
  logError: (...args: unknown[]) => logError(...args),
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { getNearbyReaders, getUserLocation } from "@/lib/queries/geo";
import { getNeighbors } from "@/lib/utils/geohash";

const READER = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  username: "ada",
  display_name: "Ada",
  avatar_url: null,
  location_label: "Berlin",
  location_geohash: "u33dc1",
  presence_type: "temporary",
  presence_expires_at: "2099-01-01T00:00:00.000Z",
  presence_note: "reading in the park",
};

function userBooksChain(rows: unknown[]) {
  const chain = {
    select: vi.fn(() => chain),
    in: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(async () => ({ data: rows })),
  };
  return chain;
}

describe("getNearbyReaders", () => {
  beforeEach(() => {
    rpc.mockReset();
    from.mockReset();
    logError.mockReset();
  });

  it("asks the RPC for the searched cell and its surrounding cells", async () => {
    rpc.mockResolvedValue({ data: [], error: null });

    await getNearbyReaders("u33d", 25);

    expect(rpc).toHaveBeenCalledTimes(1);
    const [name, args] = rpc.mock.calls[0];
    expect(name).toBe("get_nearby_readers");
    expect(args.p_limit).toBe(25);
    expect(args.p_prefixes).toEqual(getNeighbors("u33d"));
    expect(args.p_prefixes.length).toBeGreaterThan(1);
    expect(args.p_prefixes).toContain("u33d");
  });

  it("never reads the profiles table directly", async () => {
    rpc.mockResolvedValue({ data: [READER], error: null });
    from.mockImplementation(() => userBooksChain([]));

    await getNearbyReaders("u33d");

    const tables = from.mock.calls.map((c) => c[0]);
    expect(tables).not.toContain("profiles");
    expect(tables).toEqual(["user_books"]);
  });

  it("returns the RPC rows as-is, merged with the current read", async () => {
    rpc.mockResolvedValue({ data: [READER], error: null });
    from.mockImplementation(() =>
      userBooksChain([
        {
          user_id: READER.id,
          book: { id: "b1", title: "Dune", author: "Herbert", cover_url: null, slug: "dune" },
        },
      ])
    );

    const readers = await getNearbyReaders("u33d");

    expect(readers).toHaveLength(1);
    expect(readers[0]).toMatchObject({
      id: READER.id,
      location_geohash: "u33dc1",
      presence_type: "temporary",
      currently_reading: { id: "b1", slug: "dune" },
    });
  });

  it("rejects an invalid geohash before touching the database", async () => {
    expect(await getNearbyReaders("not a geohash!")).toEqual([]);
    expect(await getNearbyReaders("")).toEqual([]);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns an empty list and logs when the RPC fails", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });

    expect(await getNearbyReaders("u33d")).toEqual([]);
    expect(logError).toHaveBeenCalledTimes(1);
    expect(from).not.toHaveBeenCalled();
  });
});

describe("getUserLocation", () => {
  beforeEach(() => {
    rpc.mockReset();
    from.mockReset();
  });

  it("reads the caller's own row through get_my_profile", async () => {
    const maybeSingle = vi.fn(async () => ({
      data: {
        id: READER.id,
        location_enabled: true,
        location_geohash: "u33dc1",
        location_label: "Berlin",
        location_precision: 7,
      },
      error: null,
    }));
    rpc.mockReturnValue({ maybeSingle });

    const result = await getUserLocation(READER.id);

    expect(rpc).toHaveBeenCalledWith("get_my_profile");
    expect(from).not.toHaveBeenCalled();
    expect(result).toEqual({ enabled: true, geohash: "u33dc1", label: "Berlin", precision: 7 });
  });

  it("returns null when asked about someone other than the signed-in user", async () => {
    const maybeSingle = vi.fn(async () => ({ data: { id: READER.id }, error: null }));
    rpc.mockReturnValue({ maybeSingle });

    expect(await getUserLocation("00000000-0000-4000-8000-000000000000")).toBeNull();
  });
});
