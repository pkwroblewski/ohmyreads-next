// @vitest-environment node
/**
 * POST /api/webhooks/supabase (Phase 2, Task 21, T4).
 *
 * The shared secret is compared in constant time; in production a missing
 * secret fails closed; a wrong or absent header never reaches the admin
 * client; only a public.profiles INSERT triggers the welcome email.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const { getUserById, sendWelcomeEmail, logger, safeCompare } = vi.hoisted(() => ({
  getUserById: vi.fn(),
  sendWelcomeEmail: vi.fn(),
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
  safeCompare: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ auth: { admin: { getUserById } } }),
}));
vi.mock("@/lib/actions/email", () => ({ sendWelcomeEmail }));
vi.mock("@/lib/utils/log", () => ({ logger, logError: vi.fn() }));
vi.mock("@/lib/utils/secrets", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/utils/secrets")>();
  safeCompare.mockImplementation(real.safeCompare);
  return { safeCompare: (a: unknown, b: unknown) => safeCompare(a, b) };
});

import { POST } from "@/app/api/webhooks/supabase/route";

const USER = "550e8400-e29b-41d4-a716-446655440000";
const PROFILE_INSERT = {
  type: "INSERT",
  table: "profiles",
  schema: "public",
  record: { id: USER, username: "ada", display_name: "Ada" },
  old_record: null,
};

function post(body: unknown, secret?: string) {
  return new NextRequest("https://ohmyreads.example/api/webhooks/supabase", {
    method: "POST",
    headers: { "content-type": "application/json", ...(secret !== undefined ? { "x-webhook-secret": secret } : {}) },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SUPABASE_WEBHOOK_SECRET", "s3cret");
  getUserById.mockResolvedValue({ data: { user: { email: "ada@example.com" } } });
  sendWelcomeEmail.mockResolvedValue({ success: true });
});

afterEach(() => vi.unstubAllEnvs());

describe("POST /api/webhooks/supabase", () => {
  it("rejects a wrong secret without touching the admin client", async () => {
    const res = await POST(post(PROFILE_INSERT, "nope"));
    expect(res.status).toBe(401);
    expect(safeCompare).toHaveBeenCalledWith("nope", "s3cret");
    expect(getUserById).not.toHaveBeenCalled();
    expect(sendWelcomeEmail).not.toHaveBeenCalled();
  });

  it("rejects a missing header (safeCompare gets null and does not throw)", async () => {
    const res = await POST(post(PROFILE_INSERT));
    expect(res.status).toBe(401);
    expect(safeCompare).toHaveBeenCalledWith(null, "s3cret");
    expect(getUserById).not.toHaveBeenCalled();
  });

  it("fails closed in production when no secret is configured", async () => {
    vi.stubEnv("SUPABASE_WEBHOOK_SECRET", "");
    vi.stubEnv("NODE_ENV", "production");
    const res = await POST(post(PROFILE_INSERT, "anything"));
    expect(res.status).toBe(401);
    expect(logger.error).toHaveBeenCalledWith(expect.stringMatching(/not configured in production/));
    expect(getUserById).not.toHaveBeenCalled();
  });

  it("allows an unconfigured secret outside production, with a warning", async () => {
    vi.stubEnv("SUPABASE_WEBHOOK_SECRET", "");
    vi.stubEnv("NODE_ENV", "development");
    const res = await POST(post(PROFILE_INSERT));
    expect(res.status).toBe(200);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringMatching(/dev mode/));
    expect(sendWelcomeEmail).toHaveBeenCalledTimes(1);
  });

  it("sends the welcome email for a new public profile with the right secret", async () => {
    const res = await POST(post(PROFILE_INSERT, "s3cret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(getUserById).toHaveBeenCalledWith(USER);
    expect(sendWelcomeEmail).toHaveBeenCalledWith({
      email: "ada@example.com",
      username: "ada",
      displayName: "Ada",
    });
  });

  it("ignores other events and profiles without a username or email", async () => {
    expect((await POST(post({ ...PROFILE_INSERT, type: "UPDATE" }, "s3cret"))).status).toBe(200);
    expect((await POST(post({ ...PROFILE_INSERT, table: "reviews" }, "s3cret"))).status).toBe(200);
    expect(getUserById).not.toHaveBeenCalled();

    await POST(post({ ...PROFILE_INSERT, record: { id: USER, username: null } }, "s3cret"));
    expect(sendWelcomeEmail).not.toHaveBeenCalled();

    getUserById.mockResolvedValue({ data: { user: { email: null } } });
    await POST(post(PROFILE_INSERT, "s3cret"));
    expect(sendWelcomeEmail).not.toHaveBeenCalled();
  });

  it("answers 200 even when the email provider fails, and 500 on a malformed body", async () => {
    sendWelcomeEmail.mockResolvedValue({ success: false, error: "resend down" });
    expect((await POST(post(PROFILE_INSERT, "s3cret"))).status).toBe(200);

    const bad = new NextRequest("https://ohmyreads.example/api/webhooks/supabase", {
      method: "POST",
      headers: { "x-webhook-secret": "s3cret" },
      body: "not json",
    });
    expect((await POST(bad)).status).toBe(500);
  });
});
