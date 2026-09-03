// @vitest-environment node
/**
 * Route-handler tests for the gates added in Tasks 6 and 9 (Task 28).
 *
 * None of the 30 API routes had a test. These cover the three shapes that
 * matter: a route parameter that reaches a PostgREST filter string, and the
 * origin → auth → rate-limit chain in front of the two endpoints that spend
 * money per call (an LLM and a paid maps API). Order is asserted as well as
 * outcome — a cross-site request must be refused *before* anything else runs.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const SITE = "https://ohmyreads-next.vercel.app";

const getUser = vi.fn();
const checkRateLimit = vi.fn();
const getConversationFriend = vi.fn();
const getMessages = vi.fn();
const getMatrix = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser } }),
  getUser: () => getUser(),
  createPublicClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: null }),
          limit: async () => ({ data: [] }),
        }),
        limit: async () => ({ data: [] }),
      }),
    }),
    rpc: async () => ({ data: [] }),
  }),
}));

vi.mock("@/lib/utils/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimit(...args),
  getClientIp: () => "203.0.113.5",
}));

vi.mock("@/lib/queries/messages", () => ({
  getConversationFriend: (...args: unknown[]) => getConversationFriend(...args),
  getMessages: (...args: unknown[]) => getMessages(...args),
}));

// curated-picks pulls these in at module scope; the gate tests never reach them.
vi.mock("ai", () => ({ generateObject: vi.fn() }));
vi.mock("@ai-sdk/google", () => ({ google: () => ({}) }));
vi.mock("next/cache", () => ({
  unstable_cache: (fn: unknown) => fn,
  revalidateTag: vi.fn(),
  updateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/services/mapbox-mcp", () => ({
  getMatrix: (...args: unknown[]) => getMatrix(...args),
  isMcpConfigured: () => false,
}));

import { GET as messagesGET } from "@/app/api/messages/[friendId]/route";
import { GET as curatedPicksGET } from "@/app/api/ai/curated-picks/route";
import { GET as nearbyPlacesGET } from "@/app/api/geo/nearby-places/route";

// A same-origin fetch from one of our own pages. `isForeignOrigin` refuses
// requests with no origin information at all, so the default carries the
// browser's fetch metadata; the cross-site cases override it.
function req(path: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(new URL(path, SITE), {
    headers: { "sec-fetch-site": "same-origin", ...headers },
  });
}

function signedIn(id = "user-1") {
  getUser.mockResolvedValue({ data: { user: { id } } });
}

function signedOut() {
  getUser.mockResolvedValue({ data: { user: null } });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", SITE);
  checkRateLimit.mockResolvedValue({ allowed: true, remaining: 9 });
});

describe("GET /api/messages/[friendId]", () => {
  const params = (friendId: string) => ({ params: Promise.resolve({ friendId }) });
  const VALID_ID = "550e8400-e29b-41d4-a716-446655440000";

  it("requires a session before looking at the parameter at all", async () => {
    signedOut();

    const response = await messagesGET(req("/api/messages/x"), params("x"));

    expect(response.status).toBe(401);
    expect(getConversationFriend).not.toHaveBeenCalled();
  });

  it("rejects a friendId that is not a UUID", async () => {
    signedIn();

    const response = await messagesGET(
      req(`/api/messages/${VALID_ID}`),
      params("not-a-uuid")
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid friend ID" });
  });

  it("rejects the characters that are structural in a PostgREST filter", async () => {
    signedIn();

    // This value is interpolated into an `.or()` string downstream, where
    // `.` `,` `(` `)` change the meaning of the filter. A UUID cannot contain
    // them, so the shape check is what closes the injection path — each of
    // these must be refused before it reaches the query.
    const payloads = [
      `${VALID_ID},is.null`,
      `${VALID_ID}.eq.x`,
      `${VALID_ID})`,
      "*",
      `${VALID_ID} or true`,
    ];

    for (const payload of payloads) {
      const response = await messagesGET(
        req(`/api/messages/${VALID_ID}`),
        params(payload)
      );

      expect(response.status, payload).toBe(400);
    }

    expect(getConversationFriend).not.toHaveBeenCalled();
  });

  it("accepts the nil UUID, which the shape check is not meant to catch", async () => {
    signedIn();
    getConversationFriend.mockResolvedValue(null);

    // `z.string().uuid()` in zod 4.1.13 accepts `00000000-...`; only
    // `z.uuidv4()` rejects it. That is fine here — the schema exists to keep
    // filter metacharacters out, and a nil UUID simply matches no friend. This
    // pins the behaviour so nobody later assumes the shape check does more.
    const response = await messagesGET(
      req(`/api/messages/${VALID_ID}`),
      params("00000000-0000-0000-0000-000000000000")
    );

    expect(response.status).toBe(404);
  });

  it("returns 404 when the id is well-formed but not a friend", async () => {
    signedIn();
    getConversationFriend.mockResolvedValue(null);

    const response = await messagesGET(
      req(`/api/messages/${VALID_ID}`),
      params(VALID_ID)
    );

    expect(response.status).toBe(404);
    expect(getMessages).not.toHaveBeenCalled();
  });

  it("returns the conversation for a real friend", async () => {
    signedIn();
    getConversationFriend.mockResolvedValue({ id: VALID_ID, username: "ada" });
    getMessages.mockResolvedValue({ messages: [{ id: "m1" }] });

    const response = await messagesGET(
      req(`/api/messages/${VALID_ID}`),
      params(VALID_ID)
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      friend: { id: VALID_ID, username: "ada" },
      messages: [{ id: "m1" }],
    });
  });
});

describe("GET /api/ai/curated-picks", () => {
  it("refuses a cross-site request before checking the session", async () => {
    signedIn();

    const response = await curatedPicksGET(
      req("/api/ai/curated-picks", { origin: "https://evil.example" })
    );

    expect(response.status).toBe(403);
    // Ordering matters: the point of this gate is that a foreign page cannot
    // make the endpoint do any work, session or not.
    expect(getUser).not.toHaveBeenCalled();
    expect(checkRateLimit).not.toHaveBeenCalled();
  });

  it("refuses an anonymous caller — this endpoint spends LLM tokens", async () => {
    signedOut();

    const response = await curatedPicksGET(req("/api/ai/curated-picks"));

    expect(response.status).toBe(401);
    expect(checkRateLimit).not.toHaveBeenCalled();
  });

  it("rate-limits per user, not per IP", async () => {
    signedIn("user-42");
    checkRateLimit.mockResolvedValue({ allowed: false });

    const response = await curatedPicksGET(req("/api/ai/curated-picks"));

    expect(response.status).toBe(429);
    expect(checkRateLimit).toHaveBeenCalledWith("ai-curated:user-42", 20, 60000);
  });
});

describe("GET /api/geo/nearby-places", () => {
  it("refuses a cross-site request before doing anything else", async () => {
    signedIn();

    const response = await nearbyPlacesGET(
      req("/api/geo/nearby-places?lat=51.5&lng=-0.12", {
        origin: "https://evil.example",
      })
    );

    expect(response.status).toBe(403);
    expect(getUser).not.toHaveBeenCalled();
  });

  it("refuses an anonymous caller — this endpoint proxies a paid API", async () => {
    signedOut();

    const response = await nearbyPlacesGET(
      req("/api/geo/nearby-places?lat=51.5&lng=-0.12")
    );

    expect(response.status).toBe(401);
    expect(checkRateLimit).not.toHaveBeenCalled();
  });

  it("rate-limits per user", async () => {
    signedIn("user-7");
    checkRateLimit.mockResolvedValue({ allowed: false });

    const response = await nearbyPlacesGET(
      req("/api/geo/nearby-places?lat=51.5&lng=-0.12")
    );

    expect(response.status).toBe(429);
    expect(checkRateLimit).toHaveBeenCalledWith("geo-nearby:user-7", 30, 60000);
    expect(getMatrix).not.toHaveBeenCalled();
  });

  it("rejects coordinates that are missing or not numbers", async () => {
    signedIn();

    for (const query of ["", "?lat=51.5", "?lng=-0.12", "?lat=abc&lng=-0.12"]) {
      const response = await nearbyPlacesGET(
        req(`/api/geo/nearby-places${query}`)
      );

      expect(response.status, query).toBe(400);
      expect(getMatrix).not.toHaveBeenCalled();
    }
  });

  it("lets a same-origin signed-in request through the gates", async () => {
    signedIn();

    const response = await nearbyPlacesGET(
      req("/api/geo/nearby-places?lat=51.5&lng=-0.12", { origin: SITE })
    );

    expect(response.status).not.toBe(403);
    expect(response.status).not.toBe(401);
    expect(response.status).not.toBe(429);
    expect(checkRateLimit).toHaveBeenCalled();
  });
});
