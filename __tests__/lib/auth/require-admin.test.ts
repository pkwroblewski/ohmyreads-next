/**
 * Tests for the canonical admin gate (Task 26).
 *
 * Every admin action, admin query, admin page and the admin layout now route
 * their authorization through this one module, so these cases stand in for all
 * of them: the gate is only as good as its four outcomes.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const getUser = vi.fn();
const from = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  getUser: () => getUser(),
  createClient: async () => ({ from }),
}));

const logError = vi.fn();
vi.mock("@/lib/utils/log", () => ({
  logError: (...args: unknown[]) => logError(...args),
}));

import { checkAdmin, requireAdmin } from "@/lib/auth/require-admin";

/** Stand in for `.from("profiles").select(...).eq(...).maybeSingle()`. */
function profileReturns(result: {
  data: { is_admin: boolean } | null;
  error?: unknown;
}) {
  from.mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ error: null, ...result }),
  });
}

function signedInAs(id: string | null) {
  getUser.mockResolvedValue({ data: { user: id ? { id } : null } });
}

describe("checkAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects an anonymous caller without touching the database", async () => {
    signedInAs(null);

    const result = await checkAdmin();

    expect(result).toEqual({
      ok: false,
      reason: "unauthenticated",
      error: "Not authenticated",
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects a signed-in non-admin", async () => {
    signedInAs("user-1");
    profileReturns({ data: { is_admin: false } });

    const result = await checkAdmin();

    expect(result).toEqual({
      ok: false,
      reason: "unauthorized",
      error: "Not authorized",
    });
    expect(from).toHaveBeenCalledWith("profiles");
  });

  it("rejects a signed-in user with no profile row", async () => {
    signedInAs("ghost");
    profileReturns({ data: null });

    expect(await checkAdmin()).toMatchObject({
      ok: false,
      reason: "unauthorized",
    });
  });

  it("denies — and logs — when the profile read itself fails", async () => {
    signedInAs("user-1");
    profileReturns({ data: null, error: { code: "57014", message: "timeout" } });

    expect(await checkAdmin()).toMatchObject({
      ok: false,
      reason: "unauthorized",
    });
    expect(logError).toHaveBeenCalled();
  });

  it("admits an admin and hands back their session client", async () => {
    signedInAs("admin-1");
    profileReturns({ data: { is_admin: true } });

    const result = await checkAdmin();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user.id).toBe("admin-1");
      expect(result.supabase).toBeDefined();
    }
  });
});

describe("requireAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws for an anonymous caller", async () => {
    signedInAs(null);

    await expect(requireAdmin()).rejects.toThrow("Not authenticated");
  });

  it("throws for a signed-in non-admin", async () => {
    signedInAs("user-1");
    profileReturns({ data: { is_admin: false } });

    await expect(requireAdmin()).rejects.toThrow("Not authorized");
  });

  it("resolves for an admin", async () => {
    signedInAs("admin-1");
    profileReturns({ data: { is_admin: true } });

    await expect(requireAdmin()).resolves.toMatchObject({
      user: { id: "admin-1" },
    });
  });
});
