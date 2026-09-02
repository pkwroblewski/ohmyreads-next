// @vitest-environment node
/**
 * One-click digest unsubscribe (Phase 2, Task 9).
 *
 * No session, so the HMAC in `t` is the whole authorization: a wrong or
 * tampered token must change nothing and say so; a right one flips
 * `email_digest_enabled` off for that user, through the service-role client,
 * and answers 200 for GET and for the RFC 8058 POST alike.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { signUnsubscribeToken } from "@/lib/email/unsubscribe-token";

const checkRateLimit = vi.fn();
const update = vi.fn();
const select = vi.fn();
const from = vi.fn();

vi.mock("@/lib/utils/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimit(...args),
  getClientIp: () => "203.0.113.5",
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from }),
}));

vi.mock("@/lib/utils/log", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
  logError: vi.fn(),
}));

const USER = "550e8400-e29b-41d4-a716-446655440000";
const SECRET = "link-key";

async function loadRoute(env: Record<string, string>) {
  vi.resetModules();
  vi.unstubAllEnvs();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  return import("@/app/api/email/unsubscribe/route");
}

function req(params: Record<string, string>, method = "GET"): NextRequest {
  const url = new URL("https://ohmyreads-next.vercel.app/api/email/unsubscribe");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url, { method });
}

beforeEach(() => {
  vi.clearAllMocks();
  checkRateLimit.mockResolvedValue({ allowed: true });
  select.mockResolvedValue({ data: [{ id: USER }], error: null });
  update.mockReturnValue({ eq: () => ({ select }) });
  from.mockReturnValue({ update });
});

describe("GET /api/email/unsubscribe", () => {
  it("turns the digest off for a correctly signed link", async () => {
    const { GET } = await loadRoute({ EMAIL_TOKEN_SECRET: SECRET });

    const response = await GET(req({ u: USER, t: signUnsubscribeToken(USER, SECRET) }));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(await response.text()).toContain("unsubscribed");
    expect(from).toHaveBeenCalledWith("profiles");
    expect(update).toHaveBeenCalledWith({ email_digest_enabled: false });
  });

  it("accepts the RFC 8058 one-click POST too", async () => {
    const { POST } = await loadRoute({ EMAIL_TOKEN_SECRET: SECRET });

    const response = await POST(
      req({ u: USER, t: signUnsubscribeToken(USER, SECRET) }, "POST")
    );

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith({ email_digest_enabled: false });
  });

  it("falls back to CRON_SECRET when EMAIL_TOKEN_SECRET is unset", async () => {
    const { GET } = await loadRoute({ CRON_SECRET: "cron-key" });

    const response = await GET(req({ u: USER, t: signUnsubscribeToken(USER, "cron-key") }));

    expect(response.status).toBe(200);
  });

  it("changes nothing for a wrong signature", async () => {
    const { GET } = await loadRoute({ EMAIL_TOKEN_SECRET: SECRET });

    const response = await GET(req({ u: USER, t: signUnsubscribeToken(USER, "other-key") }));

    expect(response.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it("changes nothing when the token was minted for another user", async () => {
    const { GET } = await loadRoute({ EMAIL_TOKEN_SECRET: SECRET });
    const other = "11111111-1111-4111-8111-111111111111";

    const response = await GET(req({ u: USER, t: signUnsubscribeToken(other, SECRET) }));

    expect(response.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects malformed parameters before touching the database", async () => {
    const { GET } = await loadRoute({ EMAIL_TOKEN_SECRET: SECRET });

    expect((await GET(req({ u: "not-a-uuid", t: "abc" }))).status).toBe(400);
    expect((await GET(req({ u: USER }))).status).toBe(400);
    expect((await GET(req({ u: USER, t: "has spaces!" }))).status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });

  it("does not claim success when no row was updated", async () => {
    const { GET } = await loadRoute({ EMAIL_TOKEN_SECRET: SECRET });
    select.mockResolvedValue({ data: [], error: null });

    const response = await GET(req({ u: USER, t: signUnsubscribeToken(USER, SECRET) }));

    expect(response.status).toBe(400);
  });

  it("refuses to run with no signing secret at all", async () => {
    const { GET } = await loadRoute({});

    const response = await GET(req({ u: USER, t: signUnsubscribeToken(USER, SECRET) }));

    expect(response.status).toBe(503);
    expect(from).not.toHaveBeenCalled();
  });

  it("is rate limited per IP", async () => {
    const { GET } = await loadRoute({ EMAIL_TOKEN_SECRET: SECRET });
    checkRateLimit.mockResolvedValue({ allowed: false });

    const response = await GET(req({ u: USER, t: signUnsubscribeToken(USER, SECRET) }));

    expect(response.status).toBe(429);
    expect(checkRateLimit).toHaveBeenCalledWith("email-unsubscribe:203.0.113.5", 10, 60000);
    expect(from).not.toHaveBeenCalled();
  });
});
