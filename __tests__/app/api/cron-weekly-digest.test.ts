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
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
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
