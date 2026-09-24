// @vitest-environment node
/**
 * GET /api/geo/places/enrich.
 *
 * The Google Places key must never reach the browser: the photo is resolved
 * server-side and only the key-free photoUri is returned. The in-memory cache
 * must key on every input, not just the client-supplied osm_id, so a crafted
 * request can't store one business's data under another place.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/utils/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  getClientIp: () => "203.0.113.5",
}));

vi.mock("@/lib/utils/log", () => ({
  logError: vi.fn(),
  logger: { error: vi.fn() },
}));

import { GET } from "@/app/api/geo/places/enrich/route";

const KEY = "AIzaSECRET-test-key";
const PHOTO_URI = "https://lh3.googleusercontent.com/place-photo=s400";

function req(query: string): NextRequest {
  return new NextRequest(
    new URL(`/api/geo/places/enrich${query}`, "https://ohmyreads.com"),
    { headers: { "sec-fetch-site": "same-origin" } }
  );
}

function mockGoogle(displayName: string) {
  const fetchMock = vi.fn(async (url: string) => {
    if (url.includes("places:searchText")) {
      return Response.json({
        places: [
          {
            id: "gp1",
            displayName: { text: displayName },
            photos: [{ name: "places/gp1/photos/ph1" }],
          },
        ],
      });
    }
    return Response.json({ name: "places/gp1/photos/ph1", photoUri: PHOTO_URI });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("GET /api/geo/places/enrich", () => {
  beforeEach(() => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", KEY);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("returns a key-free photoUri and sends the key only as a header", async () => {
    const fetchMock = mockGoogle("Foyles");
    const res = await GET(req("?name=Foyles&lat=51.5142&lng=-0.1300&osm_id=osm-node-1"));
    const text = await res.text();

    expect(text).not.toContain(KEY);
    expect(text).not.toContain("key=");
    expect(JSON.parse(text).photoUrl).toBe(PHOTO_URI);

    const [mediaUrl, init] = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    expect(mediaUrl).toContain("skipHttpRedirect=true");
    expect(mediaUrl).not.toContain(KEY);
    expect((init.headers as Record<string, string>)["X-Goog-Api-Key"]).toBe(KEY);
  });

  it("does not share a cache entry between requests with the same osm_id but a different name", async () => {
    mockGoogle("Real Bookshop");
    await GET(req("?name=Real%20Bookshop&lat=40.1&lng=-3.1&osm_id=osm-node-42"));

    const fetchMock = mockGoogle("Spam Shop");
    const res = await GET(req("?name=Spam%20Shop&lat=40.1&lng=-3.1&osm_id=osm-node-42"));

    expect(res.headers.get("X-Cache")).toBe("MISS");
    expect(fetchMock).toHaveBeenCalled();

    // The original entry is still intact
    const again = await GET(req("?name=Real%20Bookshop&lat=40.1&lng=-3.1&osm_id=osm-node-42"));
    expect(again.headers.get("X-Cache")).toBe("HIT");
    expect((await again.json()).name).toBe("Real Bookshop");
  });

  it("omits the photo when the media lookup fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.includes("places:searchText")
          ? Response.json({ places: [{ id: "gp2", photos: [{ name: "places/gp2/photos/x" }] }] })
          : new Response("denied", { status: 403 })
      )
    );
    const res = await GET(req("?name=Other&lat=10&lng=10&osm_id=osm-node-7"));
    const body = await res.json();
    expect(body.found).toBe(true);
    expect(body.photoUrl).toBeNull();
  });
});
