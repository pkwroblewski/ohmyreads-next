// @vitest-environment node
/**
 * Tests for the weekly-digest cron gate (Phase 2, Task 5).
 *
 * The secret used to be compared with `!==`, unlike the webhook and seed
 * routes. `CRON_SECRET` is read at module load, so each case re-imports.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const safeCompare = vi.fn();
const getResendClient = vi.fn();
const createAdminClient = vi.fn();
const sendEmail = vi.fn();

vi.mock("@/lib/utils/secrets", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/utils/secrets")>();
  return {
    safeCompare: (...args: [string | null, string | null]) => {
      safeCompare(...args);
      return actual.safeCompare(...args);
    },
  };
});
vi.mock("@/lib/email/resend", () => ({
  getResendClient: () => getResendClient(),
  FROM_EMAIL: "OhMyReads <hello@ohmyreads.com>",
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => createAdminClient(),
}));
vi.mock("@/lib/utils/log", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

async function loadRoute(secret: string) {
  vi.resetModules();
  vi.stubEnv("CRON_SECRET", secret);
  return import("@/app/api/cron/weekly-digest/route");
}

function req(authorization?: string): NextRequest {
  return new NextRequest("https://ohmyreads-next.vercel.app/api/cron/weekly-digest", {
    headers: authorization ? { authorization } : {},
  });
}

const USER = "550e8400-e29b-41d4-a716-446655440000";

/**
 * A query builder where every method chains and awaiting resolves to `result`.
 * The route touches seven tables per user; only the profiles list matters
 * here, so everything else answers "nothing".
 */
function chain(result: unknown, calls: Array<[string, unknown[]]> = []) {
  const target = {
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  return new Proxy(target, {
    get(t, prop: string) {
      if (prop === "then") return t.then;
      return (...args: unknown[]) => {
        calls.push([prop, args]);
        return chain(result, calls);
      };
    },
  });
}

/** Wire a service-role client with one digest-enabled user. */
function arrangeSend() {
  const profileCalls: Array<[string, unknown[]]> = [];
  const from = vi.fn((table: string) =>
    table === "profiles"
      ? chain(
          { data: [{ id: USER, username: "ada", display_name: null }], error: null },
          profileCalls
        )
      : // `.single()` answers null when there is no row; lists answer `[] || null`
        // identically in the route, so null covers both.
        chain({ data: null, error: null })
  );
  createAdminClient.mockReturnValue({
    from,
    auth: {
      admin: {
        getUserById: vi.fn().mockResolvedValue({ data: { user: { email: "ada@example.com" } } }),
      },
    },
  });
  sendEmail.mockResolvedValue({ data: { id: "email-1" }, error: null });
  getResendClient.mockReturnValue({ emails: { send: sendEmail } });
  return { profileCalls };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  // Stop the route before it does any work: no email client configured.
  getResendClient.mockReturnValue(null);
});

describe("GET /api/cron/weekly-digest", () => {
  it("refuses to run when no secret is configured", async () => {
    const { GET } = await loadRoute("");

    const response = await GET(req("Bearer anything"));

    expect(response.status).toBe(503);
  });

  it("rejects a wrong or missing bearer token", async () => {
    const { GET } = await loadRoute("s3cret");

    expect((await GET(req("Bearer s3cre"))).status).toBe(401);
    expect((await GET(req("Bearer s3cret-extra"))).status).toBe(401);
    expect((await GET(req())).status).toBe(401);
    expect(getResendClient).not.toHaveBeenCalled();
  });

  it("compares the token in constant time and proceeds when it matches", async () => {
    const { GET } = await loadRoute("s3cret");

    const response = await GET(req("Bearer s3cret"));

    expect(safeCompare).toHaveBeenCalledWith("Bearer s3cret", "Bearer s3cret");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      message: "Email service not configured",
    });
  });
});

describe("GET /api/cron/weekly-digest — the send (Task 9)", () => {
  it("skips disabled accounts and sends with a signed unsubscribe link and headers", async () => {
    const { profileCalls } = arrangeSend();
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://ohmyreads-next.vercel.app");
    const { GET } = await loadRoute("s3cret");
    const { signUnsubscribeToken } = await import("@/lib/email/unsubscribe-token");

    const response = await GET(req("Bearer s3cret"));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ sent: 1, errors: 0, total: 1 });

    // Task 7: nobody who is disabled gets mail.
    expect(profileCalls).toContainEqual(["is", ["disabled_at", null]]);
    expect(profileCalls).toContainEqual(["eq", ["email_digest_enabled", true]]);

    const expectedUrl = `https://ohmyreads-next.vercel.app/api/email/unsubscribe?u=${USER}&t=${signUnsubscribeToken(USER, "s3cret")}`;
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const sent = sendEmail.mock.calls[0][0];
    expect(sent.to).toBe("ada@example.com");
    expect(sent.headers).toEqual({
      "List-Unsubscribe": `<${expectedUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
    expect(sent.html).toContain(expectedUrl.replace(/&/g, "&amp;"));
    expect(sent.text).toContain(expectedUrl);
    expect(sent.html).not.toContain("settings?unsubscribe=digest");
  });

  it("keeps going when one recipient fails and counts it (Task 21, T5)", async () => {
    // Two digest-enabled users; the email lookup throws for the first, so the
    // loop must isolate that failure and still send to the second.
    const from = vi.fn((table: string) =>
      table === "profiles"
        ? chain({
            data: [
              { id: USER, username: "ada", display_name: null },
              { id: "550e8400-e29b-41d4-a716-446655440001", username: "bob", display_name: null },
            ],
            error: null,
          })
        : chain({ data: null, error: null })
    );
    const getUserById = vi
      .fn()
      .mockRejectedValueOnce(new Error("auth admin unavailable"))
      .mockResolvedValueOnce({ data: { user: { email: "bob@example.com" } } });
    createAdminClient.mockReturnValue({ from, auth: { admin: { getUserById } } });
    sendEmail.mockResolvedValue({ data: { id: "email-1" }, error: null });
    getResendClient.mockReturnValue({ emails: { send: sendEmail } });
    const route = await loadRoute("cron-secret");

    const response = await route.GET(req("Bearer cron-secret"));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ sent: 1, errors: 1, total: 2 });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0].to).toBe("bob@example.com");
  });

  it("prefers EMAIL_TOKEN_SECRET over CRON_SECRET for the link", async () => {
    arrangeSend();
    vi.stubEnv("EMAIL_TOKEN_SECRET", "link-key");
    const { GET } = await loadRoute("s3cret");
    const { signUnsubscribeToken } = await import("@/lib/email/unsubscribe-token");

    await GET(req("Bearer s3cret"));

    const sent = sendEmail.mock.calls[0][0];
    expect(sent.headers["List-Unsubscribe"]).toContain(
      `t=${signUnsubscribeToken(USER, "link-key")}`
    );
  });
});
