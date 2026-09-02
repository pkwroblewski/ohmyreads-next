// @vitest-environment node
/**
 * GET /api/geo/readers after migration 065.
 *
 * The route is the public face of the reader map. It must only ever search
 * at the coarse 4-character cell (~20 km) whatever precision the client sends,
 * and its response must contain nothing but the fields the map needs — no
 * email, inbox or admin columns can leak through even if the query layer
 * were to return them.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const getNearbyReaders = vi.fn();
const checkRateLimit = vi.fn();

vi.mock("@/lib/queries/geo", () => ({
  getNearbyReaders: (...args: unknown[]) => getNearbyReaders(...args),
}));

vi.mock("@/lib/utils/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimit(...args),
  getClientIp: () => "203.0.113.5",
}));

vi.mock("@/lib/utils/log", () => ({
  logError: vi.fn(),
}));

import { GET } from "@/app/api/geo/readers/route";

function req(query: string): NextRequest {
  return new NextRequest(new URL(`/api/geo/readers${query}`, "https://ohmyreads-next.vercel.app"));
}

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
  currently_reading: { id: "b1", title: "Dune", author: "Herbert", cover_url: null, slug: "dune" },
  // Fields that must never reach the wire, even if the query returned them
  email_digest_enabled: true,
  unread_messages_count: 7,
  is_admin: true,
};

describe("GET /api/geo/readers", () => {
  beforeEach(() => {
    getNearbyReaders.mockReset();
    checkRateLimit.mockReset();
    checkRateLimit.mockResolvedValue({ allowed: true });
  });

  it("searches at the coarse 4-character cell regardless of the requested precision", async () => {
    getNearbyReaders.mockResolvedValue([]);

    const res = await GET(req("?geohash=U33DC1XYZ"));

    expect(res.status).toBe(200);
    expect(getNearbyReaders).toHaveBeenCalledWith("u33d", 50);
  });

  it("caps the limit at 100", async () => {
    getNearbyReaders.mockResolvedValue([]);

    await GET(req("?geohash=u33dc&limit=5000"));

    expect(getNearbyReaders).toHaveBeenCalledWith("u33d", 100);
  });

  it("returns only the whitelisted reader fields", async () => {
    getNearbyReaders.mockResolvedValue([READER]);

    const res = await GET(req("?geohash=u33dc"));
    const body = await res.json();

    expect(body.readers).toHaveLength(1);
    expect(Object.keys(body.readers[0]).sort()).toEqual(
      [
        "avatarUrl",
        "currentlyReading",
        "displayName",
        "geohashPrefix",
        "id",
        "locationLabel",
        "presenceExpiresAt",
        "presenceNote",
        "presenceType",
        "username",
      ].sort()
    );
    expect(JSON.stringify(body)).not.toMatch(/email|unread|is_admin/);
    expect(body.readers[0].geohashPrefix).toBe("u33dc1");
  });

  it("rejects a malformed or too-short geohash without querying", async () => {
    expect((await GET(req("?geohash=u"))).status).toBe(400);
    expect((await GET(req("?geohash=ai!"))).status).toBe(400);
    expect((await GET(req(""))).status).toBe(400);
    expect(getNearbyReaders).not.toHaveBeenCalled();
  });

  it("rate-limits before querying", async () => {
    checkRateLimit.mockResolvedValue({ allowed: false });

    const res = await GET(req("?geohash=u33dc"));

    expect(res.status).toBe(429);
    expect(getNearbyReaders).not.toHaveBeenCalled();
  });

  it("sends no-store cache headers so presence is never cached at the edge", async () => {
    getNearbyReaders.mockResolvedValue([]);

    const res = await GET(req("?geohash=u33dc"));

    expect(res.headers.get("Cache-Control")).toContain("no-store");
  });
});
